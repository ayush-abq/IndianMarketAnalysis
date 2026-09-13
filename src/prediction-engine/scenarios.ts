import type { HorizonPrediction } from "./predict";

export function scenariosFromMl(p6: HorizonPrediction | null) {
  const p = p6?.calibratedProbability;
  if (p == null) {
    return {
      source: "unavailable",
      note: "Scenarios are not invented. Train a 6M model first.",
      bull: null,
      base: null,
      bear: null,
    };
  }
  const exp = p6?.expectedReturn ?? null;
  return {
    source: "ml",
    note: "Probabilities come from the calibrated ML ensemble. The LLM may only explain these numbers.",
    bull: {
      expectedReturn: exp != null ? exp + Math.abs(exp) * 0.6 : null,
      probability: Math.min(0.95, p * 0.55),
      drivers: ["Historical analog of stronger 6M outcomes in the trained sample"],
      risks: ["Right tail is a scenario, not a target"],
    },
    base: {
      expectedReturn: exp,
      probability: Math.min(0.95, 0.25 + p * 0.35),
      drivers: ["Calibrated 6M probability and ridge expected return"],
      risks: ["Out-of-sample error remains"],
    },
    bear: {
      expectedReturn: exp != null ? -Math.abs(exp) : null,
      probability: Math.min(0.95, 1 - p),
      drivers: ["Complement of the calibrated positive-outcome probability"],
      risks: ["Path drawdown can exceed the expected-return bear case"],
    },
  };
}
