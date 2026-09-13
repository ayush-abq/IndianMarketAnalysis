import { inflateRawSync } from "node:zlib";
import { env } from "@/lib/env";
import { parseNumber } from "@/lib/utils";
import { parseCsv } from "./nse-csv";
import { RateLimiter, withBackoff } from "./rate-limit";

export type BhavRow = {
  symbol: string;
  series: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  deliveryVolume: number | null;
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NSESectorScanner/1.0";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

let limiter: RateLimiter | null = null;
function rateLimiter() {
  if (!limiter) limiter = new RateLimiter(env().PROVIDER_MIN_INTERVAL_MS);
  return limiter;
}

export function bhavFileName(date: string) {
  const [y, m, d] = date.split("-");
  return `sec_bhavdata_full_${d}${m}${y}.csv`;
}

/** Official cash-market bhavcopy zip: YYYY/MMM/cmDDMMMYYYYbhav.csv.zip */
export function historicalBhavZipPath(date: string) {
  const [y, m, d] = date.split("-");
  const mon = MONTHS[Number(m) - 1];
  return `${y}/${mon}/cm${d}${mon}${y}bhav.csv.zip`;
}

/**
 * Official NSE security-wise bhavcopy.
 * Unadjusted close. adjusted_close is set equal to close unless a corporate-action factor exists.
 */
export function parseOfficialBhavcopy(text: string): BhavRow[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toUpperCase().replace(/\s+/g, "_"));
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iSym = idx(["SYMBOL", "TCKR"]);
  const iSeries = idx(["SERIES"]);
  const iDate = idx(["DATE1", "DATE", "TIMESTAMP"]);
  const iOpen = idx(["OPEN_PRICE", "OPEN"]);
  const iHigh = idx(["HIGH_PRICE", "HIGH"]);
  const iLow = idx(["LOW_PRICE", "LOW"]);
  const iClose = idx(["CLOSE_PRICE", "CLOSE"]);
  const iVol = idx(["TTL_TRD_QTY", "TOTTRDQTY", "VOLUME"]);
  const iDel = idx(["DELIV_QTY", "DELIVERY_QTY"]);
  if (iSym < 0 || iClose < 0) return [];
  const out: BhavRow[] = [];
  for (const row of rows.slice(1)) {
    const symbol = row[iSym]?.trim().toUpperCase();
    const series = (row[iSeries] ?? "EQ").trim().toUpperCase();
    const close = parseNumber(row[iClose]);
    if (!symbol || close == null) continue;
    if (series && series !== "EQ" && series !== "BE") continue;
    out.push({
      symbol,
      series: series || "EQ",
      date: normalizeBhavDate(row[iDate] ?? ""),
      open: parseNumber(row[iOpen]),
      high: parseNumber(row[iHigh]),
      low: parseNumber(row[iLow]),
      close,
      volume: parseNumber(row[iVol]),
      deliveryVolume: parseNumber(row[iDel]),
    });
  }
  return out;
}

function normalizeBhavDate(raw: string): string {
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{2})[-/]([A-Za-z]{3}|[0-9]{2})[-/](\d{4})$/);
  if (dmy) {
    const months: Record<string, string> = {
      JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
      JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
    };
    const mon = months[dmy[2].toUpperCase()] ?? dmy[2];
    return `${dmy[3]}-${mon}-${dmy[1]}`;
  }
  return s.slice(0, 10);
}

const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;
const ZIP_DATA_DESC = 0x08074b50;

function looksLikeBhavName(name: string) {
  return /\.csv$/i.test(name) || /bhav/i.test(name);
}

function inflateMember(method: number, compressed: Buffer, name: string): string {
  if (method === 0) return compressed.toString("utf8");
  if (method === 8) return inflateRawSync(compressed).toString("utf8");
  throw new Error(`Unsupported zip method ${method} for ${name}`);
}

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 22 - 65_535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) !== ZIP_EOCD) continue;
    const commentLen = buf.readUInt16LE(i + 20);
    if (i + 22 + commentLen === buf.length) return i;
  }
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === ZIP_EOCD) return i;
  }
  return -1;
}

