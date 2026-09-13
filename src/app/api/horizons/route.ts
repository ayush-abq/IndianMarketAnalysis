import { buildHorizonBoard } from "@/services/horizon-research";
import { ok } from "../_util";

export async function GET() {
  return ok(await buildHorizonBoard());
}
