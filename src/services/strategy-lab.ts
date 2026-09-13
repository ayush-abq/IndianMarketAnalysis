import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { backtestRuns, indices } from "@/db/schema";
import { calculateReturns, periodReturn } from "@/calculations/returns";
import { computeMaBundle } from "@/calculations/moving-averages";
import { findAsOfIndex, sliceThrough } from "@/calculations/trading-days";
import { computeForBars, loadBars } from "@/services/metrics";
import { getSettings } from "@/services/settings";
import { MODEL_VERSIONS, SAMPLE_CAUTION } from "@/config/terminal-defaults";
import { COST_SCENARIOS } from "@/config/alpha-defaults";
import { confidenceLabel } from "@/scoring/opportunity-classify";
import { buildAlphaPanel, decaySeries, realizedTrade, regimeAt } from "@/services/alpha-research";
import type { ExecutionTiming } from "@/calculations/execution";

export type ScreenConditions = {
  minDrawdown?: number;
  maxDrawdown?: number;
  minQuality?: number;
  minValuation?: number;
  minRecovery?: number;
  minEarnings?: number;
  minRs?: number;
  minOpportunity?: number;
  signals?: string[];
  excludeFallingKnife?: boolean;
};

export type SnapshotRow = {
  assetId: number;
  name: string;
  asOf: string;
  close: number;
  distanceFromAth: number;
  return1m: number | null;
  return3m: number | null;
  return1y: number | null;
  recoveryScore: number;
  opportunityScore: number;
  qualityScore: number | null;
  valuationScore: number | null;
  earningsScore: number | null;
  rsScore: number | null;
  priceVs200: number | null;
  signal: string;
};

export type Trade = SnapshotRow & {
  holdTradingDays: number;
  forwardReturn: number | null;
  benchmarkReturn: number | null;
  excessReturn: number | null;
  grossReturn?: number | null;
  entryDate?: string | null;
  exitDate?: string | null;
  regime?: string | null;
  decay?: Record<string, number | null>;
};

export type TradeStats = {
  signals: number;
  withOutcome: number;
  winRate: number | null;
  averageReturn: number | null;
  medianReturn: number | null;
  best: number | null;
  worst: number | null;
  profitFactor: number | null;
  downsideDeviation: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdownOfTradeReturns: number | null;
  benchmarkAverage: number | null;
  excessAverage: number | null;
  caution: string;
  confidence: string;
};

/**
 * Screen at date T uses only fields known at T.
 * Missing quality/valuation/earnings fail a minimum threshold (never treated as 0, never invented).
 */
export function matchesScreen(row: SnapshotRow, c: ScreenConditions): boolean {
  if (c.minDrawdown != null && row.distanceFromAth < c.minDrawdown) return false;
  if (c.maxDrawdown != null && row.distanceFromAth > c.maxDrawdown) return false;
  if (c.minRecovery != null && row.recoveryScore < c.minRecovery) return false;
  if (c.minOpportunity != null && row.opportunityScore < c.minOpportunity) return false;
  if (!passesOptionalMin(row.qualityScore, c.minQuality)) return false;
  if (!passesOptionalMin(row.valuationScore, c.minValuation)) return false;
  if (!passesOptionalMin(row.earningsScore, c.minEarnings)) return false;
  if (!passesOptionalMin(row.rsScore, c.minRs)) return false;
  if (c.excludeFallingKnife && row.signal === "FALLING_KNIFE") return false;
  if (c.signals?.length && !c.signals.includes(row.signal)) return false;
  return true;
}

function passesOptionalMin(value: number | null | undefined, min?: number): boolean {
  if (min == null) return true;
  if (value == null || !Number.isFinite(value)) return false;
  return value >= min;
}

export function assertNoLookAhead(asOf: string, observationDates: string[]): void {
  for (const d of observationDates) {
    if (d > asOf) {
      throw new Error(`Look-ahead bias: observation ${d} is after as-of ${asOf}`);
    }
  }
}

