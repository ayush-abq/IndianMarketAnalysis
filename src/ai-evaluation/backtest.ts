import { labeledForward } from "@/services/strategy-lab";
import { featuresFromBars } from "@/feature-store/features";
import type { TrainedBundle } from "@/model-training/train";
import { predictFromBundle } from "@/prediction-engine/predict";
import { classificationMetrics, financialMetrics } from "@/ml/metrics";
import type { PriceBar } from "@/calculations/trading-days";

/**
 * PIT ML backtest. At each as-of, features use bars through T only.
 * Future returns are applied after the prediction is recorded in-memory.
 * LLM debate is not run here by default (too slow / leakage-prone unless you pass asOf-only context).
 */
export function backtestBundle(
  bundle: TrainedBundle,
  series: { id: number; name: string; bars: PriceBar[] }[],
  opts?: { every?: number; horizonDays?: number; threshold?: number },
) {
  const every = opts?.every ?? 21;
  const hold = opts?.horizonDays ?? 126;
  const threshold = opts?.threshold ?? 0.55;
  const y: number[] = [];
  const p: number[] = [];
  const rets: number[] = [];
  for (const s of series) {
    for (let i = 60; i + hold < s.bars.length; i += every) {
      const asOf = s.bars[i].date;
      const feat = featuresFromBars(s.bars, asOf);
      if (!feat) continue;
      const pred = predictFromBundle(bundle, feat.values, "EXPERIMENTAL");
      const actual = labeledForward(s.bars, asOf, hold);
      if (pred.calibratedProbability == null || actual == null) continue;
      y.push(actual > 0 ? 1 : 0);
      p.push(pred.calibratedProbability);
      rets.push(pred.calibratedProbability >= threshold ? actual : 0);
    }
  }
  return {
    n: y.length,
    classification: classificationMetrics(y, p),
    financial: financialMetrics(rets),
    note: "Predictions were scored only after they were formed from as-of features. LLM text is not part of this numerical backtest.",
  };
}
