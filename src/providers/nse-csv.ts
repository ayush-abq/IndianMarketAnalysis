import { parseNumber } from "@/lib/utils";
import type { ProviderBar, ReturnTypeCode } from "./types";

const ALIASES: Record<string, string> = {
  "CNX NIFTY": "NIFTY 50",
  "CNX NIFTY JUNIOR": "NIFTY NEXT 50",
  "CNX 100": "NIFTY 100",
  "CNX 200": "NIFTY 200",
  "CNX 500": "NIFTY 500",
  "CNX AUTO": "NIFTY AUTO",
  "CNX BANK": "NIFTY BANK",
  "CNX FMCG": "NIFTY FMCG",
  "CNX IT": "NIFTY IT",
  "CNX MEDIA": "NIFTY MEDIA",
  "CNX METAL": "NIFTY METAL",
  "CNX PHARMA": "NIFTY PHARMA",
  "CNX PSU BANK": "NIFTY PSU BANK",
  "CNX REALTY": "NIFTY REALTY",
  "CNX FINANCE": "NIFTY FINANCIAL SERVICES",
};

export function normalizeIndexName(name: string): string {
  return name
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/^THE /, "");
}

export function canonicalName(name: string): string {
  const key = normalizeIndexName(name);
  return ALIASES[key] ?? key;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      if (inQuotes && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cur.trim());
      cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur.trim());
      if (row.some((c) => c.length)) rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur.trim());
    if (row.some((c) => c.length)) rows.push(row);
  }
  return rows;
}

function headerIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9%]/g, ""));
  for (const c of candidates) {
    const key = c.toLowerCase().replace(/[^a-z0-9%]/g, "");
    const idx = normalized.findIndex((h) => h === key || h.includes(key));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseDateCell(value: string): string | null {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const named = v.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,})[\s\-](\d{4})$/);
  if (named) {
    const months: Record<string, string> = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const mm = months[named[2].slice(0, 3).toLowerCase()];
    if (mm) return `${named[3]}-${mm}-${named[1].padStart(2, "0")}`;
  }
  return null;
}

export type OfficialCloseRow = {
  nseName: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

/**
 * Parses the official NSE daily publication
 * `ind_close_all_DDMMYYYY.csv` and compatible historical index CSVs
 * exported from NSE / NSE Indices official download pages.
 */
export function parseOfficialIndexCloseCsv(text: string): OfficialCloseRow[] {
  const table = parseCsv(text);
  if (table.length < 2) return [];
  const headers = table[0];
  const nameIdx = headerIndex(headers, ["Index Name", "Index", "Name"]);
  const dateIdx = headerIndex(headers, ["Index Date", "Date", "HistoricalDate"]);
  const openIdx = headerIndex(headers, ["Open Index Value", "Open", "OPEN"]);
  const highIdx = headerIndex(headers, ["High Index Value", "High", "HIGH"]);
  const lowIdx = headerIndex(headers, ["Low Index Value", "Low", "LOW"]);
  const closeIdx = headerIndex(headers, [
    "Closing Index Value",
    "Close",
    "CLOSE",
    "Closing",
  ]);
  const volIdx = headerIndex(headers, ["Volume", "VOL", "Turnover"]);
  const triIdx = headerIndex(headers, ["TotalReturnsIndex", "TRI", "Total Return"]);

  if (closeIdx < 0) return [];

  const out: OfficialCloseRow[] = [];
  for (const cells of table.slice(1)) {
    const close = parseNumber(cells[closeIdx] ?? cells[triIdx]);
    if (close == null) continue;
    const date = parseDateCell(cells[dateIdx] ?? "");
    if (!date) continue;
    const nseName = canonicalName(cells[nameIdx] ?? "");
    if (!nseName) continue;
    out.push({
      nseName,
      date,
      open: parseNumber(cells[openIdx]),
      high: parseNumber(cells[highIdx]),
      low: parseNumber(cells[lowIdx]),
      close,
      volume: parseNumber(cells[volIdx]),
    });
  }
  return out;
}

export function rowsToBars(
  rows: OfficialCloseRow[],
  nseName: string,
  returnType: ReturnTypeCode,
): ProviderBar[] {
  const key = canonicalName(nseName);
  const matched = rows.filter((r) => r.nseName === key);
  const byDate = new Map<string, ProviderBar>();
  for (const r of matched) {
    byDate.set(r.date, {
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      returnType,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function eodFileName(date: string): string {
  const [y, m, d] = date.split("-");
  return `ind_close_all_${d}${m}${y}.csv`;
}
