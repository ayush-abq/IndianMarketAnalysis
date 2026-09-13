import { STOCK_OPP_WEIGHTS } from "@/config/terminal-defaults";
import { weightedAvailable } from "./weighted-score";
import { classifyOpportunity } from "./opportunity-classify";
import { isValueTrap } from "./valuation-score";

export function stockOpportunityScore(input: {
  quality: number | null;
  valuation: number | null;
  earnings: number | null;
  sectorRecovery: number | null;
  relativeStrength: number | null;
  momentum: number | null;
  balanceSheet: number | null;
  risk: number | null;
  dataQuality: number | null;
}) {
  const raw = weightedAvailable(
    {
      quality: input.quality,
      valuation: input.valuation,
      earnings: input.earnings,
      sector_recovery: input.sectorRecovery,
      relative_strength: input.relativeStrength,
      momentum: input.momentum,
      balance_sheet: input.balanceSheet,
      risk: input.risk,
    },
    STOCK_OPP_WEIGHTS,
  );
  if (raw.score == null) return raw;
  if ((input.dataQuality ?? 100) < 40) {
    return { ...raw, score: Math.min(raw.score, 55) };
  }
  return raw;
}

export function whyOpportunity(parts: {
  quality?: number | null;
  valuation?: number | null;
  earnings?: number | null;
  sectorRecovery?: number | null;
  relativeStrength?: number | null;
  momentum?: number | null;
  balanceSheet?: number | null;
  risk?: number | null;
  dataQuality?: number | null;
}) {
  const reasons: string[] = [];
  const risks: string[] = [];
  const push = (label: string, v: number | null | undefined) => {
    if (v == null) return;
    if (v >= 60) reasons.push(`${label} ${v.toFixed(0)}`);
    else if (v < 40) risks.push(`${label} ${v.toFixed(0)}`);
  };
  push("Quality", parts.quality);
  push("Valuation", parts.valuation);
  push("Earnings", parts.earnings);
  push("Sector recovery", parts.sectorRecovery);
  push("Relative strength", parts.relativeStrength);
  push("Momentum", parts.momentum);
  push("Balance sheet", parts.balanceSheet);
  if ((parts.risk ?? 50) < 40) risks.push(`Risk score ${parts.risk!.toFixed(0)}`);
  if ((parts.dataQuality ?? 100) < 50) risks.push("Data quality is incomplete — rank is not aggressive.");
  if (!reasons.length) reasons.push("No component is strongly supportive. Treat as a watchlist item, not a candidate.");
  if (!risks.length) risks.push("See component scores. This is a research classification, not a recommendation.");
  return { reasons, risks };
}

export function classifyStock(input: {
  drawdown: number | null;
  quality: number | null;
  valuation: number | null;
  earnings: number | null;
  recovery: number | null;
  rs: number | null;
  vs200: number | null;
  return1m: number | null;
  return3m: number | null;
  cashFlowDeteriorating?: boolean;
  debtRising?: boolean;
}) {
  if (
    isValueTrap({
      valuation: input.valuation,
      earnings: input.earnings,
      quality: input.quality,
      cashFlowDeteriorating: input.cashFlowDeteriorating,
      debtRising: input.debtRising,
      rs: input.rs,
    })
  ) {
    return "VALUE_TRAP";
  }
  return classifyOpportunity(input);
}
