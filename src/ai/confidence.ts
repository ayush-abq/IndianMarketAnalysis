export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_EVIDENCE";

export function aiConfidence(input: {
  mlAgreement?: number | null;
  analogueCount?: number | null;
  dataQuality?: number | null;
  calibrationGap?: number | null;
  regimeMatch?: boolean | null;
  analystCriticAgree?: boolean | null;
  modelsDisagree?: boolean;
  stale?: boolean;
}) {
  const reasons: string[] = [];
  let score = 50;
  if (input.mlAgreement != null) {
    score += (input.mlAgreement - 0.5) * 40;
    reasons.push(`ML member agreement ${input.mlAgreement.toFixed(2)}`);
  } else {
    score -= 10;
    reasons.push("ML agreement unavailable");
  }
  if ((input.analogueCount ?? 0) >= 20) score += 8;
  else if ((input.analogueCount ?? 0) < 8) {
    score -= 12;
    reasons.push("Historical analogue sample is thin");
  }
  if ((input.dataQuality ?? 100) < 40) {
    score -= 15;
    reasons.push("Data quality is incomplete");
  }
  if ((input.calibrationGap ?? 0) > 0.15) {
    score -= 10;
    reasons.push("Raw vs calibrated probability gap is wide");
  }
  if (input.regimeMatch === false) {
    score -= 8;
    reasons.push("Regime compatibility is weak");
  }
  if (input.analystCriticAgree === false) {
    score -= 8;
    reasons.push("Analyst and critic disagree");
  }
  if (input.modelsDisagree) {
    score -= 10;
    reasons.push("Models disagree");
  }
  if (input.stale) {
    score -= 10;
    reasons.push("Inputs are stale");
  }
  score = Math.max(0, Math.min(100, score));
  const band: ConfidenceBand =
    (input.analogueCount ?? 0) < 5 && input.mlAgreement == null
      ? "INSUFFICIENT_EVIDENCE"
      : score >= 70
        ? "HIGH"
        : score >= 50
          ? "MEDIUM"
          : score >= 30
            ? "LOW"
            : "INSUFFICIENT_EVIDENCE";
  return {
    score,
    band,
    reasons,
    note: "Confidence is computed from agreement, sample size, data quality and calibration — not from LLM wording.",
  };
}
