CREATE TABLE IF NOT EXISTS "indices" (
  "id" serial PRIMARY KEY,
  "name" varchar(160) NOT NULL,
  "symbol" varchar(64) NOT NULL,
  "nse_name" varchar(160) NOT NULL,
  "yahoo_symbol" varchar(64),
  "category" varchar(64) NOT NULL,
  "subcategory" varchar(64) NOT NULL,
  "provider" varchar(64) NOT NULL DEFAULT 'NSE_OFFICIAL_EOD',
  "data_source" varchar(64) NOT NULL DEFAULT 'NSE_OFFICIAL_EOD',
  "inception_date" date,
  "currency" varchar(8) NOT NULL DEFAULT 'INR',
  "description" text,
  "is_benchmark" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "indices_symbol_uidx" ON "indices" ("symbol");
CREATE UNIQUE INDEX IF NOT EXISTS "indices_nse_name_uidx" ON "indices" ("nse_name");

CREATE TABLE IF NOT EXISTS "index_prices" (
  "id" serial PRIMARY KEY,
  "index_id" integer NOT NULL REFERENCES "indices"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "open" numeric(18,4),
  "high" numeric(18,4),
  "low" numeric(18,4),
  "close" numeric(18,4) NOT NULL,
  "volume" numeric(20,2),
  "return_type" varchar(4) NOT NULL DEFAULT 'PR',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "index_prices_uidx" ON "index_prices" ("index_id","date","return_type");
CREATE INDEX IF NOT EXISTS "index_prices_idx" ON "index_prices" ("index_id","date");

CREATE TABLE IF NOT EXISTS "index_returns" (
  "id" serial PRIMARY KEY,
  "index_id" integer NOT NULL REFERENCES "indices"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "return_type" varchar(4) NOT NULL DEFAULT 'PR',
  "return_1d" numeric(12,6),
  "return_1w" numeric(12,6),
  "return_1m" numeric(12,6),
  "return_3m" numeric(12,6),
  "return_6m" numeric(12,6),
  "return_1y" numeric(12,6),
  "return_2y" numeric(12,6),
  "return_3y" numeric(12,6),
  "return_5y" numeric(12,6),
  "return_since_inception" numeric(14,6),
  "return_5d" numeric(12,6),
  "return_20d" numeric(12,6),
  "return_50d" numeric(12,6),
  "return_100d" numeric(12,6),
  "return_200d" numeric(12,6)
);
CREATE UNIQUE INDEX IF NOT EXISTS "index_returns_uidx" ON "index_returns" ("index_id","date","return_type");
CREATE INDEX IF NOT EXISTS "index_returns_idx" ON "index_returns" ("index_id","date");

CREATE TABLE IF NOT EXISTS "index_drawdowns" (
  "id" serial PRIMARY KEY,
  "index_id" integer NOT NULL REFERENCES "indices"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "return_type" varchar(4) NOT NULL DEFAULT 'PR',
  "current_close" numeric(18,4) NOT NULL,
  "all_time_high" numeric(18,4) NOT NULL,
  "ath_date" date NOT NULL,
  "intraday_ath" numeric(18,4),
  "intraday_ath_date" date,
  "drawdown_percent" numeric(12,6) NOT NULL,
  "drawdown_amount" numeric(18,4) NOT NULL,
  "distance_from_ath_percent" numeric(12,6) NOT NULL,
  "high_52w" numeric(18,4),
  "low_52w" numeric(18,4),
  "drawdown_52w_percent" numeric(12,6),
  "max_historical_drawdown" numeric(12,6),
  "max_historical_drawdown_date" date,
  "trough_close" numeric(18,4),
  "trough_date" date,
  "recovery_from_trough_pct" numeric(12,6),
  "days_below_40" integer,
  "days_below_30" integer,
  "prior_drawdowns_30" integer,
  "prior_drawdowns_40" integer,
  "prior_drawdowns_50" integer,
  "avg_recovery_days_20" numeric(10,2),
  "avg_recovery_days_30" numeric(10,2),
  "avg_recovery_days_40" numeric(10,2),
  "avg_recovery_days_50" numeric(10,2),
  "drawdown_percentile" numeric(8,4)
);
CREATE UNIQUE INDEX IF NOT EXISTS "index_drawdowns_uidx" ON "index_drawdowns" ("index_id","date","return_type");
CREATE INDEX IF NOT EXISTS "index_drawdowns_idx" ON "index_drawdowns" ("index_id","date");

CREATE TABLE IF NOT EXISTS "index_scores" (
  "id" serial PRIMARY KEY,
  "index_id" integer NOT NULL REFERENCES "indices"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "return_type" varchar(4) NOT NULL DEFAULT 'PR',
  "drawdown_score" numeric(8,4),
  "drawdown_score_continuous" numeric(8,4),
  "momentum_score" numeric(8,4),
  "return_score" numeric(8,4),
  "trend_score" numeric(8,4),
  "recovery_score" numeric(8,4),
  "capitulation_score" numeric(8,4),
  "weakness_score" numeric(8,4),
  "relative_strength_score" numeric(8,4),
  "breadth_score" numeric(8,4),
  "opportunity_score" numeric(8,4),
  "overall_score" numeric(8,4),
  "classification" varchar(64) NOT NULL,
  "trend_state" varchar(32),
  "signal" varchar(64),
  "regime" varchar(16),
  "ma20" numeric(18,4),
  "ma50" numeric(18,4),
  "ma100" numeric(18,4),
  "ma200" numeric(18,4),
  "price_vs_50" numeric(12,6),
  "price_vs_100" numeric(12,6),
  "price_vs_200" numeric(12,6),
  "ma50_slope" numeric(12,6),
  "ma100_slope" numeric(12,6),
  "ma200_slope" numeric(12,6),
  "rs_1m_nifty50" numeric(12,6),
  "rs_3m_nifty50" numeric(12,6),
  "rs_6m_nifty50" numeric(12,6),
  "rs_1y_nifty50" numeric(12,6),
  "rs_1m_nifty500" numeric(12,6),
  "rs_3m_nifty500" numeric(12,6),
  "rs_6m_nifty500" numeric(12,6),
  "rs_1y_nifty500" numeric(12,6),
  "volatility_20d" numeric(12,6),
  "research_note" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "index_scores_uidx" ON "index_scores" ("index_id","date","return_type");
CREATE INDEX IF NOT EXISTS "index_scores_idx" ON "index_scores" ("index_id","date");

CREATE TABLE IF NOT EXISTS "daily_snapshots" (
  "id" serial PRIMARY KEY,
  "index_id" integer NOT NULL REFERENCES "indices"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "return_type" varchar(4) NOT NULL DEFAULT 'PR',
  "payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "daily_snapshots_uidx" ON "daily_snapshots" ("index_id","date","return_type");
CREATE INDEX IF NOT EXISTS "daily_snapshots_idx" ON "daily_snapshots" ("index_id","date");

CREATE TABLE IF NOT EXISTS "data_ingestion_runs" (
  "id" serial PRIMARY KEY,
  "provider" varchar(64) NOT NULL,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "status" varchar(32) NOT NULL,
  "records_downloaded" integer NOT NULL DEFAULT 0,
  "records_inserted" integer NOT NULL DEFAULT 0,
  "records_updated" integer NOT NULL DEFAULT 0,
  "failed_records" integer NOT NULL DEFAULT 0,
  "error_message" text,
  "job_key" varchar(80),
  "details" jsonb
);

CREATE TABLE IF NOT EXISTS "alerts" (
  "id" serial PRIMARY KEY,
  "index_id" integer REFERENCES "indices"("id") ON DELETE SET NULL,
  "date" date NOT NULL,
  "alert_type" varchar(64) NOT NULL,
  "severity" varchar(16) NOT NULL,
  "message" text NOT NULL,
  "acknowledged" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "alerts_date_idx" ON "alerts" ("date");

CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" serial PRIMARY KEY,
  "key" varchar(64) NOT NULL UNIQUE,
  "value" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "market_holidays" (
  "id" serial PRIMARY KEY,
  "date" date NOT NULL UNIQUE,
  "name" varchar(160) NOT NULL,
  "market" varchar(16) NOT NULL DEFAULT 'NSE'
);

CREATE TABLE IF NOT EXISTS "constituents" (
  "id" serial PRIMARY KEY,
  "index_id" integer NOT NULL REFERENCES "indices"("id") ON DELETE CASCADE,
  "as_of_date" date NOT NULL,
  "symbol" varchar(32) NOT NULL,
  "name" varchar(160),
  "weight" numeric(10,6),
  "market_cap" numeric(20,2)
);
CREATE UNIQUE INDEX IF NOT EXISTS "constituents_uidx" ON "constituents" ("index_id","as_of_date","symbol");

CREATE TABLE IF NOT EXISTS "constituent_metrics" (
  "id" serial PRIMARY KEY,
  "index_id" integer NOT NULL REFERENCES "indices"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "symbol" varchar(32) NOT NULL,
  "close" numeric(18,4),
  "return_1y" numeric(12,6),
  "distance_from_ath" numeric(12,6),
  "above_50dma" boolean,
  "above_200dma" boolean
);
CREATE UNIQUE INDEX IF NOT EXISTS "constituent_metrics_uidx" ON "constituent_metrics" ("index_id","date","symbol");

CREATE TABLE IF NOT EXISTS "index_breadth" (
  "id" serial PRIMARY KEY,
  "index_id" integer NOT NULL REFERENCES "indices"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "constituent_count" integer,
  "pct_below_10" numeric(8,4),
  "pct_below_20" numeric(8,4),
  "pct_below_30" numeric(8,4),
  "pct_below_40" numeric(8,4),
  "pct_below_50" numeric(8,4),
  "pct_above_50dma" numeric(8,4),
  "pct_above_200dma" numeric(8,4),
  "breadth_score" numeric(8,4)
);
CREATE UNIQUE INDEX IF NOT EXISTS "index_breadth_uidx" ON "index_breadth" ("index_id","date");

CREATE TABLE IF NOT EXISTS "data_quality_flags" (
  "id" serial PRIMARY KEY,
  "index_id" integer REFERENCES "indices"("id") ON DELETE CASCADE,
  "date" date,
  "flag" varchar(32) NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
