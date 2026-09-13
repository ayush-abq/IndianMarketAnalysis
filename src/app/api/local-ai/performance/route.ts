import { ok } from "../../_util";
import { performanceDashboard } from "@/services/local-ai-layer";

export async function GET() {
  return ok(await performanceDashboard());
}
