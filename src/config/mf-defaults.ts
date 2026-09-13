export const MF_RESEARCH_WEIGHTS = {
  risk_adjusted: 0.2,
  long_term_returns: 0.15,
  consistency: 0.15,
  drawdown: 0.1,
  benchmark: 0.1,
  expense: 0.1,
  portfolio: 0.05,
  manager: 0.05,
  aum: 0.05,
  sector_alignment: 0.05,
} as const;

export const DEBT_RESEARCH_WEIGHTS = {
  risk_adjusted: 0.1,
  long_term_returns: 0.1,
  consistency: 0.1,
  drawdown: 0.2,
  benchmark: 0.1,
  expense: 0.15,
  portfolio: 0.15,
  manager: 0.05,
  aum: 0.05,
  sector_alignment: 0,
} as const;

export const INDEX_RESEARCH_WEIGHTS = {
  risk_adjusted: 0.05,
  long_term_returns: 0.1,
  consistency: 0.1,
  drawdown: 0.05,
  benchmark: 0.3,
  expense: 0.25,
  portfolio: 0.05,
  manager: 0,
  aum: 0.1,
  sector_alignment: 0,
} as const;

export const RISK_FREE_RATE = 6.5;

export type MfWeightSet = Record<keyof typeof MF_RESEARCH_WEIGHTS, number>;

export const MF_SCORE_WEIGHTS_BY_CLASS: Record<string, MfWeightSet> = {
  Equity: MF_RESEARCH_WEIGHTS,
  Hybrid: MF_RESEARCH_WEIGHTS,
  Debt: DEBT_RESEARCH_WEIGHTS,
  "Index Fund": INDEX_RESEARCH_WEIGHTS,
  ETF: INDEX_RESEARCH_WEIGHTS,
  Other: MF_RESEARCH_WEIGHTS,
};

export const DEFAULT_SIP_AMOUNT = 10000;
export const DEFAULT_LUMPSUM = 100000;
export const MF_NAV_CRON = "0 22 * * 1-6";
export const MF_MONTHLY_CRON = "0 7 3 * *";
