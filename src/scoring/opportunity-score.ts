import { clamp } from "@/lib/utils";
import type { COMPOSITE_WEIGHTS, OPPORTUNITY_BUCKETS, OPPORTUNITY_WEIGHTS } from "@/config/defaults";

export type OpportunityLabel =
  | "Strong / Not beaten down"
  | "Mild weakness"
  | "Weak"
  | "Deeply beaten down"
  | "Extreme weakness / research candidate"
  | "Extreme drawdown / investigate carefully";

export function labelOpportunity(score: number, buckets: typeof OPPORTUNITY_BUCKETS): OpportunityLabel {
  if (score >= buckets.extreme_weakness) return "Extreme drawdown / investigate carefully";
  if (score >= buckets.deeply_beaten_down) return "Extreme weakness / research candidate";
  if (score >= buckets.weak) return "Deeply beaten down";
  if (score >= buckets.mild_weakness) return "Weak";
  if (score >= buckets.strong) return "Mild weakness";
  return "Strong / Not beaten down";
}

/**
 * Opportunity / research score — NOT a buy signal.
 * High score = more beaten-down + some recovery evidence to investigate.
 * Falling knives still score high on drawdown/weakness but recovery/momentum
 * components stay low; the signal matrix separates them.
 */
export function opportunityScore(
  parts: {
    drawdown: number;
    weakness: number | null;
    momentumReversal: number;
    recovery: number;
    relativeStrength: number | null;
  },
  weights: typeof OPPORTUNITY_WEIGHTS,
): number {
  const items = [
    { w: weights.drawdown, v: parts.drawdown },
    { w: weights.weakness, v: parts.weakness ?? 40 },
    { w: weights.momentum_reversal, v: parts.momentumReversal },
    { w: weights.recovery, v: parts.recovery },
    { w: weights.relative_strength, v: invertRs(parts.relativeStrength) },
  ];
  const totalW = items.reduce((a, i) => a + i.w, 0);
  return clamp(items.reduce((a, i) => a + i.v * i.w, 0) / totalW, 0, 100);
}

function invertRs(rs: number | null): number {
  if (rs == null) return 50;
  return clamp(50 - rs, 0, 100);
}

export function compositeResearchScore(
  parts: {
    drawdown: number;
    weakness: number | null;
    recovery: number;
    momentum: number;
    relativeStrength: number | null;
    breadth: number | null;
    capitulation: number;
  },
  weights: typeof COMPOSITE_WEIGHTS,
): number {
  const items = [
    { w: weights.drawdown, v: parts.drawdown },
    { w: weights.weakness, v: parts.weakness ?? 40 },
    { w: weights.recovery, v: parts.recovery },
    { w: weights.momentum, v: parts.momentum },
    { w: weights.relative_strength, v: invertRs(parts.relativeStrength) },
    { w: weights.breadth, v: parts.breadth ?? 40 },
    { w: weights.capitulation, v: parts.capitulation },
  ];
  const totalW = items.reduce((a, i) => a + i.w, 0);
  return clamp(items.reduce((a, i) => a + i.v * i.w, 0) / totalW, 0, 100);
}
