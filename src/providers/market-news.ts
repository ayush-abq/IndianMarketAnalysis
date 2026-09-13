/**
 * Licensed / authorized market-news feed.
 * Official NSE EOD and AMFI NAV files do not include headlines.
 * Until MARKET_NEWS_BASE_URL + MARKET_NEWS_API_KEY are set, news stays empty —
 * never scraped, never invented by the model.
 */

import { NEWS_UNAVAILABLE_NOTE, type NewsItem } from "@/services/explain";

export async function fetchLicensedNews(query: { symbol?: string; name: string }): Promise<{
  items: NewsItem[];
  note: string;
}> {
  const base = process.env.MARKET_NEWS_BASE_URL ?? "";
  const key = process.env.MARKET_NEWS_API_KEY ?? "";
  if (!base || !key) {
    return { items: [], note: NEWS_UNAVAILABLE_NOTE };
  }

  const url = new URL("/search", base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("q", query.symbol || query.name);
  url.searchParams.set("name", query.name);
  if (query.symbol) url.searchParams.set("symbol", query.symbol);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return {
        items: [],
        note: `Licensed news endpoint returned ${res.status}. Showing price/NAV evidence only — no invented headline.`,
      };
    }
    const body = (await res.json()) as { items?: NewsItem[] };
    const items = Array.isArray(body.items)
      ? body.items
          .filter((n) => n?.headline && n.source && n.date)
          .slice(0, 5)
          .map((n) => ({ headline: n.headline, source: n.source, date: n.date, url: n.url }))
      : [];
    return {
      items,
      note: items.length
        ? "Headlines below came from the configured licensed news feed, not from NSE EOD or AMFI files."
        : "Licensed news feed is configured but returned no items for this name. Price/NAV evidence still stands.",
    };
  } catch {
    return {
      items: [],
      note: "Licensed news feed did not respond. Price/NAV evidence is shown instead of a guessed story.",
    };
  }
}

export async function withLicensedNews<T extends { news: NewsItem[]; newsNote: string }>(
  explanation: T,
  query: { symbol?: string; name: string },
): Promise<T> {
  const news = await fetchLicensedNews(query);
  return { ...explanation, news: news.items, newsNote: news.note };
}
