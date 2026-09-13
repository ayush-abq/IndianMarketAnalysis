import { clamp } from "@/lib/utils";
import { stdev } from "@/calculations/volatility";
import { analyzeHistoricalDrawdowns } from "@/calculations/historical-drawdowns";
import type { PriceBar } from "@/calculations/trading-days";

export type NavPoint = { date: string; nav: number };

export function navToBars(points: NavPoint[]): PriceBar[] {
  return points.map((p) => ({ date: p.date, close: p.nav, open: p.nav, high: p.nav, low: p.nav }));
}

export function absoluteReturn(end: number, start: number): number | null {
  if (!Number.isFinite(end) || !Number.isFinite(start) || start <= 0) return null;
  return ((end / start) - 1) * 100;
}

export function cagr(end: number, start: number, years: number): number | null {
  if (!Number.isFinite(end) || !Number.isFinite(start) || start <= 0 || years <= 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export function yearsBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (365.25 * 86_400_000);
}

export function closestOnOrBefore(sorted: NavPoint[], asOf: string): NavPoint | null {
  let found: NavPoint | null = null;
  for (const p of sorted) {
    if (p.date <= asOf) found = p;
    else break;
  }
  return found;
}

export function pointYearsAgo(sorted: NavPoint[], asOf: string, years: number): NavPoint | null {
  const end = closestOnOrBefore(sorted, asOf);
  if (!end) return null;
  const targetMs = Date.parse(`${end.date}T00:00:00Z`) - years * 365.25 * 86_400_000;
  const target = new Date(targetMs).toISOString().slice(0, 10);
  return closestOnOrBefore(sorted, target);
}

export function periodStats(sorted: NavPoint[], asOf: string, years: number): { abs: number | null; cagr: number | null } {
  const end = closestOnOrBefore(sorted, asOf);
  const start = pointYearsAgo(sorted, asOf, years);
  if (!end || !start || start.date === end.date) return { abs: null, cagr: null };
  const abs = absoluteReturn(end.nav, start.nav);
  const y = yearsBetween(start.date, end.date);
  return { abs, cagr: y >= 1 ? cagr(end.nav, start.nav, y) : abs };
}

/**
 * Newton–Raphson XIRR. Cash flows: negative contributions, positive terminal value.
 */
export function xirr(cashflows: { date: string; amount: number }[], guess = 0.12): number | null {
  if (cashflows.length < 2) return null;
  const t0 = Date.parse(`${cashflows[0].date}T00:00:00Z`);
  const years = cashflows.map((c) => (Date.parse(`${c.date}T00:00:00Z`) - t0) / (365.25 * 86_400_000));
  let rate = guess;
  for (let i = 0; i < 80; i++) {
    let f = 0;
    let df = 0;
    for (let j = 0; j < cashflows.length; j++) {
      const t = years[j];
      const denom = (1 + rate) ** t;
      if (!Number.isFinite(denom) || denom === 0) return null;
      f += cashflows[j].amount / denom;
      df += (-t * cashflows[j].amount) / ((1 + rate) ** (t + 1));
    }
    if (Math.abs(df) < 1e-12) break;
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.99) return null;
    if (Math.abs(next - rate) < 1e-8) {
      const pct = next * 100;
      return Number.isFinite(pct) && Math.abs(pct) < 5000 ? pct : null;
    }
    rate = next;
  }
  const pct = rate * 100;
  return Number.isFinite(pct) && Math.abs(pct) < 5000 ? pct : null;
}

export function sipResult(
  sorted: NavPoint[],
  asOf: string,
  years: number,
  amount: number,
  frequency: "monthly" | "quarterly" = "monthly",
) {
  const end = closestOnOrBefore(sorted, asOf);
  if (!end) return null;
  const start = pointYearsAgo(sorted, asOf, years);
  if (!start) return null;
  const stepMonths = frequency === "quarterly" ? 3 : 1;
  const flows: { date: string; amount: number }[] = [];
  let units = 0;
  let invested = 0;
  const cursor = new Date(`${start.date}T00:00:00Z`);
  const last = new Date(`${end.date}T00:00:00Z`);
  while (cursor <= last) {
    const d = cursor.toISOString().slice(0, 10);
    const nav = closestOnOrBefore(sorted, d);
    if (nav && nav.nav > 0) {
      units += amount / nav.nav;
      invested += amount;
      flows.push({ date: nav.date, amount: -amount });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + stepMonths);
  }
  if (!invested || !units) return null;
  const currentValue = units * end.nav;
  flows.push({ date: end.date, amount: currentValue });
  return {
    invested,
    currentValue,
    profit: currentValue - invested,
    absoluteReturn: ((currentValue / invested) - 1) * 100,
    xirr: xirr(flows),
    years,
    amount,
    frequency,
  };
}

