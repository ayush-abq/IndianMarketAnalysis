import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const stocks = pgTable(
  "stocks",
  {
    id: serial("id").primaryKey(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    companyName: varchar("company_name", { length: 240 }),
    isin: varchar("isin", { length: 16 }),
    exchange: varchar("exchange", { length: 8 }).notNull().default("NSE"),
    series: varchar("series", { length: 8 }).notNull().default("EQ"),
    sector: varchar("sector", { length: 80 }),
    industry: varchar("industry", { length: 120 }),
    marketCapCategory: varchar("market_cap_category", { length: 24 }),
    indexMemberships: jsonb("index_memberships").$type<string[]>(),
    active: boolean("active").notNull().default(true),
    listingDate: date("listing_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stocks_symbol_uidx").on(t.symbol, t.series)],
);

export const stockPrices = pgTable(
  "stock_prices",
  {
    id: serial("id").primaryKey(),
    stockId: integer("stock_id")
      .notNull()
      .references(() => stocks.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    open: numeric("open", { precision: 18, scale: 4 }),
    high: numeric("high", { precision: 18, scale: 4 }),
    low: numeric("low", { precision: 18, scale: 4 }),
    close: numeric("close", { precision: 18, scale: 4 }).notNull(),
    adjustedClose: numeric("adjusted_close", { precision: 18, scale: 4 }),
    volume: numeric("volume", { precision: 20, scale: 2 }),
    deliveryVolume: numeric("delivery_volume", { precision: 20, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stock_prices_uidx").on(t.stockId, t.date),
    index("stock_prices_idx").on(t.stockId, t.date),
  ],
);

export const stockScores = pgTable(
  "stock_scores",
  {
    id: serial("id").primaryKey(),
    stockId: integer("stock_id")
      .notNull()
      .references(() => stocks.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    close: numeric("close", { precision: 18, scale: 4 }),
    distanceFromAth: numeric("distance_from_ath", { precision: 12, scale: 6 }),
    return1m: numeric("return_1m", { precision: 12, scale: 6 }),
    return3m: numeric("return_3m", { precision: 12, scale: 6 }),
    return1y: numeric("return_1y", { precision: 12, scale: 6 }),
    return3y: numeric("return_3y", { precision: 12, scale: 6 }),
    return5y: numeric("return_5y", { precision: 12, scale: 6 }),
    priceVs50: numeric("price_vs_50", { precision: 12, scale: 6 }),
    priceVs200: numeric("price_vs_200", { precision: 12, scale: 6 }),
    rsi: numeric("rsi", { precision: 8, scale: 4 }),
    rsScore: numeric("rs_score", { precision: 8, scale: 4 }),
    qualityScore: numeric("quality_score", { precision: 8, scale: 4 }),
    valuationScore: numeric("valuation_score", { precision: 8, scale: 4 }),
    earningsScore: numeric("earnings_score", { precision: 8, scale: 4 }),
    opportunityScore: numeric("opportunity_score", { precision: 8, scale: 4 }),
    dataQualityScore: numeric("data_quality_score", { precision: 8, scale: 4 }),
    classification: varchar("classification", { length: 48 }),
    signal: varchar("signal", { length: 48 }),
    explanation: jsonb("explanation"),
    modelVersion: varchar("model_version", { length: 24 }).notNull().default("opp-v1.0"),
  },
  (t) => [uniqueIndex("stock_scores_uidx").on(t.stockId, t.date)],
);

export const stockFundamentals = pgTable(
  "stock_fundamentals",
  {
    id: serial("id").primaryKey(),
    stockId: integer("stock_id")
      .notNull()
      .references(() => stocks.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    period: varchar("period", { length: 16 }).notNull().default("Q"),
    revenue: numeric("revenue", { precision: 20, scale: 2 }),
    ebitda: numeric("ebitda", { precision: 20, scale: 2 }),
    pat: numeric("pat", { precision: 20, scale: 2 }),
    eps: numeric("eps", { precision: 14, scale: 4 }),
    ocf: numeric("ocf", { precision: 20, scale: 2 }),
    fcf: numeric("fcf", { precision: 20, scale: 2 }),
    pe: numeric("pe", { precision: 12, scale: 4 }),
    pb: numeric("pb", { precision: 12, scale: 4 }),
    evEbitda: numeric("ev_ebitda", { precision: 12, scale: 4 }),
    roe: numeric("roe", { precision: 10, scale: 4 }),
    roce: numeric("roce", { precision: 10, scale: 4 }),
    debtEquity: numeric("debt_equity", { precision: 10, scale: 4 }),
    source: varchar("source", { length: 64 }).notNull().default("unavailable"),
    sourceDate: date("source_date"),
  },
  (t) => [uniqueIndex("stock_fundamentals_uidx").on(t.stockId, t.date, t.period)],
);

export const marketRegimeSnapshots = pgTable(
  "market_regime_snapshots",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull().unique(),
    regime: varchar("regime", { length: 32 }).notNull(),
    score: numeric("score", { precision: 8, scale: 4 }),
    nifty50: numeric("nifty50", { precision: 18, scale: 4 }),
    nifty50Return1d: numeric("nifty50_return_1d", { precision: 12, scale: 6 }),
    nifty50Return1y: numeric("nifty50_return_1y", { precision: 12, scale: 6 }),
    nifty50Drawdown: numeric("nifty50_drawdown", { precision: 12, scale: 6 }),
    indiaVix: numeric("india_vix", { precision: 12, scale: 6 }),
    sectorPctAbove50: numeric("sector_pct_above_50", { precision: 8, scale: 4 }),
    sectorPctAbove200: numeric("sector_pct_above_200", { precision: 8, scale: 4 }),
    sectorPctBelow30: numeric("sector_pct_below_30", { precision: 8, scale: 4 }),
    sectorPctBelow40: numeric("sector_pct_below_40", { precision: 8, scale: 4 }),
    recoveringSectors: integer("recovering_sectors"),
    fallingSectors: integer("falling_sectors"),
    breadthDivergence: varchar("breadth_divergence", { length: 48 }),
    explanation: jsonb("explanation"),
    modelVersion: varchar("model_version", { length: 24 }).notNull().default("regime-v1.0"),
  },
);

export const researchSignals = pgTable(
  "research_signals",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    assetType: varchar("asset_type", { length: 16 }).notNull(),
    assetId: integer("asset_id").notNull(),
    assetName: varchar("asset_name", { length: 240 }).notNull(),
    screen: varchar("screen", { length: 64 }).notNull(),
    signal: varchar("signal", { length: 64 }).notNull(),
    score: numeric("score", { precision: 8, scale: 4 }),
    payload: jsonb("payload"),
    modelVersion: varchar("model_version", { length: 24 }).notNull().default("opp-v1.0"),
    forward1m: numeric("forward_1m", { precision: 12, scale: 6 }),
    forward3m: numeric("forward_3m", { precision: 12, scale: 6 }),
    forward6m: numeric("forward_6m", { precision: 12, scale: 6 }),
    forward1y: numeric("forward_1y", { precision: 12, scale: 6 }),
    forwardFilledAt: timestamp("forward_filled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("research_signals_idx").on(t.date, t.assetType, t.screen)],
);

export const backtestRuns = pgTable("backtest_runs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  name: varchar("name", { length: 160 }),
  universe: varchar("universe", { length: 32 }).notNull(),
  conditions: jsonb("conditions").notNull(),
  holdTradingDays: integer("hold_trading_days").notNull(),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  modelVersion: varchar("model_version", { length: 24 }).notNull().default("lab-v1.0"),
  result: jsonb("result").notNull(),
});

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: serial("id").primaryKey(),
    listName: varchar("list_name", { length: 48 }).notNull().default("WATCHLIST"),
    assetType: varchar("asset_type", { length: 16 }).notNull(),
    assetId: integer("asset_id").notNull(),
    assetName: varchar("asset_name", { length: 240 }).notNull(),
    thesis: text("thesis"),
    entryPrice: numeric("entry_price", { precision: 18, scale: 4 }),
    invalidation: text("invalidation"),
    notes: text("notes"),
    status: varchar("status", { length: 32 }).notNull().default("WATCHLIST"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("watchlist_uidx").on(t.listName, t.assetType, t.assetId)],
);

export const thesisChecks = pgTable("thesis_checks", {
  id: serial("id").primaryKey(),
  watchlistId: integer("watchlist_id")
    .notNull()
    .references(() => watchlistItems.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  condition: varchar("condition", { length: 80 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  detail: text("detail"),
});

export const paperPositions = pgTable("paper_positions", {
  id: serial("id").primaryKey(),
  assetType: varchar("asset_type", { length: 16 }).notNull(),
  assetId: integer("asset_id").notNull(),
  assetName: varchar("asset_name", { length: 240 }).notNull(),
  side: varchar("side", { length: 8 }).notNull().default("LONG"),
  quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
  entryDate: date("entry_date").notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 4 }).notNull(),
  exitDate: date("exit_date"),
  exitPrice: numeric("exit_price", { precision: 18, scale: 4 }),
  reason: text("reason"),
  scoreAtEntry: numeric("score_at_entry", { precision: 8, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const researchJournal = pgTable("research_journal", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  assetType: varchar("asset_type", { length: 16 }),
  assetId: integer("asset_id"),
  assetName: varchar("asset_name", { length: 240 }),
  thesis: text("thesis"),
  evidence: text("evidence"),
  decision: text("decision"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const modelVersions = pgTable("model_versions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  version: varchar("version", { length: 24 }).notNull(),
  parameters: jsonb("parameters").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const corporateActions = pgTable(
  "corporate_actions",
  {
    id: serial("id").primaryKey(),
    stockId: integer("stock_id")
      .notNull()
      .references(() => stocks.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    actionType: varchar("action_type", { length: 32 }).notNull(),
    ratio: varchar("ratio", { length: 32 }),
    factor: numeric("factor", { precision: 16, scale: 8 }),
    source: varchar("source", { length: 64 }).notNull().default("unavailable"),
    sourceDate: date("source_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("corporate_actions_uidx").on(t.stockId, t.date, t.actionType)],
);

export const institutionalFlows = pgTable(
  "institutional_flows",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    fiiNet: numeric("fii_net", { precision: 18, scale: 2 }),
    diiNet: numeric("dii_net", { precision: 18, scale: 2 }),
    source: varchar("source", { length: 64 }).notNull().default("unavailable"),
    sourceDate: date("source_date"),
  },
  (t) => [uniqueIndex("institutional_flows_uidx").on(t.date)],
);

export const researchPortfolios = pgTable("research_portfolios", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  kind: varchar("kind", { length: 24 }).notNull().default("RESEARCH"),
  notes: text("notes"),
  riskLimits: jsonb("risk_limits"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const researchPortfolioLegs = pgTable("research_portfolio_legs", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id")
    .notNull()
    .references(() => researchPortfolios.id, { onDelete: "cascade" }),
  assetType: varchar("asset_type", { length: 16 }).notNull(),
  assetId: integer("asset_id").notNull(),
  assetName: varchar("asset_name", { length: 240 }).notNull(),
  weightPct: numeric("weight_pct", { precision: 8, scale: 4 }).notNull(),
});

export const dailyBriefs = pgTable(
  "daily_briefs",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    kind: varchar("kind", { length: 16 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: jsonb("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("daily_briefs_uidx").on(t.date, t.kind)],
);
