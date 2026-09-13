import { ollamaEmbed } from "@/ai/ollama";

/** Local hashed n-grams — no paid embedding API. Used when Ollama embeddings are not pulled. */
export function hashEmbed(text: string, dim = 256): number[] {
  const vec = new Array(dim).fill(0);
  const t = text.toLowerCase();
  for (let i = 0; i < t.length - 2; i++) {
    const gram = t.slice(i, i + 3);
    let h = 2166136261;
    for (let j = 0; j < gram.length; j++) h = Math.imul(h ^ gram.charCodeAt(j), 16777619);
    vec[(h >>> 0) % dim] += 1;
  }
  const n = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
  return vec.map((v) => v / n);
}

export async function embedText(text: string, model?: string) {
  if (model) {
    try {
      const v = await ollamaEmbed(model, text);
      if (v.length) return { vector: v, model, source: "ollama" as const };
    } catch {
      /* fall through to local hash */
    }
  }
  return { vector: hashEmbed(text), model: "hash-ngram-256", source: "local_hash" as const };
}

export function cosine(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
