import { loadFundRows, searchFunds } from "@/services/mf-queries";
import { ok } from "../_util";
import { listOpts } from "./_opts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("search")) {
    return ok(await searchFunds(url.searchParams.get("search")!));
  }
  const opts = listOpts(url);
  const rows = await loadFundRows(opts);
  return ok({ asOf: opts.asOf ?? null, defaultScreen: { plan: opts.plan, option: opts.option }, rows: rows.slice(0, opts.limit) });
}
