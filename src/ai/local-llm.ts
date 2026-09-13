import { env } from "@/lib/env";
import { getSettings } from "@/services/settings";
import { ollamaChat, probeOllama } from "./ollama";
import { FORBIDDEN_CLAIMS } from "@/config/local-ai";

export type LlmRole = "analyst" | "critic" | "synthesizer" | "fast";

export class LocalLLMProvider {
  async resolveModel(role: LlmRole): Promise<string> {
    const settings = await getSettings().catch(() => null);
    const e = env();
    const fromSettings = settings?.local_ai;
    const map: Record<LlmRole, string> = {
      analyst: fromSettings?.analyst_model || e.AI_MODEL_ANALYST,
      critic: fromSettings?.critic_model || e.AI_MODEL_REASONER || e.AI_MODEL_ANALYST,
      synthesizer: fromSettings?.synthesizer_model || e.AI_MODEL_REASONER || e.AI_MODEL_ANALYST,
      fast: fromSettings?.fast_model || e.AI_MODEL_FAST || e.AI_MODEL_ANALYST,
    };
    return map[role].trim();
  }

  async available() {
    const probe = await probeOllama();
    return probe;
  }

  async complete(role: LlmRole, system: string, user: string) {
    const settings = await getSettings().catch(() => null);
    const model = await this.resolveModel(role);
    const out = await ollamaChat({
      model,
      system,
      user,
      temperature: settings?.local_ai.temperature ?? 0.2,
      numCtx: settings?.local_ai.context_size ?? 8192,
      maxTokens: settings?.local_ai.max_tokens ?? 1400,
      think: settings?.local_ai.thinking_mode ?? false,
    });
    return { ...out, text: sanitizeClaims(out.text) };
  }
}

export const localLlm = new LocalLLMProvider();

export function sanitizeClaims(text: string) {
  let out = text;
  for (const phrase of FORBIDDEN_CLAIMS) {
    const re = new RegExp(phrase, "ig");
    out = out.replace(re, "historical probability / model estimate");
  }
  return out;
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
