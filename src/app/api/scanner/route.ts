import { applyScannerFilters, loadScannerRows } from "@/services/queries";
import { ok, parseNum } from "../_util";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnType = url.searchParams.get("returnType") === "TR" ? "TR" : "PR";
  const rows = await loadScannerRows({ returnType });
  return ok(
    applyScannerFilters(rows, {
      drawdown: parseNum(url.searchParams.get("drawdown")),
      y1: parseNum(url.searchParams.get("y1")),
      y2: parseNum(url.searchParams.get("y2")),
      y5: parseNum(url.searchParams.get("y5")),
      recovery: url.searchParams.get("recovery") as "high" | "medium" | "low" | undefined,
      trend: url.searchParams.get("trend") as "bullish" | "neutral" | "bearish" | undefined,
      classification: url.searchParams.get("classification") ?? undefined,
      signal: url.searchParams.get("signal") ?? undefined,
      sort: url.searchParams.get("sort") ?? "drawdown",
    }),
  );
}
