import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { CsvImportProvider } from "./csv-import";
import { LicensedMarketDataProvider } from "./licensed";
import { NseOfficialEodProvider } from "./nse-official-eod";
import { YahooFinanceProvider } from "./yahoo";
import type { HistoryRequest, MarketDataProvider, ProviderBar } from "./types";
import { ProviderError } from "./types";

export type { MarketDataProvider, ProviderBar, ProviderIndex } from "./types";
export { ProviderError } from "./types";

function createProvider(id: string): MarketDataProvider {
  switch (id) {
    case "NSE_OFFICIAL_EOD":
      return new NseOfficialEodProvider();
    case "LICENSED":
      return new LicensedMarketDataProvider();
    case "CSV_IMPORT":
      return new CsvImportProvider();
    case "YAHOO":
      return new YahooFinanceProvider();
    default:
      throw new Error(`Unknown data provider: ${id}`);
  }
}

/**
 * Official/authorized source first. Optional configured fallback only.
 * Never silently invents values. Callers persist successful bars to Postgres;
 * the dashboard reads the database only.
 */
export class FailoverMarketDataProvider implements MarketDataProvider {
  readonly id: string;
  readonly kind: MarketDataProvider["kind"];
  readonly description: string;
  private readonly primary: MarketDataProvider;
  private readonly fallback: MarketDataProvider | null;
  lastSource: string | null = null;
  stale = false;

  constructor() {
    const cfg = env();
    this.primary = createProvider(cfg.DATA_PROVIDER);
    this.fallback =
      cfg.FALLBACK_PROVIDER !== "NONE" && cfg.FALLBACK_PROVIDER !== cfg.DATA_PROVIDER
        ? createProvider(cfg.FALLBACK_PROVIDER)
        : null;
    this.id = this.primary.id;
    this.kind = this.primary.kind;
    this.description = this.fallback
      ? `${this.primary.description} (fallback: ${this.fallback.id})`
      : this.primary.description;
  }

  async getIndexList() {
    return this.try("getIndexList", (p) => p.getIndexList());
  }

  async getHistoricalIndexData(req: HistoryRequest) {
    return this.try("getHistoricalIndexData", (p) => p.getHistoricalIndexData(req));
  }

  async getLatestIndexData(req: Omit<HistoryRequest, "from">) {
    return this.try("getLatestIndexData", (p) => p.getLatestIndexData(req));
  }

  async getIndexMetadata(nseName: string) {
    return this.try("getIndexMetadata", (p) => p.getIndexMetadata(nseName));
  }

  async getIndexConstituents(nseName: string, asOf?: string) {
    return this.try("getIndexConstituents", (p) => p.getIndexConstituents(nseName, asOf));
  }

  async getTotalReturnData(req: Omit<HistoryRequest, "from"> & { from: string }) {
    return this.try("getTotalReturnData", (p) => p.getTotalReturnData(req));
  }

  async healthcheck() {
    const primary = await this.primary.healthcheck();
    const fallback = this.fallback ? await this.fallback.healthcheck() : null;
    return {
      ok: primary.ok || Boolean(fallback?.ok),
      message: primary.ok
        ? primary.message
        : `Primary (${this.primary.id}) failed: ${primary.message}` +
          (fallback ? ` | Fallback (${this.fallback!.id}): ${fallback.message}` : ""),
      primary,
      fallback,
    };
  }

  private async try<T>(op: string, fn: (p: MarketDataProvider) => Promise<T>): Promise<T> {
    try {
      const result = await fn(this.primary);
      this.lastSource = this.primary.id;
      this.stale = false;
      if (Array.isArray(result) && result.length === 0 && this.fallback) {
        logger.warn({ op, provider: this.primary.id }, "Primary returned empty; trying fallback");
        const fb = await fn(this.fallback);
        this.lastSource = this.fallback.id;
        return fb;
      }
      return result;
    } catch (err) {
      logger.error({ op, err, provider: this.primary.id }, "Primary provider failed");
      if (!this.fallback) {
        this.stale = true;
        throw err;
      }
      try {
        const result = await fn(this.fallback);
        this.lastSource = this.fallback.id;
        logger.warn({ op, fallback: this.fallback.id }, "Using fallback provider");
        return result;
      } catch (fbErr) {
        this.stale = true;
        logger.error({ op, err: fbErr }, "Fallback provider failed — keeping previous database values");
        throw new ProviderError(
          `All providers failed for ${op}`,
          `${this.primary.id}+${this.fallback.id}`,
        );
      }
    }
  }
}

export function createMarketDataProvider(): FailoverMarketDataProvider {
  return new FailoverMarketDataProvider();
}

export function isPriceBar(bar: ProviderBar): boolean {
  return bar.returnType === "PR";
}
