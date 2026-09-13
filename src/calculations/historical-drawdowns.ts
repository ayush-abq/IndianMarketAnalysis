import { runningDrawdownSeries } from "./drawdown";
import type { PriceBar } from "./trading-days";

export type DrawdownEpisode = {
  startDate: string;
  troughDate: string;
  recoveryDate: string | null;
  peakDate: string;
  peakValue: number;
  troughValue: number;
  maxDrawdownPct: number;
  recoveryDays: number | null;
};

export type HistoricalDrawdownStats = {
  maxHistoricalDrawdown: number;
  maxHistoricalDrawdownDate: string;
  episodes: DrawdownEpisode[];
  priorDrawdowns30: number;
  priorDrawdowns40: number;
  priorDrawdowns50: number;
  avgRecoveryDays20: number | null;
  avgRecoveryDays30: number | null;
  avgRecoveryDays40: number | null;
  avgRecoveryDays50: number | null;
  currentTrough: { date: string; close: number } | null;
  daysBelow: (threshold: number) => number;
  recoveryFromTroughPct: number | null;
  drawdownPercentile: number | null;
};

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Identifies peak-to-trough-to-recovery episodes using only data through as-of.
 * A new ATH after a drawdown ends the episode (no look-ahead).
 */
export function analyzeHistoricalDrawdowns(sorted: PriceBar[]): HistoricalDrawdownStats | null {
  if (sorted.length < 2) return null;

  let peak = sorted[0].close;
  let peakDate = sorted[0].date;
  let trough = sorted[0].close;
  let troughDate = sorted[0].date;
  let inDrawdown = false;
  const episodes: DrawdownEpisode[] = [];

  const finalize = (recoveryDate: string | null, recoveryClose?: number) => {
    const maxDd = ((trough - peak) / peak) * 100;
    const recoveryDays =
      recoveryDate != null
        ? Math.round(
            (Date.parse(`${recoveryDate}T00:00:00Z`) - Date.parse(`${troughDate}T00:00:00Z`)) /
              86_400_000,
          )
        : null;
    episodes.push({
      startDate: peakDate,
      troughDate,
      recoveryDate,
      peakDate,
      peakValue: peak,
      troughValue: trough,
      maxDrawdownPct: maxDd,
      recoveryDays,
    });
    void recoveryClose;
  };

  for (let i = 1; i < sorted.length; i++) {
    const bar = sorted[i];
    if (bar.close >= peak) {
      if (inDrawdown) finalize(bar.date, bar.close);
      peak = bar.close;
      peakDate = bar.date;
      trough = bar.close;
      troughDate = bar.date;
      inDrawdown = false;
    } else {
      inDrawdown = true;
      if (bar.close < trough) {
        trough = bar.close;
        troughDate = bar.date;
      }
    }
  }
  if (inDrawdown) finalize(null);

  const completed = episodes.filter((e) => e.recoveryDate);
  const avgFor = (threshold: number) =>
    mean(completed.filter((e) => Math.abs(e.maxDrawdownPct) >= threshold).map((e) => e.recoveryDays!).filter((d) => d != null));

  const series = runningDrawdownSeries(sorted);
  const distances = series.map((s) => s.distanceFromAth);
  const currentDistance = distances[distances.length - 1] ?? 0;
  const below = distances.filter((d) => d <= currentDistance).length;
  const drawdownPercentile = distances.length ? (below / distances.length) * 100 : null;

  let maxDd = 0;
  let maxDdDate = sorted[0].date;
  for (const e of episodes) {
    if (e.maxDrawdownPct < maxDd) {
      maxDd = e.maxDrawdownPct;
      maxDdDate = e.troughDate;
    }
  }

  const last = sorted[sorted.length - 1];
  const openEpisode = episodes.find((e) => e.recoveryDate == null);
  const currentTrough = openEpisode
    ? { date: openEpisode.troughDate, close: openEpisode.troughValue }
    : { date: last.date, close: last.close };

  const recoveryFromTroughPct =
    currentTrough.close > 0 ? ((last.close - currentTrough.close) / currentTrough.close) * 100 : null;

  const daysBelow = (threshold: number) => {
    let count = 0;
    let streak = 0;
    for (const s of series) {
      if (s.distanceFromAth >= threshold) {
        streak += 1;
        count = streak;
      } else {
        streak = 0;
      }
    }
    return count;
  };

  return {
    maxHistoricalDrawdown: maxDd,
    maxHistoricalDrawdownDate: maxDdDate,
    episodes,
    priorDrawdowns30: episodes.filter((e) => Math.abs(e.maxDrawdownPct) >= 30).length,
    priorDrawdowns40: episodes.filter((e) => Math.abs(e.maxDrawdownPct) >= 40).length,
    priorDrawdowns50: episodes.filter((e) => Math.abs(e.maxDrawdownPct) >= 50).length,
    avgRecoveryDays20: avgFor(20),
    avgRecoveryDays30: avgFor(30),
    avgRecoveryDays40: avgFor(40),
    avgRecoveryDays50: avgFor(50),
    currentTrough,
    daysBelow,
    recoveryFromTroughPct,
    drawdownPercentile,
  };
}

export function recoveryWindowReturn(sorted: PriceBar[], tradingDays: number): number | null {
  if (sorted.length < 2) return null;
  const hist = analyzeHistoricalDrawdowns(sorted);
  if (!hist?.currentTrough) return null;
  const last = sorted[sorted.length - 1];
  const fromIdx = Math.max(0, sorted.length - 1 - tradingDays);
  const from = sorted[fromIdx];
  if (!from || from.close <= 0) return null;
  // Recovery over window is price change of last N trading days (from trough context)
  return ((last.close / from.close) - 1) * 100;
}
