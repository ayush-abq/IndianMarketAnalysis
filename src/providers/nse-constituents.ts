import { env } from "@/lib/env";
import { parseCsv } from "./nse-csv";

export type ConstituentRow = {
  symbol: string;
  companyName: string | null;
  industry: string | null;
  series: string;
  isin: string | null;
  index: string;
};

export const OFFICIAL_INDEX_LISTS: { index: string; file: string; cap: string }[] = [
  { index: "NIFTY50", file: "ind_nifty50list.csv", cap: "LARGE" },
  { index: "NIFTY100", file: "ind_nifty100list.csv", cap: "LARGE" },
  { index: "NIFTY200", file: "ind_nifty200list.csv", cap: "LARGE" },
  { index: "NIFTY500", file: "ind_nifty500list.csv", cap: "LARGE" },
  { index: "NIFTY_MIDCAP_150", file: "ind_niftymidcap150list.csv", cap: "MID" },
  { index: "NIFTY_SMALLCAP_250", file: "ind_niftysmallcap250list.csv", cap: "SMALL" },
];

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NSESectorScanner/1.0";

export function parseOfficialConstituentCsv(text: string, index: string): ConstituentRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toUpperCase().replace(/\s+/g, "_"));
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iName = idx(["COMPANY_NAME", "COMPANY", "NAME"]);
  const iInd = idx(["INDUSTRY"]);
  const iSym = idx(["SYMBOL"]);
  const iSeries = idx(["SERIES"]);
  const iIsin = idx(["ISIN_CODE", "ISIN"]);
  if (iSym < 0) return [];
  const out: ConstituentRow[] = [];
  for (const row of rows.slice(1)) {
    const symbol = row[iSym]?.trim().toUpperCase();
    if (!symbol) continue;
    out.push({
      symbol,
      companyName: row[iName]?.trim() || null,
      industry: row[iInd]?.trim() || null,
      series: (row[iSeries] ?? "EQ").trim().toUpperCase() || "EQ",
      isin: row[iIsin]?.trim() || null,
      index,
    });
  }
  return out;
}

export async function fetchOfficialConstituents(): Promise<{
  rows: ConstituentRow[];
  failed: string[];
}> {
  const base = env().NSE_CONSTITUENT_BASE_URL.replace(/\/$/, "");
  const rows: ConstituentRow[] = [];
  const failed: string[] = [];
  for (const spec of OFFICIAL_INDEX_LISTS) {
    try {
      const res = await fetch(`${base}/${spec.file}`, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/csv,text/plain,*/*",
          Referer: "https://www.nseindia.com/",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        failed.push(`${spec.index}:${res.status}`);
        continue;
      }
      rows.push(...parseOfficialConstituentCsv(await res.text(), spec.index));
    } catch {
      failed.push(`${spec.index}:network`);
    }
  }
  return { rows, failed };
}
