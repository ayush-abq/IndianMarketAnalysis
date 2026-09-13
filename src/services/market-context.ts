import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { indices, institutionalFlows, marketRegimeSnapshots } from "@/db/schema";
import { calculateReturns } from "@/calculations/returns";
import { computeMaBundle } from "@/calculations/moving-averages";
import { loadBars } from "@/services/metrics";
import { loadScannerRows, latestMetricDate } from "@/services/queries";
import { classifyBreadthDivergence, detectMarketRegime } from "@/scoring/regime";
import { MODEL_VERSIONS } from "@/config/terminal-defaults";

export type SectorBreadth = {
  asOf: string | null;
  count: number;
  pctAbove50: number | null;
  pctAbove200: number | null;
  pctBelow20: number | null;
  pctBelow30: number | null;
  pctBelow40: number | null;
  pctBelow50: number | null;
  advanceDecline: number | null;
  recovering: number;
  falling: number;
  score: number | null;
};

export function sectorBreadthFromRows(
  rows: {
    priceVs50: number | null;
    priceVs200: number | null;
    distanceFromAth: number;
    return1d: number | null;
    signal: string;
  }[],
): Omit<SectorBreadth, "asOf"> {
  const n = rows.length;
  if (!n) {
    return {
      count: 0,
      pctAbove50: null,
      pctAbove200: null,
      pctBelow20: null,
      pctBelow30: null,
      pctBelow40: null,
      pctBelow50: null,
      advanceDecline: null,
      recovering: 0,
      falling: 0,
      score: null,
    };
  }
  const known50 = rows.filter((r) => r.priceVs50 != null);
  const known200 = rows.filter((r) => r.priceVs200 != null);
  const adv = rows.filter((r) => (r.return1d ?? 0) > 0).length;
  const dec = rows.filter((r) => (r.return1d ?? 0) < 0).length;
  const pctAbove50 = known50.length ? (known50.filter((r) => (r.priceVs50 ?? 0) > 0).length / known50.length) * 100 : null;
  const pctAbove200 = known200.length
    ? (known200.filter((r) => (r.priceVs200 ?? 0) > 0).length / known200.length) * 100
    : null;
  const pctBelow20 = (rows.filter((r) => r.distanceFromAth >= 20).length / n) * 100;
  const pctBelow30 = (rows.filter((r) => r.distanceFromAth >= 30).length / n) * 100;
  const pctBelow40 = (rows.filter((r) => r.distanceFromAth >= 40).length / n) * 100;
  const pctBelow50 = (rows.filter((r) => r.distanceFromAth >= 50).length / n) * 100;
  const recovering = rows.filter((r) => r.signal === "EARLY_RECOVERY" || r.signal === "RECOVERING").length;
  const falling = rows.filter((r) => r.signal === "FALLING_KNIFE").length;
  const score =
    pctAbove50 != null && pctAbove200 != null
      ? Math.max(0, Math.min(100, pctAbove50 * 0.4 + pctAbove200 * 0.4 + (100 - pctBelow30) * 0.2))
      : null;
  return {
    count: n,
    pctAbove50,
    pctAbove200,
    pctBelow20,
    pctBelow30,
    pctBelow40,
    pctBelow50,
    advanceDecline: dec > 0 ? adv / dec : adv > 0 ? null : null,
    recovering,
    falling,
    score,
  };
}

