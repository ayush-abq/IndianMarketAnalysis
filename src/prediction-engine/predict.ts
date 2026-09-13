import { encodeFeatures } from "@/ml/metrics";
import { applyCalibrator } from "@/ml/calibration";
import { reconstructPredict, type TrainedBundle } from "@/model-training/train";
import type { FeatureRow } from "@/feature-store/features";

export type HorizonPrediction = {
  horizon: string;
  rawProbability: number | null;
  calibratedProbability: number | null;
  expectedReturn: number | null;
  members: { id: string; raw: number; weight: number }[];
  status: string;
};

export function predictFromBundle(bundle: TrainedBundle, features: FeatureRow["values"], status: string): HorizonPrediction {
  const x = encodeFeatures(bundle.featureKeys, features, bundle.medians);
  const members: HorizonPrediction["members"] = [];
  let raw = 0;
  let wsum = 0;
  for (const m of bundle.members) {
    const fn = reconstructPredict(m.artifact as { kind?: string; weights?: number[]; bias?: number; trees?: unknown[] });
    if (!fn) continue;
    const p = fn(x);
    members.push({ id: m.id, raw: p, weight: m.weight });
    raw += p * m.weight;
    wsum += m.weight;
  }
  const blended = wsum ? raw / wsum : null;
  const platt = bundle.calibrators.platt as { apply?: (n: number) => number; a?: number; b?: number } | undefined;
  let calibrated = blended;
  if (blended != null && platt && typeof platt.apply === "function") {
    calibrated = applyCalibrator(platt as { kind: "platt"; apply: (n: number) => number }, blended);
  } else if (blended != null && platt && platt.a != null && platt.b != null) {
    const z = platt.a * blended + platt.b;
    calibrated = z >= 20 ? 1 : z <= -20 ? 0 : 1 / (1 + Math.exp(-z));
  }
  let expectedReturn: number | null = null;
  const ridge = bundle.ridge as { beta?: number[] } | null;
  if (ridge?.beta?.length) {
    expectedReturn = ridge.beta[0] ?? 0;
    for (let i = 0; i < x.length; i++) expectedReturn += (ridge.beta[i + 1] ?? 0) * x[i];
  }
  return {
    horizon: bundle.version,
    rawProbability: blended,
    calibratedProbability: calibrated,
    expectedReturn,
    members,
    status,
  };
}

export function emptyPrediction(reason: string) {
  return {
    available: false as const,
    reason,
    status: "NOT_TRAINED",
    horizons: {} as Record<string, HorizonPrediction>,
    drawdown: {} as Record<string, HorizonPrediction>,
    importance: [] as { key: string; weight: number }[],
  };
}
