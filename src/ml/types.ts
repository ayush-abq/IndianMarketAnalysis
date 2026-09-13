export type FeatureVector = Record<string, number | null>;

export type LabeledRow = {
  entityId: number;
  entityName: string;
  asOf: string;
  features: FeatureVector;
  labelReturn: number | null;
  labelPositive: number | null;
  labelGain10: number | null;
  labelGain20: number | null;
  labelGain30: number | null;
  labelDd20: number | null;
  horizon: "1M" | "3M" | "6M" | "1Y";
};

export type BinaryModel = {
  kind: "logistic" | "random_forest" | "extra_trees";
  featureKeys: string[];
  predictProba(x: number[]): number;
};

export type RegressionModel = {
  kind: "ridge";
  featureKeys: string[];
  predict(x: number[]): number;
};

export type ClassificationMetrics = {
  n: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  rocAuc: number | null;
  prAuc: number | null;
  logLoss: number | null;
  brier: number | null;
};

export type FinancialMetrics = {
  n: number;
  hitRate: number | null;
  cagr: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
  profitFactor: number | null;
  expectancy: number | null;
};

export type Calibrator = {
  kind: "platt" | "isotonic";
  apply(raw: number): number;
};
