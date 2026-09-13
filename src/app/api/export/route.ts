import { applyScannerFilters, loadScannerRows } from "@/services/queries";
import { toCsv, toXlsx } from "@/services/export";
import { getDailyReport } from "@/services/report";
import { parseNum } from "../_util";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "csv";
  const rows = applyScannerFilters(await loadScannerRows({ returnType: "PR" }), {
    drawdown: parseNum(url.searchParams.get("drawdown")),
    sort: url.searchParams.get("sort") ?? "drawdown",
  });

  if (format === "json") {
    return Response.json(rows);
  }
  if (format === "xlsx") {
    const buf = await toXlsx(rows);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=scanner.xlsx",
      },
    });
  }
  if (format === "pdf") {
    const report = await getDailyReport();
    return new Response((report as { text?: string } | null)?.text ?? "No report", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=scanner.csv",
    },
  });
}
