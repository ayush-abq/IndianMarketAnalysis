import { answerFromAppData, runNaturalLanguageScreen } from "@/services/nl-screener";
import { fail, ok } from "../_util";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q");
  if (!q) return fail("q required");
  return ok(await runNaturalLanguageScreen(q));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { q?: string } | null;
  if (!body?.q) return fail("q required");
  return ok(await answerFromAppData(body.q));
}
