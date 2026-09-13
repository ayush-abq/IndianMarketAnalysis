import { loadFundRows } from "@/services/mf-queries";
import { ok } from "../../_util";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const opts = listOpts(new URL(req.url));
  const rows = (await loadFundRows(opts)).filter(
    (r) => (r.sharpe ?? 0) > 0.6 && (r.maxDrawdown ?? -99) > -35 && (r.consistency ?? 0) > 55,
  );
  return ok({
    title: "Quality at Reasonable Cost",
    disclaimer: "High consistency + Sharpe + controlled drawdown. TER shown when official/licensed data exists — not invented.",
    rows: rows.slice(0, opts.limit),
  });
}
