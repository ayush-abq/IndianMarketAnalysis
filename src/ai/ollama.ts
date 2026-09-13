import { env } from "@/lib/env";
import { getSettings } from "@/services/settings";

export type OllamaStatus = {
  reachable: boolean;
  baseUrl: string;
  models: { name: string; size: number | null }[];
  error: string | null;
};

export async function ollamaBaseUrl() {
  try {
    const s = await getSettings();
    return s.local_ai.ollama_base_url || env().OLLAMA_BASE_URL;
  } catch {
    return env().OLLAMA_BASE_URL;
  }
}

export async function probeOllama(): Promise<OllamaStatus> {
  const baseUrl = await ollamaBaseUrl();
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { reachable: false, baseUrl, models: [], error: `Ollama HTTP ${res.status}` };
    const body = (await res.json()) as { models?: { name: string; size?: number }[] };
    return {
      reachable: true,
      baseUrl,
      models: (body.models ?? []).map((m) => ({ name: m.name, size: m.size ?? null })),
      error: null,
    };
  } catch (err) {
    return {
      reachable: false,
      baseUrl,
      models: [],
      error: err instanceof Error ? err.message : "Ollama not reachable",
    };
  }
}

export async function ollamaChat(input: {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  numCtx?: number;
  maxTokens?: number;
  think?: boolean;
}): Promise<{ text: string; model: string; source: "ollama" }> {
  if (!input.model.trim()) {
    throw new Error("No local model selected. Set AI_MODEL_ANALYST or Settings → local_ai.analyst_model after `ollama pull`.");
  }
  const baseUrl = await ollamaBaseUrl();
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      stream: false,
      think: input.think ?? false,
      options: {
        temperature: input.temperature ?? 0.2,
        num_ctx: input.numCtx ?? 8192,
        num_predict: input.maxTokens ?? 1400,
      },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    throw new Error(`Local Ollama chat failed (${res.status}). Is the model pulled?`);
  }
  const body = (await res.json()) as { message?: { content?: string } };
  return { text: body.message?.content ?? "", model: input.model, source: "ollama" };
}

export async function ollamaEmbed(model: string, text: string): Promise<number[]> {
  const baseUrl = await ollamaBaseUrl();
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Local embedding failed (${res.status})`);
  const body = (await res.json()) as { embedding?: number[] };
  return body.embedding ?? [];
}
