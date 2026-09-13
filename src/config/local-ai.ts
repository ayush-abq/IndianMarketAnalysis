/** Local AI/ML defaults. No paid API. Ollama + in-process ML only. */

export const LOCAL_AI_BLEND = {
  quantitative: 0.6,
  ml: 0.25,
  ai: 0.1,
  critic_risk: 0.05,
} as const;

export const LOCAL_AI_DEFAULTS = {
  enabled: false,
  ollama_base_url: "http://127.0.0.1:11434",
  analyst_model: "",
  critic_model: "",
  synthesizer_model: "",
  fast_model: "",
  embedding_model: "",
  temperature: 0.2,
  context_size: 8192,
  max_tokens: 1400,
  thinking_mode: false,
  device: "auto" as "auto" | "cpu" | "gpu",
  blend: { ...LOCAL_AI_BLEND },
  aggressive_mode: false,
  never_auto_download: true,
};

export const FEATURE_SET_VERSION = "fs-v1.0";
export const ML_MODEL_FAMILY = "local-ensemble-v1";

export const WALK_FORWARD_SPEC = [
  { trainEnd: "2019-12-31", validateYear: "2020", testYear: "2021" },
  { trainEnd: "2020-12-31", validateYear: "2021", testYear: "2022" },
  { trainEnd: "2021-12-31", validateYear: "2022", testYear: "2023" },
  { trainEnd: "2022-12-31", validateYear: "2023", testYear: "2024" },
  { trainEnd: "2023-12-31", validateYear: "2024", testYear: "2025" },
  { trainEnd: "2024-12-31", validateYear: "2025", testYear: "2026" },
] as const;

export const FEATURE_KEYS = [
  "return_1m",
  "return_3m",
  "return_6m",
  "return_1y",
  "drawdown",
  "price_vs_50",
  "price_vs_200",
  "rsi",
  "rs_1y",
  "volatility_20",
  "volume_ratio",
  "recovery_score",
  "momentum_score",
  "sector_return_1y",
  "regime_score",
  "quality",
  "valuation",
  "earnings",
  "pe",
  "pb",
  "roe",
  "roce",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FORBIDDEN_CLAIMS = [
  "guaranteed profit",
  "certain to rise",
  "risk-free",
  "guaranteed target",
  "will definitely",
  "cannot lose",
];
