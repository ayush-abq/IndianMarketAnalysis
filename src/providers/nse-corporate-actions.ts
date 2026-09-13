/**
 * Official NSE daily PR zip — book-closure / corporate-action CSV (Bc*.csv).
 * Same nsearchives family as bhavcopy. Not a live quote API.
 */
import { env } from "@/lib/env";
import { parseCsv } from "./nse-csv";
import { extractZipMember } from "./nse-bhavcopy";
import { RateLimiter, withBackoff } from "./rate-limit";

export type CaActionType = "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS";

export type ParsedCorporateAction = {
  symbol: string;
  series: string;
  date: string;
  actionType: CaActionType;
  ratio: string | null;
  factor: number | null;
  purpose: string;
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NSESectorScanner/1.0";

const CASH_SERIES = new Set(["EQ", "BE"]);

let limiter: RateLimiter | null = null;
function rateLimiter() {
  if (!limiter) limiter = new RateLimiter(env().PROVIDER_MIN_INTERVAL_MS);
  return limiter;
}

/** PR110926.zip for 2026-09-11 */
export function officialPrZipName(date: string) {
  const [y, m, d] = date.split("-");
  return `PR${d}${m}${y.slice(2)}.zip`;
}

export function parseExDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmyNum = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyNum) {
    return `${dmyNum[3]}-${dmyNum[2].padStart(2, "0")}-${dmyNum[1].padStart(2, "0")}`;
  }
  const dmyMon = s.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{4})$/);
  if (dmyMon) {
    const months: Record<string, string> = {
      JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
      JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
    };
    const mon = months[dmyMon[2].toUpperCase()];
    if (!mon) return null;
    return `${dmyMon[3]}-${mon}-${dmyMon[1].padStart(2, "0")}`;
  }
  return null;
}

export function parsePurpose(purpose: string): { actionType: CaActionType; ratio: string | null; factor: number | null }[] {
  const u = purpose.toUpperCase().replace(/\s+/g, " ").trim();
  if (!u) return [];
  if (/\bINT(?:EREST)?\b/.test(u) && !/\bDIV/.test(u)) return [];
  if (/REDMPT/.test(u) && !/\bDIV/.test(u) && !/BONUS|SPLIT|RIGHTS/.test(u)) return [];

  const out: { actionType: CaActionType; ratio: string | null; factor: number | null }[] = [];

  const bonus = u.match(/BONUS\s+(\d+)\s*:\s*(\d+)/);
  if (bonus) {
    const added = Number(bonus[1]);
    const held = Number(bonus[2]);
    if (added > 0 && held > 0) {
      out.push({ actionType: "BONUS", ratio: `${added}:${held}`, factor: held / (added + held) });
    }
  }

  const fv = u.match(
    /FV\s*SPL(?:IT|T)?\s*(?:FRM|FROM)?\s*(?:RS\.?\s*)?(\d+(?:\.\d+)?)\s*(?:TO|-)\s*(?:RS\.?\s*)?(\d+(?:\.\d+)?)/,
  );
  if (fv) {
    const from = Number(fv[1]);
    const to = Number(fv[2]);
    if (from > 0 && to > 0 && from !== to) {
      out.push({ actionType: "SPLIT", ratio: `${from}→${to}`, factor: to / from });
    }
  } else {
    const split = u.match(/\bSPLIT\s+(\d+)\s*:\s*(\d+)/);
    if (split) {
      const from = Number(split[1]);
      const to = Number(split[2]);
      if (from > 0 && to > 0) {
        out.push({ actionType: "SPLIT", ratio: `${from}:${to}`, factor: from / to });
      }
    }
  }

  if (/\bRIGHTS\b/.test(u)) {
    const rights = u.match(/RIGHTS\s+(\d+)\s*:\s*(\d+)/);
    out.push({
      actionType: "RIGHTS",
      ratio: rights ? `${rights[1]}:${rights[2]}` : null,
      factor: null,
    });
  }

  if (/\bDIV/.test(u)) {
    const amt = u.match(/\b(?:RS|RE)\s*([0-9]+(?:\.[0-9]+)?)/);
    out.push({
      actionType: "DIVIDEND",
      ratio: amt ? `RS ${amt[1]}`.slice(0, 32) : null,
      factor: null,
    });
  }

  return out;
}

export function parseOfficialBookClosureCsv(text: string): ParsedCorporateAction[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toUpperCase().replace(/\s+/g, "_"));
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iSym = idx(["SYMBOL"]);
  const iSeries = idx(["SERIES"]);
  const iEx = idx(["EX_DT", "EXDATE", "EX_DATE"]);
  const iPurpose = idx(["PURPOSE"]);
  if (iSym < 0 || iEx < 0 || iPurpose < 0) return [];

  const out: ParsedCorporateAction[] = [];
  for (const row of rows.slice(1)) {
    const symbol = row[iSym]?.trim().toUpperCase();
    const series = (row[iSeries] ?? "EQ").trim().toUpperCase();
    if (!symbol || !CASH_SERIES.has(series || "EQ")) continue;
    const date = parseExDate(row[iEx] ?? "");
    if (!date) continue;
    const purpose = (row[iPurpose] ?? "").trim();
    for (const parsed of parsePurpose(purpose)) {
      out.push({
        symbol,
        series: series || "EQ",
        date,
        actionType: parsed.actionType,
        ratio: parsed.ratio,
        factor: parsed.factor,
        purpose,
      });
    }
  }
  return out;
}

export function looksLikeBookClosureName(name: string) {
  return /(^|[\\/])bc[^\\/]*\.csv$/i.test(name);
}

export async function fetchOfficialBookClosures(date: string): Promise<{
  ok: boolean;
  status: number;
  rows: ParsedCorporateAction[];
  source?: string;
}> {
  const url = `${env().NSE_PR_BASE_URL.replace(/\/$/, "")}/${officialPrZipName(date)}`;
  await rateLimiter().wait();
  const res = await withBackoff(
    async () =>
      fetch(url, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "application/zip,*/*",
          Referer: "https://www.nseindia.com/",
        },
        signal: AbortSignal.timeout(45_000),
      }),
    { retries: 2, label: `pr:${date}` },
  );
  if (!res.ok) return { ok: false, status: res.status, rows: [] };
  const buf = Buffer.from(await res.arrayBuffer());
  const text = extractZipMember(buf, looksLikeBookClosureName);
  const rows = parseOfficialBookClosureCsv(text);
  return { ok: true, status: res.status, rows, source: "NSE_PR_BC" };
}

/** Product of split/bonus factors with an ex-date strictly after the bar. */
export function adjustmentFactorAfter(
  actions: { date: string; factor: number | null }[],
  barDate: string,
): number {
  let product = 1;
  for (const action of actions) {
    if (action.factor == null || action.factor <= 0) continue;
    if (action.date > barDate) product *= action.factor;
  }
  return product;
}
