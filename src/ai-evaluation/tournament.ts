import { classificationMetrics, financialMetrics } from "@/ml/metrics";

export type TournamentRow = {
  model: string;
  classification: ReturnType<typeof classificationMetrics>;
  financial: ReturnType<typeof financialMetrics>;
};

export function rankTournament(rows: TournamentRow[]) {
  const scored = rows.map((r) => {
    const sharpe = r.financial.sharpe ?? -99;
    const pf = r.financial.profitFactor ?? 0;
    const dd = r.financial.maxDrawdown ?? 100;
    const pr = r.classification.prAuc ?? 0;
    const brier = r.classification.brier ?? 1;
    const score = sharpe * 0.35 + pf * 0.15 + pr * 0.25 + (1 - brier) * 0.15 - (dd / 100) * 0.1;
    return { ...r, robustness: score };
  });
  scored.sort((a, b) => b.robustness - a.robustness);
  return {
    winner: scored[0]?.model ?? null,
    ranking: scored,
    note: "Winner is chosen on out-of-sample Sharpe / PR-AUC / Brier / drawdown — not model-name hype.",
  };
}
