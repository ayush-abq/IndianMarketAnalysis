import { periodReturn } from "@/calculations/returns";
import { loadBars } from "@/services/metrics";
import { loadStockBars } from "@/services/stock-metrics";
import { loadNavSeries } from "@/services/mf-queries";
import { portfolioRiskWarnings } from "@/services/research-lists";

export type PortfolioLegInput = {
  assetType: "SECTOR" | "STOCK" | "FUND" | "CASH" | "GOLD" | "OTHER";
  assetId: number;
  assetName: string;
  weightPct: number;
  sector?: string | null;
};

export async function analyzePortfolio(
  legs: PortfolioLegInput[],
  limits?: { maxSingle?: number; maxSector?: number; maxFund?: number },
) {
  const warnings = portfolioRiskWarnings(legs, limits);
  const series = await Promise.all(legs.map(async (leg) => ({ leg, bars: await seriesFor(leg) })));
  const available = series.filter((s) => s.bars.length >= 60);
  const missing = series.filter((s) => s.leg.assetType !== "CASH" && s.bars.length < 60).map((s) => s.leg.assetName);
  const corr = correlationMatrix(available.map((s) => ({ name: s.leg.assetName, closes: s.bars })));
  const hist = available.length ? historicalPortfolioStats(available) : null;
  return {
    disclaimer: "Historical portfolio statistics only. Not expected future returns. Missing series stay N/A.",
    warnings,
    missingHistory: missing,
    stats: hist,
    correlation: corr,
    stress: hist
      ? {
          niftyMinus10: hist.averageReturn != null ? hist.averageReturn * 0 : null,
          note: "Use Strategy Lab crisis windows for historically observed index shocks. Do not treat these as predictions.",
        }
      : null,
  };
}

async function seriesFor(leg: PortfolioLegInput): Promise<{ date: string; close: number }[]> {
  if (leg.assetType === "CASH") return [];
  if (leg.assetType === "SECTOR") return loadBars(leg.assetId, "PR");
  if (leg.assetType === "STOCK") return loadStockBars(leg.assetId);
  if (leg.assetType === "FUND") {
    const nav = await loadNavSeries(leg.assetId);
    return nav.map((p) => ({ date: p.date, close: Number(p.nav) }));
  }
  return [];
}

export function correlationMatrix(
  series: { name: string; closes: { date: string; close: number }[] }[],
  lookback = 252,
) {
  const names = series.map((s) => s.name);
  const rets = series.map((s) => dailyReturns(s.closes.slice(-lookback - 1)));
  const matrix: number[][] = names.map(() => names.map(() => NaN));
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < names.length; j++) {
      matrix[i][j] = pearson(rets[i], rets[j]) ?? NaN;
    }
  }
  return { names, matrix, lookbackTradingDays: lookback, note: "Pairwise Pearson of overlapping daily returns. N/A stays blank." };
}

function dailyReturns(bars: { close: number }[]) {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const r = periodReturn(bars[i].close, bars[i - 1].close);
    if (r != null) out.push(r);
  }
  return out;
}

function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 20) return null;
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = x[i] - mx;
    const vy = y[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

function historicalPortfolioStats(parts: { leg: PortfolioLegInput; bars: { date: string; close: number }[] }[]) {
  const dates = new Set<string>();
  for (const p of parts) for (const b of p.bars) dates.add(b.date);
  const ordered = [...dates].sort();
  const maps = parts.map((p) => new Map(p.bars.map((b) => [b.date, b.close])));
  const equity: number[] = [];
  let value = 100;
  let peak = 100;
  let maxDd = 0;
  const rets: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    let r = 0;
    let w = 0;
    for (let j = 0; j < parts.length; j++) {
      const prev = maps[j].get(ordered[i - 1]);
      const cur = maps[j].get(ordered[i]);
      if (prev == null || cur == null) continue;
      const pr = periodReturn(cur, prev);
      if (pr == null) continue;
      r += pr * (parts[j].leg.weightPct / 100);
      w += parts[j].leg.weightPct / 100;
    }
    if (w < 0.5) continue;
    rets.push(r);
    value *= 1 + r / 100;
    peak = Math.max(peak, value);
    maxDd = Math.min(maxDd, ((value - peak) / peak) * 100);
    equity.push(value);
  }
  if (!rets.length) return { averageReturn: null, volatility: null, maxDrawdown: null, lastEquity: null };
  const avg = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varr = rets.reduce((a, b) => a + (b - avg) ** 2, 0) / rets.length;
  return {
    averageReturn: avg * 252,
    volatility: Math.sqrt(varr) * Math.sqrt(252),
    maxDrawdown: maxDd,
    lastEquity: equity.at(-1) ?? null,
    observations: rets.length,
  };
}

export function stressFromBeta(portfolioReturn: number | null, shockPct: number, beta = 1) {
  if (portfolioReturn == null) return null;
  return shockPct * beta;
}
