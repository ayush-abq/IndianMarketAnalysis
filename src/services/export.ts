import type { ScannerRow } from "@/lib/types";

export function toCsv(rows: ScannerRow[]): string {
  const headers = [
    "Rank",
    "Sector",
    "Current",
    "ATH",
    "ATH Date",
    "Below ATH %",
    "1Y",
    "2Y",
    "5Y",
    "3M",
    "6M",
    "50DMA",
    "200DMA",
    "RS vs Nifty50 1Y",
    "Recovery",
    "Opportunity",
    "Classification",
    "Signal",
    "Why",
    "Return Type",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.rank,
        csv(r.name),
        r.current,
        r.ath,
        r.athDate,
        r.distanceFromAth,
        r.return1y ?? "",
        r.return2y ?? "",
        r.return5y ?? "",
        r.return3m ?? "",
        r.return6m ?? "",
        r.ma50 ?? "",
        r.ma200 ?? "",
        r.rs1yNifty50 ?? "",
        r.recoveryScore,
        r.opportunityScore,
        r.classification,
        r.signal,
        csv(r.whyShort ?? ""),
        r.returnType,
      ].join(","),
    );
  }
  return lines.join("\n");
}

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function toXlsx(rows: ScannerRow[]): Promise<Buffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Scanner");
  ws.addRow([
    "Rank",
    "Sector",
    "Current",
    "ATH",
    "ATH Date",
    "Below ATH %",
    "1Y",
    "2Y",
    "5Y",
    "Recovery",
    "Opportunity",
    "Signal",
    "Why",
  ]);
  for (const r of rows) {
    ws.addRow([
      r.rank,
      r.name,
      r.current,
      r.ath,
      r.athDate,
      r.distanceFromAth,
      r.return1y,
      r.return2y,
      r.return5y,
      r.recoveryScore,
      r.opportunityScore,
      r.signal,
      r.whyShort,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
