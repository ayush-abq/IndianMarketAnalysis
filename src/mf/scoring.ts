import { clamp } from "@/lib/utils";
import { MF_RESEARCH_WEIGHTS, MF_SCORE_WEIGHTS_BY_CLASS } from "@/config/mf-defaults";
import { scoreClamp } from "./calculations";

export type MfScoreParts = {
  returnScore: number | null;
  riskScore: number | null;
  consistencyScore: number | null;
  drawdownScore: number | null;
  expenseScore: number | null;
  benchmarkScore: number | null;
  portfolioScore: number | null;
  managerScore: number | null;
  aumScore: number | null;
  sectorAlignmentScore: number | null;
};

export type MfClassification =
  | "ELITE"
  | "TOP_TIER"
  | "STRONG"
  | "ABOVE_AVERAGE"
  | "AVERAGE"
  | "WEAK"
  | "HIGH_RISK_HIGH_REWARD"
  | "UNDERPERFORMER"
  | "AVOID_FOR_RESEARCH";

export function classifyFund(score: number, maxDd: number | null, sharpe: number | null): MfClassification {
  if (score >= 85 && (maxDd == null || maxDd > -35) && (sharpe == null || sharpe > 0.6)) return "ELITE";
  if (score >= 75) return "TOP_TIER";
  if (score >= 65) return "STRONG";
  if (score >= 55) return "ABOVE_AVERAGE";
  if ((maxDd ?? 0) <= -40 && (sharpe ?? 1) < 0.3 && score >= 45) return "HIGH_RISK_HIGH_REWARD";
  if (score >= 45) return "AVERAGE";
  if (score >= 30) return "WEAK";
  if (score < 20) return "AVOID_FOR_RESEARCH";
  return "UNDERPERFORMER";
}

export function researchScore(parts: MfScoreParts, assetClass: string) {
  const weights = MF_SCORE_WEIGHTS_BY_CLASS[assetClass] ?? MF_SCORE_WEIGHTS_BY_CLASS.Other;
  const map: [keyof typeof MF_RESEARCH_WEIGHTS, number | null][] = [
    ["risk_adjusted", parts.riskScore],
    ["long_term_returns", parts.returnScore],
    ["consistency", parts.consistencyScore],
    ["drawdown", parts.drawdownScore],
    ["benchmark", parts.benchmarkScore],
    ["expense", parts.expenseScore],
    ["portfolio", parts.portfolioScore],
    ["manager", parts.managerScore],
    ["aum", parts.aumScore],
    ["sector_alignment", parts.sectorAlignmentScore],
  ];
  const used = map.filter(([, v]) => v != null) as [keyof typeof MF_RESEARCH_WEIGHTS, number][];
  const totalW = used.reduce((a, [k]) => a + weights[k], 0);
  if (!totalW) return { overall: null as number | null, used: [] as { key: string; weight: number; value: number }[] };
  const overall = used.reduce((a, [k, v]) => a + v * weights[k], 0) / totalW;
  return {
    overall: clamp(overall, 0, 100),
    used: used.map(([k, v]) => ({ key: k, weight: weights[k], value: v })),
  };
}

export function partScores(input: {
  cagr5y: number | null;
  cagr3y: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
  rollingBeatPct: number | null;
  rollingStdev: number | null;
  excess5y: number | null;
  ter: number | null;
  top10: number | null;
  managerTenure: number | null;
  aumCr: number | null;
  sectorAlignment: number | null;
}): MfScoreParts {
  const ret = average([
    scoreClamp(input.cagr5y, 0, 22),
    scoreClamp(input.cagr3y, -2, 20),
  ]);
  const risk = average([
    scoreClamp(input.sharpe, -0.2, 1.6),
    scoreClamp(input.sortino, -0.2, 2.0),
  ]);
  const consistency = average([
    scoreClamp(input.rollingBeatPct, 30, 90),
    scoreClamp(input.rollingStdev, 2, 14, true),
  ]);
  const dd = scoreClamp(input.maxDrawdown, -45, -5);
  const expense = scoreClamp(input.ter, 0.1, 2.4, true);
  const bench = scoreClamp(input.excess5y, -4, 6);
  const portfolio = scoreClamp(input.top10, 20, 70, true);
  const manager = scoreClamp(input.managerTenure, 0, 8);
  const aum = input.aumCr == null ? 55 : clamp(40 + Math.log10(Math.max(input.aumCr, 1)) * 12, 20, 85);
  return {
    returnScore: ret,
    riskScore: risk,
    consistencyScore: consistency,
    drawdownScore: dd,
    expenseScore: expense,
    benchmarkScore: bench,
    portfolioScore: portfolio,
    managerScore: manager,
    aumScore: aum,
    sectorAlignmentScore: input.sectorAlignment,
  };
}

function average(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}
