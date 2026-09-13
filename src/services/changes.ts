import { loadScannerRows } from "@/services/queries";
import { getDb } from "@/db/client";
import { dailySnapshots, indices } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export type ChangeItem = {
  name: string;
  indexId: number;
  type: string;
  previous: string;
  today: string;
  detail: string;
};

export async function whatChangedToday(asOf?: string) {
  const todayRows = await loadScannerRows({ asOf, returnType: "PR" });
  const date = asOf ?? todayRows[0]?.athDate;
  const db = getDb();
  const snaps = await db
    .select({
      date: dailySnapshots.date,
      payload: dailySnapshots.payload,
      indexId: dailySnapshots.indexId,
      name: indices.name,
    })
    .from(dailySnapshots)
    .innerJoin(indices, eq(indices.id, dailySnapshots.indexId))
    .orderBy(desc(dailySnapshots.date));

  const dates = [...new Set(snaps.map((s) => s.date))].sort();
  const latest = date && dates.includes(date) ? date : dates.at(-1);
  const prior = dates.filter((d) => latest && d < latest).at(-1);
  if (!latest || !prior) return { asOf: latest ?? null, previous: prior ?? null, changes: [] as ChangeItem[] };

  const prevMap = new Map(
    snaps.filter((s) => s.date === prior).map((s) => [s.indexId, s.payload as Record<string, unknown>]),
  );
  const changes: ChangeItem[] = [];

  for (const row of todayRows) {
    const prev = prevMap.get(row.indexId);
    if (!prev) continue;
    const pDd = Number(prev.distanceFromAth ?? 0);
    const pRec = Number(prev.recoveryScore ?? 0);
    const pSig = String(prev.signal ?? "");
    const p50 = Number(prev.priceVs50 ?? 0);
    const p200 = Number(prev.priceVs200 ?? 0);

    for (const th of [30, 40, 50, 60]) {
      if (row.distanceFromAth >= th && pDd < th) {
        changes.push({
          name: row.name,
          indexId: row.indexId,
          type: `NEW >${th}% DRAWDOWN`,
          previous: `${pDd.toFixed(1)}%`,
          today: `${row.distanceFromAth.toFixed(1)}%`,
          detail: `${row.name} crossed the -${th}% drawdown threshold.`,
        });
      }
    }
    if (row.recoveryScore - pRec >= 10) {
      changes.push({
        name: row.name,
        indexId: row.indexId,
        type: "RECOVERY IMPROVEMENT",
        previous: pRec.toFixed(0),
        today: row.recoveryScore.toFixed(0),
        detail: `Recovery score ${pRec.toFixed(0)} → ${row.recoveryScore.toFixed(0)}`,
      });
    }
    if (pSig !== row.signal) {
      changes.push({
        name: row.name,
        indexId: row.indexId,
        type: "SIGNAL CHANGE",
        previous: pSig,
        today: row.signal,
        detail: `${pSig} → ${row.signal}`,
      });
    }
    if ((row.priceVs200 ?? -1) > 0 && p200 <= 0) {
      changes.push({
        name: row.name,
        indexId: row.indexId,
        type: "TREND BREAK",
        previous: "below 200DMA",
        today: "above 200DMA",
        detail: `${row.name} crossed above its 200DMA.`,
      });
    }
    if ((row.priceVs50 ?? -1) > 0 && p50 <= 0) {
      changes.push({
        name: row.name,
        indexId: row.indexId,
        type: "TREND BREAK",
        previous: "below 50DMA",
        today: "above 50DMA",
        detail: `${row.name} crossed above its 50DMA.`,
      });
    }
  }

  return { asOf: latest, previous: prior, changes };
}