export function lumpsumResult(sorted: NavPoint[], asOf: string, years: number, amount: number) {
  const stats = periodStats(sorted, asOf, years);
  if (stats.abs == null) return null;
  const currentValue = amount * (1 + stats.abs / 100);
  return {
    invested: amount,
    currentValue,
    profit: currentValue - amount,
    absoluteReturn: stats.abs,
    cagr: years >= 1 ? stats.cagr : stats.abs,
    years,
  };
}

export function monthlyLogReturns(sorted: NavPoint[]): number[] {
  const monthly: NavPoint[] = [];
  let lastMonth = "";
  for (const p of sorted) {
    const ym = p.date.slice(0, 7);
    if (ym !== lastMonth) {
      monthly.push(p);
      lastMonth = ym;
    } else {
      monthly[monthly.length - 1] = p;
    }
  }
  const out: number[] = [];
  for (let i = 1; i < monthly.length; i++) {
    if (monthly[i - 1].nav > 0) out.push(Math.log(monthly[i].nav / monthly[i - 1].nav));
  }
  return out;
}

export function annualizedVol(sorted: NavPoint[]): number | null {
  const r = monthlyLogReturns(sorted);
  const s = stdev(r);
  if (s == null) return null;
  return s * Math.sqrt(12) * 100;
}

export function sharpeRatio(cagrPct: number | null, volPct: number | null, rf = 6.5): number | null {
  if (cagrPct == null || volPct == null || volPct === 0) return null;
  return (cagrPct - rf) / volPct;
}

export function sortinoRatio(sorted: NavPoint[], cagrPct: number | null, rf = 6.5): number | null {
  if (cagrPct == null) return null;
  const r = monthlyLogReturns(sorted).map((x) => (Math.exp(x) - 1) * 100);
  const downside = r.filter((x) => x < rf / 12);
  if (downside.length < 2) return null;
  const dd = stdev(downside.map((x) => x - rf / 12));
  if (dd == null || dd === 0) return null;
  const s = (cagrPct - rf) / (dd * Math.sqrt(12));
  return Number.isFinite(s) && Math.abs(s) < 1000 ? s : null;
}

export function downsideDeviation(sorted: NavPoint[], rf = 6.5): number | null {
  const r = monthlyLogReturns(sorted).map((x) => (Math.exp(x) - 1) * 100);
  const downs = r.filter((x) => x < rf / 12).map((x) => x - rf / 12);
  const s = stdev(downs);
  return s == null ? null : s * Math.sqrt(12);
}

export function betaAlpha(
  fund: NavPoint[],
  bench: NavPoint[],
  fundCagr: number | null,
  benchCagr: number | null,
  rf = 6.5,
): { beta: number | null; alpha: number | null; treynor: number | null } {
  const fr = monthlyLogReturns(fund);
  const br = monthlyLogReturns(bench);
  const n = Math.min(fr.length, br.length);
  if (n < 12) return { beta: null, alpha: null, treynor: null };
  const f = fr.slice(-n);
  const b = br.slice(-n);
  const meanF = f.reduce((a, x) => a + x, 0) / n;
  const meanB = b.reduce((a, x) => a + x, 0) / n;
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (f[i] - meanF) * (b[i] - meanB);
    varB += (b[i] - meanB) ** 2;
  }
  const beta = varB === 0 ? null : cov / varB;
  const alpha =
    fundCagr != null && benchCagr != null && beta != null ? fundCagr - (rf + beta * (benchCagr - rf)) : null;
  const treynor = beta != null && beta !== 0 && fundCagr != null ? (fundCagr - rf) / beta : null;
  return { beta, alpha, treynor };
}

