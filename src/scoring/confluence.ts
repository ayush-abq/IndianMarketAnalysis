import {
  AGGRESSIVE_ALPHA_WEIGHTS,
  ALPHA_MODEL,
  CONFLUENCE_WEIGHTS,
  RISK_PENALTY_WEIGHTS,
  type ResearchMode,
  RESEARCH_MODES,
} from "@/config/alpha-defaults";
import { weightedAvailable } from "./weighted-score";

export function confluenceScore(parts: {
  fundamentals?: number | null;
  valuation?: number | null;
  earnings?: number | null;
  momentum?: number | null;
  relativeStrength?: number | null;
  sector?: number | null;
  recovery?: number | null;
  institutionalFlow?: number | null;
  catalyst?: number | null;
}) {
  const raw = weightedAvailable(
    {
      fundamentals: parts.fundamentals,
      valuation: parts.valuation,
      earnings: parts.earnings,
      momentum: parts.momentum,
      relative_strength: parts.relativeStrength,
      sector: parts.sector,
      recovery: parts.recovery,
      institutional_flow: parts.institutionalFlow,
      catalyst: parts.catalyst,
    },
    CONFLUENCE_WEIGHTS,
  );
  return {
    ...raw,
    model: ALPHA_MODEL,
    missingNote:
      raw.missing.length > 0
        ? `Omitted from confluence (N/A, not zero): ${raw.missing.join(", ")}.`
        : null,
  };
}

export function aggressiveAlphaScore(parts: {
  upside?: number | null;
  valuationDislocation?: number | null;
  earningsAcceleration?: number | null;
  recovery?: number | null;
  relativeStrength?: number | null;
  sector?: number | null;
  catalyst?: number | null;
  institutional?: number | null;
}) {
  return {
    ...weightedAvailable(
      {
        upside: parts.upside,
        valuation_dislocation: parts.valuationDislocation,
        earnings_acceleration: parts.earningsAcceleration,
        recovery: parts.recovery,
        relative_strength: parts.relativeStrength,
        sector: parts.sector,
        catalyst: parts.catalyst,
        institutional: parts.institutional,
      },
      AGGRESSIVE_ALPHA_WEIGHTS,
    ),
    model: ALPHA_MODEL,
  };
}

export function riskPenalty(parts: {
  volatility?: number | null;
  drawdown?: number | null;
  liquidity?: number | null;
  debt?: number | null;
  event?: number | null;
  deterioration?: number | null;
}) {
  return weightedAvailable(
    {
      volatility: parts.volatility,
      drawdown: parts.drawdown,
      liquidity: parts.liquidity,
      debt: parts.debt,
      event: parts.event,
      deterioration: parts.deterioration,
    },
    RISK_PENALTY_WEIGHTS,
  );
}

export function netAggressiveScore(alpha: number | null, penalty: number | null) {
  if (alpha == null) return { net: null, alpha, penalty, note: "Aggressive alpha N/A — insufficient components." };
  const p = penalty ?? 0;
  return {
    net: Math.max(0, Math.min(100, alpha - p * 0.35)),
    alpha,
    penalty: p,
    note: "Risk penalty is subtracted, not hidden. Not a recommendation.",
  };
}

export function passesModeGates(
  mode: ResearchMode,
  input: {
    drawdown: number | null;
    recovery: number | null;
    classification: string;
    dataQuality: number | null;
  },
) {
  const g = RESEARCH_MODES[mode];
  if ((input.drawdown ?? 0) < g.minDrawdown && mode !== "CONSERVATIVE") return false;
  if (mode === "CONSERVATIVE" && (input.recovery ?? 0) < g.minRecovery) return false;
  if (g.excludeFallingKnife && input.classification === "FALLING_KNIFE") return false;
  if (g.excludeValueTrap && input.classification === "VALUE_TRAP") return false;
  if ((input.dataQuality ?? 100) < g.minDataQuality) return false;
  return true;
}

export function situationalRisk(drawdown: number | null): number | null {
  if (drawdown == null) return null;
  return Math.max(0, Math.min(100, drawdown));
}
