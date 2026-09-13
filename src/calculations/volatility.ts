import type { PriceBar } from "./trading-days";

export function dailyLogReturns(sorted: PriceBar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    const cur = sorted[i].close;
    if (prev > 0 && cur > 0) out.push(Math.log(cur / prev));
  }
  return out;
}

export function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function realizedVol20d(sorted: PriceBar[]): number | null {
  const rets = dailyLogReturns(sorted).slice(-20);
  const s = stdev(rets);
  if (s == null) return null;
  return s * Math.sqrt(252) * 100;
}

export function volPercentile(currentVol: number | null, historyVols: number[]): number | null {
  if (currentVol == null || !historyVols.length) return null;
  const below = historyVols.filter((v) => v <= currentVol).length;
  return (below / historyVols.length) * 100;
}
