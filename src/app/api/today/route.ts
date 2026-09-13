import { buildSimplePicks } from "@/services/simple-picks";
import { ok } from "../_util";

export async function GET() {
  return ok(await buildSimplePicks());
}
