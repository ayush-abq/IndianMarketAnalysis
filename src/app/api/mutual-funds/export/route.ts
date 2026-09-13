import { loadFundRows } from "@/services/mf-queries";
import { mfToCsv, mfToXlsx } from "@/services/mf-export";
import { listOpts } from "../_opts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const opts = listOpts(url);
  const rows = (await loadFundRows(opts)).slice(0, 500);
  const format = url.searchParams.get("format") ?? "csv";
  if (format === "json") return Response.json(rows);
  if (format === "xlsx") {
    const buf = await mfToXlsx(rows);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=mutual-funds.xlsx",
      },
    });
  }
  return new Response(mfToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=mutual-funds.csv",
    },
  });
}
