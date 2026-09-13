/**
 * Alpha Research configuration — all weights and cost assumptions are versioned.
 * Do not hard-code these in scoring logic.
 */
export const ALPHA_MODEL = {
  name: "AlphaConfluence",
  version: "alpha-v1.0",
} as const;

export type ResearchMode = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export const RESEARCH_MODES: Record<
  ResearchMode,
  {
    label: string;
    description: string;
    minDrawdown: number;
    minRecovery: number;
    excludeFallingKnife: boolean;
    excludeValueTrap: boolean;
    minDataQuality: number;
    minSampleForHighConfidence: number;
    maxSingleNamePct: number;
    allowSmallerHistory: boolean;
  }
> = {
  CONSERVATIVE: {
    label: "Conservative",
    description: "Shallower stress, stronger confirmation, stricter evidence.",
    minDrawdown: 20,
    minRecovery: 60,
    excludeFallingKnife: true,
    excludeValueTrap: true,
    minDataQuality: 50,
    minSampleForHighConfidence: 40,
    maxSingleNamePct: 8,
    allowSmallerHistory: false,
  },
  BALANCED: {
    label: "Balanced",
    description: "Default research screen. Quality + recovery with visible risk.",
    minDrawdown: 30,
    minRecovery: 55,
    excludeFallingKnife: true,
    excludeValueTrap: true,
    minDataQuality: 40,
    minSampleForHighConfidence: 30,
    maxSingleNamePct: 12,
    allowSmallerHistory: false,
  },
  AGGRESSIVE: {
    label: "Aggressive",
    description:
      "Higher accepted risk and deeper drawdowns — not reckless. Still requires liquidity, data quality, and historical evidence.",
    minDrawdown: 40,
    minRecovery: 45,
    excludeFallingKnife: true,
    excludeValueTrap: true,
    minDataQuality: 40,
    minSampleForHighConfidence: 20,
    maxSingleNamePct: 15,
    allowSmallerHistory: true,
  },
};

export const CONFLUENCE_WEIGHTS = {
  fundamentals: 0.2,
  valuation: 0.15,
  earnings: 0.15,
  momentum: 0.1,
  relative_strength: 0.1,
  sector: 0.1,
  recovery: 0.1,
  institutional_flow: 0.05,
  catalyst: 0.05,
} as const;

export const AGGRESSIVE_ALPHA_WEIGHTS = {
  upside: 0.3,
  valuation_dislocation: 0.2,
  earnings_acceleration: 0.15,
  recovery: 0.1,
  relative_strength: 0.1,
  sector: 0.05,
  catalyst: 0.05,
  institutional: 0.05,
} as const;

export const RISK_PENALTY_WEIGHTS = {
  volatility: 0.25,
  drawdown: 0.25,
  liquidity: 0.15,
  debt: 0.15,
  event: 0.1,
  deterioration: 0.1,
} as const;

/** Round-trip cost assumptions in basis points (research estimates, not a broker quote). */
export const COST_SCENARIOS = {
  low: { label: "Low cost", roundTripBps: 15 },
  base: { label: "Base cost", roundTripBps: 40 },
  high: { label: "High cost", roundTripBps: 80 },
} as const;

export const NSE_CASH_COST_BREAKDOWN_BPS = {
  brokerageEachWay: 3,
  sttSellDelivery: 10,
  stampBuy: 1.5,
  exchangeGstSebi: 1.5,
  slippageEachWay: 10,
} as const;

export const EXECUTION = {
  default: "NEXT_SESSION" as const,
  note: "Signal at close T. Earliest fill is the next session (T+1 close unless opens are available). Same-day close execution is opt-in only.",
};

export const DECAY_HORIZONS = [1, 5, 10, 21, 63, 126, 252] as const;

export const MIN_SAMPLE_SIZE = 10;
export const SMALL_SAMPLE_SIZE = 20;
