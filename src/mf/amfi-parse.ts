import { parseNumber } from "@/lib/utils";

export type AmfiSchemeRow = {
  schemeCode: string;
  isin: string | null;
  isinReinvest: string | null;
  schemeName: string;
  nav: number;
  date: string;
  amcName: string | null;
  plan: "DIRECT" | "REGULAR" | "UNKNOWN";
  option: "GROWTH" | "IDCW" | "UNKNOWN";
  assetClass: string;
  category: string;
  schemeType: string;
};

const MONTHS: Record<string, string> = {
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

export function parseAmfiDate(value: string): string | null {
  const v = value.trim();
  const named = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (named) {
    const mm = MONTHS[named[2].toLowerCase()];
    if (mm) return `${named[3]}-${mm}-${named[1].padStart(2, "0")}`;
  }
  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

export function inferPlan(name: string): "DIRECT" | "REGULAR" | "UNKNOWN" {
  const n = name.toUpperCase();
  if (/\bDIRECT\b/.test(n)) return "DIRECT";
  if (/\bREGULAR\b/.test(n)) return "REGULAR";
  return "UNKNOWN";
}

export function inferOption(name: string): "GROWTH" | "IDCW" | "UNKNOWN" {
  const n = name.toUpperCase();
  if (/\bIDCW\b|\bDIVIDEND\b|\bPAYOUT\b|\bREINVEST/.test(n) && !/\bGROWTH\b/.test(n)) return "IDCW";
  if (/\bGROWTH\b/.test(n)) return "GROWTH";
  return "UNKNOWN";
}

export function parseCategoryHeader(header: string): { assetClass: string; category: string; schemeType: string } {
  const h = header.replace(/\s+/g, " ").trim();
  const schemeType = h.toLowerCase().includes("close ended")
    ? "Close Ended"
    : h.toLowerCase().includes("interval")
      ? "Interval"
      : "Open Ended";
  const inner = h.match(/\((.+)\)/)?.[1] ?? h;
  const parts = inner.split(" - ").map((p) => p.replace(/Scheme|Fund/gi, "").trim()).filter(Boolean);
  let assetClass = "Other";
  const raw = inner.toUpperCase();
  if (raw.includes("EQUITY")) assetClass = "Equity";
  else if (raw.includes("DEBT") || raw.includes("INCOME")) assetClass = "Debt";
  else if (raw.includes("HYBRID")) assetClass = "Hybrid";
  else if (raw.includes("SOLUTION") || raw.includes("CHILD") || raw.includes("RETIREMENT")) assetClass = "Solution Oriented";
  else if (raw.includes("INDEX")) assetClass = "Index Fund";
  else if (raw.includes("ETF") || raw.includes("EXCHANGE TRADED")) assetClass = "ETF";
  else if (raw.includes("FUND OF FUND") || raw.includes("FOF")) assetClass = "FoF";
  else if (raw.includes("OTHER") || raw.includes("GOLD") || raw.includes("SILVER")) assetClass = "Other";

  const category = (parts[1] ?? parts[0] ?? "Unclassified")
    .replace(/Open Ended Schemes/i, "")
    .trim() || "Unclassified";

  if (/INDEX/i.test(inner) && assetClass === "Equity") assetClass = "Index Fund";
  return { assetClass, category, schemeType };
}

export function inferAmc(name: string): string | null {
  const cut = name.split(" - ")[0]?.trim();
  if (!cut) return null;
  return cut.replace(/\s+(Direct|Regular|Growth|IDCW).*$/i, "").trim();
}

/**
 * Official AMFI NAVAll / NAV history text.
 * Category headers are preserved so classification stays official.
 */
export function parseAmfiNavText(text: string): AmfiSchemeRow[] {
  if (/<html/i.test(text) && !text.includes("Scheme Code")) return [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const out: AmfiSchemeRow[] = [];
  let meta = { assetClass: "Other", category: "Unclassified", schemeType: "Open Ended" };
  let lastAmc: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Scheme Code/i.test(line)) continue;
    if (!line.includes(";")) {
      if (/schemes|equity|debt|hybrid|index|etf|solution|other/i.test(line) && line.length > 8) {
        meta = parseCategoryHeader(line);
      } else if (line.length > 3 && line.length < 80 && !/\d/.test(line)) {
        lastAmc = line;
      }
      continue;
    }
    const cells = line.split(";").map((c) => c.trim());
    if (cells.length < 6) continue;
    const schemeCode = cells[0];
    if (!/^\d+$/.test(schemeCode)) continue;
    const parsed = parseAmfiDataRow(cells);
    if (!parsed?.schemeName) continue;
    out.push({
      schemeCode,
      isin: parsed.isin,
      isinReinvest: parsed.isinReinvest,
      schemeName: parsed.schemeName,
      nav: parsed.nav,
      date: parsed.date,
      amcName: lastAmc ?? inferAmc(parsed.schemeName),
      plan: inferPlan(`${parsed.planCol} ${parsed.schemeName}`),
      option: inferOption(`${parsed.optionCol} ${parsed.schemeName}`),
      assetClass: meta.assetClass,
      category: meta.category,
      schemeType: meta.schemeType,
    });
  }
  return out;
}

function looksLikeIsin(value: string) {
  return !value || value === "-" || /^INF[A-Z0-9]+/i.test(value);
}

function parseAmfiDataRow(cells: string[]) {
  if (cells.length >= 8 && parseNumber(cells[6]) != null && parseAmfiDate(cells[7] ?? "")) {
    const nav = parseNumber(cells[6])!;
    const date = parseAmfiDate(cells[7])!;
    if (looksLikeIsin(cells[1])) {
      return {
        schemeName: cells[3],
        planCol: cells[4],
        optionCol: cells[5],
        isin: emptyToNull(cells[1]),
        isinReinvest: emptyToNull(cells[2]),
        nav,
        date,
      };
    }
    return {
      schemeName: cells[1],
      planCol: cells[2],
      optionCol: cells[3],
      isin: emptyToNull(cells[4]),
      isinReinvest: emptyToNull(cells[5]),
      nav,
      date,
    };
  }
  if (cells.length >= 6 && parseNumber(cells[4]) != null && parseAmfiDate(cells[5] ?? "")) {
    return {
      schemeName: cells[3],
      planCol: "",
      optionCol: "",
      isin: emptyToNull(cells[1]),
      isinReinvest: emptyToNull(cells[2]),
      nav: parseNumber(cells[4])!,
      date: parseAmfiDate(cells[5])!,
    };
  }
  return null;
}

function emptyToNull(value?: string) {
  const v = value?.trim();
  if (!v || v === "-" || v.toLowerCase() === "null") return null;
  return v;
}
