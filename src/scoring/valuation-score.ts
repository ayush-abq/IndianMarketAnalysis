import { weightedAvailable } from "./weighted-score";

export function valuationPercentile(current: number | null, history: number[]): number | null {
  if (current == null || !Number.isFinite(current) || history.length < 20) return null;
  const sorted = [...history].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  let below = 0;
  for (const v of sorted) if (v <= current) below += 1;
  return (below / sorted.length) * 100;
}

export function valuationLabel(percentile: number | null): string | null {
  if (percentile == null) return null;
  if (percentile <= 25) return "Historically inexpensive";
  if (percentile >= 75) return "Historically expensive";
  return "Near historical mid-range";
}

export function valuationScore(input: {
  pePercentile?: number | null;
  pbPercentile?: number | null;
  evEbitdaPercentile?: number | null;
  fcfYieldScore?: number | null;
  quality?: number | null;
  earnings?: number | null;
}) {
  const cheapness = (p: number | null | undefined) => (p == null ? null : 100 - p);
  return weightedAvailable(
    {
      pe: cheapness(input.pePercentile),
      pb: cheapness(input.pbPercentile),
      evEbitda: cheapness(input.evEbitdaPercentile),
      fcf: input.fcfYieldScore,
      quality: input.quality,
      earnings: input.earnings,
    },
    { pe: 0.3, pb: 0.15, evEbitda: 0.15, fcf: 0.15, quality: 0.15, earnings: 0.1 },
  );
}

export function isValueTrap(input: {
  valuation: number | null;
  earnings: number | null;
  quality: number | null;
  cashFlowDeteriorating?: boolean;
  debtRising?: boolean;
  rs: number | null;
}): boolean {
  const cheap = (input.valuation ?? 0) >= 70;
  if (!cheap) return false;
  const deteriorating =
    (input.earnings != null && input.earnings < 40) ||
    (input.quality != null && input.quality < 45) ||
    Boolean(input.cashFlowDeteriorating) ||
    Boolean(input.debtRising) ||
    (input.rs != null && input.rs < 25);
  return deteriorating;
}

export function qarpScore(input: {
  quality: number | null;
  growth: number | null;
  valuation: number | null;
  risk: number | null;
}) {
  return weightedAvailable(
    {
      quality: input.quality,
      growth: input.growth,
      valuation: input.valuation,
      risk: input.risk,
    },
    { quality: 0.35, growth: 0.25, valuation: 0.25, risk: 0.15 },
  );
}
