import type { PriceBar } from "./trading-days";

export type TrendState =
  | "STRONG_UPTREND"
  | "UPTREND"
  | "SIDEWAYS"
  | "DOWNTREND"
  | "STRONG_DOWNTREND";

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

export function smaAt(values: number[], endIndexInclusive: number, period: number): number | null {
  if (endIndexInclusive + 1 < period) return null;
  const start = endIndexInclusive - period + 1;
  if (start < 0) return null;
  let sum = 0;
  for (let i = start; i <= endIndexInclusive; i++) sum += values[i];
  return sum / period;
}

export function maSlopePct(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export function priceVsMa(price: number, ma: number | null): number | null {
  if (ma == null || ma === 0) return null;
  return ((price - ma) / ma) * 100;
}

export function crossedAbove(prevPrice: number, prevMa: number, price: number, ma: number): boolean {
  return prevPrice <= prevMa && price > ma;
}

export function crossedBelow(prevPrice: number, prevMa: number, price: number, ma: number): boolean {
  return prevPrice >= prevMa && price < ma;
}

export function classifyTrend(input: {
  price: number;
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
  ma50Slope: number | null;
  ma200Slope: number | null;
}): TrendState {
  const { price, ma50, ma100, ma200, ma50Slope, ma200Slope } = input;
  const above50 = ma50 != null && price > ma50;
  const above200 = ma200 != null && price > ma200;
  const stacked = ma50 != null && ma100 != null && ma200 != null && ma50 > ma100 && ma100 > ma200;
  const inverted = ma50 != null && ma100 != null && ma200 != null && ma50 < ma100 && ma100 < ma200;

  if (above50 && above200 && stacked && (ma50Slope ?? 0) > 0 && (ma200Slope ?? 0) > 0) {
    return "STRONG_UPTREND";
  }
  if (above50 && above200) return "UPTREND";
  if (!above50 && !above200 && inverted && (ma200Slope ?? 0) < 0) return "STRONG_DOWNTREND";
  if (!above50 && !above200) return "DOWNTREND";
  return "SIDEWAYS";
}

export function computeMaBundle(sorted: PriceBar[]) {
  const closes = sorted.map((b) => b.close);
  const price = closes[closes.length - 1];
  const prev = closes.length > 1 ? closes[closes.length - 2] : null;

  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma100 = sma(closes, 100);
  const ma200 = sma(closes, 200);

  const prevMa20 = prev != null ? sma(closes.slice(0, -1), 20) : null;
  const prevMa50 = prev != null ? sma(closes.slice(0, -1), 50) : null;
  const prevMa200 = prev != null ? sma(closes.slice(0, -1), 200) : null;

  const ma50Prior = smaAt(closes, closes.length - 6, 50);
  const ma100Prior = smaAt(closes, closes.length - 6, 100);
  const ma200Prior = smaAt(closes, closes.length - 21, 200);

  const ma50Slope = maSlopePct(ma50, ma50Prior);
  const ma100Slope = maSlopePct(ma100, ma100Prior);
  const ma200Slope = maSlopePct(ma200, ma200Prior);

  return {
    price,
    ma20,
    ma50,
    ma100,
    ma200,
    priceVs20: priceVsMa(price, ma20),
    priceVs50: priceVsMa(price, ma50),
    priceVs100: priceVsMa(price, ma100),
    priceVs200: priceVsMa(price, ma200),
    ma50Slope,
    ma100Slope,
    ma200Slope,
    cross20: prev != null && ma20 != null && prevMa20 != null ? crossedAbove(prev, prevMa20, price, ma20) : false,
    cross50: prev != null && ma50 != null && prevMa50 != null ? crossedAbove(prev, prevMa50, price, ma50) : false,
    cross200: prev != null && ma200 != null && prevMa200 != null ? crossedAbove(prev, prevMa200, price, ma200) : false,
    crossBelow50: prev != null && ma50 != null && prevMa50 != null ? crossedBelow(prev, prevMa50, price, ma50) : false,
    crossBelow200: prev != null && ma200 != null && prevMa200 != null ? crossedBelow(prev, prevMa200, price, ma200) : false,
    goldenCross:
      ma50 != null && ma200 != null && prevMa50 != null && prevMa200 != null
        ? crossedAbove(prevMa50, prevMa200, ma50, ma200)
        : false,
    trendState: classifyTrend({
      price,
      ma50,
      ma100,
      ma200,
      ma50Slope,
      ma200Slope,
    }),
  };
}
