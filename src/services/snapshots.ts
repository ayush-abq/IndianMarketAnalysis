import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dailySnapshots } from "@/db/schema";
import { loadScannerRows } from "@/services/queries";
import { logger } from "@/lib/logger";

export async function writeDailySnapshots(asOf: string, returnType: "PR" | "TR" = "PR") {
  const db = getDb();
  const rows = await loadScannerRows({ asOf, returnType, includeBenchmarks: true });
  for (const row of rows) {
    const payload = {
      name: row.name,
      current: row.current,
      distanceFromAth: row.distanceFromAth,
      ath: row.ath,
      athDate: row.athDate,
      return1y: row.return1y,
      return2y: row.return2y,
      return5y: row.return5y,
      return3m: row.return3m,
      return6m: row.return6m,
      recoveryScore: row.recoveryScore,
      opportunityScore: row.opportunityScore,
      signal: row.signal,
      classification: row.classification,
      priceVs50: row.priceVs50,
      priceVs200: row.priceVs200,
      rs1yNifty50: row.rs1yNifty50,
    };
    await db
      .insert(dailySnapshots)
      .values({
        indexId: row.indexId,
        date: asOf,
        returnType,
        payload,
      })
      .onConflictDoUpdate({
        target: [dailySnapshots.indexId, dailySnapshots.date, dailySnapshots.returnType],
        set: { payload },
      });
  }
  logger.info({ asOf, rows: rows.length }, "Daily snapshots stored");
}

export async function snapshotHistory(indexId: number, returnType: "PR" | "TR" = "PR") {
  const db = getDb();
  return db
    .select()
    .from(dailySnapshots)
    .where(eq(dailySnapshots.indexId, indexId))
    .then((rows) => rows.filter((r) => r.returnType === returnType));
}
