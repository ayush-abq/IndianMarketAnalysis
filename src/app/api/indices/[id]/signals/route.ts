import { loadScannerRows } from "@/services/queries";
import { fail, ok } from "../../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await loadScannerRows({ returnType: "PR", includeBenchmarks: true });
  const row = rows.find((r) => r.indexId === Number(id));
  if (!row) return fail("Not found", 404);
  return ok({
    signal: row.signal,
    signalLabel: row.signalLabel,
    classification: row.classification,
    trendState: row.trendState,
    recoveryScore: row.recoveryScore,
    opportunityScore: row.opportunityScore,
    researchNote: row.researchNote,
  });
}
