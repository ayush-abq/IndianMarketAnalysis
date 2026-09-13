import { buildDashboard } from "@/services/queries";
import { ok } from "../_util";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rt = url.searchParams.get("returnType") === "TR" ? "TR" : "PR";
  return ok(await buildDashboard(rt));
}
