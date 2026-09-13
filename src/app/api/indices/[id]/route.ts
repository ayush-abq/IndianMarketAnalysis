import { loadScannerRows } from "@/services/queries";
import { getIndexDetail } from "@/services/queries";
import { withLicensedNews } from "@/providers/market-news";
import { fail, ok } from "../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const indexId = Number(id);
  const meta = await getIndexDetail(indexId);
  if (!meta) return fail("Index not found", 404);
  const rows = await loadScannerRows({ returnType: "PR", includeBenchmarks: true });
  const row = rows.find((r) => r.indexId === indexId) ?? null;
  const explanation = row
    ? await withLicensedNews(row.explanation, { name: meta.name, symbol: meta.symbol })
    : null;
  return ok({ meta, snapshot: row ? { ...row, explanation } : null });
}
