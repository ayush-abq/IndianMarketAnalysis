import { getFundDetail } from "@/services/mf-queries";
import { fail, ok } from "../../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = await getFundDetail(Number(id));
  if (!d?.score) return fail("Score not computed — need more official NAV history", 404);
  return ok({
    score: d.score,
    howCalculated:
      "Configurable category-specific weights on risk-adjusted returns, long-term returns, consistency, drawdown, benchmark excess, expense, portfolio, manager, AUM, and NSE sector alignment. Missing inputs are omitted and weights renormalized. Never ranked solely on 5Y return.",
  });
}
