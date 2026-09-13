import { loadScannerRows } from "@/services/queries";
import { ok } from "../_util";

export async function GET() {
  const rows = await loadScannerRows({ returnType: "PR" });
  return ok(
    rows.map((r) => ({
      name: r.name,
      d1: r.return1d,
      m1: r.return1m,
      m3: r.return3m,
      m6: r.return6m,
      y1: r.return1y,
      y2: r.return2y,
      y5: r.return5y,
      drawdown: r.distanceFromAth,
      recovery: r.recoveryScore,
      opportunity: r.opportunityScore,
      rs: r.rs1yNifty50,
      signal: r.signal,
    })),
  );
}
