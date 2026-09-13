import { getFundDetail } from "@/services/mf-queries";
import { fail, ok } from "../../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = await getFundDetail(Number(id));
  if (!d) return fail("Not found", 404);
  return ok(d.risk);
}
