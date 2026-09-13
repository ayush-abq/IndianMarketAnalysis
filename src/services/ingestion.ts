import { and, eq, sql } from "drizzle-orm";
import { INDEX_UNIVERSE } from "@/config/universe";
import { getDb } from "@/db/client";
import {
  dataIngestionRuns,
  dataQualityFlags,
  indexPrices,
  indices,
} from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { canonicalName, normalizeIndexName } from "@/providers/nse-csv";
import { createMarketDataProvider } from "@/providers";
import type { ProviderBar } from "@/providers/types";
import { NseOfficialEodProvider } from "@/providers/nse-official-eod";
import { validateBars } from "@/services/data-quality";
import { jobKeyFor } from "@/services/ingestion-key";
import { expectedDataDate, isNseTradingDay, previousTradingDay, tradingDaysBetween } from "@/services/calendar";
import { recomputeAll } from "@/services/metrics";
import { generateDailyAlerts } from "@/services/alerts";
import { writeDailySnapshots } from "@/services/snapshots";
import { generateDailyReport } from "@/services/report";

export type IngestMode = "daily" | "backfill" | "manual";

export async function runIngestion(mode: IngestMode = "daily") {
  const asOf = await expectedDataDate();
  const key = jobKeyFor(asOf, mode);
  const db = getDb();

  const existing = await db
    .select()
    .from(dataIngestionRuns)
    .where(and(eq(dataIngestionRuns.jobKey, key), eq(dataIngestionRuns.status, "success")));
  if (existing.length && mode !== "manual") {
    logger.info({ key }, "Ingestion already completed — skipping duplicate job");
    return { status: "skipped" as const, asOf, key };
  }

  const trading = await isNseTradingDay(asOf);
  if (!trading && mode === "daily") {
    logger.info({ asOf }, "NSE holiday/weekend — not treating missing data as an error");
    await db.insert(dataIngestionRuns).values({
      provider: env().DATA_PROVIDER,
      status: "market_closed",
      jobKey: key,
      completedAt: new Date(),
      errorMessage: `Market closed on ${asOf}`,
    });
    return { status: "market_closed" as const, asOf, key };
  }

  const [run] = await db
    .insert(dataIngestionRuns)
    .values({
      provider: env().DATA_PROVIDER,
      status: "running",
      jobKey: key,
    })
    .returning();

  let downloaded = 0;
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  try {
    await ensureUniverse();
    const provider = createMarketDataProvider();

    if (mode === "backfill") {
      const stats = await backfillOfficial(asOf);
      downloaded = stats.downloaded;
      inserted = stats.inserted;
      updated = stats.updated;
    } else {
      const stats = await ingestLatest(provider, asOf);
      downloaded = stats.downloaded;
      inserted = stats.inserted;
      updated = stats.updated;
      failed = stats.failed;
    }

    await mergeAliasedHistories();
    const computed = await recomputeAll(asOf, "PR");
    try {
      await recomputeAll(asOf, "TR");
    } catch {
      logger.info("TRI series not available — price-return remains the scanner default");
    }
    await writeDailySnapshots(computed.asOf ?? asOf);
    await generateDailyAlerts(computed.asOf ?? asOf);
    await generateDailyReport(computed.asOf ?? asOf);
    const day = computed.asOf ?? asOf;
    try {
      const { snapshotMarketContext } = await import("@/services/market-context");
      const { recordRadarSignals, fillSignalForwards } = await import("@/services/signal-tracker");
      const { generateIntelligenceBrief } = await import("@/services/daily-brief");
      const { refreshThesisChecks } = await import("@/services/research-lists");
      await snapshotMarketContext(day);
      await recordRadarSignals(day);
      await generateIntelligenceBrief(day, "daily");
      await fillSignalForwards();
      await refreshThesisChecks();
    } catch (err) {
      logger.warn({ err }, "Terminal post-ingest extras failed — NSE metrics retained");
    }

    await db
      .update(dataIngestionRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        recordsDownloaded: downloaded,
        recordsInserted: inserted,
        recordsUpdated: updated,
        failedRecords: failed,
        details: { asOf, source: provider.lastSource, computed: computed.computed },
      })
      .where(eq(dataIngestionRuns.id, run.id));

    logger.info({ asOf, downloaded, inserted, updated }, "Ingestion pipeline complete");
    return { status: "success" as const, asOf, downloaded, inserted, updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, asOf }, "Ingestion failed — previous database values retained");
    await db
      .update(dataIngestionRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        recordsDownloaded: downloaded,
        recordsInserted: inserted,
        recordsUpdated: updated,
        failedRecords: failed,
        errorMessage: message,
      })
      .where(eq(dataIngestionRuns.id, run.id));
    return { status: "failed" as const, asOf, error: message };
  }
}

