import { clamp } from "@/lib/utils";

export type WeightedParts = Record<string, number | null | undefined>;
export type WeightMap = Record<string, number>;

export type WeightedResult = {
  score: number | null;
  used: string[];
  missing: string[];
  coverage: number;
};

/**
 * Weighted average that OMISSION-renormalizes missing inputs.
 * Missing is never treated as 0. If nothing is available, score is null (N/A).
 */
export function weightedAvailable(parts: WeightedParts, weights: WeightMap): WeightedResult {
  let w = 0;
  let s = 0;
  const used: string[] = [];
  const missing: string[] = [];
  for (const [key, weight] of Object.entries(weights)) {
    const v = parts[key];
    if (v == null || !Number.isFinite(v)) {
      missing.push(key);
      continue;
    }
    w += weight;
    s += v * weight;
    used.push(key);
  }
  if (w <= 0) return { score: null, used, missing, coverage: 0 };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return {
    score: clamp(s / w, 0, 100),
    used,
    missing,
    coverage: total > 0 ? w / total : 0,
  };
}

export function dataQualityScore(input: {
  historyYears: number | null;
  daysStale: number | null;
  corporateActionsKnown: boolean;
  fundamentalsAvailable: boolean;
  providerOfficial: boolean;
}): number {
  let score = 40;
  const years = input.historyYears ?? 0;
  score += Math.min(30, years * 4);
  if (input.daysStale == null) score -= 10;
  else if (input.daysStale <= 1) score += 15;
  else if (input.daysStale <= 5) score += 8;
  else if (input.daysStale <= 15) score += 0;
  else score -= Math.min(25, input.daysStale);
  if (input.corporateActionsKnown) score += 8;
  if (input.fundamentalsAvailable) score += 10;
  if (input.providerOfficial) score += 7;
  return clamp(score, 0, 100);
}
