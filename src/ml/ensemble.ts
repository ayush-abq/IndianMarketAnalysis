import type { BinaryModel, Calibrator } from "./types";
import { applyCalibrator } from "./calibration";

export type EnsembleMember = {
  id: string;
  model: BinaryModel;
  oosScore: number;
  calibrator?: Calibrator;
};

/** Weights from out-of-sample scores. Never equal unless scores are equal. */
export function ensembleWeights(members: { id: string; oosScore: number }[]) {
  const floor = members.map((m) => Math.max(0, m.oosScore));
  const sum = floor.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return Object.fromEntries(members.map((m) => [m.id, 1 / Math.max(1, members.length)]));
  }
  return Object.fromEntries(members.map((m, i) => [m.id, floor[i] / sum]));
}

export function predictEnsemble(members: EnsembleMember[], x: number[]) {
  const weights = ensembleWeights(members);
  let raw = 0;
  let calibrated = 0;
  const parts: { id: string; raw: number; calibrated: number; weight: number }[] = [];
  for (const m of members) {
    const r = m.model.predictProba(x);
    const c = applyCalibrator(m.calibrator, r);
    const w = weights[m.id] ?? 0;
    raw += r * w;
    calibrated += c * w;
    parts.push({ id: m.id, raw: r, calibrated: c, weight: w });
  }
  return { raw, calibrated, parts, weights };
}

export function serializeCalibrator(c: Calibrator) {
  return c;
}
