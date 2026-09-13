import { listWatchlist, removeWatchlist, upsertWatchlist } from "@/services/research-lists";
import { fail, ok } from "../_util";

export async function GET(req: Request) {
  const list = new URL(req.url).searchParams.get("list") ?? "WATCHLIST";
  return ok({ items: await listWatchlist(list) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.assetType || !body?.assetId || !body?.assetName) return fail("assetType, assetId, assetName required");
  const row = await upsertWatchlist({
    listName: typeof body.listName === "string" ? body.listName : undefined,
    assetType: String(body.assetType),
    assetId: Number(body.assetId),
    assetName: String(body.assetName),
    thesis: typeof body.thesis === "string" ? body.thesis : undefined,
    entryPrice: body.entryPrice != null ? Number(body.entryPrice) : undefined,
    invalidation: typeof body.invalidation === "string" ? body.invalidation : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
  });
  return ok(row);
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return fail("id required");
  await removeWatchlist(id);
  return ok({ ok: true });
}
