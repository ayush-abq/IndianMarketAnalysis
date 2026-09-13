import { FEATURE_KEYS, FEATURE_SET_VERSION, ML_MODEL_FAMILY } from "@/config/local-ai";
import { trainLogistic, trainRidge } from "@/ml/logistic";
import { trainForest, treeImportances } from "@/ml/trees";
import { classificationMetrics, encodeFeatures, featureMedians, financialMetrics } from "@/ml/metrics";
import { fitIsotonic, fitPlatt } from "@/ml/calibration";
import { ensembleWeights } from "@/ml/ensemble";
import type { LabeledRow } from "@/ml/types";
import { splitByFold, walkForwardFolds, type Fold } from "./walk-forward";

export type TrainedBundle = {
  version: string;
  featureKeys: string[];
  medians: Record<string, number>;
  members: {
    id: string;
    kind: string;
    artifact: unknown;
    oosScore: number;
    weight: number;
  }[];
  calibrators: Record<string, unknown>;
  ridge: unknown;
  folds: { fold: Fold; metrics: unknown; nTrain: number; nVal: number; nTest: number }[];
  featureImportance: { key: string; weight: number }[];
  limitations: string[];
};

function labelOf(row: LabeledRow, target: string) {
  if (target === "positive") return row.labelPositive;
  if (target === "gain10") return row.labelGain10;
  if (target === "gain20") return row.labelGain20;
  if (target === "gain30") return row.labelGain30;
  if (target === "dd20") return row.labelDd20;
  return row.labelPositive;
}

export function trainHorizonBundle(rows: LabeledRow[], horizon: LabeledRow["horizon"], target = "positive"): TrainedBundle {
  const usable = rows.filter((r) => r.horizon === horizon && labelOf(r, target) != null);
  const dates = usable.map((r) => r.asOf).sort();
  const folds = walkForwardFolds(dates[0] ?? "2020-01-01", dates.at(-1) ?? "2026-09-11");
  const keys = [...FEATURE_KEYS];
  const medians = featureMedians(usable.map((r) => r.features), keys);
  const foldReports: TrainedBundle["folds"] = [];
  const oosByModel: Record<string, number[]> = { logistic: [], random_forest: [], extra_trees: [] };

  for (const fold of folds) {
    const { train, validate, test } = splitByFold(usable, fold);
    if (train.length < 40 || test.length < 10) continue;
    const Xtr = train.map((r) => encodeFeatures(keys, r.features, medians));
    const ytr = train.map((r) => Number(labelOf(r, target)));
    const Xte = test.map((r) => encodeFeatures(keys, r.features, medians));
    const yte = test.map((r) => Number(labelOf(r, target)));
    const log = trainLogistic(Xtr, ytr);
    const rf = trainForest(Xtr, ytr, { extra: false, trees: 17, maxDepth: 5, seed: 3 });
    const et = trainForest(Xtr, ytr, { extra: true, trees: 17, maxDepth: 5, seed: 9 });
    const models = { logistic: log, random_forest: rf, extra_trees: et };
    const metrics: Record<string, unknown> = {};
    for (const [id, model] of Object.entries(models)) {
      const p = Xte.map((x) => model.predictProba(x));
      const cls = classificationMetrics(yte, p);
      const fin = financialMetrics(
        test.map((r, i) => ((p[i] ?? 0) >= 0.55 && r.labelReturn != null ? r.labelReturn : 0)),
      );
      metrics[id] = { classification: cls, financial: fin };
      if (cls.prAuc != null) oosByModel[id].push(cls.prAuc);
      else if (fin.sharpe != null) oosByModel[id].push(Math.max(0, (fin.sharpe + 1) / 4));
    }
    foldReports.push({
      fold,
      metrics,
      nTrain: train.length,
      nVal: validate.length,
      nTest: test.length,
    });
  }

  const Xall = usable.map((r) => encodeFeatures(keys, r.features, medians));
  const yall = usable.map((r) => Number(labelOf(r, target)));
  const log = trainLogistic(Xall, yall);
  const rf = trainForest(Xall, yall, { extra: false, trees: 21, maxDepth: 5, seed: 3 });
  const et = trainForest(Xall, yall, { extra: true, trees: 21, maxDepth: 5, seed: 9 });
  log.featureKeys = keys;
  rf.featureKeys = keys;
  et.featureKeys = keys;

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const scores = [
    { id: "logistic", oosScore: mean(oosByModel.logistic) },
    { id: "random_forest", oosScore: mean(oosByModel.random_forest) },
    { id: "extra_trees", oosScore: mean(oosByModel.extra_trees) },
  ];
  const weights = ensembleWeights(scores);
  const rawAll = Xall.map((x) => log.predictProba(x));
  const platt = fitPlatt(rawAll, yall);
  const iso = fitIsotonic(rawAll, yall);
  const yRet = usable.filter((r) => r.labelReturn != null);
  const ridge = trainRidge(
    yRet.map((r) => encodeFeatures(keys, r.features, medians)),
    yRet.map((r) => r.labelReturn as number),
  );
  const imp = treeImportances(rf, keys.length).map((w, i) => ({ key: keys[i], weight: w })).sort((a, b) => b.weight - a.weight);

  return {
    version: `${ML_MODEL_FAMILY}-${horizon}-${target}`,
    featureKeys: keys,
    medians,
    members: [
      { id: "logistic", kind: "logistic", artifact: log, oosScore: scores[0].oosScore, weight: weights.logistic },
      { id: "random_forest", kind: "random_forest", artifact: rf, oosScore: scores[1].oosScore, weight: weights.random_forest },
      { id: "extra_trees", kind: "extra_trees", artifact: et, oosScore: scores[2].oosScore, weight: weights.extra_trees },
    ],
    calibrators: { platt, isotonic: iso },
    ridge,
    folds: foldReports,
    featureImportance: imp.slice(0, 12),
    limitations: [
      "In-process logistic / random-forest / extra-trees. XGBoost, LightGBM and CatBoost run only via python/ml when you install those packages.",
      "Fundamentals (PE/ROE/earnings) stay null until a licensed feed with publication dates is stored. They are not imputed.",
      "Walk-forward folds with too few rows are skipped, not filled with invented metrics.",
      "Status is EXPERIMENTAL until you promote a version after reviewing out-of-sample folds.",
    ],
  };
}

export function reconstructPredict(artifact: { kind?: string; weights?: number[]; bias?: number; trees?: unknown[] }) {
  if (artifact.kind === "logistic" && artifact.weights && artifact.bias != null) {
    return (x: number[]) => {
      let z = artifact.bias as number;
      for (let j = 0; j < artifact.weights!.length; j++) z += artifact.weights![j] * (x[j] ?? 0);
      if (z >= 20) return 1;
      if (z <= -20) return 0;
      return 1 / (1 + Math.exp(-z));
    };
  }
  if ((artifact.kind === "random_forest" || artifact.kind === "extra_trees") && Array.isArray(artifact.trees)) {
    const walk = (node: Record<string, unknown>, x: number[]): number => {
      if (node.leaf) return Number(node.p);
      return x[Number(node.feature)] <= Number(node.threshold)
        ? walk(node.left as Record<string, unknown>, x)
        : walk(node.right as Record<string, unknown>, x);
    };
    return (x: number[]) => {
      const trees = artifact.trees as Record<string, unknown>[];
      return trees.reduce((a, t) => a + walk(t, x), 0) / trees.length;
    };
  }
  return null;
}

export { FEATURE_SET_VERSION };
