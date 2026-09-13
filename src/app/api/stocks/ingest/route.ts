import { runStockIngestion } from "@/services/stock-ingestion";
import { ok } from "../../_util";

export async function POST() {
  return ok(await runStockIngestion("manual"));
}
