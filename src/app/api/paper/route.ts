import { addPaper, closePaper, listPaper } from "@/services/research-lists";
import { fail, ok } from "../_util";

export async function GET() {
  return ok({ positions: await listPaper() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("JSON body required");
  if (body.closeId) {
    await closePaper(Number(body.closeId), String(body.exitDate), Number(body.exitPrice));
    return ok({ closed: true });
  }
  if (!body.assetType || !body.assetId || !body.assetName || !body.entryDate || body.entryPrice == null) {
    return fail("assetType, assetId, assetName, entryDate, entryPrice required");
  }
  return ok(
    await addPaper({
      assetType: String(body.assetType),
      assetId: Number(body.assetId),
      assetName: String(body.assetName),
      quantity: Number(body.quantity ?? 1),
      entryDate: String(body.entryDate),
      entryPrice: Number(body.entryPrice),
      reason: typeof body.reason === "string" ? body.reason : undefined,
      scoreAtEntry: body.scoreAtEntry != null ? Number(body.scoreAtEntry) : undefined,
    }),
  );
}
