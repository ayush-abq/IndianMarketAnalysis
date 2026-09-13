import { forwardReturns, scanAsOf } from "@/services/historical-scanner";
import { fail, ok } from "../_util";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const asOf = url.searchParams.get("asOf");
  if (!asOf) return fail("asOf=YYYY-MM-DD is required");
  const rows = await scanAsOf(asOf);
  const withForward = [];
  for (const row of rows) {
    const fwd = url.searchParams.get("forward") === "1" ? await forwardReturns(row.indexId, asOf) : [];
    withForward.push({ ...row, forward: fwd });
  }
  return ok({ asOf, note: "Point-in-time: ATH and signals use only data available on asOf.", rows: withForward });
}
