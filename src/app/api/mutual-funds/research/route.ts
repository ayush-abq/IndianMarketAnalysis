import { researchShortlist } from "@/services/mf-research";
import { ok } from "../../_util";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    amount?: number;
    monthlySip?: number;
    horizon?: string;
    riskTolerance?: string;
    categories?: string[];
    plan?: string;
    option?: string;
  };
  return ok(await researchShortlist(body));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return ok(
    await researchShortlist({
      monthlySip: Number(url.searchParams.get("sip") ?? 25000),
      horizon: url.searchParams.get("horizon") ?? "10+",
      riskTolerance: url.searchParams.get("risk") ?? "Aggressive",
      categories: url.searchParams.get("categories")?.split(",").filter(Boolean),
    }),
  );
}
