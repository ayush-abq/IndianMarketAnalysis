import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dataIngestionRuns, stockPrices, stocks } from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { fetchOfficialBhavcopy, type BhavRow } from "@/providers/nse-bhavcopy";
import { fetchOfficialConstituents, OFFICIAL_INDEX_LISTS } from "@/providers/nse-constituents";
import { fetchEquityFundamentals } from "@/providers/equity-fundamentals";
import { computeStockScores } from "@/services/stock-metrics";
import { runCorporateActionIngestion } from "@/services/corporate-actions";
import { expectedDataDate, isNseTradingDay, tradingDaysBetween } from "@/services/calendar";

const PRICE_CHUNK = 400;
const COMPLETE_DAY_MIN_ROWS = 500;

export async function runStockIngestion(
  mode: "daily" | "backfill" | "manual" = "daily",
  opts: { from?: string } = {},
) {
  const asOf = await expectedDataDate();
  const db = getDb();
  const trading = await isNseTradingDay(asOf);
  if (!trading && mode === "daily") {
    return { status: "market_closed" as const, asOf };
  }

  const start = opts.from || env().STOCK_HISTORICAL_START;
  const key = mode === "backfill" ? `stocks:backfill:${start}:${asOf}` : `stocks:${mode}:${asOf}`;
  if (mode !== "manual" && mode !== "backfill") {
    const existing = await db
      .select()
      .from(dataIngestionRuns)
      .where(and(eq(dataIngestionRuns.jobKey, key), eq(dataIngestionRuns.status, "success")));
    if (existing.length) {
      return { status: "skipped" as const, asOf, key };
    }
  }

  const [run] = await db
    .insert(dataIngestionRuns)
    .values({
      provider: "NSE_OFFICIAL_BHAVCOPY",
      status: "running",
      jobKey: key,
    })
    .returning();

  try {
    const membership = await refreshIndexMemberships();

    if (mode === "backfill") {
      const hist = await backfillOfficialBhav(start, asOf);
      const computed = await computeStockScores(asOf);
      await db
        .update(dataIngestionRuns)
        .set({
          status: "success",
          completedAt: new Date(),
          recordsDownloaded: hist.downloaded,
          recordsInserted: hist.inserted,
          recordsUpdated: hist.updated,
          details: { membership, ...hist, computed },
        })
        .where(eq(dataIngestionRuns.id, run.id));
      return {
        status: "success" as const,
        asOf,
        start,
        ...hist,
        membership,
        computed,
      };
    }

    const bhav = await fetchOfficialBhavcopy(asOf);
    if (!bhav.ok) {
      logger.warn({ asOf, status: bhav.status }, "Official bhavcopy unavailable — last stock prices retained");
      await db
        .update(dataIngestionRuns)
        .set({
          status: bhav.status === 404 ? "market_closed" : "failed",
          completedAt: new Date(),
          errorMessage: `Bhavcopy HTTP ${bhav.status}`,
          details: { membership },
        })
        .where(eq(dataIngestionRuns.id, run.id));
      return { status: "failed" as const, asOf, error: `Bhavcopy HTTP ${bhav.status}` };
    }

    const persisted = await persistBhavRows(bhav.rows, asOf);
    const fundamentals = await fetchEquityFundamentals(bhav.rows.map((r) => r.symbol));
    const actions = await runCorporateActionIngestion("manual").catch((err) => {
      logger.warn({ err }, "Official PR corporate actions skipped");
      return { status: "failed" as const };
    });
    const computed = await computeStockScores(asOf);

    await db
      .update(dataIngestionRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        recordsDownloaded: bhav.rows.length,
        recordsInserted: persisted.inserted,
        recordsUpdated: persisted.updated,
        details: { membership, fundamentals: fundamentals.limitation, computed, actions, source: bhav.source },
      })
      .where(eq(dataIngestionRuns.id, run.id));

    return {
      status: "success" as const,
      asOf,
      rows: bhav.rows.length,
      membership,
      fundamentals: fundamentals.limitation,
      computed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, asOf }, "Stock ingestion failed — previous prices retained");
    await db
      .update(dataIngestionRuns)
      .set({ status: "failed", completedAt: new Date(), errorMessage: message })
      .where(eq(dataIngestionRuns.id, run.id));
    return { status: "failed" as const, asOf, error: message };
  }
}

async function backfillOfficialBhav(start: string, asOf: string) {
  const days = await tradingDaysBetween(start, asOf);
  const have = await datesWithPrices();
  logger.info({ start, asOf, days: days.length, already: have.size }, "Starting official bhavcopy historical backfill");

  let downloaded = 0;
  let inserted = 0;
  let updated = 0;
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
      const bhav = await fetchOfficialBhavcopy(day);
      if (!bhav.ok || !bhav.rows.length) {
        missing += 1;
        logger.warn({ day, status: bhav.status }, "Official bhavcopy missing — skipping day");
        continue;
      }
      const persisted = await persistBhavRows(bhav.rows, day);
      downloaded += bhav.rows.length;
      inserted += persisted.inserted;
      updated += persisted.updated;
      have.add(day);
      if ((i + 1) % 20 === 0 || i === days.length - 1) {
        logger.info(
          { day, i: i + 1, of: days.length, rows: bhav.rows.length, source: bhav.source },
          "Official bhavcopy backfill progress",
        );
      }
    } catch (err) {
      failed += 1;
      logger.warn({ err, day }, "Official bhavcopy failed — skipping day");
    }
  }

  return { downloaded, inserted, updated, skipped, missing, failed, days: days.length };
}

