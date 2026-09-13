import { loadFundRows, type MfRow } from "@/services/mf-queries";
import { ok } from "../../_util";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const opts = listOpts(new URL(req.url));
  const all = await loadFundRows(opts);
  const take = (pred: (r: MfRow) => boolean) => all.filter(pred).slice(0, 8);
  return ok({
    title: "Core Portfolio research buckets",
    disclaimer: "Buckets are research starting points, not an allocation recommendation.",
    buckets: {
      coreEquity: take((r) => /large cap|flexi|index/i.test(`${r.category} ${r.assetClass}`) && r.assetClass !== "Debt"),
      satelliteEquity: take((r) => /mid cap|small cap|sectoral|thematic|value|contra/i.test(r.category)),
      debt: take((r) => r.assetClass === "Debt"),
      hybrid: take((r) => r.assetClass === "Hybrid"),
      international: take((r) => /international|overseas|global|us|nasdaq/i.test(`${r.category} ${r.schemeName}`)),
      gold: take((r) => /gold|silver|commodity/i.test(`${r.category} ${r.schemeName}`)),
    },
  });
}
