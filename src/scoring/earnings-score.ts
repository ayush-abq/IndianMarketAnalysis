import { weightedAvailable } from "./weighted-score";

export type EarningsWarning =
  | "EARNINGS_QUALITY_WARNING"
  | "CASH_FLOW_WARNING"
  | "BALANCE_SHEET_WARNING";

export function earningsMomentumScore(input: {
  yoyRevenue?: number | null;
  yoyEps?: number | null;
  yoyPat?: number | null;
  surpriseRate?: number | null;
  acceleration?: number | null;
}) {
  return weightedAvailable(
    {
      revenue: clipGrowth(input.yoyRevenue),
      eps: clipGrowth(input.yoyEps),
      pat: clipGrowth(input.yoyPat),
      surprise: input.surpriseRate,
      acceleration: input.acceleration,
    },
    { revenue: 0.25, eps: 0.3, pat: 0.2, surprise: 0.15, acceleration: 0.1 },
  );
}

function clipGrowth(g: number | null | undefined): number | null {
  if (g == null || !Number.isFinite(g)) return null;
  return Math.max(0, Math.min(100, 50 + g));
}

export function earningsQualityWarnings(input: {
  patChange?: number | null;
  ocfChange?: number | null;
  revenueChange?: number | null;
  marginChange?: number | null;
  receivablesChange?: number | null;
  inventoryChange?: number | null;
  debtChange?: number | null;
  earningsChange?: number | null;
}): EarningsWarning[] {
  const out: EarningsWarning[] = [];
  if ((input.patChange ?? 0) > 0 && (input.ocfChange ?? 0) < 0) out.push("CASH_FLOW_WARNING");
  if ((input.revenueChange ?? 0) > 0 && (input.marginChange ?? 0) < 0) out.push("EARNINGS_QUALITY_WARNING");
  if ((input.receivablesChange ?? 0) > 20 || (input.inventoryChange ?? 0) > 20) out.push("EARNINGS_QUALITY_WARNING");
  if ((input.debtChange ?? 0) > 0 && (input.earningsChange ?? 0) < 0) out.push("BALANCE_SHEET_WARNING");
  if ((input.patChange ?? 0) > 0 && (input.ocfChange ?? 0) < 0 && !out.includes("EARNINGS_QUALITY_WARNING")) {
    out.push("EARNINGS_QUALITY_WARNING");
  }
  return [...new Set(out)];
}
