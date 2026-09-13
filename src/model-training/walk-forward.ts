import { WALK_FORWARD_SPEC } from "@/config/local-ai";
import type { LabeledRow } from "@/ml/types";

export type Fold = {
  name: string;
  trainFrom: string;
  trainTo: string;
  validateFrom: string;
  validateTo: string;
  testFrom: string;
  testTo: string;
};

/** Specified rolling windows, kept only when the sample actually covers them. */
export function walkForwardFolds(minDate: string, maxDate: string): Fold[] {
  const folds: Fold[] = [];
  const minYear = Number(minDate.slice(0, 4));
  for (const spec of WALK_FORWARD_SPEC) {
    const trainStart = `${Math.max(minYear, 2015)}-01-01`;
    const testTo = `${spec.testYear}-12-31`;
    if (trainStart > spec.trainEnd) continue;
    if (spec.trainEnd < minDate) continue;
    if (`${spec.validateYear}-01-01` > maxDate) continue;
    folds.push({
      name: `train≤${spec.trainEnd}/val${spec.validateYear}/test${spec.testYear}`,
      trainFrom: trainStart,
      trainTo: spec.trainEnd,
      validateFrom: `${spec.validateYear}-01-01`,
      validateTo: `${spec.validateYear}-12-31`,
      testFrom: `${spec.testYear}-01-01`,
      testTo: testTo,
    });
  }
  return folds;
}

export function splitByFold(rows: LabeledRow[], fold: Fold) {
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  return {
    train: rows.filter((r) => inRange(r.asOf, fold.trainFrom, fold.trainTo)),
    validate: rows.filter((r) => inRange(r.asOf, fold.validateFrom, fold.validateTo)),
    test: rows.filter((r) => inRange(r.asOf, fold.testFrom, fold.testTo)),
  };
}
