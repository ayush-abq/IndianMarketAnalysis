import { localLlm, parseJsonObject } from "./local-llm";
import { compactContext, contextGuardrail, type MarketContext } from "./market-context";
import { runDebate } from "@/ai-agents/debate";

export class LocalAIService {
  async analyze(ctx: MarketContext) {
    return runDebate(ctx);
  }

  async explain(ctx: MarketContext) {
    const model = await localLlm.resolveModel("fast");
    if (!model) return { source: "unavailable", text: "No local model selected." };
    const out = await localLlm.complete(
      "fast",
      `${contextGuardrail()} Explain the numbers. Do not add new ones.`,
      compactContext(ctx),
    );
    return { source: out.source, text: out.text, model: out.model };
  }

  async criticize(ctx: MarketContext) {
    const debate = await runDebate(ctx);
    return debate.critic;
  }

  async summarize(ctx: MarketContext) {
    const model = await localLlm.resolveModel("fast");
    if (!model) return { source: "unavailable", text: "No local model selected." };
    const out = await localLlm.complete("fast", `${contextGuardrail()} Summarize in 5 bullets.`, compactContext(ctx));
    return { source: out.source, text: out.text, model: out.model };
  }

  async compare(left: MarketContext, right: MarketContext) {
    const model = await localLlm.resolveModel("analyst");
    if (!model) return { source: "unavailable", text: "No local model selected." };
    const out = await localLlm.complete(
      "analyst",
      `${contextGuardrail()} Compare these two contexts. Do not invent a winner.`,
      JSON.stringify({ left, right }),
    );
    return { source: out.source, text: out.text, parsed: parseJsonObject(out.text), model: out.model };
  }

  async research(ctx: MarketContext) {
    return runDebate(ctx, { persist: true });
  }

  async generateReport(ctx: MarketContext) {
    const debate = await runDebate(ctx, { persist: true });
    return {
      title: `Local research report — ${ctx.entity.name} @ ${ctx.asOf}`,
      disclaimer: "Research signal only. Not a recommendation. Numbers come from the local database and ML registry.",
      debate,
      context: ctx,
    };
  }
}

export const localAi = new LocalAIService();
