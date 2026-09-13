import { refreshThesisChecks } from "@/services/research-lists";
import { ok } from "../_util";

export async function POST() {
  return ok(await refreshThesisChecks());
}
