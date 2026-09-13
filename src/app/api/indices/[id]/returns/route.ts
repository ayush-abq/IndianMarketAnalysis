import { loadScannerRows } from "@/services/queries";
import { fail, ok } from "../../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await loadScannerRows({ returnType: "PR", includeBenchmarks: true });
  const row = rows.find((r) => r.indexId === Number(id));
  if (!row) return fail("Not found", 404);
  return ok({
    returnType: "PR",
    periods: {
      "1D": row.return1d,
      "1W": row.return1w,
      "1M": row.return1m,
      "3M": row.return3m,
      "6M": row.return6m,
      "1Y": row.return1y,
      "2Y": row.return2y,
      "3Y": row.return3y,
      "5Y": row.return5y,
    },
  });
}
