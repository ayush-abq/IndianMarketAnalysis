import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { corporateActions, dataIngestionRuns, stocks } from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { addCalendarDays } from "@/calculations/trading-days";
import { expectedDataDate, isNseTradingDay, tradingDaysBetween } from "@/services/calendar";
import { fetchOfficialBookClosures, type ParsedCorporateAction } from "@/providers/nse-corporate-actions";
import { computeStockScores } from "@/services/stock-metrics";

export async function runCorporateActionIngestion(
  mode: "daily" | "backfill" | "manual" = "daily",
  opts: { from?: string } = {},
) {
  const asOf = await expectedDataDate();
  const db = getDb();
  if (mode === "daily" && !(await isNseTradingDay(asOf))) {
    return { status: "market_closed" as const, asOf };
  }

  const start = opts.from || env().NSE_HISTORICAL_START;
  const key = mode === "backfill" ? `ca:backfill:${start}:${asOf}` : `ca:${mode}:${asOf}`;
  if (mode !== "manual" && mode !== "backfill") {
    const existing = await db
      .select()
      .from(dataIngestionRuns)
      .where(and(eq(dataIngestionRuns.jobKey, key), eq(dataIngestionRuns.status, "success")));
    if (existing.length) return { status: "skipped" as const, asOf, key };
  }

  const [run] = await db
    .insert(dataIngestionRuns)
    .values({ provider: "NSE_OFFICIAL_PR_BC", status: "running", jobKey: key })
    .returning();

  try {
    const days =
      mode === "backfill" ? await caBackfillDays(start, asOf) : [asOf];
    const have = mode === "backfill" ? await ingestedCaDays() : new Set<string>();
    let downloaded = 0;
    let inserted = 0;
    let skipped = 0;
    let missing = 0;
    let failed = 0;

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (have.has(day)) {
        skipped += 1;
        continue;
      }
      try {
        const file = await fetchOfficialBookClosures(day);
        if (!file.ok) {
          missing += 1;
          continue;
        }
        const persisted = await persistCorporateActions(file.rows, day);
        downloaded += file.rows.length;
        inserted += persisted.upserted;
        have.add(day);
        if ((i + 1) % 20 === 0 || i === days.length - 1) {
          logger.info(
            { day, i: i + 1, of: days.length, rows: file.rows.length },
            "Official PR book-closure progress",
          );
        }
      } catch (err) {
        failed += 1;
        logger.warn({ err, day }, "Official PR book-closure failed — skipping day");
      }
    }

    const adjusted = await applyOfficialAdjustments();
    const computed = adjusted.stockIds.length
      ? await computeStockScores(asOf, { stockIds: adjusted.stockIds })
      : { computed: 0 };

    await db
      .update(dataIngestionRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        recordsDownloaded: downloaded,
        recordsInserted: inserted,
        recordsUpdated: adjusted.updated,
        details: { downloaded, inserted, skipped, missing, failed, days: days.length, adjusted, computed },
      })
      .where(eq(dataIngestionRuns.id, run.id));

    return {
      status: "success" as const,
      asOf,
      start,
      downloaded,
      inserted,
      skipped,
      missing,
      failed,
      days: days.length,
      adjusted,
      computed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Corporate-action ingest failed");
    await db
      .update(dataIngestionRuns)
      .set({ status: "failed", completedAt: new Date(), errorMessage: message })
      .where(eq(dataIngestionRuns.id, run.id));
    return { status: "failed" as const, asOf, error: message };
  }
}

async function caBackfillDays(start: string, asOf: string) {
  const all = await tradingDaysBetween(start, asOf);
  const recentFrom = addCalendarDays(asOf, -90);
  return all.filter((day, i) => day >= recentFrom || i % 5 === 0);
}

async function ingestedCaDays() {
  const db = getDb();
  const rows = await db
    .selectDistinct({ date: corporateActions.sourceDate })
    .from(corporateActions);
  return new Set(rows.map((r) => r.date).filter((d): d is string => Boolean(d)));
}

async function persistCorporateActions(rows: ParsedCorporateAction[], sourceDate: string) {
  const db = getDb();
  const listed = await db.select({ id: stocks.id, symbol: stocks.symbol, series: stocks.series }).from(stocks);
  const byKey = new Map(listed.map((s) => [`${s.symbol}|${s.series}`, s.id]));
  const bySymbol = new Map<string, number>();
  for (const s of listed) {
    if (s.series === "EQ" || !bySymbol.has(s.symbol)) bySymbol.set(s.symbol, s.id);
  }

  const values = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const stockId = byKey.get(`${row.symbol}|${row.series}`) ?? bySymbol.get(row.symbol);
    if (!stockId) continue;
    const key = `${stockId}|${row.date}|${row.actionType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    values.push({
      stockId,
      date: row.date,
      actionType: row.actionType,
      ratio: row.ratio,
      factor: row.factor != null ? String(row.factor) : null,
      source: "NSE_PR_BC",
      sourceDate,
    });
  }

  let upserted = 0;
  for (let i = 0; i < values.length; i += 300) {
    const chunk = values.slice(i, i + 300);
    await db
      .insert(corporateActions)
      .values(chunk)
      .onConflictDoUpdate({
        target: [corporateActions.stockId, corporateActions.date, corporateActions.actionType],
        set: {
          ratio: sql`excluded.ratio`,
          factor: sql`excluded.factor`,
          source: sql`excluded.source`,
          sourceDate: sql`excluded.source_date`,
        },
      });
    upserted += chunk.length;
  }
  return { upserted };
}

export async function applyOfficialAdjustments() {
  const db = getDb();
  const touched = await db.execute(sql`
    UPDATE stock_prices p
    SET adjusted_close = ROUND(
      (p.close::float8 * COALESCE((
        SELECT EXP(SUM(LN(c.factor::float8)))
        FROM corporate_actions c
        WHERE c.stock_id = p.stock_id
          AND c.date > p.date
          AND c.factor IS NOT NULL
          AND c.action_type IN ('SPLIT', 'BONUS')
          AND c.factor::float8 > 0
      ), 1))::numeric,
      4
    )
    WHERE p.stock_id IN (
      SELECT DISTINCT stock_id FROM corporate_actions
      WHERE factor IS NOT NULL AND action_type IN ('SPLIT', 'BONUS')
    )
  `);
  const ids = await db
    .selectDistinct({ stockId: corporateActions.stockId })
    .from(corporateActions)
    .where(sql`${corporateActions.factor} is not null`);
  return {
    updated: Number((touched as { count?: number }).count ?? 0),
    stockIds: ids.map((r) => r.stockId),
  };
}

export async function loadStockCorporateActions(stockId: number, limit = 12) {
  const db = getDb();
  return db
    .select()
    .from(corporateActions)
    .where(eq(corporateActions.stockId, stockId))
    .orderBy(desc(corporateActions.date))
    .limit(limit);
}
