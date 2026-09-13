import { analyzeFund } from "@/services/mf-ai";
import { fail, ok } from "../../../_util";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const out = await analyzeFund(Number(id));
  if (!out) return fail("Not found", 404);
  return ok(out);
}
