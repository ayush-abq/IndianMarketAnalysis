import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ragChunks, ragDocuments } from "@/db/schema";
import { cosine, embedText } from "./embeddings";

export async function ingestDocument(input: {
  source: string;
  title: string;
  documentType: string;
  company?: string;
  documentDate?: string;
  body: string;
  embeddingModel?: string;
}) {
  const db = getDb();
  const [doc] = await db
    .insert(ragDocuments)
    .values({
      source: input.source,
      title: input.title,
      documentType: input.documentType,
      company: input.company,
      documentDate: input.documentDate,
      body: input.body,
    })
    .returning();
  const chunks = chunkText(input.body, 800);
  for (let i = 0; i < chunks.length; i++) {
    const emb = await embedText(chunks[i], input.embeddingModel);
    await db.insert(ragChunks).values({
      documentId: doc.id,
      chunkIndex: i,
      text: chunks[i],
      embedding: emb.vector,
      embeddingModel: emb.model,
    });
  }
  return { documentId: doc.id, chunks: chunks.length };
}

export async function searchDocuments(query: string, opts?: { company?: string; k?: number; embeddingModel?: string }) {
  const db = getDb();
  const q = await embedText(query, opts?.embeddingModel);
  const docs = await db.select().from(ragDocuments);
  const allowed = new Set(docs.filter((d) => !opts?.company || d.company === opts.company).map((d) => d.id));
  const chunks = await db.select().from(ragChunks);
  const scored = chunks
    .filter((c) => allowed.has(c.documentId) && Array.isArray(c.embedding))
    .map((c) => ({
      ...c,
      score: cosine(q.vector, c.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts?.k ?? 6);
  return { query, embedding: q.model, hits: scored, note: "Local vector search only. No cloud embeddings." };
}

export async function documentById(id: number) {
  const db = getDb();
  const [doc] = await db.select().from(ragDocuments).where(eq(ragDocuments.id, id)).limit(1);
  return doc ?? null;
}

function chunkText(text: string, size: number) {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.filter((s) => s.trim().length > 40);
}
