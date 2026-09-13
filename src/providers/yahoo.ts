import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { INDEX_UNIVERSE } from "@/config/universe";
import { RateLimiter, withBackoff } from "./rate-limit";
import type {
  HistoryRequest,
  MarketDataProvider,
  ProviderBar,
  ProviderConstituent,
  ProviderIndex,
  ProviderMetadata,
} from "./types";
import { ProviderError } from "./types";

/**
 * Optional third-party fallback. This is NOT an NSE official or licensed source.
 * Use only when FALLBACK_PROVIDER=YAHOO and the authorized source is unavailable.
 * Price series only — never treat as total return.
 */
export class YahooFinanceProvider implements MarketDataProvider {
  readonly id = "YAHOO";
  readonly kind = "third_party" as const;
  readonly description = "Third-party fallback (Yahoo Finance). Not an NSE official source.";
  private readonly limiter: RateLimiter;

  constructor() {
    this.limiter = new RateLimiter(Math.max(env().PROVIDER_MIN_INTERVAL_MS, 1200));
  }

  async getIndexList(): Promise<ProviderIndex[]> {
    return INDEX_UNIVERSE.filter((i) => i.yahooSymbol).map((i) => ({
      name: i.name,
      symbol: i.symbol,
      nseName: i.nseName,
      yahooSymbol: i.yahooSymbol,
      category: i.category,
      subCategory: i.subCategory,
      description: i.description,
      hasTotalReturn: false,
    }));
  }

  async getHistoricalIndexData(req: HistoryRequest): Promise<ProviderBar[]> {
    if (req.returnType === "TR") return [];
    const symbol = req.yahooSymbol;
    if (!symbol) return [];
    await this.limiter.wait();
    const period1 = Math.floor(new Date(`${req.from}T00:00:00Z`).getTime() / 1000);
    const period2 = Math.floor(new Date(`${req.to}T23:59:59Z`).getTime() / 1000);
    const url = `${env().YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
    const json = await withBackoff(() => this.fetchJson(url), {
      retries: env().PROVIDER_MAX_RETRIES,
      label: `yahoo:${symbol}`,
    });
    return parseYahooChart(json);
  }

  async getLatestIndexData(req: Omit<HistoryRequest, "from">): Promise<ProviderBar | null> {
    const bars = await this.getHistoricalIndexData({
      ...req,
      from: addDays(req.to, -14),
    });
    return bars.at(-1) ?? null;
  }

  async getIndexMetadata(nseName: string): Promise<ProviderMetadata | null> {
    const seed = INDEX_UNIVERSE.find((i) => i.nseName === nseName);
    return seed ? { name: seed.name, nseName: seed.nseName, description: seed.description } : null;
  }

  async getIndexConstituents(): Promise<ProviderConstituent[]> {
    return [];
  }

  async getTotalReturnData(): Promise<ProviderBar[]> {
    return [];
  }

  async healthcheck() {
    try {
      await this.fetchJson(`${env().YAHOO_BASE_URL}/v8/finance/chart/%5ENSEI?range=5d&interval=1d`);
      return { ok: true, message: "Yahoo Finance reachable (third-party fallback)" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Yahoo unreachable" };
    }
  }

  private async fetchJson(url: string): Promise<unknown> {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 NSESectorScanner/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new ProviderError(`Yahoo HTTP ${res.status}`, this.id, res.status >= 500);
    return res.json();
  }
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseYahooChart(json: unknown): ProviderBar[] {
  const chart = json as {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
      }[];
    };
  };
  const result = chart.chart?.result?.[0];
  if (!result?.timestamp) return [];
  const q = result.indicators?.quote?.[0];
  const bars: ProviderBar[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = q?.close?.[i];
    if (close == null || !Number.isFinite(close)) continue;
    bars.push({
      date: new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10),
      open: q?.open?.[i] ?? null,
      high: q?.high?.[i] ?? null,
      low: q?.low?.[i] ?? null,
      close,
      volume: q?.volume?.[i] ?? null,
      returnType: "PR",
    });
  }
  logger.info({ bars: bars.length }, "Yahoo third-party history parsed");
  return bars;
}
