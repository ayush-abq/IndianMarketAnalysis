import { clamp } from "@/lib/utils";
import type { TrendState } from "@/calculations/moving-averages";

function mapReturn(value: number | null, scale: number): number | null {
  if (value == null) return null;
  return clamp(50 - (value / scale) * 50, 0, 100);
}

/**
 * Higher = weaker / more negative momentum (research framing).
 * A reversal (short-term improving while long-term weak) lowers this score.
 */
export function momentumScore(input: {
  d1: number | null;
  d5: number | null;
  d20: number | null;
  d50: number | null;
  d200: number | null;
  trendState: TrendState;
}): number {
  const parts = [
    mapReturn(input.d1, 3),
    mapReturn(input.d5, 8),
    mapReturn(input.d20, 15),
    mapReturn(input.d50, 25),
    mapReturn(input.d200, 40),
  ].filter((v): v is number => v != null);

  const base = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 50;
  const trendAdj =
    input.trendState === "STRONG_DOWNTREND"
      ? 12
      : input.trendState === "DOWNTREND"
        ? 6
        : input.trendState === "STRONG_UPTREND"
          ? -12
          : input.trendState === "UPTREND"
            ? -6
            : 0;
  return clamp(base + trendAdj, 0, 100);
}

/**
 * 0–100 where higher means short-term momentum is improving vs recent decline.
 */
export function momentumReversalScore(input: {
  d5: number | null;
  d20: number | null;
  m3: number | null;
  priceVs50: number | null;
  trendState: TrendState;
}): number {
  let score = 0;
  if ((input.d5 ?? -99) > 0) score += 25;
  else if ((input.d5 ?? -99) > -2) score += 12;
  if ((input.d20 ?? -99) > 0) score += 25;
  else if ((input.d20 ?? -99) > -4) score += 10;
  if ((input.m3 ?? -99) > 0) score += 20;
  if ((input.priceVs50 ?? -99) > 0) score += 20;
  if (input.trendState === "UPTREND" || input.trendState === "STRONG_UPTREND") score += 10;
  else if (input.trendState === "SIDEWAYS") score += 5;
  return clamp(score, 0, 100);
}
