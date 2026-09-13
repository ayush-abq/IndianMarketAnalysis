import { loadFundRows } from "@/services/mf-queries";
import { ok } from "../../../_util";
import { listOpts } from "../../_opts";

export async function GET(req: Request, ctx: { params: Promise<{ category: string }> }) {
  const { category } = await ctx.params;
  const opts = listOpts(new URL(req.url));
  const rows = await loadFundRows({ ...opts, category: decodeURIComponent(category) });
  return ok({ category, rows: rows.slice(0, opts.limit) });
}
