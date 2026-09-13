import { loadFundRows } from "@/services/mf-queries";
import { ok } from "../../_util";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const opts = listOpts(new URL(req.url));
  const rows = await loadFundRows({ ...opts, signal: "EARLY_RECOVERY_FUND" });
  return ok({ title: "Recovery Funds", disclaimer: "Early-recovery research label from NSE sector context + fund relative strength. Not a buy signal.", rows: rows.slice(0, opts.limit) });
}
