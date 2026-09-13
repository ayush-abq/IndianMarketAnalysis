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

export const mutualFunds = pgTable(
  "mutual_funds",
  {
    id: serial("id").primaryKey(),
    schemeName: varchar("scheme_name", { length: 320 }).notNull(),
    amcName: varchar("amc_name", { length: 160 }),
    schemeCode: varchar("scheme_code", { length: 16 }).notNull(),
    isin: varchar("isin", { length: 16 }),
    isinReinvest: varchar("isin_reinvest", { length: 16 }),
    plan: varchar("plan", { length: 16 }).notNull().default("UNKNOWN"),
    option: varchar("option", { length: 16 }).notNull().default("UNKNOWN"),
    assetClass: varchar("asset_class", { length: 32 }).notNull().default("OTHER"),
    category: varchar("category", { length: 80 }).notNull().default("Unclassified"),
    subcategory: varchar("subcategory", { length: 80 }),
    schemeType: varchar("scheme_type", { length: 64 }),
    benchmark: varchar("benchmark", { length: 160 }),
    inceptionDate: date("inception_date"),
    fundManager: varchar("fund_manager", { length: 160 }),
    managerTenureYears: numeric("manager_tenure_years", { precision: 8, scale: 2 }),
    riskometer: varchar("riskometer", { length: 32 }),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mutual_funds_scheme_code_uidx").on(t.schemeCode)],
);

export const mutualFundNav = pgTable(
  "mutual_fund_nav",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    nav: numeric("nav", { precision: 18, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mutual_fund_nav_uidx").on(t.fundId, t.date),
    index("mutual_fund_nav_idx").on(t.fundId, t.date),
  ],
);

export const mutualFundReturns = pgTable(
  "mutual_fund_returns",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    return1m: numeric("return_1m", { precision: 12, scale: 6 }),
    return3m: numeric("return_3m", { precision: 12, scale: 6 }),
    return6m: numeric("return_6m", { precision: 12, scale: 6 }),
    return1y: numeric("return_1y", { precision: 12, scale: 6 }),
    return2y: numeric("return_2y", { precision: 12, scale: 6 }),
    return3y: numeric("return_3y", { precision: 12, scale: 6 }),
    return5y: numeric("return_5y", { precision: 12, scale: 6 }),
    return7y: numeric("return_7y", { precision: 12, scale: 6 }),
    return10y: numeric("return_10y", { precision: 12, scale: 6 }),
    returnSinceInception: numeric("return_since_inception", { precision: 14, scale: 6 }),
    cagr2y: numeric("cagr_2y", { precision: 12, scale: 6 }),
    cagr3y: numeric("cagr_3y", { precision: 12, scale: 6 }),
    cagr5y: numeric("cagr_5y", { precision: 12, scale: 6 }),
    cagr7y: numeric("cagr_7y", { precision: 12, scale: 6 }),
    cagr10y: numeric("cagr_10y", { precision: 12, scale: 6 }),
    cagrSinceInception: numeric("cagr_since_inception", { precision: 12, scale: 6 }),
  },
  (t) => [uniqueIndex("mutual_fund_returns_uidx").on(t.fundId, t.date)],
);

export const mutualFundRisk = pgTable(
  "mutual_fund_risk",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    volatility: numeric("volatility", { precision: 12, scale: 6 }),
    standardDeviation: numeric("standard_deviation", { precision: 12, scale: 6 }),
    beta: numeric("beta", { precision: 12, scale: 6 }),
    sharpe: numeric("sharpe", { precision: 12, scale: 6 }),
    sortino: numeric("sortino", { precision: 12, scale: 6 }),
    alpha: numeric("alpha", { precision: 12, scale: 6 }),
    treynor: numeric("treynor", { precision: 12, scale: 6 }),
    downsideDeviation: numeric("downside_deviation", { precision: 12, scale: 6 }),
    maxDrawdown: numeric("max_drawdown", { precision: 12, scale: 6 }),
    currentDrawdown: numeric("current_drawdown", { precision: 12, scale: 6 }),
    calmarRatio: numeric("calmar_ratio", { precision: 12, scale: 6 }),
    upsideCapture: numeric("upside_capture", { precision: 12, scale: 6 }),
    downsideCapture: numeric("downside_capture", { precision: 12, scale: 6 }),
    recoveryDays: integer("recovery_days"),
    worst1y: numeric("worst_1y", { precision: 12, scale: 6 }),
    worst3y: numeric("worst_3y", { precision: 12, scale: 6 }),
    worstCalendarYear: numeric("worst_calendar_year", { precision: 12, scale: 6 }),
  },
  (t) => [uniqueIndex("mutual_fund_risk_uidx").on(t.fundId, t.date)],
);

export const mutualFundSip = pgTable(
  "mutual_fund_sip",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("10000"),
    frequency: varchar("frequency", { length: 16 }).notNull().default("monthly"),
    sip1yXirr: numeric("sip_1y_xirr", { precision: 12, scale: 6 }),
    sip3yXirr: numeric("sip_3y_xirr", { precision: 12, scale: 6 }),
    sip5yXirr: numeric("sip_5y_xirr", { precision: 12, scale: 6 }),
    sip7yXirr: numeric("sip_7y_xirr", { precision: 12, scale: 6 }),
    sip10yXirr: numeric("sip_10y_xirr", { precision: 12, scale: 6 }),
    payload: jsonb("payload"),
  },
  (t) => [uniqueIndex("mutual_fund_sip_uidx").on(t.fundId, t.date, t.amount, t.frequency)],
);

