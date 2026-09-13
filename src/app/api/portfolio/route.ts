import { listPortfolios, upsertPortfolio } from "@/services/research-lists";
import { analyzePortfolio } from "@/services/portfolio-analytics";
import { fail, ok } from "../_util";

export async function GET() {
  return ok({ portfolios: await listPortfolios() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name || !Array.isArray(body.legs)) return fail("name and legs required");
  const legs = (body.legs as Record<string, unknown>[]).map((l) => ({
    assetType: String(l.assetType),
    assetId: Number(l.assetId),
    assetName: String(l.assetName),
    weightPct: Number(l.weightPct),
    sector: typeof l.sector === "string" ? l.sector : null,
  }));
  await upsertPortfolio({
    id: body.id != null ? Number(body.id) : undefined,
    name: String(body.name),
    kind: typeof body.kind === "string" ? body.kind : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    riskLimits: (body.riskLimits as Record<string, number>) ?? undefined,
    legs,
  });
  const analysis = await analyzePortfolio(legs as Parameters<typeof analyzePortfolio>[0]);
  return ok({ portfolios: await listPortfolios(), analysis });
}