export async function ensureUniverse() {
  const db = getDb();
  for (const seed of INDEX_UNIVERSE) {
    await db
      .insert(indices)
      .values({
        name: seed.name,
        symbol: seed.symbol,
        nseName: seed.nseName,
        yahooSymbol: seed.yahooSymbol,
        category: seed.category,
        subcategory: seed.subCategory,
        provider: env().DATA_PROVIDER,
        dataSource: env().DATA_PROVIDER,
        inceptionDate: seed.inceptionDate,
        description: seed.description,
        isBenchmark: Boolean(seed.isBenchmark),
        active: true,
      })
      .onConflictDoUpdate({
        target: indices.symbol,
        set: {
          name: seed.name,
          nseName: seed.nseName,
          yahooSymbol: seed.yahooSymbol,
          updatedAt: new Date(),
        },
      });
  }
}

async function ingestLatest(
  provider: ReturnType<typeof createMarketDataProvider>,
  asOf: string,
) {
  const db = getDb();
  const all = await db.select().from(indices).where(eq(indices.active, true));
  let downloaded = 0;
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  if (env().DATA_PROVIDER === "NSE_OFFICIAL_EOD") {
    return ingestOfficialDays([asOf]);
  }

  const from = await previousTradingDay(asOf);
  for (const idx of all) {
    try {
      const bars = await provider.getHistoricalIndexData({
        nseName: idx.nseName,
        symbol: idx.symbol,
        yahooSymbol: idx.yahooSymbol,
        from,
        to: asOf,
        returnType: "PR",
      });
      downloaded += bars.length;
      const res = await upsertBars(idx.id, bars);
      inserted += res.inserted;
      updated += res.updated;
    } catch (err) {
      failed += 1;
      logger.error({ err, index: idx.nseName }, "Failed to ingest index");
    }
  }
  return { downloaded, inserted, updated, failed };
}

async function backfillOfficial(asOf: string) {
  const start = env().NSE_HISTORICAL_START;
  const days = await tradingDaysBetween(start, asOf);
  logger.info({ start, asOf, days: days.length }, "Starting official EOD historical backfill");
  return ingestOfficialDays(days);
}

async function ingestOfficialDays(days: string[]) {
  const official = new NseOfficialEodProvider();
  const db = getDb();
  let downloaded = 0;
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const day of days) {
    try {
      const rows = await official.getDayRows(day);
      if (!rows.length) continue;
      downloaded += rows.length;
      await discoverNewIndices(rows.map((r) => r.nseName));
      const all = await db.select().from(indices).where(eq(indices.active, true));
      const byName = new Map(all.map((i) => [canonicalName(i.nseName), i]));
      const grouped = new Map<number, ProviderBar[]>();
      for (const row of rows) {
        const idx = byName.get(row.nseName);
        if (!idx) continue;
        const list = grouped.get(idx.id) ?? [];
        list.push({
          date: row.date,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
          returnType: "PR",
        });
        grouped.set(idx.id, list);
      }
      for (const [indexId, bars] of grouped) {
        const res = await upsertBars(indexId, bars);
        inserted += res.inserted;
        updated += res.updated;
      }
    } catch (err) {
      failed += 1;
      logger.warn({ err, day }, "Official EOD file missing or failed — skipping day");
    }
  }
  return { downloaded, inserted, updated, failed };
}

async function discoverNewIndices(names: string[]) {
  const db = getDb();
  const existing = await db.select().from(indices);
  const have = new Set(existing.map((i) => normalizeIndexName(i.nseName)));
  for (const name of names) {
    const key = canonicalName(name);
    if (have.has(key)) continue;
    const seeded = INDEX_UNIVERSE.find((s) => normalizeIndexName(s.nseName) === key);
    const symbol = seeded?.symbol ?? key.replace(/[^A-Z0-9]/g, "").slice(0, 32);
    const inferred = classifyDiscovered(key);
    await db
      .insert(indices)
      .values({
        name: seeded?.name ?? titleCase(name),
        symbol,
        nseName: seeded?.nseName ?? key,
        yahooSymbol: seeded?.yahooSymbol,
        category: seeded?.category ?? inferred.category,
        subcategory: seeded?.subCategory ?? "discovered",
        provider: env().DATA_PROVIDER,
        dataSource: env().DATA_PROVIDER,
        description: seeded?.description ?? "Discovered from official NSE EOD file",
        isBenchmark: Boolean(seeded?.isBenchmark),
        active: seeded ? true : inferred.active,
      })
      .onConflictDoNothing();
    have.add(key);
    logger.info({ name: key }, "Added newly discovered official index to universe");
  }
}

