import { mfDashboard } from "@/services/mf-queries";
import { ok } from "../../_util";

export async function GET() {
  return ok(await mfDashboard());
}
