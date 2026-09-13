import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { parseAmfiNavText, type AmfiSchemeRow } from "@/mf/amfi-parse";
import { RateLimiter, withBackoff } from "@/providers/rate-limit";
import type { MutualFundDataProvider } from "./types";

const UA = "Mozilla/5.0 NSESectorScanner-MF/1.0";

/**
 * Official AMFI published NAV files.
 * Daily: NAVAll.txt
 * History: AMFI NAV History Report (portal download)
 */
export class AmfiOfficialProvider implements MutualFundDataProvider {
  readonly id = "AMFI";
  readonly kind = "official" as const;
  private readonly limiter = new RateLimiter(env().PROVIDER_MIN_INTERVAL_MS);

  async getSchemeUniverse(): Promise<AmfiSchemeRow[]> {
    const text = await this.getText(env().AMFI_NAVALL_URL);
    const rows = parseAmfiNavText(text);
    logger.info({ rows: rows.length }, "AMFI NAVAll parsed");
    return rows;
  }

  async getNavHistory(from: string, to: string): Promise<AmfiSchemeRow[]> {
    const url = historyUrl(from, to);
    const text = await this.getText(url);
    const rows = parseAmfiNavText(text);
    logger.info({ from, to, rows: rows.length }, "AMFI NAV history parsed");
    return rows;
  }

  async healthcheck() {
    try {
      const res = await fetch(env().AMFI_NAVALL_URL, {
        headers: { "User-Agent": UA, Accept: "text/plain,*/*" },
        signal: AbortSignal.timeout(30_000),
      });
      return {
        ok: res.ok,
        message: res.ok ? "AMFI official NAVAll reachable" : `AMFI HTTP ${res.status}`,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "AMFI unreachable" };
    }
  }

  private async getText(url: string): Promise<string> {
    await this.limiter.wait();
    return withBackoff(async () => {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/plain,text/csv,*/*",
          Referer: "https://www.amfiindia.com/",
        },
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`AMFI ${url} HTTP ${res.status}`);
      const text = await res.text();
      if (/<html/i.test(text) && !text.includes("Scheme Code")) {
        throw new Error(`AMFI ${url} returned HTML instead of a NAV file`);
      }
      return text;
    }, { retries: env().PROVIDER_MAX_RETRIES, label: `amfi:${url}` });
  }
}

function historyUrl(from: string, to: string) {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
    return `${d}-${mon}-${y}`;
  };
  const base = env().AMFI_NAV_HISTORY_URL.replace(/\/$/, "");
  return `${base}?tp=1&frmdt=${fmt(from)}&todt=${fmt(to)}`;
}
