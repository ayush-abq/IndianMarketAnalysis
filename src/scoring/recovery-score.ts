import { clamp } from "@/lib/utils";
import type { RECOVERY_WEIGHTS } from "@/config/defaults";

function norm(value: number | null, lo: number, hi: number): number {
  if (value == null) return 0;
  return clamp(((value - lo) / (hi - lo)) * 100, 0, 100);
}

export function recoveryScore(
  input: {
    recoveryFromTroughPct: number | null;
    return5d: number | null;
    return20d: number | null;
    priceVs50: number | null;
    priceVs200: number | null;
    return3m: number | null;
    return6m: number | null;
    rs1m: number | null;
    crossed50: boolean;
    crossed200: boolean;
    higherLow: boolean;
  },
  weights: typeof RECOVERY_WEIGHTS,
): number {
  const shortMomentum = clamp(
    ((input.return5d ?? 0) > 0 ? 40 : 0) +
      ((input.return20d ?? 0) > 0 ? 40 : 10) +
      (input.higherLow ? 20 : 0),
    0,
    100,
  );
  const ma50 = clamp(
    ((input.priceVs50 ?? -10) > 0 ? 70 : 20 + norm(input.priceVs50, -15, 0) * 0.3) +
      (input.crossed50 ? 20 : 0),
    0,
    100,
  );
  const ma200 = clamp(
    ((input.priceVs200 ?? -20) > 0 ? 80 : norm(input.priceVs200, -25, 0)) + (input.crossed200 ? 15 : 0),
    0,
    100,
  );

  const components = [
    { w: weights.drawdown_improvement, v: norm(input.recoveryFromTroughPct, 0, 25) },
    { w: weights.short_term_momentum, v: shortMomentum },
    { w: weights.ma50_recovery, v: ma50 },
    { w: weights.ma200_recovery, v: ma200 },
    { w: weights.return_3m, v: norm(input.return3m, -10, 15) },
    { w: weights.return_6m, v: norm(input.return6m, -15, 20) },
    { w: weights.relative_strength, v: norm(input.rs1m, -8, 8) },
  ];
  const totalW = components.reduce((a, c) => a + c.w, 0);
  return clamp(components.reduce((a, c) => a + c.v * c.w, 0) / totalW, 0, 100);
}

export function detectHigherLow(closes: number[]): boolean {
  if (closes.length < 40) return false;
  const recent = closes.slice(-40);
  const mid = Math.floor(recent.length / 2);
  const firstLow = Math.min(...recent.slice(0, mid));
  const secondLow = Math.min(...recent.slice(mid));
  const firstHigh = Math.max(...recent.slice(0, mid));
  const secondHigh = Math.max(...recent.slice(mid));
  return secondLow > firstLow && secondHigh >= firstHigh * 0.98;
}
