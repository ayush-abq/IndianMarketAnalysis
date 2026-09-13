import { fundsForSector } from "@/services/mf-queries";
import { ok } from "../../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ sector: string }> }) {
  const { sector } = await ctx.params;
  return ok(await fundsForSector(decodeURIComponent(sector)));
}
