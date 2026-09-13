import { clamp } from "@/lib/utils";
import type { RETURN_THRESHOLDS, WEAKNESS_WEIGHTS } from "@/config/defaults";

function periodWeakness(value: number | null, t: { bad: number; very_bad: number; extreme: number }): number | null {
  if (value == null) return null;
  if (value <= t.extreme) return 100;
  if (value <= t.very_bad) return 80;
  if (value <= t.bad) return 60;
  if (value <= 0) return 40;
  if (value <= 10) return 20;
  if (value <= 25) return 10;
  return 0;
}

export function weaknessScore(
  returns: { y1: number | null; y2: number | null; y5: number | null },
  thresholds: typeof RETURN_THRESHOLDS,
  weights: typeof WEAKNESS_WEIGHTS,
): { y1: number | null; y2: number | null; y5: number | null; weighted: number | null } {
  const y1 = periodWeakness(returns.y1, thresholds.y1);
  const y2 = periodWeakness(returns.y2, thresholds.y2);
  const y5 = periodWeakness(returns.y5, thresholds.y5);

  const parts: { score: number; weight: number }[] = [];
  if (y1 != null) parts.push({ score: y1, weight: weights.y1 });
  if (y2 != null) parts.push({ score: y2, weight: weights.y2 });
  if (y5 != null) parts.push({ score: y5, weight: weights.y5 });
  if (!parts.length) return { y1, y2, y5, weighted: null };

  const totalW = parts.reduce((a, p) => a + p.weight, 0);
  const weighted = clamp(parts.reduce((a, p) => a + p.score * p.weight, 0) / totalW, 0, 100);
  return { y1, y2, y5, weighted };
}
