import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type StructuredMetrics = {
  sector: string;
  drawdown: number;
  return_1y: number | null;
  return_2y: number | null;
  return_5y: number | null;
  recovery_score: number;
  relative_strength_1y: number | null;
  price_vs_200dma: number | null;
  signal: string;
  research_note: string;
};

/**
 * Optional layer. The model receives structured DB metrics only.
 * It is instructed not to invent numbers. If the API is off, a
 * deterministic summary from the research note is returned.
 */
export async function analyzeWithAi(metrics: StructuredMetrics) {
  if (env().LOCAL_AI_ENABLED) {
    try {
      const { localLlm } = await import("@/ai/local-llm");
      const { contextGuardrail } = await import("@/ai/market-context");
      const model = await localLlm.resolveModel("analyst");
      if (model) {
        const out = await localLlm.complete(
          "analyst",
          `${contextGuardrail()} Return JSON keys: summary, whatIsWeak, whatIsImproving, whatRemainsRisky, historicalContext, whyItQualifies, invalidation. Use only supplied numbers.`,
          JSON.stringify(metrics),
        );
        const { parseJsonObject } = await import("@/ai/local-llm");
        const parsed = parseJsonObject(out.text);
        if (parsed) return { source: "local_ollama", ...parsed, metrics };
      }
    } catch {
      /* fall through to deterministic — never to a paid API from this path */
    }
  }
  if (!env().AI_ANALYSIS_ENABLED || !env().OPENAI_API_KEY) {
    return {
      source: "deterministic",
      summary: metrics.research_note,
      whatIsWeak: `Drawdown ${metrics.drawdown.toFixed(1)}%, 1Y ${metrics.return_1y ?? "n/a"}`,
      whatIsImproving: `Recovery score ${metrics.recovery_score.toFixed(0)}`,
      whatRemainsRisky: metrics.signal === "FALLING_KNIFE" ? "Momentum remains negative" : "See research note",
      historicalContext: "See historical analysis page for point-in-time context.",
      whyItQualifies: metrics.signal,
      invalidation: "A sustained move back toward ATH with 200DMA reclaim would weaken the beaten-down thesis.",
      metrics,
    };
  }

  const body = {
    model: env().OPENAI_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a research assistant. Use ONLY the supplied JSON numbers. Never invent, round into new facts, or recommend buying/selling. Return JSON with keys: summary, whatIsWeak, whatIsImproving, whatRemainsRisky, historicalContext, whyItQualifies, invalidation.",
      },
      { role: "user", content: JSON.stringify(metrics) },
    ],
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env().OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content.replace(/^```json|```$/g, ""));
    return { source: "ai", ...parsed, metrics };
  } catch (err) {
    logger.error({ err }, "AI analysis failed — returning deterministic note");
    return {
      source: "deterministic",
      summary: metrics.research_note,
      metrics,
    };
  }
}
