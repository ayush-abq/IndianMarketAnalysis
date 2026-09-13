import { LOCAL_AI_BLEND } from "@/config/local-ai";
import { weightedAvailable } from "@/scoring/weighted-score";

export function blendResearchScore(input: {
  quantitative: number | null;
  ml: number | null;
  ai: number | null;
  criticRisk: number | null;
  weights?: { quantitative: number; ml: number; ai: number; critic_risk: number };
}) {
  const w = input.weights ?? LOCAL_AI_BLEND;
  const raw = weightedAvailable(
    {
      quantitative: input.quantitative,
      ml: input.ml,
      ai: input.ai,
      critic_risk: input.criticRisk,
    },
    w,
  );
  return {
    ...raw,
    note: "LLM weight is capped by settings. Missing ML/AI parts are dropped and weights renormalized — never treated as zero.",
  };
}

export function mlScoreFromProbability(p: number | null) {
  if (p == null || !Number.isFinite(p)) return null;
  return Math.max(0, Math.min(100, p * 100));
}
