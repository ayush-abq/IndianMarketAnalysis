import { fail, ok } from "../../_util";
import { researchCard } from "@/services/local-ai-layer";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { stockId?: number };
  if (!body.stockId) return fail("stockId required");
  const card = await researchCard(body.stockId, { debate: true });
  if (!card) return fail("Stock not found", 404);
  return ok(card);
}
