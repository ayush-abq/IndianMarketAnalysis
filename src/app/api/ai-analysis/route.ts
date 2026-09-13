import { loadScannerRows } from "@/services/queries";
import { analyzeWithAi } from "@/services/ai-analysis";
import { fail, ok } from "../_util";

export async function POST(req: Request) {
  const body = (await req.json()) as { indexId?: number };
  if (!body.indexId) return fail("indexId required");
  const rows = await loadScannerRows({ returnType: "PR", includeBenchmarks: true });
  const row = rows.find((r) => r.indexId === body.indexId);
  if (!row) return fail("Not found", 404);
  return ok(
    await analyzeWithAi({
      sector: row.name,
      drawdown: row.distanceFromAth,
      return_1y: row.return1y,
      return_2y: row.return2y,
      return_5y: row.return5y,
      recovery_score: row.recoveryScore,
      relative_strength_1y: row.rs1yNifty50,
      price_vs_200dma: row.priceVs200,
      signal: row.signal,
      research_note: row.researchNote ?? "",
    }),
  );
}
