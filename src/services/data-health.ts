import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dataIngestionRuns, dataQualityFlags, indices } from "@/db/schema";
import { createMarketDataProvider } from "@/providers";
import { expectedDataDate } from "@/services/calendar";
import { env } from "@/lib/env";
import { nowISTLabel } from "@/lib/utils";
import { mfHealth } from "@/services/mf-queries";
import { buildCoverageReport } from "@/services/coverage";

export async function dataHealth() {
  const db = getDb();
  const lastSuccess = (
    await db
      .select()
      .from(dataIngestionRuns)
      .where(eq(dataIngestionRuns.status, "success"))
      .orderBy(desc(dataIngestionRuns.completedAt))
      .limit(1)
  )[0];
  const lastAttempt = (
    await db.select().from(dataIngestionRuns).orderBy(desc(dataIngestionRuns.startedAt)).limit(1)
  )[0];
  const priceAgg = await db.execute(sql`
    select max(date) as latest, count(*)::int as n from index_prices
  `);
  const latest = (priceAgg[0] as { latest: string | null; n: number } | undefined)?.latest ?? null;
  const expected = await expectedDataDate();
  const staleIndices = await db.execute(sql`
    select i.name, max(p.date) as latest
    from indices i
    left join index_prices p on p.index_id = i.id and p.return_type = 'PR'
    where i.active = true
    group by i.id, i.name
    having max(p.date) is null or max(p.date) < ${expected}
  `);
  const flags = await db.select().from(dataQualityFlags).orderBy(desc(dataQualityFlags.createdAt)).limit(50);
  const provider = createMarketDataProvider();
  const api = await provider.healthcheck();

  let dbOk = true;
  try {
    await db.select({ id: indices.id }).from(indices).limit(1);
  } catch {
    dbOk = false;
  }

  return {
    generatedAt: nowISTLabel(),
    lastSuccessfulIngestion: lastSuccess?.completedAt?.toISOString() ?? null,
    lastAttemptedIngestion: lastAttempt?.startedAt?.toISOString() ?? null,
    lastAttemptStatus: lastAttempt?.status ?? null,
    dataProvider: env().DATA_PROVIDER,
    fallbackProvider: env().FALLBACK_PROVIDER,
    recordsFetched: lastSuccess?.recordsDownloaded ?? 0,
    recordsInserted: lastSuccess?.recordsInserted ?? 0,
    recordsUpdated: lastSuccess?.recordsUpdated ?? 0,
    failedRecords: lastSuccess?.failedRecords ?? 0,
    latestTradingDate: latest,
    expectedTradingDate: expected,
    stale: !latest || latest < expected,
    staleIndices,
    flags,
    api,
    database: { ok: dbOk },
    architecture:
      "Official/authorized source → local PostgreSQL → precomputed calculations → dashboard (DB read only)",
    mf: await mfHealth().catch(() => null),
    stocks: await db
      .execute(sql`select count(*)::int as n, max(date)::text as latest from stock_prices`)
      .then((rows) => rows[0] ?? { n: 0, latest: null })
      .catch(() => ({ n: 0, latest: null, note: "stock_prices table not migrated yet" })),
    coverage: await buildCoverageReport().catch((err) => ({
      error: err instanceof Error ? err.message : String(err),
    })),
  };
}
