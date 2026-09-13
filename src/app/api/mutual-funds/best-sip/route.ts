import { loadFundRows } from "@/services/mf-queries";
import { ok } from "../../_util";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const opts = listOpts(new URL(req.url));
  const rows = (await loadFundRows(opts)).sort((a, b) => (b.sip5y ?? -99) - (a.sip5y ?? -99) || (b.sip10y ?? -99) - (a.sip10y ?? -99));
  return ok({ title: "Best SIP Funds — historical SIP XIRR", disclaimer: "Past SIP XIRR is not a future return. Ranked with consistency and drawdown still visible.", rows: rows.slice(0, opts.limit) });
}
