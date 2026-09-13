import { describe, expect, it } from "vitest";
import { trainLogistic } from "@/ml/logistic";
import { trainForest } from "@/ml/trees";
import { classificationMetrics } from "@/ml/metrics";
import { ensembleWeights } from "@/ml/ensemble";
import { fitPlatt } from "@/ml/calibration";
import { walkForwardFolds, splitByFold } from "@/model-training/walk-forward";
import { featuresFromBars } from "@/feature-store/features";
import { detectConflicts } from "@/prediction-engine/contradiction";
import { blendResearchScore } from "@/prediction-engine/blend";
import { emptyPrediction } from "@/prediction-engine/predict";
import { aiConfidence } from "@/ai/confidence";
import { sanitizeClaims } from "@/ai/local-llm";
import { hashEmbed, cosine } from "@/rag/embeddings";
import { detectDecay } from "@/ai-evaluation/decay";
import type { PriceBar } from "@/calculations/trading-days";

function series(n: number, start = 100, drift = 0.2): PriceBar[] {
  const out: PriceBar[] = [];
  let px = start;
  const d0 = Date.parse("2020-01-02T00:00:00Z");
  for (let i = 0; i < n; i++) {
    px *= 1 + drift / 100 + (i % 7 === 0 ? -0.01 : 0.002);
    const date = new Date(d0 + i * 86400000).toISOString().slice(0, 10);
    out.push({ date, close: px, volume: 1000 + i });
  }
  return out;
}

describe("local ML algorithms", () => {
  it("fits logistic on a linearly separable problem", () => {
    const X = [
      [0, 0],
      [0.1, 0.2],
      [0.2, 0],
      [3, 3],
      [3.2, 2.8],
      [2.7, 3.1],
    ];
    const y = [0, 0, 0, 1, 1, 1];
    const m = trainLogistic(X, y, { epochs: 120, lr: 0.2 });
    expect(m.predictProba([0, 0])).toBeLessThan(0.4);
    expect(m.predictProba([3, 3])).toBeGreaterThan(0.6);
  });

  it("random forest predicts a majority class leaf", () => {
    const X = Array.from({ length: 40 }, (_, i) => [i < 20 ? 0 : 5, i % 3]);
    const y = X.map((r) => (r[0] > 2 ? 1 : 0));
    const m = trainForest(X, y, { trees: 11, maxDepth: 3, seed: 1 });
    expect(m.predictProba([0, 1])).toBeLessThan(0.4);
    expect(m.predictProba([5, 1])).toBeGreaterThan(0.6);
  });

  it("weights ensemble members by OOS score, not equally", () => {
    const w = ensembleWeights([
      { id: "a", oosScore: 0.8 },
      { id: "b", oosScore: 0.2 },
    ]);
    expect(w.a).toBeGreaterThan(w.b);
    expect(w.a + w.b).toBeCloseTo(1);
  });

  it("reports classification metrics without inventing a sample", () => {
    const m = classificationMetrics([1, 0, 1, 0], [0.9, 0.2, 0.8, 0.1]);
    expect(m.n).toBe(4);
    expect(m.accuracy).toBe(1);
    expect(m.rocAuc).not.toBeNull();
  });

  it("platt calibration is a finite map of raw scores", () => {
    const raw = [0.9, 0.85, 0.2, 0.1, 0.8, 0.15];
    const y = [1, 0, 0, 0, 1, 0];
    const c = fitPlatt(raw, y);
    expect(c.apply(0.9)).toBeGreaterThan(0);
    expect(c.apply(0.9)).toBeLessThan(1);
  });
});

describe("point-in-time + walk-forward", () => {
  it("does not use bars after as-of when building features", () => {
    const bars = series(400, 100, 0.15);
    const mid = bars[200].date;
    const feat = featuresFromBars(bars, mid);
    const late = featuresFromBars(bars, bars[399].date);
    expect(feat).not.toBeNull();
    expect(late).not.toBeNull();
    expect(feat!.asOf <= mid).toBe(true);
    expect(feat!.availableAt <= mid).toBe(true);
    expect(feat!.values.return_1y).not.toEqual(late!.values.return_1y);
  });

  it("keeps walk-forward folds chronological", () => {
    const folds = walkForwardFolds("2018-01-01", "2024-12-31");
    expect(folds.length).toBeGreaterThan(0);
    for (const f of folds) {
      expect(f.trainTo < f.validateFrom).toBe(true);
      expect(f.validateTo < f.testFrom).toBe(true);
    }
  });

  it("splitByFold never puts a test date into train", () => {
    const fold = walkForwardFolds("2015-01-01", "2022-12-31")[0];
    const rows = [
      { asOf: "2018-06-01", horizon: "1M" as const, entityId: 1, entityName: "A", features: {}, labelReturn: 1, labelPositive: 1, labelGain10: 0, labelGain20: 0, labelGain30: 0, labelDd20: 0 },
      { asOf: "2021-06-01", horizon: "1M" as const, entityId: 1, entityName: "A", features: {}, labelReturn: 1, labelPositive: 1, labelGain10: 0, labelGain20: 0, labelGain30: 0, labelDd20: 0 },
    ];
    const s = splitByFold(rows, fold);
    expect(s.train.every((r) => r.asOf <= fold.trainTo)).toBe(true);
    expect(s.test.every((r) => r.asOf >= fold.testFrom)).toBe(true);
  });
});

describe("opportunity blend and safety", () => {
  it("drops missing ML instead of treating it as zero", () => {
    const b = blendResearchScore({ quantitative: 80, ml: null, ai: null, criticRisk: null });
    expect(b.score).toBeCloseTo(80);
  });

  it("does not invent a prediction when untrained", () => {
    const e = emptyPrediction("not trained");
    expect(e.available).toBe(false);
    expect(e.status).toBe("NOT_TRAINED");
    expect(Object.keys(e.horizons)).toHaveLength(0);
  });

  it("flags signal conflict when tape and sector disagree", () => {
    const c = detectConflicts({ return1m: 6, sectorReturn1y: -12, rs1y: -8, valuation: 70, earnings: 65 });
    expect(c.conflict).toBe(true);
    expect(c.label).toBe("SIGNAL CONFLICT");
  });

  it("computes confidence from sample size, not wording", () => {
    const low = aiConfidence({ analogueCount: 2, mlAgreement: null, dataQuality: 20 });
    expect(low.band).toBe("INSUFFICIENT_EVIDENCE");
    expect(low.note).toMatch(/not from LLM wording/i);
  });

  it("strips forbidden certainty language", () => {
    expect(sanitizeClaims("This is a guaranteed profit and risk-free")).toMatch(/historical probability/i);
  });

  it("marks decay without auto-replacing the model", () => {
    const d = detectDecay({
      oosHitRate: 0.62,
      recentHitRate: 0.4,
      oosSharpe: 1.1,
      recentSharpe: 0.1,
      calibrationGap: 0.2,
      recentMaxDd: 30,
    });
    expect(d.status).toBe("DEGRADED");
    expect(d.note).toMatch(/does not auto-replace/i);
  });
});

describe("local embeddings", () => {
  it("ranks a closer hashed document higher", () => {
    const q = hashEmbed("annual report revenue growth");
    const a = hashEmbed("annual report discusses revenue growth and margins");
    const b = hashEmbed("completely unrelated cooking recipe");
    expect(cosine(q, a)).toBeGreaterThan(cosine(q, b));
  });
});
