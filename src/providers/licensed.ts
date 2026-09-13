import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
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
 * Adapter for an authorized NSE product or a licensed vendor.
 *
 * Expected REST shape (override via NSE_BASE_URL):
 *   GET {base}/indices
 *   GET {base}/indices/{symbol}/history?from=YYYY-MM-DD&to=YYYY-MM-DD&returnType=PR|TR
 *   GET {base}/indices/{symbol}/latest?returnType=PR|TR
 *   GET {base}/indices/{symbol}/metadata
 *   GET {base}/indices/{symbol}/constituents
 *   GET {base}/indices/{symbol}/total-return?from=&to=
 *
 * Auth: Authorization: Bearer $NSE_API_KEY
 *       X-API-Key / X-API-Secret when secret is set
 */
export class LicensedMarketDataProvider implements MarketDataProvider {
  readonly id = "LICENSED";
  readonly kind = "licensed" as const;
  readonly description = "Authorized NSE / licensed vendor API";
  private readonly limiter: RateLimiter;

  constructor() {
    this.limiter = new RateLimiter(env().PROVIDER_MIN_INTERVAL_MS);
  }

  async getIndexList(): Promise<ProviderIndex[]> {
    const data = await this.getJson<ProviderIndex[]>("/indices");
    return Array.isArray(data) ? data : [];
  }

  async getHistoricalIndexData(req: HistoryRequest): Promise<ProviderBar[]> {
    const q = new URLSearchParams({
      from: req.from,
      to: req.to,
      returnType: req.returnType,
    });
    const data = await this.getJson<ProviderBar[]>(
      `/indices/${encodeURIComponent(req.symbol)}/history?${q}`,
    );
    return Array.isArray(data) ? data.map((b) => ({ ...b, returnType: req.returnType })) : [];
  }

  async getLatestIndexData(req: Omit<HistoryRequest, "from">): Promise<ProviderBar | null> {
    const q = new URLSearchParams({ returnType: req.returnType });
    return this.getJson<ProviderBar | null>(
      `/indices/${encodeURIComponent(req.symbol)}/latest?${q}`,
    );
  }

  async getIndexMetadata(nseName: string): Promise<ProviderMetadata | null> {
    return this.getJson<ProviderMetadata | null>(
      `/indices/${encodeURIComponent(nseName)}/metadata`,
    );
  }

  async getIndexConstituents(nseName: string): Promise<ProviderConstituent[]> {
    const data = await this.getJson<ProviderConstituent[]>(
      `/indices/${encodeURIComponent(nseName)}/constituents`,
    );
    return Array.isArray(data) ? data : [];
  }

  async getTotalReturnData(req: Omit<HistoryRequest, "returnType">): Promise<ProviderBar[]> {
    return this.getHistoricalIndexData({ ...req, returnType: "TR" });
  }

  async healthcheck() {
    try {
      if (!env().NSE_BASE_URL || !env().NSE_API_KEY) {
        return { ok: false, message: "Licensed provider not configured (NSE_BASE_URL / NSE_API_KEY)" };
      }
      await this.getJson<unknown>("/health");
      return { ok: true, message: "Licensed API reachable" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Licensed API error" };
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const base = env().NSE_BASE_URL.replace(/\/$/, "");
    if (!base) throw new ProviderError("NSE_BASE_URL is not set", this.id, false);
    await this.limiter.wait();
    return withBackoff(async () => {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "NSESectorScanner/1.0",
      };
      if (env().NSE_API_KEY) headers.Authorization = `Bearer ${env().NSE_API_KEY}`;
      if (env().NSE_API_KEY) headers["X-API-Key"] = env().NSE_API_KEY;
      if (env().NSE_API_SECRET) headers["X-API-Secret"] = env().NSE_API_SECRET;
      const res = await fetch(`${base}${path}`, {
        headers,
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        logger.error({ path, status: res.status }, "Licensed provider HTTP error");
        throw new ProviderError(`Licensed API ${path} HTTP ${res.status}`, this.id, res.status >= 500);
      }
      return (await res.json()) as T;
    }, { retries: env().PROVIDER_MAX_RETRIES, label: `licensed:${path}` });
  }
}