export function captureRatios(fund: NavPoint[], bench: NavPoint[]): { up: number | null; down: number | null } {
  const fr = monthlyLogReturns(fund).map((x) => (Math.exp(x) - 1) * 100);
  const br = monthlyLogReturns(bench).map((x) => (Math.exp(x) - 1) * 100);
  const n = Math.min(fr.length, br.length);
  if (n < 12) return { up: null, down: null };
  let fu = 0, bu = 0, fd = 0, bd = 0, nu = 0, nd = 0;
  for (let i = 0; i < n; i++) {
    const fi = fr[fr.length - n + i];
    const bi = br[br.length - n + i];
    if (bi >= 0) {
      fu += fi;
      bu += bi;
      nu += 1;
    } else {
      fd += fi;
      bd += bi;
      nd += 1;
    }
  }
  return {
    up: nu && bu !== 0 ? (fu / nu) / (bu / nu) * 100 : null,
    down: nd && bd !== 0 ? (fd / nd) / (bd / nd) * 100 : null,
  };
}

export function rollingCagr(sorted: NavPoint[], windowYears: number, asOf: string): number[] {
  const end = closestOnOrBefore(sorted, asOf);
  if (!end) return [];
  const out: number[] = [];
  const windowMs = windowYears * 365.25 * 86_400_000;
  const monthly = monthlyPoints(sorted.filter((p) => p.date <= asOf));
  for (const p of monthly) {
    const startDate = new Date(Date.parse(`${p.date}T00:00:00Z`) - windowMs).toISOString().slice(0, 10);
    const start = closestOnOrBefore(sorted, startDate);
    if (!start || start.date >= p.date) continue;
    const y = yearsBetween(start.date, p.date);
    if (y < windowYears * 0.9) continue;
    const v = cagr(p.nav, start.nav, y);
    if (v != null) out.push(v);
  }
  return out;
}

export function summarizeRolling(values: number[]) {
  if (!values.length) return { avg: null, median: null, min: null, max: null, stdev: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stdev: stdev(values),
  };
}

function monthlyPoints(sorted: NavPoint[]): NavPoint[] {
  const out: NavPoint[] = [];
  let last = "";
  for (const p of sorted) {
    const ym = p.date.slice(0, 7);
    if (ym !== last) {
      out.push(p);
      last = ym;
    } else out[out.length - 1] = p;
  }
  return out;
}

export function calendarYearReturns(sorted: NavPoint[]): { year: number; ret: number }[] {
  const byYear = new Map<number, { first: NavPoint; last: NavPoint }>();
  for (const p of sorted) {
    const y = Number(p.date.slice(0, 4));
    const cur = byYear.get(y);
    if (!cur) byYear.set(y, { first: p, last: p });
    else cur.last = p;
  }
  return [...byYear.entries()]
    .map(([year, v]) => ({ year, ret: absoluteReturn(v.last.nav, v.first.nav) }))
    .filter((x): x is { year: number; ret: number } => x.ret != null);
}

export function expenseImpact(terDiffPct: number, years: number, start = 100000, growth = 0.12) {
  const high = start * (1 + growth) ** years;
  const low = start * (1 + (growth - terDiffPct / 100)) ** years;
  return { years, withoutExtraFee: high, withExtraFee: low, cost: high - low };
}

export function overlapHoldings(
  a: { isin?: string | null; securityName: string; weight: number }[],
  b: { isin?: string | null; securityName: string; weight: number }[],
) {
  const key = (h: { isin?: string | null; securityName: string }) =>
    (h.isin && h.isin.length > 6 ? h.isin : h.securityName).toUpperCase();
  const mapB = new Map(b.map((h) => [key(h), h]));
  const common: { name: string; weightA: number; weightB: number; minWeight: number }[] = [];
  let overlap = 0;
  for (const h of a) {
    const other = mapB.get(key(h));
    if (!other) continue;
    const minW = Math.min(h.weight, other.weight);
    overlap += minW;
    common.push({
      name: h.securityName,
      weightA: h.weight,
      weightB: other.weight,
      minWeight: minW,
    });
  }
  return { overlapPct: overlap, common: common.sort((x, y) => y.minWeight - x.minWeight) };
}