/** Real sizes live in the central directory — required for streaming zips (bit 3). */
function extractViaCentralDirectory(buf: Buffer, match: (name: string) => boolean): string | null {
  const eocd = findEocd(buf);
  if (eocd < 0) return null;
  let cd = buf.readUInt32LE(eocd + 16);
  while (cd + 46 <= buf.length && buf.readUInt32LE(cd) === ZIP_CENTRAL) {
    const method = buf.readUInt16LE(cd + 10);
    const compSize = buf.readUInt32LE(cd + 20);
    const nameLen = buf.readUInt16LE(cd + 28);
    const extraLen = buf.readUInt16LE(cd + 30);
    const commentLen = buf.readUInt16LE(cd + 32);
    const localOff = buf.readUInt32LE(cd + 42);
    const name = buf.subarray(cd + 46, cd + 46 + nameLen).toString("utf8");
    if (match(name) && compSize > 0 && localOff + 30 <= buf.length && buf.readUInt32LE(localOff) === ZIP_LOCAL) {
      const locNameLen = buf.readUInt16LE(localOff + 26);
      const locExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + locNameLen + locExtraLen;
      return inflateMember(method, buf.subarray(dataStart, dataStart + compSize), name);
    }
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** When the local header has no sizes, the descriptor after the payload holds them. */
function compressedSizeFromDescriptor(buf: Buffer, dataStart: number): number {
  for (let i = dataStart; i + 16 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== ZIP_DATA_DESC) continue;
    const compSize = buf.readUInt32LE(i + 8);
    if (compSize > 0 && dataStart + compSize === i) return compSize;
  }
  for (let i = dataStart + 12; i + 4 <= buf.length; i++) {
    const sig = buf.readUInt32LE(i);
    if (sig !== ZIP_LOCAL && sig !== ZIP_CENTRAL) continue;
    if (i >= dataStart + 16 && buf.readUInt32LE(i - 16) === ZIP_DATA_DESC) {
      const compSize = buf.readUInt32LE(i - 8);
      if (dataStart + compSize === i - 16) return compSize;
    }
    const compSize = buf.readUInt32LE(i - 8);
    if (compSize > 0 && dataStart + compSize === i - 12) return compSize;
  }
  throw new Error("Could not locate zip data descriptor");
}

/** Named member from an official NSE zip. Store or deflate only. */
export function extractZipMember(buf: Buffer, match: (name: string) => boolean): string {
  const fromCd = extractViaCentralDirectory(buf, match);
  if (fromCd != null) return fromCd;

  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== ZIP_LOCAL) {
      offset += 1;
      continue;
    }
    const flags = buf.readUInt16LE(offset + 6);
    const method = buf.readUInt16LE(offset + 8);
    let compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    if (dataStart > buf.length) break;
    if (!match(name)) {
      offset = dataStart + (compSize || 1);
      continue;
    }
    if ((flags & 0x8) !== 0 || compSize === 0) {
      compSize = compressedSizeFromDescriptor(buf, dataStart);
    }
    return inflateMember(method, buf.subarray(dataStart, dataStart + compSize), name);
  }
  throw new Error("No matching member in official NSE zip");
}

/** First CSV (or bhav) member from an official NSE zip. */
export function extractFirstCsvFromZip(buf: Buffer): string {
  return extractZipMember(buf, looksLikeBhavName);
}

async function fetchOfficialFile(url: string, zip: boolean): Promise<{ ok: boolean; status: number; rows: BhavRow[] }> {
  await rateLimiter().wait();
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: zip ? "application/zip,*/*" : "text/csv,text/plain,*/*",
      Referer: "https://www.nseindia.com/",
    },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return { ok: false, status: res.status, rows: [] };
  let text: string;
  if (zip) {
    const buf = Buffer.from(await res.arrayBuffer());
    text = extractFirstCsvFromZip(buf);
  } else {
    text = await res.text();
  }
  const rows = parseOfficialBhavcopy(text);
  if (!rows.length) return { ok: false, status: 404, rows: [] };
  return { ok: true, status: res.status, rows };
}

/** Newer `sec_bhavdata_full_*.csv` files exist from 2020. Older sessions are zip-only. */
const FULL_BHAV_FROM = "2020-01-01";

/**
 * Official full bhavcopy for a session, then official historical cash zip if the
 * newer file is missing (older years). Dates before 2020 skip the full-file 404.
 */
export async function fetchOfficialBhavcopy(date: string): Promise<{ ok: boolean; status: number; rows: BhavRow[]; source?: string }> {
  const histUrl = `${env().NSE_BHAV_HISTORICAL_BASE_URL.replace(/\/$/, "")}/${historicalBhavZipPath(date)}`;
  if (date >= FULL_BHAV_FROM) {
    const fullUrl = `${env().NSE_BHAV_BASE_URL.replace(/\/$/, "")}/${bhavFileName(date)}`;
    const full = await withBackoff(() => fetchOfficialFile(fullUrl, false), {
      retries: 1,
      label: `bhav:${date}`,
    });
    if (full.ok) return { ...full, source: "sec_bhavdata_full" };
    if (full.status !== 404) return full;
  }
  const hist = await withBackoff(() => fetchOfficialFile(histUrl, true), {
    retries: 2,
    label: `bhav-hist:${date}`,
  });
  if (hist.ok) return { ...hist, source: "cm_bhav_zip" };
  return { ok: false, status: hist.status, rows: [] };
}
