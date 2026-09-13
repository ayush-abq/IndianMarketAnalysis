CREATE TABLE IF NOT EXISTS "stocks" (
  "id" serial PRIMARY KEY,
  "symbol" varchar(32) NOT NULL,
  "company_name" varchar(240),
  "isin" varchar(16),
  "exchange" varchar(8) NOT NULL DEFAULT 'NSE',
  "series" varchar(8) NOT NULL DEFAULT 'EQ',
  "sector" varchar(80),
  "industry" varchar(120),
  "market_cap_category" varchar(24),
  "index_memberships" jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "listing_date" date,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "stocks_symbol_uidx" ON "stocks" ("symbol","series");

CREATE TABLE IF NOT EXISTS "stock_prices" (
  "id" serial PRIMARY KEY,
  "stock_id" integer NOT NULL REFERENCES "stocks"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "open" numeric(18,4),
  "high" numeric(18,4),
  "low" numeric(18,4),
  "close" numeric(18,4) NOT NULL,
  "adjusted_close" numeric(18,4),
  "volume" numeric(20,2),
  "delivery_volume" numeric(20,2),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "stock_prices_uidx" ON "stock_prices" ("stock_id","date");
CREATE INDEX IF NOT EXISTS "stock_prices_idx" ON "stock_prices" ("stock_id","date");

CREATE TABLE IF NOT EXISTS "stock_scores" (
  "id" serial PRIMARY KEY,
  "stock_id" integer NOT NULL REFERENCES "stocks"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "close" numeric(18,4),
  "distance_from_ath" numeric(12,6),
  "return_1m" numeric(12,6),
  "return_3m" numeric(12,6),
  "return_1y" numeric(12,6),
  "return_3y" numeric(12,6),
  "return_5y" numeric(12,6),
  "price_vs_50" numeric(12,6),
  "price_vs_200" numeric(12,6),
  "rsi" numeric(8,4),
  "rs_score" numeric(8,4),
  "quality_score" numeric(8,4),
  "valuation_score" numeric(8,4),
  "earnings_score" numeric(8,4),
  "opportunity_score" numeric(8,4),
  "data_quality_score" numeric(8,4),
  "classification" varchar(48),
  "signal" varchar(48),
  "explanation" jsonb,
  "model_version" varchar(24) NOT NULL DEFAULT 'opp-v1.0'
);
CREATE UNIQUE INDEX IF NOT EXISTS "stock_scores_uidx" ON "stock_scores" ("stock_id","date");

CREATE TABLE IF NOT EXISTS "stock_fundamentals" (
  "id" serial PRIMARY KEY,
  "stock_id" integer NOT NULL REFERENCES "stocks"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "period" varchar(16) NOT NULL DEFAULT 'Q',
  "revenue" numeric(20,2),
  "ebitda" numeric(20,2),
  "pat" numeric(20,2),
  "eps" numeric(14,4),
  "ocf" numeric(20,2),
  "fcf" numeric(20,2),
  "pe" numeric(12,4),
  "pb" numeric(12,4),
  "ev_ebitda" numeric(12,4),
  "roe" numeric(10,4),
  "roce" numeric(10,4),
  "debt_equity" numeric(10,4),
  "source" varchar(64) NOT NULL DEFAULT 'unavailable',
  "source_date" date
);
CREATE UNIQUE INDEX IF NOT EXISTS "stock_fundamentals_uidx" ON "stock_fundamentals" ("stock_id","date","period");

CREATE TABLE IF NOT EXISTS "market_regime_snapshots" (
  "id" serial PRIMARY KEY,
  "date" date NOT NULL UNIQUE,
  "regime" varchar(32) NOT NULL,
  "score" numeric(8,4),
  "nifty50" numeric(18,4),
  "nifty50_return_1d" numeric(12,6),
  "nifty50_return_1y" numeric(12,6),
  "nifty50_drawdown" numeric(12,6),
  "india_vix" numeric(12,6),
  "sector_pct_above_50" numeric(8,4),
  "sector_pct_above_200" numeric(8,4),
  "sector_pct_below_30" numeric(8,4),
  "sector_pct_below_40" numeric(8,4),
  "recovering_sectors" integer,
  "falling_sectors" integer,
  "breadth_divergence" varchar(48),
  "explanation" jsonb,
  "model_version" varchar(24) NOT NULL DEFAULT 'regime-v1.0'
);

CREATE TABLE IF NOT EXISTS "research_signals" (
  "id" serial PRIMARY KEY,
  "date" date NOT NULL,
  "asset_type" varchar(16) NOT NULL,
  "asset_id" integer NOT NULL,
  "asset_name" varchar(240) NOT NULL,
  "screen" varchar(64) NOT NULL,
  "signal" varchar(64) NOT NULL,
  "score" numeric(8,4),
  "payload" jsonb,
  "model_version" varchar(24) NOT NULL DEFAULT 'opp-v1.0',
  "forward_1m" numeric(12,6),
  "forward_3m" numeric(12,6),
  "forward_6m" numeric(12,6),
  "forward_1y" numeric(12,6),
  "forward_filled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "research_signals_idx" ON "research_signals" ("date","asset_type","screen");

CREATE TABLE IF NOT EXISTS "backtest_runs" (
  "id" serial PRIMARY KEY,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "name" varchar(160),
  "universe" varchar(32) NOT NULL,
  "conditions" jsonb NOT NULL,
  "hold_trading_days" integer NOT NULL,
  "from_date" date NOT NULL,
  "to_date" date NOT NULL,
  "model_version" varchar(24) NOT NULL DEFAULT 'lab-v1.0',
  "result" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "watchlist_items" (
  "id" serial PRIMARY KEY,
  "list_name" varchar(48) NOT NULL DEFAULT 'WATCHLIST',
  "asset_type" varchar(16) NOT NULL,
  "asset_id" integer NOT NULL,
  "asset_name" varchar(240) NOT NULL,
  "thesis" text,
  "entry_price" numeric(18,4),
  "invalidation" text,
  "notes" text,
  "status" varchar(32) NOT NULL DEFAULT 'WATCHLIST',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "watchlist_uidx" ON "watchlist_items" ("list_name","asset_type","asset_id");

CREATE TABLE IF NOT EXISTS "thesis_checks" (
  "id" serial PRIMARY KEY,
  "watchlist_id" integer NOT NULL REFERENCES "watchlist_items"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "condition" varchar(80) NOT NULL,
  "status" varchar(16) NOT NULL,
  "detail" text
);

CREATE TABLE IF NOT EXISTS "paper_positions" (
  "id" serial PRIMARY KEY,
  "asset_type" varchar(16) NOT NULL,
  "asset_id" integer NOT NULL,
  "asset_name" varchar(240) NOT NULL,
  "side" varchar(8) NOT NULL DEFAULT 'LONG',
  "quantity" numeric(18,4) NOT NULL,
  "entry_date" date NOT NULL,
  "entry_price" numeric(18,4) NOT NULL,
  "exit_date" date,
  "exit_price" numeric(18,4),
  "reason" text,
  "score_at_entry" numeric(8,4),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "research_journal" (
  "id" serial PRIMARY KEY,
  "date" date NOT NULL,
  "asset_type" varchar(16),
  "asset_id" integer,
  "asset_name" varchar(240),
  "thesis" text,
  "evidence" text,
  "decision" text,
  "outcome" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "model_versions" (
  "id" serial PRIMARY KEY,
  "name" varchar(64) NOT NULL,
  "version" varchar(24) NOT NULL,
  "parameters" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "corporate_actions" (
  "id" serial PRIMARY KEY,
  "stock_id" integer NOT NULL REFERENCES "stocks"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "action_type" varchar(32) NOT NULL,
  "ratio" varchar(32),
  "factor" numeric(16,8),
  "source" varchar(64) NOT NULL DEFAULT 'unavailable',
  "source_date" date,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_actions_uidx" ON "corporate_actions" ("stock_id","date","action_type");

CREATE TABLE IF NOT EXISTS "institutional_flows" (
  "id" serial PRIMARY KEY,
  "date" date NOT NULL,
  "fii_net" numeric(18,2),
  "dii_net" numeric(18,2),
  "source" varchar(64) NOT NULL DEFAULT 'unavailable',
  "source_date" date
);
CREATE UNIQUE INDEX IF NOT EXISTS "institutional_flows_uidx" ON "institutional_flows" ("date");

CREATE TABLE IF NOT EXISTS "research_portfolios" (
  "id" serial PRIMARY KEY,
  "name" varchar(120) NOT NULL,
  "kind" varchar(24) NOT NULL DEFAULT 'RESEARCH',
  "notes" text,
  "risk_limits" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "research_portfolio_legs" (
  "id" serial PRIMARY KEY,
  "portfolio_id" integer NOT NULL REFERENCES "research_portfolios"("id") ON DELETE CASCADE,
  "asset_type" varchar(16) NOT NULL,
  "asset_id" integer NOT NULL,
  "asset_name" varchar(240) NOT NULL,
  "weight_pct" numeric(8,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS "daily_briefs" (
  "id" serial PRIMARY KEY,
  "date" date NOT NULL,
  "kind" varchar(16) NOT NULL,
  "title" varchar(200) NOT NULL,
  "body" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "daily_briefs_uidx" ON "daily_briefs" ("date","kind");
