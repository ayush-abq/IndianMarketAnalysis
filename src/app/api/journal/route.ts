import { addJournal, listJournal } from "@/services/research-lists";
import { fail, ok } from "../_util";

export async function GET() {
  return ok({ entries: await listJournal() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.date) return fail("date required");
  return ok(
    await addJournal({
      date: String(body.date),
      assetType: typeof body.assetType === "string" ? body.assetType : undefined,
      assetId: body.assetId != null ? Number(body.assetId) : undefined,
      assetName: typeof body.assetName === "string" ? body.assetName : undefined,
      thesis: typeof body.thesis === "string" ? body.thesis : undefined,
      evidence: typeof body.evidence === "string" ? body.evidence : undefined,
      decision: typeof body.decision === "string" ? body.decision : undefined,
      outcome: typeof body.outcome === "string" ? body.outcome : undefined,
    }),
  );
}
