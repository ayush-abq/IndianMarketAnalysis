import type { ClassificationMetrics, FinancialMetrics } from "./types";

function clamp01(p: number) {
  return Math.min(1 - 1e-9, Math.max(1e-9, p));
}

export function classificationMetrics(y: number[], p: number[], threshold = 0.5): ClassificationMetrics {
  const n = Math.min(y.length, p.length);
  if (!n) {
    return { n: 0, accuracy: null, precision: null, recall: null, f1: null, rocAuc: null, prAuc: null, logLoss: null, brier: null };
  }
  let tp = 0, fp = 0, tn = 0, fn = 0, log = 0, brier = 0;
  for (let i = 0; i < n; i++) {
    const pred = p[i] >= threshold ? 1 : 0;
    if (pred === 1 && y[i] === 1) tp += 1;
    else if (pred === 1) fp += 1;
    else if (y[i] === 1) fn += 1;
    else tn += 1;
    const pi = clamp01(p[i]);
    log += -(y[i] * Math.log(pi) + (1 - y[i]) * Math.log(1 - pi));
    brier += (p[i] - y[i]) ** 2;
  }
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision != null && recall != null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null;
  return {
    n,
    accuracy: (tp + tn) / n,
    precision,
    recall,
    f1,
    rocAuc: rocAuc(y, p),
    prAuc: prAuc(y, p),
    logLoss: log / n,
    brier: brier / n,
  };
}

export function rocAuc(y: number[], p: number[]): number | null {
  const pairs = y.map((yi, i) => ({ y: yi, p: p[i] })).sort((a, b) => a.p - b.p);
  const pos = pairs.filter((r) => r.y === 1).length;
  const neg = pairs.length - pos;
  if (!pos || !neg) return null;
  let rankSum = 0;
  pairs.forEach((r, i) => {
    if (r.y === 1) rankSum += i + 1;
  });
  return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}

export function prAuc(y: number[], p: number[]): number | null {
  const order = y.map((yi, i) => ({ y: yi, p: p[i] })).sort((a, b) => b.p - a.p);
  const pos = order.filter((r) => r.y === 1).length;
  if (!pos) return null;
  let tp = 0;
  let fp = 0;
  let prevRecall = 0;
  let auc = 0;
  for (const r of order) {
    if (r.y === 1) tp += 1;
    else fp += 1;
    const recall = tp / pos;
    const precision = tp / (tp + fp);
    auc += (recall - prevRecall) * precision;
    prevRecall = recall;
  }
  return auc;
}

export function financialMetrics(returns: number[]): FinancialMetrics {
  const n = returns.length;
  if (!n) {
    return { n: 0, hitRate: null, cagr: null, sharpe: null, sortino: null, maxDrawdown: null, profitFactor: null, expectancy: null };
  }
  const hits = returns.filter((r) => r > 0).length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const downside = returns.filter((r) => r < 0);
  const downVar = downside.length ? downside.reduce((a, r) => a + r ** 2, 0) / downside.length : 0;
  const gains = returns.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const losses = Math.abs(returns.filter((r) => r < 0).reduce((a, b) => a + b, 0));
  let eq = 1;
  let peak = 1;
  let maxDd = 0;
  for (const r of returns) {
    eq *= 1 + r / 100;
    peak = Math.max(peak, eq);
    maxDd = Math.max(maxDd, peak > 0 ? (peak - eq) / peak : 0);
  }
  const years = n / 12;
  return {
    n,
    hitRate: hits / n,
    cagr: years > 0 && eq > 0 ? (eq ** (1 / years) - 1) * 100 : null,
    sharpe: std > 0 ? (mean / std) * Math.sqrt(12) : null,
    sortino: downVar > 0 ? (mean / Math.sqrt(downVar)) * Math.sqrt(12) : null,
    maxDrawdown: maxDd * 100,
    profitFactor: losses > 0 ? gains / losses : null,
    expectancy: mean,
  };
}

export function encodeFeatures(keys: string[], features: Record<string, number | null>, medians?: Record<string, number>) {
  return keys.map((k) => {
    const v = features[k];
    if (v != null && Number.isFinite(v)) return v;
    return medians?.[k] ?? 0;
  });
}

export function featureMedians(rows: Record<string, number | null>[], keys: string[]) {
  const out: Record<string, number> = {};
  for (const k of keys) {
    const vals = rows.map((r) => r[k]).filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
    out[k] = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  }
  return out;
}
