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

export const indices = pgTable(
  "indices",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    nseName: varchar("nse_name", { length: 160 }).notNull(),
    yahooSymbol: varchar("yahoo_symbol", { length: 64 }),
    category: varchar("category", { length: 64 }).notNull(),
    subcategory: varchar("subcategory", { length: 64 }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull().default("NIFTY_INDICES"),
    dataSource: varchar("data_source", { length: 64 }).notNull().default("NIFTY_INDICES"),
    inceptionDate: date("inception_date"),
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    description: text("description"),
    isBenchmark: boolean("is_benchmark").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("indices_symbol_uidx").on(t.symbol),
    uniqueIndex("indices_nse_name_uidx").on(t.nseName),
  ],
);

export const indexPrices = pgTable(
  "index_prices",
  {
    id: serial("id").primaryKey(),
    indexId: integer("index_id")
      .notNull()
      .references(() => indices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    open: numeric("open", { precision: 18, scale: 4 }),
    high: numeric("high", { precision: 18, scale: 4 }),
    low: numeric("low", { precision: 18, scale: 4 }),
    close: numeric("close", { precision: 18, scale: 4 }).notNull(),
    volume: numeric("volume", { precision: 20, scale: 2 }),
    returnType: varchar("return_type", { length: 4 }).notNull().default("PR"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("index_prices_uidx").on(t.indexId, t.date, t.returnType),
    index("index_prices_idx").on(t.indexId, t.date),
  ],
);

export const indexReturns = pgTable(
  "index_returns",
  {
    id: serial("id").primaryKey(),
    indexId: integer("index_id")
      .notNull()
      .references(() => indices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    returnType: varchar("return_type", { length: 4 }).notNull().default("PR"),
    return1d: numeric("return_1d", { precision: 12, scale: 6 }),
    return1w: numeric("return_1w", { precision: 12, scale: 6 }),
    return1m: numeric("return_1m", { precision: 12, scale: 6 }),
    return3m: numeric("return_3m", { precision: 12, scale: 6 }),
    return6m: numeric("return_6m", { precision: 12, scale: 6 }),
    return1y: numeric("return_1y", { precision: 12, scale: 6 }),
    return2y: numeric("return_2y", { precision: 12, scale: 6 }),
    return3y: numeric("return_3y", { precision: 12, scale: 6 }),
    return5y: numeric("return_5y", { precision: 12, scale: 6 }),
    returnSinceInception: numeric("return_since_inception", { precision: 14, scale: 6 }),
    return5d: numeric("return_5d", { precision: 12, scale: 6 }),
    return20d: numeric("return_20d", { precision: 12, scale: 6 }),
    return50d: numeric("return_50d", { precision: 12, scale: 6 }),
    return100d: numeric("return_100d", { precision: 12, scale: 6 }),
    return200d: numeric("return_200d", { precision: 12, scale: 6 }),
  },
  (t) => [
    uniqueIndex("index_returns_uidx").on(t.indexId, t.date, t.returnType),
    index("index_returns_idx").on(t.indexId, t.date),
  ],
);

export const indexDrawdowns = pgTable(
  "index_drawdowns",
  {
    id: serial("id").primaryKey(),
    indexId: integer("index_id")
      .notNull()
      .references(() => indices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    returnType: varchar("return_type", { length: 4 }).notNull().default("PR"),
    currentClose: numeric("current_close", { precision: 18, scale: 4 }).notNull(),
    allTimeHigh: numeric("all_time_high", { precision: 18, scale: 4 }).notNull(),
    athDate: date("ath_date").notNull(),
    intradayAth: numeric("intraday_ath", { precision: 18, scale: 4 }),
    intradayAthDate: date("intraday_ath_date"),
    drawdownPercent: numeric("drawdown_percent", { precision: 12, scale: 6 }).notNull(),
    drawdownAmount: numeric("drawdown_amount", { precision: 18, scale: 4 }).notNull(),
    distanceFromAthPercent: numeric("distance_from_ath_percent", { precision: 12, scale: 6 }).notNull(),
    high52w: numeric("high_52w", { precision: 18, scale: 4 }),
    low52w: numeric("low_52w", { precision: 18, scale: 4 }),
    drawdown52wPercent: numeric("drawdown_52w_percent", { precision: 12, scale: 6 }),
    maxHistoricalDrawdown: numeric("max_historical_drawdown", { precision: 12, scale: 6 }),
    maxHistoricalDrawdownDate: date("max_historical_drawdown_date"),
    troughClose: numeric("trough_close", { precision: 18, scale: 4 }),
    troughDate: date("trough_date"),
    recoveryFromTroughPct: numeric("recovery_from_trough_pct", { precision: 12, scale: 6 }),
    daysBelow40: integer("days_below_40"),
    daysBelow30: integer("days_below_30"),
    priorDrawdowns30: integer("prior_drawdowns_30"),
    priorDrawdowns40: integer("prior_drawdowns_40"),
    priorDrawdowns50: integer("prior_drawdowns_50"),
    avgRecoveryDays20: numeric("avg_recovery_days_20", { precision: 10, scale: 2 }),
    avgRecoveryDays30: numeric("avg_recovery_days_30", { precision: 10, scale: 2 }),
    avgRecoveryDays40: numeric("avg_recovery_days_40", { precision: 10, scale: 2 }),
    avgRecoveryDays50: numeric("avg_recovery_days_50", { precision: 10, scale: 2 }),
    drawdownPercentile: numeric("drawdown_percentile", { precision: 8, scale: 4 }),
  },
  (t) => [
    uniqueIndex("index_drawdowns_uidx").on(t.indexId, t.date, t.returnType),
    index("index_drawdowns_idx").on(t.indexId, t.date),
  ],
);

export const indexScores = pgTable(
  "index_scores",
  {
    id: serial("id").primaryKey(),
    indexId: integer("index_id")
      .notNull()
      .references(() => indices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    returnType: varchar("return_type", { length: 4 }).notNull().default("PR"),
    drawdownScore: numeric("drawdown_score", { precision: 8, scale: 4 }),
    drawdownScoreContinuous: numeric("drawdown_score_continuous", { precision: 8, scale: 4 }),
    momentumScore: numeric("momentum_score", { precision: 8, scale: 4 }),
    returnScore: numeric("return_score", { precision: 8, scale: 4 }),
    trendScore: numeric("trend_score", { precision: 8, scale: 4 }),
    recoveryScore: numeric("recovery_score", { precision: 8, scale: 4 }),
    capitulationScore: numeric("capitulation_score", { precision: 8, scale: 4 }),
    weaknessScore: numeric("weakness_score", { precision: 8, scale: 4 }),
    relativeStrengthScore: numeric("relative_strength_score", { precision: 8, scale: 4 }),
    breadthScore: numeric("breadth_score", { precision: 8, scale: 4 }),
    opportunityScore: numeric("opportunity_score", { precision: 8, scale: 4 }),
    overallScore: numeric("overall_score", { precision: 8, scale: 4 }),
    classification: varchar("classification", { length: 64 }).notNull(),
    trendState: varchar("trend_state", { length: 32 }),
    signal: varchar("signal", { length: 64 }),
    regime: varchar("regime", { length: 16 }),
    ma20: numeric("ma20", { precision: 18, scale: 4 }),
    ma50: numeric("ma50", { precision: 18, scale: 4 }),
    ma100: numeric("ma100", { precision: 18, scale: 4 }),
    ma200: numeric("ma200", { precision: 18, scale: 4 }),
    priceVs50: numeric("price_vs_50", { precision: 12, scale: 6 }),
    priceVs100: numeric("price_vs_100", { precision: 12, scale: 6 }),
    priceVs200: numeric("price_vs_200", { precision: 12, scale: 6 }),
    ma50Slope: numeric("ma50_slope", { precision: 12, scale: 6 }),
    ma100Slope: numeric("ma100_slope", { precision: 12, scale: 6 }),
    ma200Slope: numeric("ma200_slope", { precision: 12, scale: 6 }),
    rs1mNifty50: numeric("rs_1m_nifty50", { precision: 12, scale: 6 }),
    rs3mNifty50: numeric("rs_3m_nifty50", { precision: 12, scale: 6 }),
    rs6mNifty50: numeric("rs_6m_nifty50", { precision: 12, scale: 6 }),
    rs1yNifty50: numeric("rs_1y_nifty50", { precision: 12, scale: 6 }),
    rs1mNifty500: numeric("rs_1m_nifty500", { precision: 12, scale: 6 }),
    rs3mNifty500: numeric("rs_3m_nifty500", { precision: 12, scale: 6 }),
    rs6mNifty500: numeric("rs_6m_nifty500", { precision: 12, scale: 6 }),
    rs1yNifty500: numeric("rs_1y_nifty500", { precision: 12, scale: 6 }),
    volatility20d: numeric("volatility_20d", { precision: 12, scale: 6 }),
    researchNote: text("research_note"),
  },
  (t) => [
    uniqueIndex("index_scores_uidx").on(t.indexId, t.date, t.returnType),
    index("index_scores_idx").on(t.indexId, t.date),
  ],
);

export const dailySnapshots = pgTable(
  "daily_snapshots",
  {
    id: serial("id").primaryKey(),
    indexId: integer("index_id")
      .notNull()
      .references(() => indices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    returnType: varchar("return_type", { length: 4 }).notNull().default("PR"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_snapshots_uidx").on(t.indexId, t.date, t.returnType),
    index("daily_snapshots_idx").on(t.indexId, t.date),
  ],
);

export const dataIngestionRuns = pgTable("data_ingestion_runs", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: varchar("status", { length: 32 }).notNull(),
  recordsDownloaded: integer("records_downloaded").notNull().default(0),
  recordsInserted: integer("records_inserted").notNull().default(0),
  recordsUpdated: integer("records_updated").notNull().default(0),
  failedRecords: integer("failed_records").notNull().default(0),
  errorMessage: text("error_message"),
  jobKey: varchar("job_key", { length: 80 }),
  details: jsonb("details"),
});

export const alerts = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    indexId: integer("index_id").references(() => indices.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    alertType: varchar("alert_type", { length: 64 }).notNull(),
    severity: varchar("severity", { length: 16 }).notNull(),
    message: text("message").notNull(),
    acknowledged: boolean("acknowledged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("alerts_date_idx").on(t.date)],
);

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marketHolidays = pgTable("market_holidays", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  market: varchar("market", { length: 16 }).notNull().default("NSE"),
});

export const constituents = pgTable(
  "constituents",
  {
    id: serial("id").primaryKey(),
    indexId: integer("index_id")
      .notNull()
      .references(() => indices.id, { onDelete: "cascade" }),
    asOfDate: date("as_of_date").notNull(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    name: varchar("name", { length: 160 }),
    weight: numeric("weight", { precision: 10, scale: 6 }),
    marketCap: numeric("market_cap", { precision: 20, scale: 2 }),
  },
  (t) => [uniqueIndex("constituents_uidx").on(t.indexId, t.asOfDate, t.symbol)],
);

export const constituentMetrics = pgTable(
  "constituent_metrics",
  {
    id: serial("id").primaryKey(),
    indexId: integer("index_id")
      .notNull()
      .references(() => indices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    close: numeric("close", { precision: 18, scale: 4 }),
    return1y: numeric("return_1y", { precision: 12, scale: 6 }),
    distanceFromAth: numeric("distance_from_ath", { precision: 12, scale: 6 }),
    above50dma: boolean("above_50dma"),
    above200dma: boolean("above_200dma"),
  },
  (t) => [uniqueIndex("constituent_metrics_uidx").on(t.indexId, t.date, t.symbol)],
);

export const indexBreadth = pgTable(
  "index_breadth",
  {
    id: serial("id").primaryKey(),
    indexId: integer("index_id")
      .notNull()
      .references(() => indices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    constituentCount: integer("constituent_count"),
    pctBelow10: numeric("pct_below_10", { precision: 8, scale: 4 }),
    pctBelow20: numeric("pct_below_20", { precision: 8, scale: 4 }),
    pctBelow30: numeric("pct_below_30", { precision: 8, scale: 4 }),
    pctBelow40: numeric("pct_below_40", { precision: 8, scale: 4 }),
    pctBelow50: numeric("pct_below_50", { precision: 8, scale: 4 }),
    pctAbove50dma: numeric("pct_above_50dma", { precision: 8, scale: 4 }),
    pctAbove200dma: numeric("pct_above_200dma", { precision: 8, scale: 4 }),
    breadthScore: numeric("breadth_score", { precision: 8, scale: 4 }),
  },
  (t) => [uniqueIndex("index_breadth_uidx").on(t.indexId, t.date)],
);

export const dataQualityFlags = pgTable("data_quality_flags", {
  id: serial("id").primaryKey(),
  indexId: integer("index_id").references(() => indices.id, { onDelete: "cascade" }),
  date: date("date"),
  flag: varchar("flag", { length: 32 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export * from "./mf-schema";
export * from "./terminal-schema";
export * from "./ai-ml-schema";