async function datesWithPrices(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({
      date: stockPrices.date,
      n: sql<number>`count(*)::int`,
    })
    .from(stockPrices)
    .groupBy(stockPrices.date);
  return new Set(rows.filter((r) => Number(r.n) >= COMPLETE_DAY_MIN_ROWS).map((r) => r.date));
}

async function persistBhavRows(rows: BhavRow[], fallbackDate: string) {
  const ids = await ensureStockIds(rows);
  const values = rows
    .map((row) => {
      const stockId = ids.get(`${row.symbol}|${row.series}`);
      if (!stockId) return null;
      const date = row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : fallbackDate;
      return {
        stockId,
        date,
        open: row.open != null ? String(row.open) : null,
        high: row.high != null ? String(row.high) : null,
        low: row.low != null ? String(row.low) : null,
        close: String(row.close),
        adjustedClose: String(row.close),
        volume: row.volume != null ? String(row.volume) : null,
        deliveryVolume: row.deliveryVolume != null ? String(row.deliveryVolume) : null,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v != null);

  const db = getDb();
  let inserted = 0;
  for (let i = 0; i < values.length; i += PRICE_CHUNK) {
    const chunk = values.slice(i, i + PRICE_CHUNK);
    await db
      .insert(stockPrices)
      .values(chunk)
      .onConflictDoUpdate({
        target: [stockPrices.stockId, stockPrices.date],
        set: {
          open: sql`excluded.open`,
          high: sql`excluded.high`,
          low: sql`excluded.low`,
          close: sql`excluded.close`,
          volume: sql`excluded.volume`,
          deliveryVolume: sql`excluded.delivery_volume`,
        },
      });
    inserted += chunk.length;
  }
  return { inserted, updated: inserted };
}

async function ensureStockIds(rows: BhavRow[]) {
  const db = getDb();
  const existing = await db.select({ id: stocks.id, symbol: stocks.symbol, series: stocks.series }).from(stocks);
  const ids = new Map(existing.map((s) => [`${s.symbol}|${s.series}`, s.id]));
  const missing: { symbol: string; series: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.symbol}|${row.series}`;
    if (ids.has(key) || seen.has(key)) continue;
    seen.add(key);
    missing.push({ symbol: row.symbol, series: row.series });
  }
  if (missing.length) {
    await db
      .insert(stocks)
      .values(missing.map((m) => ({ symbol: m.symbol, series: m.series, exchange: "NSE" as const })))
      .onConflictDoNothing();
    const again = await db.select({ id: stocks.id, symbol: stocks.symbol, series: stocks.series }).from(stocks);
    for (const s of again) ids.set(`${s.symbol}|${s.series}`, s.id);
  }
  return ids;
}

async function upsertStock(symbol: string, series: string, companyName: string | null, isin: string | null) {
  const db = getDb();
  const existing = await db
    .select()
    .from(stocks)
    .where(and(eq(stocks.symbol, symbol), eq(stocks.series, series)))
    .limit(1);
  if (existing[0]) {
    if (companyName || isin) {
      await db
        .update(stocks)
        .set({
          companyName: companyName ?? existing[0].companyName,
          isin: isin ?? existing[0].isin,
          updatedAt: new Date(),
        })
        .where(eq(stocks.id, existing[0].id));
    }
    return existing[0].id;
  }
  const [row] = await db
    .insert(stocks)
    .values({ symbol, series, companyName, isin, exchange: "NSE" })
    .returning();
  return row.id;
}

export async function refreshIndexMemberships() {
  const { rows, failed } = await fetchOfficialConstituents();
  const bySymbol = new Map<string, typeof rows>();
  for (const row of rows) {
    const arr = bySymbol.get(row.symbol) ?? [];
    arr.push(row);
    bySymbol.set(row.symbol, arr);
  }
  const capOf = (indexes: string[]) => {
    if (indexes.includes("NIFTY50") || indexes.includes("NIFTY100")) return "LARGE";
    if (indexes.includes("NIFTY_MIDCAP_150")) return "MID";
    if (indexes.includes("NIFTY_SMALLCAP_250")) return "SMALL";
    return null;
  };
  for (const [symbol, memberships] of bySymbol) {
    const first = memberships[0];
    const id = await upsertStock(symbol, first.series || "EQ", first.companyName, first.isin);
    const db = getDb();
    await db
      .update(stocks)
      .set({
        companyName: first.companyName,
        isin: first.isin,
        industry: first.industry,
        sector: first.industry,
        indexMemberships: memberships.map((m) => m.index),
        marketCapCategory: capOf(memberships.map((m) => m.index)),
        active: true,
        updatedAt: new Date(),
      })
      .where(eq(stocks.id, id));
  }
  return { symbols: bySymbol.size, lists: OFFICIAL_INDEX_LISTS.length, failed };
}
