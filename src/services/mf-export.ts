import type { MfRow } from "@/services/mf-queries";

export function mfToCsv(rows: MfRow[]): string {
  const headers = [
    "Fund",
    "AMC",
    "Category",
    "Plan",
    "Option",
    "NAV",
    "NAV date",
    "1Y",
    "3Y CAGR",
    "5Y CAGR",
    "10Y CAGR",
    "Sharpe",
    "Sortino",
    "Max drawdown",
    "Expense",
    "AUM",
    "5Y SIP XIRR",
    "Consistency",
    "Research score",
    "Classification",
    "Signal",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csv(r.schemeName),
        csv(r.amcName ?? ""),
        csv(r.category),
        r.plan,
        r.option,
        r.nav ?? "",
        r.navDate ?? "",
        r.return1y ?? "",
        r.cagr3y ?? "",
        r.cagr5y ?? "",
        r.cagr10y ?? "",
        r.sharpe ?? "",
        r.sortino ?? "",
        r.maxDrawdown ?? "",
        r.expenseRatio ?? "",
        r.aum ?? "",
        r.sip5y ?? "",
        r.consistency ?? "",
        r.overallScore ?? "",
        r.classification ?? "",
        r.signal ?? "",
      ].join(","),
    );
  }
  return lines.join("\n");
}

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function mfToXlsx(rows: MfRow[]): Promise<Buffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("MutualFunds");
  ws.addRow([
    "Fund",
    "Category",
    "Plan",
    "1Y",
    "3Y CAGR",
    "5Y CAGR",
    "Sharpe",
    "Max DD",
    "Score",
    "Signal",
  ]);
  for (const r of rows) {
    ws.addRow([
      r.schemeName,
      r.category,
      r.plan,
      r.return1y,
      r.cagr3y,
      r.cagr5y,
      r.sharpe,
      r.maxDrawdown,
      r.overallScore,
      r.signal,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
