import { loadFundRows } from "@/services/mf-queries";
import { ok } from "../../_util";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const opts = listOpts(new URL(req.url));
  const rows = await loadFundRows({ ...opts, signal: "CONTRARIAN_RESEARCH" });
  return ok({
    title: "Value / Contrarian research candidates",
    disclaimer: "Exposure to deeply beaten-down NSE sectors without calling the fund a buy. Label: Contrarian Research Candidate.",
    rows: rows.slice(0, opts.limit),
  });
}
