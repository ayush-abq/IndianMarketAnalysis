import { fail, ok } from "../../_util";
import { trainLocalModels } from "@/services/local-ai-layer";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { index?: string; limit?: number; every?: number };
  try {
    const result = await trainLocalModels({
      index: body.index,
      limit: body.limit,
      every: body.every,
    });
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Training failed");
  }
}
