import { loadFundRows } from "@/services/mf-queries";
import { ok } from "../../_util";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const opts = listOpts(new URL(req.url));
  const rows = await loadFundRows({ ...opts, indexOnly: true });
  rows.sort((a, b) => {
    const cost = (a.expenseRatio ?? 9) - (b.expenseRatio ?? 9);
    const score = (b.overallScore ?? 0) - (a.overallScore ?? 0);
    return Math.abs(cost) > 0.01 ? cost : score;
  });
  return ok({
    title: "Low-cost Index Funds / ETFs",
    disclaimer: "Ranked by research score with expense visible. Tracking difference/error appear only when a licensed official feed provides them — never invented.",
    rows: rows.slice(0, opts.limit),
  });
}