export function percentileRank(value: number, universe: number[]): number | null {
  if (!universe.length) return null;
  const below = universe.filter((v) => v <= value).length;
  return (below / universe.length) * 100;
}

export function navDrawdown(sorted: NavPoint[]) {
  const bars = navToBars(sorted);
  const hist = analyzeHistoricalDrawdowns(bars);
  if (!hist || !sorted.length) return null;
  const last = sorted[sorted.length - 1];
  let peak = -Infinity;
  for (const p of sorted) if (p.nav > peak) peak = p.nav;
  const current = peak > 0 ? ((peak - last.nav) / peak) * 100 : 0;
  return {
    maxDrawdown: hist.maxHistoricalDrawdown,
    maxDrawdownDate: hist.maxHistoricalDrawdownDate,
    currentDrawdown: current,
    recoveryFromTrough: hist.recoveryFromTroughPct,
    recoveryDays: hist.episodes.find((e) => e.recoveryDate)?.recoveryDays ?? null,
  };
}

export function scoreClamp(value: number | null, lo: number, hi: number, invert = false): number | null {
  if (value == null) return null;
  const n = clamp(((value - lo) / (hi - lo)) * 100, 0, 100);
  return invert ? 100 - n : n;
}

/** Future-value SIP calculator. Assumptions only — not a guaranteed return. */
export function sipFutureValue(monthly: number, annualRatePct: number, years: number) {
  const r = annualRatePct / 100 / 12;
  const n = Math.round(years * 12);
  const invested = monthly * n;
  const value = r === 0 ? invested : monthly * (((1 + r) ** n - 1) / r) * (1 + r);
  return { monthly, rate: annualRatePct, years, invested, value, profit: value - invested };
}

export function taxCategoryInfo(assetClass: string, category: string) {
  if (/elss/i.test(category)) {
    return {
      taxCategory: "ELSS (equity-oriented with lock-in)",
      holdingPeriodContext: "Statutory 3-year lock-in. After lock-in, equity LTCG/STCG rules typically apply.",
      exitLoadContext: "Lock-in usually supersedes exit load during the first 3 years.",
      source: "SEBI scheme classification / Income-tax Act. Display only — not tax advice.",
    };
  }
  if (assetClass === "Equity" || assetClass === "Index Fund" || assetClass === "ETF" || /aggressive hybrid/i.test(category)) {
    return {
      taxCategory: "Equity-oriented",
      holdingPeriodContext: "LTCG typically after 12 months; STCG if sold earlier. Surcharge/cess extra.",
      exitLoadContext: "See latest factsheet exit-load schedule. Not calculated here.",
      source: "SEBI scheme classification. Display only — not tax advice or liability calculation.",
    };
  }
  if (assetClass === "Debt" || /conservative hybrid|arbitrage/i.test(category)) {
    return {
      taxCategory: "Non-equity / debt-oriented (check scheme equity %)",
      holdingPeriodContext: "Acquisitions after 31 Mar 2023 are generally taxed at slab rates. Confirm with a tax advisor.",
      exitLoadContext: "See latest factsheet. Not calculated here.",
      source: "Finance Act / SEBI classification. Display only — not tax advice.",
    };
  }
  return {
    taxCategory: "See scheme documents",
    holdingPeriodContext: "Tax treatment depends on equity allocation and acquisition date.",
    exitLoadContext: "See latest factsheet. Not calculated here.",
    source: "Insufficient structured tax fields. No liability is calculated.",
  };
}

export function diversificationScore(input: {
  pairwiseOverlap: number | null;
  sectorHhi: number | null;
  assetClassCount: number;
  geographicCount: number;
}) {
  const overlap = input.pairwiseOverlap == null ? 50 : scoreClamp(input.pairwiseOverlap, 5, 70, true) ?? 50;
  const sector = input.sectorHhi == null ? 50 : scoreClamp(input.sectorHhi, 800, 4000, true) ?? 50;
  const assets = clamp(input.assetClassCount * 18, 10, 90);
  const geo = clamp(20 + input.geographicCount * 20, 20, 80);
  return clamp(overlap * 0.4 + sector * 0.3 + assets * 0.2 + geo * 0.1, 0, 100);
}
