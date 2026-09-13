import { scanMarketStructure } from "@/services/structure-scan";
import { ok } from "../_util";

export async function GET() {
  return ok(await scanMarketStructure());
}
