import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export type CoverageBlock = {
  name: string;
  status: "READY" | "PARTIAL" | "MISSING";
  summary: string;
  rows: Record<string, string | number | null>;
  missing: string[];
};

async function one<T extends Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T> {
  const db = getDb();
  const rows = await db.execute(query);
  return ((rows as unknown as T[])[0] ?? {}) as T;
}

export async function fillStockSectorsFromIndustry() {
  const db = getDb();
  await db.execute(sql`
    update stocks
    set sector = industry, updated_at = now()
    where sector is null and industry is not null
  `);
  const r = await db.execute(sql`select count(*)::int as n from stocks where sector is not null`);
  return (r as unknown as { n: number }[])[0]?.n ?? 0;
}

export async function buildCoverageReport() {
  const withSector = await fillStockSectorsFromIndustry();

  const idx = await one<{ n: string; days: string; mn: string; mx: string }>(sql`
    select count(*)::text n, count(distinct date)::text days, min(date)::text mn, max(date)::text mx from index_prices
  `);
  const idxScores = await one<{ n: string; latest: string }>(sql`
    select count(*)::text n, max(date)::text latest from index_scores
  `);
  const nav = await one<{ n: string; days: string; mn: string; mx: string }>(sql`
    select count(*)::text n, count(distinct date)::text days, min(date)::text mn, max(date)::text mx from mutual_fund_nav
  `);
  const mfScores = await one<{ n: string; latest: string }>(sql`
    select count(*)::text n, max(date)::text latest from mutual_fund_scores
  `);
  const mfExtra = await one<{ expenses: string; aum: string; holdings: string }>(sql`
    select
      (select count(*)::text from mutual_fund_expenses) expenses,
      (select count(*)::text from mutual_fund_aum) aum,
      (select count(*)::text from mutual_fund_holdings) holdings
  `);
  const px = await one<{ n: string; days: string; mn: string; mx: string }>(sql`
    select count(*)::text n, count(distinct date)::text days, min(date)::text mn, max(date)::text mx from stock_prices
  `);
  const stScores = await one<{ n: string; latest: string }>(sql`
    select count(*)::text n, max(date)::text latest from stock_scores
  `);
  const stMeta = await one<{ n: string; sector: string; industry: string; mbr: string }>(sql`
    select count(*)::text n,
      count(sector)::text sector,
      count(industry)::text industry,
      count(index_memberships)::text mbr
    from stocks
  `);
  const fundamentals = await one<{ n: string }>(sql`select count(*)::text n from stock_fundamentals`);

  const indexes: CoverageBlock = {
    name: "Indices / sectors",
    status: Number(idx.days) >= 2000 ? "READY" : "PARTIAL",
    summary: `Official NSE EOD from ${idx.mn ?? "—"} to ${idx.mx ?? "—"}.`,
    rows: {
      "Price rows": Number(idx.n),
      Sessions: Number(idx.days),
      From: idx.mn,
      Through: idx.mx,
      "Scores as-of": idxScores.latest,
    },
    missing: ["Total-return (TRI) series — licensed or official TRI CSV only."],
  };

  const fundMissing = [
    Number(mfExtra.expenses) === 0 ? "TER / expense ratio — not in AMFI NAVAll. Licensed portfolio feed only." : "",
    Number(mfExtra.aum) === 0 ? "AUM — not in AMFI NAVAll. Licensed feed only." : "",
    Number(mfExtra.holdings) === 0 ? "Holdings / portfolio — not in AMFI NAVAll. Licensed feed only." : "",
  ].filter(Boolean);
  const funds: CoverageBlock = {
    name: "Mutual funds",
    status: Number(nav.n) > 1_000_000 ? "READY" : "PARTIAL",
    summary: `Official AMFI NAVs from ${nav.mn ?? "—"} to ${nav.mx ?? "—"}. Scores use NAV history only.`,
    rows: {
      "NAV rows": Number(nav.n),
      Sessions: Number(nav.days),
      From: nav.mn,
      Through: nav.mx,
      "Scored schemes": Number(mfScores.n),
      "Scores as-of": mfScores.latest,
      TER: Number(mfExtra.expenses),
      AUM: Number(mfExtra.aum),
      Holdings: Number(mfExtra.holdings),
    },
    missing: fundMissing,
  };

  const stockMissing = [
    (px.mn ?? "") > "2015-01-02"
      ? `Stock bhavcopy starts ${px.mn}. 2015–2019 is still landing. After the current job: npm run ingest:all -- --from=2015-01-01`
      : "",
    Number(fundamentals.n) === 0 ? "PE / ROE / earnings — not in bhavcopy. Set EQUITY_FUNDAMENTAL_BASE_URL + API key." : "",
    "Closes are unadjusted. Corporate-action factors are not in the daily file.",
    Number(stMeta.mbr) < Number(stMeta.n)
      ? `Index membership is official for ${stMeta.mbr} names (Nifty lists). Other EQ names have prices only.`
      : "",
  ].filter(Boolean);

  const stockReady = Number(px.days) >= 250 && Number(stScores.n) >= 500;
  const stocksBlock: CoverageBlock = {
    name: "Stocks",
    status: stockReady && (px.mn ?? "") <= "2015-01-02" ? "READY" : stockReady ? "PARTIAL" : "MISSING",
    summary: `Official bhavcopy ${px.mn ?? "—"} → ${px.mx ?? "—"}. Sector filled from official constituent industry (${withSector} names).`,
    rows: {
      "Price rows": Number(px.n),
      Sessions: Number(px.days),
      From: px.mn,
      Through: px.mx,
      Names: Number(stMeta.n),
      "With sector": Number(stMeta.sector),
      "Index members": Number(stMeta.mbr),
      "Scores as-of": stScores.latest,
      Fundamentals: Number(fundamentals.n),
    },
    missing: stockMissing,
  };

  return {
    asOf: px.mx ?? idx.mx ?? nav.mx,
    blocks: [indexes, funds, stocksBlock],
    command: "npm run ingest:all -- --from=2015-01-01",
    note: "Official files can fill prices, NAVs, membership and industry. They cannot fill PE, AUM, TER or holdings. Those stay blank until a licensed feed is configured — never invented.",
  };
}
