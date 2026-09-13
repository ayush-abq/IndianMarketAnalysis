import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { indices } from "@/db/schema";
import { calculateReturns } from "@/calculations/returns";
import { computeMaBundle } from "@/calculations/moving-averages";
import { sliceThrough } from "@/calculations/trading-days";
import { computeForBars, loadBars } from "@/services/metrics";
import { getSettings } from "@/services/settings";
import { periodReturn } from "@/calculations/returns";
import { findAsOfIndex } from "@/calculations/trading-days";

/**
 * Point-in-time scanner. Uses ONLY prices available on `asOf`.
 * ATH, returns, and signals never use future observations.
 */
export async function scanAsOf(asOf: string, returnType: "PR" | "TR" = "PR") {
  const db = getDb();
  const settings = await getSettings();
  const all = await db.select().from(indices).where(eq(indices.active, true));
  const nifty50 = all.find((i) => i.symbol === "NIFTY50");
  const nifty500 = all.find((i) => i.symbol === "NIFTY500");
  const b50 = nifty50 ? sliceThrough(await loadBars(nifty50.id, returnType), asOf) : [];
  const b500 = nifty500 ? sliceThrough(await loadBars(nifty500.id, returnType), asOf) : [];
  const benchmarks = {
    nifty50: b50.length >= 2 ? calculateReturns(b50) : null,
    nifty500: b500.length >= 2 ? calculateReturns(b500) : null,
    nifty50Mas: b50.length >= 2 ? computeMaBundle(b50) : null,
  };

  const results = [];
  for (const idx of all) {
    if (idx.isBenchmark) continue;
    const bars = await loadBars(idx.id, returnType);
    const computed = computeForBars(bars, asOf, settings, benchmarks, idx.name);
    if (!computed) continue;
    results.push({
      name: idx.name,
      indexId: idx.id,
      asOf: computed.asOf,
      current: computed.drawdown.currentClose,
      distanceFromAth: computed.drawdown.distanceFromAthPercent,
      ath: computed.drawdown.ath,
      athDate: computed.drawdown.athDate,
      return1y: computed.returns.y1,
      return2y: computed.returns.y2,
      return5y: computed.returns.y5,
      recoveryScore: computed.scores.recovery,
      opportunityScore: computed.scores.opportunity,
      signal: computed.signal,
      classification: computed.classification,
    });
  }
  results.sort((a, b) => b.distanceFromAth - a.distanceFromAth);
  return results;
}

export async function forwardReturns(indexId: number, asOf: string, horizons = [126, 252, 504]) {
  const bars = await loadBars(indexId, "PR");
  const idx = findAsOfIndex(bars, asOf);
  if (idx < 0) return [];
  const start = bars[idx].close;
  return horizons.map((h) => {
    const future = bars[idx + h];
    return {
      tradingDays: h,
      months: Math.round(h / 21),
      available: Boolean(future),
      returnPct: future ? periodReturn(future.close, start) : null,
    };
  });
}
