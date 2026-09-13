import { env } from "@/lib/env";
import { RateLimiter } from "@/providers/rate-limit";
import type { MutualFundDataProvider } from "./types";
import type { AmfiSchemeRow } from "@/mf/amfi-parse";
import type { MfHolding } from "./types";

/** Authorized vendor adapter for portfolio / TER / AUM / manager fields AMFI does not publish daily. */
export class LicensedMfProvider implements MutualFundDataProvider {
  readonly id = "MF_LICENSED";
  readonly kind = "licensed" as const;
  private readonly limiter = new RateLimiter(env().PROVIDER_MIN_INTERVAL_MS);

  async getSchemeUniverse(): Promise<AmfiSchemeRow[]> {
    return this.getJson("/mutual-funds");
  }

  async getNavHistory(from: string, to: string): Promise<AmfiSchemeRow[]> {
    return this.getJson(`/mutual-funds/nav?from=${from}&to=${to}`);
  }

  async getPortfolio(schemeCode: string): Promise<MfHolding[]> {
    return this.getJson(`/mutual-funds/${schemeCode}/portfolio`);
  }

  async getExpenseRatio(schemeCode: string) {
    return this.getJson<{ date: string; ter: number } | null>(`/mutual-funds/${schemeCode}/ter`);
  }

  async getAum(schemeCode: string) {
    return this.getJson<{ date: string; aum: number } | null>(`/mutual-funds/${schemeCode}/aum`);
  }

  async getBenchmark(schemeCode: string) {
    return this.getJson<string | null>(`/mutual-funds/${schemeCode}/benchmark`);
  }

  async getRiskometer(schemeCode: string) {
    return this.getJson<string | null>(`/mutual-funds/${schemeCode}/riskometer`);
  }

  async getFundManager(schemeCode: string) {
    return this.getJson<{ name: string; tenureYears?: number } | null>(`/mutual-funds/${schemeCode}/manager`);
  }

  async healthcheck() {
    if (!env().MF_LICENSED_BASE_URL || !env().MF_API_KEY) {
      return { ok: false, message: "Licensed MF provider not configured" };
    }
    try {
      await this.getJson("/health");
      return { ok: true, message: "Licensed MF API reachable" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Licensed MF error" };
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const base = env().MF_LICENSED_BASE_URL.replace(/\/$/, "");
    if (!base) throw new Error("MF_LICENSED_BASE_URL is not set");
    await this.limiter.wait();
    const res = await fetch(`${base}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env().MF_API_KEY}`,
        "X-API-Key": env().MF_API_KEY,
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Licensed MF ${path} HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }
}
