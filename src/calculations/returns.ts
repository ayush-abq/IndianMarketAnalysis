import { barNTradingDaysAgo } from "./trading-days";
import type { PriceBar } from "./trading-days";

export const TRADING_DAY_PERIODS = {
  d1: 1,
  w1: 5,
  m1: 21,
  m3: 63,
  m6: 126,
  y1: 252,
  y2: 504,
  y3: 756,
  y5: 1260,
  d5: 5,
  d20: 20,
  d50: 50,
  d100: 100,
  d200: 200,
} as const;

export type PeriodKey = keyof typeof TRADING_DAY_PERIODS;

export type ReturnMap = Record<PeriodKey | "sinceInception", number | null>;

export function periodReturn(current: number, past: number | null | undefined): number | null {
  if (past == null || !Number.isFinite(past) || past === 0) return null;
  if (!Number.isFinite(current)) return null;
  return ((current / past) - 1) * 100;
}

export function calculateReturns(sortedThroughDate: PriceBar[]): ReturnMap {
  const empty: ReturnMap = {
    d1: null,
    w1: null,
    m1: null,
    m3: null,
    m6: null,
    y1: null,
    y2: null,
    y3: null,
    y5: null,
    d5: null,
    d20: null,
    d50: null,
    d100: null,
    d200: null,
    sinceInception: null,
  };
  if (sortedThroughDate.length < 2) return empty;

  const asOfIndex = sortedThroughDate.length - 1;
  const current = sortedThroughDate[asOfIndex].close;
  const first = sortedThroughDate[0].close;

  const result = { ...empty };
  for (const [key, days] of Object.entries(TRADING_DAY_PERIODS) as [PeriodKey, number][]) {
    const past = barNTradingDaysAgo(sortedThroughDate, asOfIndex, days);
    result[key] = past ? periodReturn(current, past.close) : null;
  }
  result.sinceInception = periodReturn(current, first);
  return result;
}

export function classifyReturn(
  value: number | null,
  thresholds: { bad: number; very_bad: number; extreme: number },
): "INSUFFICIENT" | "EXTREME" | "VERY_BAD" | "BAD" | "NEUTRAL" | "POSITIVE" {
  if (value == null) return "INSUFFICIENT";
  if (value <= thresholds.extreme) return "EXTREME";
  if (value <= thresholds.very_bad) return "VERY_BAD";
  if (value <= thresholds.bad) return "BAD";
  if (value <= 0) return "NEUTRAL";
  return "POSITIVE";
}
