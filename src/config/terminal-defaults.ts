export const MODEL_VERSIONS = {
  opportunity: "opp-v1.0",
  regime: "regime-v1.0",
  lab: "lab-v1.0",
} as const;

export const STOCK_OPP_WEIGHTS = {
  quality: 0.2,
  valuation: 0.2,
  earnings: 0.2,
  sector_recovery: 0.1,
  relative_strength: 0.1,
  momentum: 0.05,
  balance_sheet: 0.1,
  risk: 0.05,
} as const;

export const QUALITY_WEIGHTS = {
  roce: 0.25,
  roe: 0.2,
  fcf: 0.2,
  leverage: 0.15,
  margins: 0.1,
  consistency: 0.1,
} as const;

export const SAMPLE_CAUTION = {
  insufficient: 10,
  small: 20,
} as const;
