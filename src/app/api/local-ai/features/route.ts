import { fail, ok } from "../../_util";
import { materializeFeatures } from "@/services/local-ai-layer";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { limit?: number; asOf?: string };
  try {
    return ok(await materializeFeatures(body));
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Feature materialize failed");
  }
}
