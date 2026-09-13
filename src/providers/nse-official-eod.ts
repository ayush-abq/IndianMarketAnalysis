import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { INDEX_UNIVERSE } from "@/config/universe";
import { RateLimiter, withBackoff } from "./rate-limit";
import {
  eodFileName,
  normalizeIndexName,
  parseOfficialIndexCloseCsv,
  rowsToBars,
  type OfficialCloseRow,
} from "./nse-csv";
import type {
  HistoryRequest,
  MarketDataProvider,
  ProviderBar,
  ProviderConstituent,
  ProviderIndex,
  ProviderMetadata,
} from "./types";
import { ProviderError } from "./types";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NSESectorScanner/1.0";

/**
 * Official NSE published end-of-day index close files.
 * These are the same CSVs NSE posts as public reports — not website XHR scraping.
 *
 * Pipeline: official file → parse → caller persists to local DB.
 */
export class NseOfficialEodProvider implements MarketDataProvider {
  readonly id = "NSE_OFFICIAL_EOD";
  readonly kind = "official" as const;
  readonly description =
    "Official NSE daily index-close files (ind_close_all_DDMMYYYY.csv)";

  private readonly limiter: RateLimiter;
  private readonly cache = new Map<string, OfficialCloseRow[]>();

  constructor() {
    this.limiter = new RateLimiter(env().PROVIDER_MIN_INTERVAL_MS);
  }

  async getIndexList(): Promise<ProviderIndex[]> {
    return INDEX_UNIVERSE.map((i) => ({
      name: i.name,
      symbol: i.symbol,
      nseName: i.nseName,
      category: i.category,
      subCategory: i.subCategory,
      yahooSymbol: i.yahooSymbol,
      inceptionDate: i.inceptionDate,
      description: i.description,
      hasTotalReturn: false,
    }));
  }

  async getHistoricalIndexData(req: HistoryRequest): Promise<ProviderBar[]> {
    if (req.returnType === "TR") {
      logger.warn({ index: req.nseName }, "Official EOD files are price-return only; TRI requires a licensed feed or official TRI CSV import");
      return [];
    }
    const dates = enumerateDates(req.from, req.to);
    const all: OfficialCloseRow[] = [];
    for (const date of dates) {
      const rows = await this.loadDay(date);
      all.push(...rows);
    }
    return rowsToBars(all, req.nseName, "PR");
  }

  async getLatestIndexData(req: Omit<HistoryRequest, "from">): Promise<ProviderBar | null> {
    const rows = await this.loadDay(req.to);
    const bars = rowsToBars(rows, req.nseName, req.returnType);
    return bars.at(-1) ?? null;
  }

  async getIndexMetadata(nseName: string): Promise<ProviderMetadata | null> {
    const seed = INDEX_UNIVERSE.find((i) => normalizeIndexName(i.nseName) === normalizeIndexName(nseName));
    if (!seed) return { name: nseName, nseName };
    return {
      name: seed.name,
      nseName: seed.nseName,
      inceptionDate: seed.inceptionDate,
      description: seed.description,
    };
  }

  async getIndexConstituents(): Promise<ProviderConstituent[]> {
    return [];
  }

  async getTotalReturnData(): Promise<ProviderBar[]> {
    return [];
  }

  async healthcheck() {
    try {
      const probe = await this.fetchFile(eodFileName(recentWeekday()));
      return {
        ok: probe.ok || probe.status === 404,
        message: probe.ok
          ? "Official NSE EOD archive reachable"
          : `Archive responded HTTP ${probe.status} (404 is normal on holidays)`,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Official EOD unreachable" };
    }
  }

  /**
   * Discover every index name present in an official daily file so the
   * universe can grow without a code change.
   */
  async discoverNames(date: string): Promise<string[]> {
    const rows = await this.getDayRows(date);
    return [...new Set(rows.map((r) => r.nseName))];
  }

  async getDayRows(date: string): Promise<OfficialCloseRow[]> {
    return this.loadDay(date);
  }

  private async loadDay(date: string): Promise<OfficialCloseRow[]> {
    if (this.cache.has(date)) return this.cache.get(date)!;
    const file = eodFileName(date);
    const res = await withBackoff(() => this.fetchFile(file), {
      retries: env().PROVIDER_MAX_RETRIES,
      label: `eod:${file}`,
    });
    if (res.status === 404) {
      this.cache.set(date, []);
      return [];
    }
    if (!res.ok) {
      throw new ProviderError(`Official EOD ${file} HTTP ${res.status}`, this.id, res.status >= 500);
    }
    const rows = parseOfficialIndexCloseCsv(res.text);
    this.cache.set(date, rows);
    logger.info({ date, rows: rows.length, file }, "Downloaded official NSE EOD index file");
    return rows;
  }

  private async fetchFile(file: string): Promise<{ ok: boolean; status: number; text: string }> {
    await this.limiter.wait();
    const url = `${env().NSE_OFFICIAL_EOD_BASE_URL.replace(/\/$/, "")}/${file}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/csv,text/plain,*/*",
        Referer: "https://www.nseindia.com/",
      },
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }
}

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function recentWeekday(): string {
  const d = new Date();
  const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  while (ist.getDay() === 0 || ist.getDay() === 6) ist.setDate(ist.getDate() - 1);
  return ist.toISOString().slice(0, 10);
}
