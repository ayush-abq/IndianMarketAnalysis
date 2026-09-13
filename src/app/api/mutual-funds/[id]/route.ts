import { getFundDetail } from "@/services/mf-queries";
import { fundTaxBlock } from "@/services/mf-research";
import { withLicensedNews } from "@/providers/market-news";
import { fail, ok } from "../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const detail = await getFundDetail(Number(id));
  if (!detail) return fail("Fund not found", 404);
  const explanation = await withLicensedNews(detail.explanation, {
    name: detail.fund.schemeName,
    symbol: detail.fund.schemeCode,
  });
  return ok({ ...detail, explanation, tax: await fundTaxBlock(Number(id)) });
}
