import { LOCAL_AI_DEFAULTS } from "./local-ai";

export const DRAWDOWN_THRESHOLDS = {
  correction: 20,
  deep_correction: 30,
  bear_market: 40,
  extreme_drawdown: 50,
  capitulation: 60,
} as const;

export const RETURN_THRESHOLDS = {
  y1: { bad: -15, very_bad: -25, extreme: -35 },
  y2: { bad: -20, very_bad: -35, extreme: -50 },
  y5: { bad: 0, very_bad: -15, extreme: -30 },
} as const;

export const WEAKNESS_WEIGHTS = {
  y1: 0.3,
  y2: 0.3,
  y5: 0.4,
} as const;

export const OPPORTUNITY_WEIGHTS = {
  drawdown: 0.3,
  weakness: 0.25,
  momentum_reversal: 0.15,
  recovery: 0.15,
  relative_strength: 0.15,
} as const;

export const COMPOSITE_WEIGHTS = {
  drawdown: 0.3,
  weakness: 0.2,
  recovery: 0.15,
  momentum: 0.1,
  relative_strength: 0.1,
  breadth: 0.1,
  capitulation: 0.05,
} as const;

export const RECOVERY_WEIGHTS = {
  drawdown_improvement: 0.2,
  short_term_momentum: 0.2,
  ma50_recovery: 0.15,
  ma200_recovery: 0.15,
  return_3m: 0.1,
  return_6m: 0.1,
  relative_strength: 0.1,
} as const;

export const OPPORTUNITY_BUCKETS = {
  strong: 20,
  mild_weakness: 40,
  weak: 60,
  deeply_beaten_down: 75,
  extreme_weakness: 90,
} as const;

export const ALERT_THRESHOLDS = {
  drawdown_crosses: [30, 40, 50, 60],
  recovery_delta: 10,
  falling_knife_momentum_1m: -8,
  falling_knife_momentum_3m: -12,
} as const;

export const SIGNAL_THRESHOLDS = {
  falling_knife_drawdown: 40,
  early_recovery_drawdown: 30,
  capitulation_drawdown: 50,
  capitulation_return_1y: -25,
  elevated_volatility_percentile: 80,
  large_recent_decline_1m: -10,
  recovery_from_trough_meaningful: 8,
} as const;

export const BENCHMARKS = {
  nifty50: "NIFTY 50",
  nifty500: "NIFTY 500",
} as const;

export const DEFAULT_SETTINGS = {
  drawdown_thresholds: DRAWDOWN_THRESHOLDS,
  return_thresholds: RETURN_THRESHOLDS,
  weakness_weights: WEAKNESS_WEIGHTS,
  opportunity_weights: OPPORTUNITY_WEIGHTS,
  composite_weights: COMPOSITE_WEIGHTS,
  recovery_weights: RECOVERY_WEIGHTS,
  opportunity_buckets: OPPORTUNITY_BUCKETS,
  alert_thresholds: ALERT_THRESHOLDS,
  signal_thresholds: SIGNAL_THRESHOLDS,
  primary_return_type: "PR" as const,
  analysis_return_type: "TR" as const,
  ath_methodology: "closing" as const,
  benchmark: "NIFTY 50",
  secondary_benchmark: "NIFTY 500",
  scheduler_cron: "30 18 * * 1-5",
  historical_lookback: "max",
  refresh_time_ist: "18:30",
  local_ai: LOCAL_AI_DEFAULTS,
};

export type AppSettings = typeof DEFAULT_SETTINGS;
