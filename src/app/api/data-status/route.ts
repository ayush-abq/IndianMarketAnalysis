import { dataHealth } from "@/services/data-health";
import { ok } from "../_util";

export async function GET() {
  return ok(await dataHealth());
}
