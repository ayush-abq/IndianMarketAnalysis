import { localAiStatus } from "@/services/local-ai-layer";
import { ok } from "../../_util";

export async function GET() {
  return ok(await localAiStatus());
}
