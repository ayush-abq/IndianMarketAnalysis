import { DECAY_HORIZONS, COST_SCENARIOS, EXECUTION, ALPHA_MODEL } from "@/config/alpha-defaults";
import {
  applyRoundTripCost,
  nextSessionForward,
  type ExecutionTiming,
} from "@/calculations/execution";
import { expectedValue, evidenceStrength, alphaDecay, rankRobustness } from "@/scoring/expected-value";
import { detectMarketRegime } from "@/scoring/regime";
import { calculateReturns } from "@/calculations/returns";
import { computeMaBundle } from "@/calculations/moving-averages";
import { sliceThrough } from "@/calculations/trading-days";
import type { Trade, TradeStats } from "@/services/strategy-lab";

export function realizedTrade(
  bars: { date: string; close: number }[],
  asOf: string,
  holdTradingDays: number,
  timing: ExecutionTiming = "NEXT_SESSION",
  roundTripBps: number = COST_SCENARIOS.base.roundTripBps,
) {
  const fill = nextSessionForward(bars, asOf, holdTradingDays, timing);
  if (!fill) return null;
  return {
    ...fill,
    netReturn: applyRoundTripCost(fill.grossReturn, roundTripBps),
  };
}

export function decaySeries(
  bars: { date: string; close: number }[],
  asOf: string,
  timing: ExecutionTiming,
  roundTripBps: number,
) {
  const out: Record<string, number | null> = {};
  for (const h of DECAY_HORIZONS) {
    const t = realizedTrade(bars, asOf, h, timing, roundTripBps);
    out[`${h}d`] = t?.netReturn ?? null;
  }
  return out;
}

export function regimeAt(bars: { date: string; close: number; high?: number | null; low?: number | null; open?: number | null }[], asOf: string) {
  const through = sliceThrough(bars, asOf);
  if (through.length < 50) return "NEUTRAL";
  const rets = calculateReturns(through);
  const mas = computeMaBundle(through);
  const last = through[through.length - 1].close;
  const ath = Math.max(...through.map((b) => b.close));
  const dd = ath > 0 ? ((ath - last) / ath) * 100 : 0;
  return detectMarketRegime({
    nifty50Return1y: rets.y1,
    nifty50Return6m: rets.m6,
    nifty50Return1m: rets.m1,
    nifty50PriceVs50: mas.priceVs50,
    nifty50PriceVs200: mas.priceVs200,
    nifty50Drawdown: dd,
    nifty500Return1y: null,
  }).regime;
}

export function buildAlphaPanel(
  trades: (Trade & { regime?: string | null; decay?: Record<string, number | null> })[],
  stats: { overall: TradeStats; inSample: TradeStats; outOfSample: TradeStats },
  opts: { timing: ExecutionTiming; roundTripBps: number; survivorshipNote: string },
) {
  const nets = trades.map((t) => t.forwardReturn).filter((v): v is number => v != null);
  const ev = expectedValue(nets);
  const evidence = evidenceStrength({
    sample: ev.sample,
    winRate: stats.overall.winRate,
    oosSample: stats.outOfSample.withOutcome,
    oosWinRate: stats.outOfSample.winRate,
    parameterStable: true,
  });
  const byRegime = new Map<string, number[]>();
  for (const t of trades) {
    if (t.forwardReturn == null) continue;
    const key = t.regime ?? "UNKNOWN";
    const arr = byRegime.get(key) ?? [];
    arr.push(t.forwardReturn);
    byRegime.set(key, arr);
  }
  const regimeMatrix = [...byRegime.entries()].map(([regime, rets]) => ({
    regime,
    ...expectedValue(rets),
  }));
  const decayBuckets: Record<string, number[]> = {};
  for (const t of trades) {
    if (!t.decay) continue;
    for (const [h, v] of Object.entries(t.decay)) {
      if (v == null) continue;
      (decayBuckets[h] ??= []).push(v);
    }
  }
  const cost = {
    low: expectedValue(nets.map((r) => r + (opts.roundTripBps - COST_SCENARIOS.low.roundTripBps) / 100)),
    base: ev,
    high: expectedValue(nets.map((r) => r - (COST_SCENARIOS.high.roundTripBps - opts.roundTripBps) / 100)),
  };
  const costSensitive =
    cost.base.expectedReturn != null &&
    cost.high.expectedReturn != null &&
    cost.base.expectedReturn > 0 &&
    cost.high.expectedReturn <= 0;

  return {
    model: ALPHA_MODEL,
    execution: { timing: opts.timing, roundTripBps: opts.roundTripBps, note: EXECUTION.note },
    expectedValue: ev,
    evidence,
    regimeMatrix,
    decay: alphaDecay(decayBuckets),
    costSensitivity: {
      ...cost,
      flag: costSensitive ? "Cost-sensitive strategy" : null,
      note: "Alpha after estimated NSE cash round-trip costs (research assumption, not a broker quote).",
    },
    robustness: rankRobustness({
      cagr: stats.overall.averageReturn,
      maxDrawdown: stats.overall.maxDrawdownOfTradeReturns,
      oosCagr: stats.outOfSample.averageReturn,
      sharpe: stats.overall.sharpe,
    }),
    survivorship: opts.survivorshipNote,
    bestForRegime: bestRegimeStrategies(regimeMatrix),
  };
}

function bestRegimeStrategies(matrix: { regime: string; expectedReturn: number | null; sample: number; note: string }[]) {
  const usable = matrix.filter((m) => m.sample >= 10 && m.expectedReturn != null);
  if (!usable.length) {
    return {
      pick: null,
      note: "Insufficient per-regime sample to name a historically stronger environment.",
    };
  }
  usable.sort((a, b) => (b.expectedReturn ?? -999) - (a.expectedReturn ?? -999));
  return {
    pick: usable[0].regime,
    note: `Historically, this screen’s completed outcomes were strongest in ${usable[0].regime} (${usable[0].sample} observations). Not a forecast.`,
  };
}

export function capitalPreservationWarning(regime: string | null | undefined) {
  if (regime === "BEAR" || regime === "HIGH_VOLATILITY" || regime === "CORRECTION") {
    return "AGGRESSIVE SIGNALS CARRY ELEVATED SYSTEMIC RISK — breadth and drawdown context first.";
  }
  return null;
}
