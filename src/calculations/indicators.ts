import type { PriceBar } from "./trading-days";

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(closes: number[]) {
  if (closes.length < 35) return { macd: null, signal: null, hist: null };
  const ema = (period: number) => {
    const k = 2 / (period + 1);
    let v = closes[0];
    for (let i = 1; i < closes.length; i++) v = closes[i] * k + v * (1 - k);
    return v;
  };
  const line = ema(12) - ema(26);
  const signal = line; // last-point approximation; full series needed for a true signal EMA
  return { macd: line, signal, hist: line - signal };
}

export function atr(bars: PriceBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high ?? bars[i].close;
    const l = bars[i].low ?? bars[i].close;
    const pc = bars[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function bollinger(closes: number[], period = 20, k = 2) {
  if (closes.length < period) return { mid: null, upper: null, lower: null };
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { mid, upper: mid + k * sd, lower: mid - k * sd };
}

export function rsScore(stockRet: number | null, benchRet: number | null): number | null {
  if (stockRet == null || benchRet == null) return null;
  const excess = stockRet - benchRet;
  return Math.max(0, Math.min(100, 50 + excess * 2));
}