const SERIES_ALIASES: [string, string][] = [
  ["CNX NIFTY", "NIFTY 50"],
  ["CNX 500", "NIFTY 500"],
  ["CNX AUTO", "NIFTY AUTO"],
  ["CNX BANK", "NIFTY BANK"],
  ["CNX FMCG", "NIFTY FMCG"],
  ["CNX IT", "NIFTY IT"],
  ["CNX MEDIA", "NIFTY MEDIA"],
  ["CNX METAL", "NIFTY METAL"],
  ["CNX PHARMA", "NIFTY PHARMA"],
  ["CNX PSU BANK", "NIFTY PSU BANK"],
  ["CNX REALTY", "NIFTY REALTY"],
  ["CNX FINANCE", "NIFTY FINANCIAL SERVICES"],
];

export async function mergeAliasedHistories() {
  const db = getDb();
  const all = await db.select().from(indices);
  for (const [fromName, toName] of SERIES_ALIASES) {
    const src = all.find((i) => canonicalize(i.nseName) === fromName);
    const dst = all.find((i) => canonicalize(i.nseName) === toName);
    if (!src || !dst || src.id === dst.id) continue;
    await db.execute(sql`
      insert into index_prices (index_id, date, open, high, low, close, volume, return_type)
      select ${dst.id}, date, open, high, low, close, volume, return_type
      from index_prices
      where index_id = ${src.id}
      on conflict (index_id, date, return_type) do nothing
    `);
    await db.update(indices).set({ active: false, updatedAt: new Date() }).where(eq(indices.id, src.id));
    logger.info({ fromName, toName }, "Merged historical CNX publication name into current Nifty series");
  }
}

function canonicalize(name: string) {
  return canonicalName(name);
}

function classifyDiscovered(name: string): { category: string; active: boolean } {
  const n = name.toUpperCase();
  if (/VIX|INVERSE|LEVERAGE|DIVIDEND POINTS/.test(n)) return { category: "strategy", active: false };
  if (/SHARIAH|QUALITY|MOMENTUM|ALPHA|VALUE|LOW VOLATILITY|EQUAL WEIGHT|GROWTH|BETA/.test(n)) {
    return { category: "strategy", active: false };
  }
  if (/CORPORATE GROUP|TATA GROUP|ADANI|MAHINDRA/.test(n)) return { category: "thematic", active: false };
  if (/NIFTY 50|NIFTY 100|NIFTY 200|NIFTY 500|NEXT 50|MIDCAP|SMALLCAP/.test(n) && !/HEALTH|IT |FINANCIAL|TELECOM/.test(n)) {
    return { category: "broad", active: false };
  }
  return { category: "sectoral", active: true };
}

function titleCase(name: string) {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function upsertBars(indexId: number, bars: ProviderBar[]) {
  const db = getDb();
  const valid = bars.filter((b) => Number.isFinite(b.close));
  const flags = validateBars(
    indexId,
    valid.map((b) => ({
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    })),
  );
  for (const f of flags.filter((x) => x.flag !== "DUPLICATE")) {
    await db.insert(dataQualityFlags).values({
      indexId,
      date: f.date,
      flag: f.flag,
      message: f.message,
    });
  }

  if (!valid.length) return { inserted: 0, updated: 0 };

  const values = valid.map((bar) => ({
    indexId,
    date: bar.date,
    open: bar.open != null ? String(bar.open) : null,
    high: bar.high != null ? String(bar.high) : null,
    low: bar.low != null ? String(bar.low) : null,
    close: String(bar.close),
    volume: bar.volume != null ? String(bar.volume) : null,
    returnType: bar.returnType,
  }));

  await db
    .insert(indexPrices)
    .values(values)
    .onConflictDoUpdate({
      target: [indexPrices.indexId, indexPrices.date, indexPrices.returnType],
      set: {
        open: sql`excluded.open`,
        high: sql`excluded.high`,
        low: sql`excluded.low`,
        close: sql`excluded.close`,
        volume: sql`excluded.volume`,
      },
    });

  return { inserted: valid.length, updated: 0 };
}
