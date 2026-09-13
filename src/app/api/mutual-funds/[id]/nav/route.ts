import { loadNavSeries } from "@/services/mf-queries";
import { ok } from "../../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await loadNavSeries(Number(id));
  return ok(rows.map((r) => ({ date: r.date, nav: Number(r.nav) })));
}
