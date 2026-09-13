import { fail, ok } from "../../../../_util";
import { predictEntity, researchCard } from "@/services/local-ai-layer";

export async function GET(req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await ctx.params;
  const entityId = Number(id);
  if (!Number.isFinite(entityId)) return fail("Invalid id");
  const debate = new URL(req.url).searchParams.get("debate") === "1";
  if (type.toUpperCase() !== "STOCK") {
    return ok(await predictEntity("INDEX", entityId));
  }
  return ok(await researchCard(entityId, { debate }));
}
