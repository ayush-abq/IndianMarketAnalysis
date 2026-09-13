import { dataHealth } from "@/services/data-health";
import { ok, fail } from "../_util";

export async function GET() {
  try {
    return ok(await dataHealth());
  } catch (err) {
    return fail(err instanceof Error ? err.message : "data health failed", 500);
  }
}