export const mutualFundRolling = pgTable(
  "mutual_fund_rolling",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    windowYears: integer("window_years").notNull(),
    avg: numeric("avg", { precision: 12, scale: 6 }),
    median: numeric("median", { precision: 12, scale: 6 }),
    min: numeric("min", { precision: 12, scale: 6 }),
    max: numeric("max", { precision: 12, scale: 6 }),
    stdev: numeric("stdev", { precision: 12, scale: 6 }),
    beatBenchmarkPct: numeric("beat_benchmark_pct", { precision: 8, scale: 4 }),
    positivePct: numeric("positive_pct", { precision: 8, scale: 4 }),
  },
  (t) => [uniqueIndex("mutual_fund_rolling_uidx").on(t.fundId, t.date, t.windowYears)],
);

export const mutualFundPortfolio = pgTable(
  "mutual_fund_portfolio",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    stockCount: integer("stock_count"),
    cashPercent: numeric("cash_percent", { precision: 8, scale: 4 }),
    equityPercent: numeric("equity_percent", { precision: 8, scale: 4 }),
    debtPercent: numeric("debt_percent", { precision: 8, scale: 4 }),
    top5Percent: numeric("top_5_percent", { precision: 8, scale: 4 }),
    top10Percent: numeric("top_10_percent", { precision: 8, scale: 4 }),
    sectorConcentration: numeric("sector_concentration", { precision: 8, scale: 4 }),
    marketCapDistribution: jsonb("market_cap_distribution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mutual_fund_portfolio_uidx").on(t.fundId, t.date)],
);

export const mutualFundHoldings = pgTable(
  "mutual_fund_holdings",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    securityName: varchar("security_name", { length: 240 }).notNull(),
    isin: varchar("isin", { length: 16 }),
    weight: numeric("weight", { precision: 10, scale: 6 }),
    sector: varchar("sector", { length: 80 }),
    marketCap: varchar("market_cap", { length: 24 }),
    quantity: numeric("quantity", { precision: 20, scale: 2 }),
  },
  (t) => [index("mutual_fund_holdings_idx").on(t.fundId, t.date)],
);

export const mutualFundExpenses = pgTable(
  "mutual_fund_expenses",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    expenseRatio: numeric("expense_ratio", { precision: 8, scale: 4 }),
    directExpenseRatio: numeric("direct_expense_ratio", { precision: 8, scale: 4 }),
    regularExpenseRatio: numeric("regular_expense_ratio", { precision: 8, scale: 4 }),
    exitLoad: text("exit_load"),
    stampDuty: numeric("stamp_duty", { precision: 8, scale: 4 }),
    otherCosts: numeric("other_costs", { precision: 8, scale: 4 }),
  },
  (t) => [uniqueIndex("mutual_fund_expenses_uidx").on(t.fundId, t.date)],
);

export const mutualFundAum = pgTable(
  "mutual_fund_aum",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    aum: numeric("aum", { precision: 18, scale: 4 }),
  },
  (t) => [uniqueIndex("mutual_fund_aum_uidx").on(t.fundId, t.date)],
);

export const mutualFundBenchmarks = pgTable(
  "mutual_fund_benchmarks",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    benchmarkName: varchar("benchmark_name", { length: 160 }).notNull(),
    benchmarkReturn: numeric("benchmark_return", { precision: 12, scale: 6 }),
    fundReturn: numeric("fund_return", { precision: 12, scale: 6 }),
    excessReturn: numeric("excess_return", { precision: 12, scale: 6 }),
    period: varchar("period", { length: 16 }).notNull(),
  },
  (t) => [uniqueIndex("mutual_fund_benchmarks_uidx").on(t.fundId, t.date, t.period, t.benchmarkName)],
);

export const mutualFundScores = pgTable(
  "mutual_fund_scores",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => mutualFunds.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    returnScore: numeric("return_score", { precision: 8, scale: 4 }),
    riskScore: numeric("risk_score", { precision: 8, scale: 4 }),
    consistencyScore: numeric("consistency_score", { precision: 8, scale: 4 }),
    drawdownScore: numeric("drawdown_score", { precision: 8, scale: 4 }),
    expenseScore: numeric("expense_score", { precision: 8, scale: 4 }),
    benchmarkScore: numeric("benchmark_score", { precision: 8, scale: 4 }),
    portfolioScore: numeric("portfolio_score", { precision: 8, scale: 4 }),
    managerScore: numeric("manager_score", { precision: 8, scale: 4 }),
    downsideScore: numeric("downside_score", { precision: 8, scale: 4 }),
    marketCycleScore: numeric("market_cycle_score", { precision: 8, scale: 4 }),
    sectorAlignmentScore: numeric("sector_alignment_score", { precision: 8, scale: 4 }),
    overallScore: numeric("overall_score", { precision: 8, scale: 4 }),
    classification: varchar("classification", { length: 48 }).notNull(),
    signal: varchar("signal", { length: 48 }),
    explanation: jsonb("explanation"),
    categoryPercentiles: jsonb("category_percentiles"),
    researchNote: text("research_note"),
  },
  (t) => [uniqueIndex("mutual_fund_scores_uidx").on(t.fundId, t.date)],
);

export const mutualFundFreshness = pgTable("mutual_fund_freshness", {
  id: serial("id").primaryKey(),
  fundId: integer("fund_id")
    .notNull()
    .references(() => mutualFunds.id, { onDelete: "cascade" })
    .unique(),
  navUpdated: date("nav_updated"),
  portfolioUpdated: date("portfolio_updated"),
  aumUpdated: date("aum_updated"),
  terUpdated: date("ter_updated"),
  riskometerUpdated: date("riskometer_updated"),
  managerUpdated: date("manager_updated"),
});
