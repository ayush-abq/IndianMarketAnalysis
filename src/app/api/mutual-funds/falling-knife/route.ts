import { loadFundRows } from "@/services/mf-queries";
import { ok } from "../../_util";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const opts = listOpts(new URL(req.url));
  const rows = await loadFundRows({ ...opts, signal: "FALLING_KNIFE" });
  return ok({ title: "Falling Knife Funds", disclaimer: "NAV decline alone is not a reason to buy. These funds sit in deteriorating sector context.", rows: rows.slice(0, opts.limit) });
}