export function sampleCaution(n: number): { confidence: string; note: string } {
  return confidenceLabel(n, 100);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function summarizeTrades(trades: Trade[]): TradeStats {
  const rets = trades.map((t) => t.forwardReturn).filter((v): v is number => v != null);
  const benches = trades.map((t) => t.benchmarkReturn).filter((v): v is number => v != null);
  const excess = trades.map((t) => t.excessReturn).filter((v): v is number => v != null);
  const wins = rets.filter((v) => v > 0);
  const losses = rets.filter((v) => v < 0);
  const avg = mean(rets);
  const sd = stdev(rets);
  const down = rets.filter((v) => v < 0);
  const downSd = stdev(down.map((v) => v));
  const caution = sampleCaution(rets.length);
  const profit = wins.reduce((a, b) => a + b, 0);
  const lossAbs = Math.abs(losses.reduce((a, b) => a + b, 0));
  return {
    signals: trades.length,
    withOutcome: rets.length,
    winRate: rets.length ? (wins.length / rets.length) * 100 : null,
    averageReturn: avg,
    medianReturn: median(rets),
    best: rets.length ? Math.max(...rets) : null,
    worst: rets.length ? Math.min(...rets) : null,
    profitFactor: lossAbs > 0 ? profit / lossAbs : wins.length ? null : null,
    downsideDeviation: downSd,
    sharpe: avg != null && sd != null && sd > 0 ? avg / sd : null,
    sortino: avg != null && downSd != null && downSd > 0 ? avg / downSd : null,
    maxDrawdownOfTradeReturns: worstCumulativeDrawdown(rets),
    benchmarkAverage: mean(benches),
    excessAverage: mean(excess),
    caution: caution.note,
    confidence: caution.confidence,
  };
}

function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

function worstCumulativeDrawdown(returns: number[]): number | null {
  if (!returns.length) return null;
  let eqty = 1;
  let peak = 1;
  let dd = 0;
  for (const r of returns) {
    eqty *= 1 + r / 100;
    peak = Math.max(peak, eqty);
    dd = Math.min(dd, ((eqty - peak) / peak) * 100);
  }
  return dd;
}

export function walkForwardWindows(
  from: string,
  to: string,
  trainMonths = 24,
  testMonths = 12,
): { trainFrom: string; trainTo: string; testFrom: string; testTo: string }[] {
  const out: { trainFrom: string; trainTo: string; testFrom: string; testTo: string }[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (true) {
    const trainFrom = cursor.toISOString().slice(0, 10);
    const trainEnd = addMonths(cursor, trainMonths);
    const testEnd = addMonths(trainEnd, testMonths);
    if (trainEnd >= end) break;
    out.push({
      trainFrom,
      trainTo: minDate(trainEnd.toISOString().slice(0, 10), to),
      testFrom: trainEnd.toISOString().slice(0, 10),
      testTo: minDate(testEnd.toISOString().slice(0, 10), to),
    });
    cursor = addMonths(cursor, testMonths);
    if (cursor >= end) break;
    if (out.length > 20) break;
  }
  return out;
}

function addMonths(d: Date, months: number) {
  const n = new Date(d);
  n.setUTCMonth(n.getUTCMonth() + months);
  return n;
}

function minDate(a: string, b: string) {
  return a < b ? a : b;
}

export function tradesInRange(trades: Trade[], from: string, to: string) {
  return trades.filter((t) => t.asOf >= from && t.asOf <= to);
}

export function parameterSensitivity(
  snapshots: SnapshotRow[],
  tradesByKey: Map<string, Trade>,
  base: ScreenConditions,
  param: keyof ScreenConditions,
  values: number[],
  holdTradingDays: number,
) {
  return values.map((value) => {
    const conditions = { ...base, [param]: value };
    const selected = snapshots.filter((s) => matchesScreen(s, conditions));
    const trades = selected
      .map((s) => tradesByKey.get(`${s.asOf}|${s.assetId}|${holdTradingDays}`))
      .filter((t): t is Trade => Boolean(t));
    return { value, stats: summarizeTrades(trades), signals: selected.length };
  });
}

/** Bootstrap the historical trade-return distribution. Not a forecast. */
export function bootstrapReturnRange(returns: number[], draws = 500, seed = 1) {
  if (returns.length < SAMPLE_CAUTION.insufficient) {
    return { p05: null, p50: null, p95: null, note: "Insufficient historical evidence." };
  }
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const means: number[] = [];
  for (let i = 0; i < draws; i++) {
    let acc = 0;
    for (let j = 0; j < returns.length; j++) {
      acc += returns[Math.floor(rand() * returns.length)];
    }
    means.push(acc / returns.length);
  }
  means.sort((a, b) => a - b);
  const at = (p: number) => means[Math.min(means.length - 1, Math.floor(p * (means.length - 1)))];
  return {
    p05: at(0.05),
    p50: at(0.5),
    p95: at(0.95),
    note: "Range of average historical trade returns under resampling. Not a prediction.",
  };
}

export type StrategyLabInput = {
  name?: string;
  universe?: "SECTOR" | "STOCK";
  conditions: ScreenConditions;
  holdTradingDays?: number;
  from: string;
  to: string;
  sampleEvery?: number;
  persist?: boolean;
  execution?: ExecutionTiming;
  costScenario?: keyof typeof COST_SCENARIOS;
};

export async function runStrategyLab(input: StrategyLabInput) {
  const hold = input.holdTradingDays ?? 252;
  const sampleEvery = input.sampleEvery ?? 21;
  const universe = input.universe ?? "SECTOR";
  const timing = input.execution ?? "NEXT_SESSION";
  const roundTripBps = COST_SCENARIOS[input.costScenario ?? "base"].roundTripBps;
  if (universe !== "SECTOR") {
    return runStockStrategyLab(input, hold, sampleEvery);
  }

  const db = getDb();
  const settings = await getSettings();
  const all = await db.select().from(indices).where(eq(indices.active, true));
  const nifty50 = all.find((i) => i.symbol === "NIFTY50");
  const nifty500 = all.find((i) => i.symbol === "NIFTY500");
  const barCache = new Map<number, Awaited<ReturnType<typeof loadBars>>>();
  const load = async (id: number) => {
    if (!barCache.has(id)) barCache.set(id, await loadBars(id, "PR"));
    return barCache.get(id)!;
  };

  const benchBars = nifty50 ? await load(nifty50.id) : [];
  const nifty500Bars = nifty500 ? await load(nifty500.id) : [];
  const sampleDates = sampleAsOfDates(benchBars.length ? benchBars : nifty500Bars, input.from, input.to, sampleEvery);

  const snapshots: SnapshotRow[] = [];
  const trades: Trade[] = [];

  for (const asOf of sampleDates) {
    const b50 = sliceThrough(benchBars, asOf);
    const b500 = sliceThrough(nifty500Bars, asOf);
    assertNoLookAhead(asOf, [...b50, ...b500].map((b) => b.date));
    const benchmarks = {
      nifty50: b50.length >= 2 ? calculateReturns(b50) : null,
      nifty500: b500.length >= 2 ? calculateReturns(b500) : null,
      nifty50Mas: b50.length >= 2 ? computeMaBundle(b50) : null,
    };
    for (const idx of all) {
      if (idx.isBenchmark) continue;
      const bars = await load(idx.id);
      const computed = computeForBars(bars, asOf, settings, benchmarks, idx.name);
      if (!computed) continue;
      assertNoLookAhead(asOf, sliceThrough(bars, asOf).map((b) => b.date));
      const row: SnapshotRow = {
        assetId: idx.id,
        name: idx.name,
        asOf: computed.asOf,
        close: computed.drawdown.currentClose,
        distanceFromAth: computed.drawdown.distanceFromAthPercent,
        return1m: computed.returns.m1,
        return3m: computed.returns.m3,
        return1y: computed.returns.y1,
        recoveryScore: computed.scores.recovery,
        opportunityScore: computed.scores.opportunity,
        qualityScore: null,
        valuationScore: null,
        earningsScore: null,
        rsScore: computed.scores.rs,
        priceVs200: computed.mas.priceVs200,
        signal: computed.signal,
      };
      snapshots.push(row);
      if (!matchesScreen(row, input.conditions)) continue;
      const fill = realizedTrade(bars, asOf, hold, timing, roundTripBps);
      const benchFill = realizedTrade(benchBars, asOf, hold, timing, roundTripBps);
      const fwd = fill?.netReturn ?? null;
      const bench = benchFill?.netReturn ?? null;
      trades.push({
        ...row,
        holdTradingDays: hold,
        forwardReturn: fwd,
        benchmarkReturn: bench,
        excessReturn: fwd != null && bench != null ? fwd - bench : null,
        grossReturn: fill?.grossReturn ?? null,
        entryDate: fill?.entryDate ?? null,
        exitDate: fill?.exitDate ?? null,
        regime: regimeAt(benchBars, asOf),
        decay: decaySeries(bars, asOf, timing, roundTripBps),
      });
    }
  }

  const inSampleCut = sampleDates[Math.floor(sampleDates.length * 0.7)] ?? input.to;
  const inSample = summarizeTrades(trades.filter((t) => t.asOf <= inSampleCut));
  const outOfSample = summarizeTrades(trades.filter((t) => t.asOf > inSampleCut));
  const overall = summarizeTrades(trades);
  const windows = walkForwardWindows(input.from, input.to);
  const walkForward = windows.map((w) => ({
    ...w,
    train: summarizeTrades(tradesInRange(trades, w.trainFrom, w.trainTo)),
    test: summarizeTrades(tradesInRange(trades, w.testFrom, w.testTo)),
  }));

  const tradeKey = new Map<string, Trade>();
  for (const t of trades) tradeKey.set(`${t.asOf}|${t.assetId}|${hold}`, t);
  const sensitivity =
    input.conditions.minDrawdown != null
      ? parameterSensitivity(
          snapshots,
          tradeKey,
          input.conditions,
          "minDrawdown",
          uniqueAround(input.conditions.minDrawdown, [30, 35, 40, 45, 50]),
          hold,
        )
      : [];

  const fwdRets = trades.map((t) => t.forwardReturn).filter((v): v is number => v != null);
  const alpha = buildAlphaPanel(trades, { overall, inSample, outOfSample }, {
    timing,
    roundTripBps,
    survivorshipNote:
      "Sector lab uses stored index histories including names that were active at as-of. It does not invent delisted members. Stock lab is limited to ingested symbols and is labelled if only today’s survivors are present.",
  });
  const result = {
    modelVersion: `${MODEL_VERSIONS.lab}+${alpha.model.version}`,
    disclaimer:
      "Historical research results only. Next-session execution and estimated costs are applied. Not a forecast, not a recommendation, and not a guarantee of future returns.",
    universe,
    conditions: input.conditions,
    holdTradingDays: hold,
    execution: alpha.execution,
    sampleDates: sampleDates.length,
    overall,
    inSample,
    outOfSample,
    walkForward,
    sensitivity,
    bootstrap: bootstrapReturnRange(fwdRets),
    alpha,
    interpretation: [...interpret(overall, inSample, outOfSample), alpha.robustness.note, alpha.bestForRegime.note],
    trades: trades.slice(0, 200),
  };

  if (input.persist) {
    await db.insert(backtestRuns).values({
      name: input.name ?? "Strategy Lab",
      universe,
      conditions: input.conditions,
      holdTradingDays: hold,
      fromDate: input.from,
      toDate: input.to,
      modelVersion: MODEL_VERSIONS.lab,
      result,
    });
  }
  return result;
}

async function runStockStrategyLab(input: StrategyLabInput, hold: number, sampleEvery: number) {
  const timing = input.execution ?? "NEXT_SESSION";
  const roundTripBps = COST_SCENARIOS[input.costScenario ?? "base"].roundTripBps;
  const { loadStockBars, listActiveStocks } = await import("@/services/stock-metrics");
  const stocks = await listActiveStocks();
  if (!stocks.length) {
    return {
      modelVersion: MODEL_VERSIONS.lab,
      disclaimer: "No stock price history ingested yet. Run official bhavcopy ingest, or use universe=SECTOR.",
      universe: "STOCK",
      conditions: input.conditions,
      holdTradingDays: hold,
      sampleDates: 0,
      overall: summarizeTrades([]),
      inSample: summarizeTrades([]),
      outOfSample: summarizeTrades([]),
      walkForward: [],
      sensitivity: [],
      bootstrap: bootstrapReturnRange([]),
      interpretation: ["Stock universe is empty. Sector Strategy Lab remains available."],
      trades: [],
    };
  }
  const first = await loadStockBars(stocks[0].id);
  const dates = sampleAsOfDates(first, input.from, input.to, sampleEvery);
  const trades: Trade[] = [];
  for (const asOf of dates) {
    for (const stock of stocks) {
      const bars = await loadStockBars(stock.id);
      const through = sliceThrough(bars, asOf);
      if (through.length < 60) continue;
      assertNoLookAhead(asOf, through.map((b) => b.date));
      const computed = computeStockSnapshot(stock.id, stock.symbol, through, asOf);
      if (!matchesScreen(computed, input.conditions)) continue;
      const fill = realizedTrade(bars, asOf, hold, timing, roundTripBps);
      trades.push({
        ...computed,
        holdTradingDays: hold,
        forwardReturn: fill?.netReturn ?? null,
        benchmarkReturn: null,
        excessReturn: null,
        grossReturn: fill?.grossReturn ?? null,
        entryDate: fill?.entryDate ?? null,
        decay: decaySeries(bars, asOf, timing, roundTripBps),
      });
    }
  }
  const overall = summarizeTrades(trades);
  return {
    modelVersion: MODEL_VERSIONS.lab,
    disclaimer:
      "Historical research results only. Stock forwards use adjusted_close when present, otherwise close (corporate-action completeness may be incomplete).",
    universe: "STOCK",
    conditions: input.conditions,
    holdTradingDays: hold,
    sampleDates: dates.length,
    overall,
    inSample: overall,
    outOfSample: summarizeTrades([]),
    walkForward: [],
    sensitivity: [],
    bootstrap: bootstrapReturnRange(trades.map((t) => t.forwardReturn).filter((v): v is number => v != null)),
    interpretation: interpret(overall, overall, summarizeTrades([])),
    trades: trades.slice(0, 200),
  };
}

export function computeStockSnapshot(
  assetId: number,
  name: string,
  through: { date: string; close: number }[],
  asOf: string,
): SnapshotRow {
  const closes = through.map((b) => b.close);
  const last = through[through.length - 1];
  const ath = Math.max(...closes);
  const distanceFromAth = ath > 0 ? ((ath - last.close) / ath) * 100 : 0;
  const ret = calculateReturns(through);
  return {
    assetId,
    name,
    asOf,
    close: last.close,
    distanceFromAth,
    return1m: ret.m1,
    return3m: ret.m3,
    return1y: ret.y1,
    recoveryScore: Math.max(0, Math.min(100, 40 + (ret.m1 ?? 0) + (ret.m3 ?? 0) * 0.3)),
    opportunityScore: Math.max(0, Math.min(100, distanceFromAth)),
    qualityScore: null,
    valuationScore: null,
    earningsScore: null,
    rsScore: null,
    priceVs200: null,
    signal: distanceFromAth >= 40 && (ret.m1 ?? 0) < 0 ? "FALLING_KNIFE" : "WATCHLIST",
  };
}

export function labeledForward(
  fullBars: { date: string; close: number }[],
  asOf: string,
  holdTradingDays: number,
): number | null {
  const idx = findAsOfIndex(fullBars, asOf);
  if (idx < 0) return null;
  const future = fullBars[idx + holdTradingDays];
  if (!future) return null;
  return periodReturn(future.close, fullBars[idx].close);
}

export function sampleAsOfDates(
  bars: { date: string }[],
  from: string,
  to: string,
  every: number,
): string[] {
  const inRange = bars.filter((b) => b.date >= from && b.date <= to);
  const out: string[] = [];
  for (let i = 0; i < inRange.length; i += every) out.push(inRange[i].date);
  return out;
}

function uniqueAround(base: number, grid: number[]) {
  return [...new Set([base, ...grid])].sort((a, b) => a - b);
}

function interpret(
  overall: TradeStats,
  inSample: TradeStats,
  outOfSample: TradeStats,
): string[] {
  const lines = [
    `Historical sample: ${overall.withOutcome} completed outcomes from ${overall.signals} signals.`,
    overall.caution,
  ];
  if (overall.averageReturn != null) {
    lines.push(
      `Historical average subsequent return was ${overall.averageReturn.toFixed(1)}% over the tested hold. This is not a forecast.`,
    );
  }
  if (overall.benchmarkAverage != null && overall.excessAverage != null) {
    lines.push(
      `Buy-and-hold Nifty 50 average over the same holds was ${overall.benchmarkAverage.toFixed(1)}% (excess ${overall.excessAverage.toFixed(1)} pp).`,
    );
  }
  if (overall.withOutcome >= SAMPLE_CAUTION.small && outOfSample.withOutcome >= SAMPLE_CAUTION.insufficient) {
    if (
      inSample.averageReturn != null &&
      outOfSample.averageReturn != null &&
      outOfSample.averageReturn < inSample.averageReturn - 5
    ) {
      lines.push("Out-of-sample average was weaker than in-sample — treat in-sample figures as possibly overfit.");
    }
  }
  if (overall.withOutcome < SAMPLE_CAUTION.insufficient) {
    lines.push("Do not draw a strong conclusion. Increase history or loosen filters.");
  }
  return lines;
}
