CREATE TABLE IF NOT EXISTS "mutual_funds" (
  "id" serial PRIMARY KEY,
  "scheme_name" varchar(320) NOT NULL,
  "amc_name" varchar(160),
  "scheme_code" varchar(16) NOT NULL,
  "isin" varchar(16),
  "isin_reinvest" varchar(16),
  "plan" varchar(16) NOT NULL DEFAULT 'UNKNOWN',
  "option" varchar(16) NOT NULL DEFAULT 'UNKNOWN',
  "asset_class" varchar(32) NOT NULL DEFAULT 'OTHER',
  "category" varchar(80) NOT NULL DEFAULT 'Unclassified',
  "subcategory" varchar(80),
  "scheme_type" varchar(64),
  "benchmark" varchar(160),
  "inception_date" date,
  "fund_manager" varchar(160),
  "manager_tenure_years" numeric(8,2),
  "riskometer" varchar(32),
  "status" varchar(24) NOT NULL DEFAULT 'active',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_funds_scheme_code_uidx" ON "mutual_funds" ("scheme_code");

CREATE TABLE IF NOT EXISTS "mutual_fund_nav" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "nav" numeric(18,6) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_nav_uidx" ON "mutual_fund_nav" ("fund_id","date");
CREATE INDEX IF NOT EXISTS "mutual_fund_nav_idx" ON "mutual_fund_nav" ("fund_id","date");

CREATE TABLE IF NOT EXISTS "mutual_fund_returns" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "return_1m" numeric(12,6),
  "return_3m" numeric(12,6),
  "return_6m" numeric(12,6),
  "return_1y" numeric(12,6),
  "return_2y" numeric(12,6),
  "return_3y" numeric(12,6),
  "return_5y" numeric(12,6),
  "return_7y" numeric(12,6),
  "return_10y" numeric(12,6),
  "return_since_inception" numeric(14,6),
  "cagr_2y" numeric(12,6),
  "cagr_3y" numeric(12,6),
  "cagr_5y" numeric(12,6),
  "cagr_7y" numeric(12,6),
  "cagr_10y" numeric(12,6),
  "cagr_since_inception" numeric(12,6)
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_returns_uidx" ON "mutual_fund_returns" ("fund_id","date");

CREATE TABLE IF NOT EXISTS "mutual_fund_risk" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "volatility" numeric(12,6),
  "standard_deviation" numeric(12,6),
  "beta" numeric(12,6),
  "sharpe" numeric(12,6),
  "sortino" numeric(12,6),
  "alpha" numeric(12,6),
  "treynor" numeric(12,6),
  "downside_deviation" numeric(12,6),
  "max_drawdown" numeric(12,6),
  "current_drawdown" numeric(12,6),
  "calmar_ratio" numeric(12,6),
  "upside_capture" numeric(12,6),
  "downside_capture" numeric(12,6),
  "recovery_days" integer,
  "worst_1y" numeric(12,6),
  "worst_3y" numeric(12,6),
  "worst_calendar_year" numeric(12,6)
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_risk_uidx" ON "mutual_fund_risk" ("fund_id","date");

CREATE TABLE IF NOT EXISTS "mutual_fund_sip" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "amount" numeric(14,2) NOT NULL DEFAULT 10000,
  "frequency" varchar(16) NOT NULL DEFAULT 'monthly',
  "sip_1y_xirr" numeric(12,6),
  "sip_3y_xirr" numeric(12,6),
  "sip_5y_xirr" numeric(12,6),
  "sip_7y_xirr" numeric(12,6),
  "sip_10y_xirr" numeric(12,6),
  "payload" jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_sip_uidx" ON "mutual_fund_sip" ("fund_id","date","amount","frequency");

CREATE TABLE IF NOT EXISTS "mutual_fund_rolling" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "window_years" integer NOT NULL,
  "avg" numeric(12,6),
  "median" numeric(12,6),
  "min" numeric(12,6),
  "max" numeric(12,6),
  "stdev" numeric(12,6),
  "beat_benchmark_pct" numeric(8,4),
  "positive_pct" numeric(8,4)
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_rolling_uidx" ON "mutual_fund_rolling" ("fund_id","date","window_years");

CREATE TABLE IF NOT EXISTS "mutual_fund_portfolio" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "stock_count" integer,
  "cash_percent" numeric(8,4),
  "equity_percent" numeric(8,4),
  "debt_percent" numeric(8,4),
  "top_5_percent" numeric(8,4),
  "top_10_percent" numeric(8,4),
  "sector_concentration" numeric(8,4),
  "market_cap_distribution" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_portfolio_uidx" ON "mutual_fund_portfolio" ("fund_id","date");

CREATE TABLE IF NOT EXISTS "mutual_fund_holdings" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "security_name" varchar(240) NOT NULL,
  "isin" varchar(16),
  "weight" numeric(10,6),
  "sector" varchar(80),
  "market_cap" varchar(24),
  "quantity" numeric(20,2)
);
CREATE INDEX IF NOT EXISTS "mutual_fund_holdings_idx" ON "mutual_fund_holdings" ("fund_id","date");

CREATE TABLE IF NOT EXISTS "mutual_fund_expenses" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "expense_ratio" numeric(8,4),
  "direct_expense_ratio" numeric(8,4),
  "regular_expense_ratio" numeric(8,4),
  "exit_load" text,
  "stamp_duty" numeric(8,4),
  "other_costs" numeric(8,4)
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_expenses_uidx" ON "mutual_fund_expenses" ("fund_id","date");

CREATE TABLE IF NOT EXISTS "mutual_fund_aum" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "aum" numeric(18,4)
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_aum_uidx" ON "mutual_fund_aum" ("fund_id","date");

CREATE TABLE IF NOT EXISTS "mutual_fund_benchmarks" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "benchmark_name" varchar(160) NOT NULL,
  "benchmark_return" numeric(12,6),
  "fund_return" numeric(12,6),
  "excess_return" numeric(12,6),
  "period" varchar(16) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_benchmarks_uidx" ON "mutual_fund_benchmarks" ("fund_id","date","period","benchmark_name");

CREATE TABLE IF NOT EXISTS "mutual_fund_scores" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "return_score" numeric(8,4),
  "risk_score" numeric(8,4),
  "consistency_score" numeric(8,4),
  "drawdown_score" numeric(8,4),
  "expense_score" numeric(8,4),
  "benchmark_score" numeric(8,4),
  "portfolio_score" numeric(8,4),
  "manager_score" numeric(8,4),
  "downside_score" numeric(8,4),
  "market_cycle_score" numeric(8,4),
  "sector_alignment_score" numeric(8,4),
  "overall_score" numeric(8,4),
  "classification" varchar(48) NOT NULL,
  "signal" varchar(48),
  "explanation" jsonb,
  "category_percentiles" jsonb,
  "research_note" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "mutual_fund_scores_uidx" ON "mutual_fund_scores" ("fund_id","date");

CREATE TABLE IF NOT EXISTS "mutual_fund_freshness" (
  "id" serial PRIMARY KEY,
  "fund_id" integer NOT NULL UNIQUE REFERENCES "mutual_funds"("id") ON DELETE CASCADE,
  "nav_updated" date,
  "portfolio_updated" date,
  "aum_updated" date,
  "ter_updated" date,
  "riskometer_updated" date,
  "manager_updated" date
);