export async function snapshotMarketContext(asOf?: string) {
  const date = asOf ?? (await latestMetricDate("PR"));
  if (!date) return null;
  const rows = await loadScannerRows({ asOf: date, returnType: "PR", includeBenchmarks: true });
  const sectors = rows.filter((r) => !r.isBenchmark);
  const benchmarks = rows.filter((r) => r.isBenchmark);
  const nifty50row = benchmarks.find((r) => r.symbol === "NIFTY50") ?? rows.find((r) => r.symbol === "NIFTY50");
  const db = getDb();
  const nifty50 = (await db.select().from(indices).where(eq(indices.symbol, "NIFTY50")))[0];
  const bars = nifty50 ? await loadBars(nifty50.id, "PR") : [];
  const through = bars.filter((b) => b.date <= date);
  const rets = through.length >= 2 ? calculateReturns(through) : null;
  const mas = through.length >= 2 ? computeMaBundle(through) : null;
  const breadth = sectorBreadthFromRows(sectors);
  const prev = (
    await db.select().from(marketRegimeSnapshots).orderBy(desc(marketRegimeSnapshots.date)).limit(2)
  ).find((r) => r.date < date);
  const divergence = classifyBreadthDivergence({
    indexReturn1m: nifty50row?.return1m ?? rets?.m1 ?? null,
    sectorPctAbove50: breadth.pctAbove50,
    prevSectorPctAbove50: prev?.sectorPctAbove50 != null ? Number(prev.sectorPctAbove50) : null,
  });
  const vix = await loadIndiaVix(date);
  const flow = (
    await db.select().from(institutionalFlows).where(eq(institutionalFlows.date, date)).limit(1)
  )[0];
  const regime = detectMarketRegime({
    nifty50Return1y: nifty50row?.return1y ?? rets?.y1 ?? null,
    nifty50Return6m: nifty50row?.return6m ?? rets?.m6 ?? null,
    nifty50Return1m: nifty50row?.return1m ?? rets?.m1 ?? null,
    nifty50PriceVs50: nifty50row?.priceVs50 ?? mas?.priceVs50 ?? null,
    nifty50PriceVs200: nifty50row?.priceVs200 ?? mas?.priceVs200 ?? null,
    nifty50Drawdown: nifty50row?.distanceFromAth ?? null,
    nifty500Return1y: rows.find((r) => r.symbol === "NIFTY500")?.return1y ?? null,
    indiaVix: vix,
    sectorPctAbove200: breadth.pctAbove200,
    sectorPctBelow30: breadth.pctBelow30,
    recoveringSectors: breadth.recovering,
    fallingSectors: breadth.falling,
  });
  const payload = {
    date,
    regime: regime.regime,
    score: String(regime.score),
    nifty50: nifty50row?.current != null ? String(nifty50row.current) : null,
    nifty50Return1d: nifty50row?.return1d != null ? String(nifty50row.return1d) : null,
    nifty50Return1y: (nifty50row?.return1y ?? rets?.y1) != null ? String(nifty50row?.return1y ?? rets?.y1) : null,
    nifty50Drawdown: nifty50row?.distanceFromAth != null ? String(nifty50row.distanceFromAth) : null,
    indiaVix: vix != null ? String(vix) : null,
    sectorPctAbove50: breadth.pctAbove50 != null ? String(breadth.pctAbove50) : null,
    sectorPctAbove200: breadth.pctAbove200 != null ? String(breadth.pctAbove200) : null,
    sectorPctBelow30: breadth.pctBelow30 != null ? String(breadth.pctBelow30) : null,
    sectorPctBelow40: breadth.pctBelow40 != null ? String(breadth.pctBelow40) : null,
    recoveringSectors: breadth.recovering,
    fallingSectors: breadth.falling,
    breadthDivergence: divergence,
    explanation: {
      why: regime.why,
      risks: regime.risks,
      breadth,
      fii: flow?.fiiNet != null ? Number(flow.fiiNet) : null,
      dii: flow?.diiNet != null ? Number(flow.diiNet) : null,
      flowSource: flow?.source ?? "unavailable",
      modelVersion: MODEL_VERSIONS.regime,
    },
    modelVersion: MODEL_VERSIONS.regime,
  };
  await db
    .insert(marketRegimeSnapshots)
    .values(payload)
    .onConflictDoUpdate({
      target: marketRegimeSnapshots.date,
      set: payload,
    });
  return payload;
}

async function loadIndiaVix(asOf: string): Promise<number | null> {
  const db = getDb();
  const vix = (
    await db.select().from(indices)
  ).find((i) => /india vix|indiai\s*vix|^vix$/i.test(`${i.name} ${i.nseName} ${i.symbol}`));
  if (!vix) return null;
  const bars = await loadBars(vix.id, "PR");
  const last = [...bars].reverse().find((b) => b.date <= asOf);
  return last?.close ?? null;
}

export async function latestMarketContext() {
  const db = getDb();
  const row = (await db.select().from(marketRegimeSnapshots).orderBy(desc(marketRegimeSnapshots.date)).limit(1))[0];
  if (row) return row;
  return snapshotMarketContext();
}
