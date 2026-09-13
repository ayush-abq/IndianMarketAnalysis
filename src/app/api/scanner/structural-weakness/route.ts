import { loadScannerRows } from "@/services/queries";
import { ok } from "../../_util";

export async function GET() {
  const rows = await loadScannerRows({ returnType: "PR" });
  return ok(rows.filter((r) => r.signal === "STRUCTURAL_WEAKNESS"));
}
