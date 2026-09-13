import { fail, ok } from "../../_util";
import { ingestDocument, searchDocuments } from "@/rag/store";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q");
  if (!q) return fail("q required");
  return ok(await searchDocuments(q, { company: new URL(req.url).searchParams.get("company") ?? undefined }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    source: string;
    title: string;
    documentType: string;
    company?: string;
    documentDate?: string;
    body: string;
  };
  if (!body?.body || !body.title) return fail("title and body required");
  return ok(await ingestDocument(body));
}
