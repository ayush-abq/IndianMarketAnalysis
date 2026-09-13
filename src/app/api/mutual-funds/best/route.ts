import { loadFundRows } from "@/services/mf-queries";
import { ok } from "../../_util";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const opts = listOpts(new URL(req.url));
  const rows = await loadFundRows(opts);
  return ok({ title: "Best Funds — research ranking", disclaimer: "Composite research score within the filtered set. Not a buy list.", rows: rows.slice(0, opts.limit) });
}
