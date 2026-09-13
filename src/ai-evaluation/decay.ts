export type DecayStatus = "HEALTHY" | "WATCH" | "DEGRADED" | "DISABLED";

export function detectDecay(input: {
  oosHitRate: number | null;
  recentHitRate: number | null;
  oosSharpe: number | null;
  recentSharpe: number | null;
  calibrationGap: number | null;
  recentMaxDd: number | null;
}) {
  const reasons: string[] = [];
  let score = 0;
  if (input.oosHitRate != null && input.recentHitRate != null && input.recentHitRate < input.oosHitRate - 0.08) {
    score += 1;
    reasons.push("Hit rate is falling versus walk-forward OOS");
  }
  if (input.oosSharpe != null && input.recentSharpe != null && input.recentSharpe < input.oosSharpe - 0.3) {
    score += 1;
    reasons.push("Sharpe is falling versus walk-forward OOS");
  }
  if ((input.calibrationGap ?? 0) > 0.12) {
    score += 1;
    reasons.push("Calibration is deteriorating");
  }
  if ((input.recentMaxDd ?? 0) > 25) {
    score += 1;
    reasons.push("Recent path drawdown is elevated");
  }
  const status: DecayStatus = score >= 3 ? "DEGRADED" : score === 2 ? "WATCH" : score <= 0 ? "HEALTHY" : "WATCH";
  return {
    status,
    reasons,
    note: "DEGRADED does not auto-replace the model. Register a new version after retraining.",
  };
}
