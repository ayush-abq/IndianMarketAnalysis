import { loadFundRows } from "@/services/mf-queries";
import { fail, ok } from "../../_util";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const asOf = url.searchParams.get("asOf");
  if (!asOf) return fail("asOf required (YYYY-MM-DD). Ranking uses only information available on that date.");
  const opts = listOpts(url);
  const rows = await loadFundRows({ ...opts, asOf });
  return ok({
    asOf,
    note: "Point-in-time research ranking. Scores and NAVs after this date are not used. Survivorship: inactive/merged schemes remain in history when ingested.",
    rows: rows.slice(0, opts.limit),
  });
}
