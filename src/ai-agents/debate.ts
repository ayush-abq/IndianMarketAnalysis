import { localLlm, parseJsonObject } from "@/ai/local-llm";
import { compactContext, type MarketContext } from "@/ai/market-context";
import { ANALOGUE_SYSTEM, ANALYST_SYSTEM, CRITIC_SYSTEM, SYNTHESIS_SYSTEM } from "./prompts";
import { aiConfidence } from "@/ai/confidence";
import { getDb } from "@/db/client";
import { aiDebateRuns, aiResearchMemory } from "@/db/schema";

export type DebateResult = {
  source: "ollama" | "unavailable";
  analyst: Record<string, unknown> | { unavailable: string };
  critic: Record<string, unknown> | { unavailable: string };
  synthesis: Record<string, unknown> | { unavailable: string };
  analogues: Record<string, unknown> | null;
  confidence: ReturnType<typeof aiConfidence>;
  models: { analyst: string; critic: string; synthesizer: string };
};

export async function runDebate(ctx: MarketContext, opts?: { persist?: boolean }): Promise<DebateResult> {
  const payload = compactContext(ctx);
  const models = {
    analyst: await localLlm.resolveModel("analyst"),
    critic: await localLlm.resolveModel("critic"),
    synthesizer: await localLlm.resolveModel("synthesizer"),
  };
  if (!models.analyst) {
    const unavailable = {
      unavailable: "Ollama model not selected. Set local_ai.analyst_model or AI_MODEL_ANALYST after you pull weights. No cloud fallback.",
    };
    return {
      source: "unavailable",
      analyst: unavailable,
      critic: { unavailable: "Critic did not run — no local model." },
      synthesis: { unavailable: "Synthesis did not run — no local model." },
      analogues: null,
      confidence: aiConfidence({ mlAgreement: agreement(ctx), analogueCount: ctx.historicalAnalogues?.comparable ?? 0, dataQuality: ctx.dataQuality.score }),
      models,
    };
  }

  const [analystText, criticText] = await Promise.all([
    localLlm.complete("analyst", ANALYST_SYSTEM, payload),
    localLlm.complete("critic", CRITIC_SYSTEM, payload),
  ]);
  const analyst = parseJsonObject(analystText.text) ?? { raw: analystText.text };
  const critic = parseJsonObject(criticText.text) ?? { raw: criticText.text };
  const synthIn = JSON.stringify({ market: ctx, analyst, critic });
  const synthText = await localLlm.complete("synthesizer", SYNTHESIS_SYSTEM, synthIn);
  const synthesis = parseJsonObject(synthText.text) ?? { raw: synthText.text };

  let analogues: Record<string, unknown> | null = null;
  if (ctx.historicalAnalogues) {
    const a = await localLlm.complete(
      "fast",
      ANALOGUE_SYSTEM,
      JSON.stringify({ current: ctx, analogues: ctx.historicalAnalogues }),
    );
    analogues = parseJsonObject(a.text) ?? { raw: a.text };
  }

  const confidence = aiConfidence({
    mlAgreement: agreement(ctx),
    analogueCount: ctx.historicalAnalogues?.comparable ?? 0,
    dataQuality: ctx.dataQuality.score,
    calibrationGap: gap(ctx),
    analystCriticAgree: String(analyst.thesis ?? "") === String((critic as { conclusion?: string }).conclusion ?? "") ? true : false,
    modelsDisagree: disagreement(ctx),
  });

  if (opts?.persist) {
    const db = getDb();
    await db.insert(aiDebateRuns).values({
      entityType: ctx.entity.type,
      entityId: ctx.entity.id,
      asOf: ctx.asOf,
      analyst,
      critic,
      synthesis,
      confidence,
    });
    await db.insert(aiResearchMemory).values({
      entityType: ctx.entity.type,
      entityId: ctx.entity.id,
      asOf: ctx.asOf,
      role: "SYNTHESIS",
      thesis: String((synthesis as { final_research_assessment?: string }).final_research_assessment ?? ""),
      analysis: { analyst, critic, synthesis },
      prediction: ctx.ml,
    });
  }

  return { source: "ollama", analyst, critic, synthesis, analogues, confidence, models };
}

function agreement(ctx: MarketContext) {
  const parts = (ctx.ml as { members?: { raw: number }[] } | null)?.members;
  if (!parts?.length) return null;
  const mean = parts.reduce((a, p) => a + p.raw, 0) / parts.length;
  const var_ = parts.reduce((a, p) => a + (p.raw - mean) ** 2, 0) / parts.length;
  return Math.max(0, 1 - Math.sqrt(var_) * 4);
}

function gap(ctx: MarketContext) {
  const ml = ctx.ml as { rawProbability?: number; calibratedProbability?: number } | null;
  if (ml?.rawProbability == null || ml.calibratedProbability == null) return null;
  return Math.abs(ml.rawProbability - ml.calibratedProbability);
}

function disagreement(ctx: MarketContext) {
  const parts = (ctx.ml as { members?: { raw: number }[] } | null)?.members;
  if (!parts || parts.length < 2) return false;
  const xs = parts.map((p) => p.raw);
  return Math.max(...xs) - Math.min(...xs) > 0.25;
}
