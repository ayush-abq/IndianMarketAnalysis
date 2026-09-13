import { loadStockRows } from "@/services/stock-metrics";
import { ok } from "../_util";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rows = await loadStockRows({
    q: url.searchParams.get("q") ?? undefined,
    classification: url.searchParams.get("classification") ?? undefined,
    index: url.searchParams.get("index") ?? undefined,
  });
  return ok({
    rows,
    note: "Official bhavcopy prices. 1Y / ATH / DMA need enough stored daily files.",
  });
}
