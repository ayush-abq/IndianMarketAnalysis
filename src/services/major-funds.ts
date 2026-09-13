import { MAJOR_FUND_SLEEVES, type MajorFundSleeve } from "@/config/major-funds";
import type { MfRow } from "@/services/mf-queries";

function byResearch(a: MfRow, b: MfRow) {
  const ter = (a.expenseRatio ?? 99) - (b.expenseRatio ?? 99);
  if (Math.abs(ter) > 0.02) return ter;
  return (b.overallScore ?? -1) - (a.overallScore ?? -1);
}

export function pickFundForSleeve(funds: MfRow[], sleeve: MajorFundSleeve): MfRow | null {
  const hits = funds.filter((f) => sleeve.test(f.schemeName));
  if (!hits.length) return null;
  for (const prefer of sleeve.prefer ?? []) {
    const preferred = hits.filter((f) => prefer.test(f.schemeName)).sort(byResearch)[0];
    if (preferred) return preferred;
  }
  return [...hits].sort((a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1))[0] ?? null;
}

export function pickMajorFunds(funds: MfRow[]): { sleeve: string; fund: MfRow }[] {
  const used = new Set<number>();
  const out: { sleeve: string; fund: MfRow }[] = [];
  for (const sleeve of MAJOR_FUND_SLEEVES) {
    const fund = pickFundForSleeve(funds, sleeve);
    if (!fund || used.has(fund.id)) continue;
    used.add(fund.id);
    out.push({ sleeve: sleeve.label, fund });
  }
  return out;
}
