CREATE TABLE IF NOT EXISTS "feature_snapshots" (
  "id" serial PRIMARY KEY,
  "entity_type" varchar(16) NOT NULL,
  "entity_id" integer NOT NULL,
  "entity_name" varchar(240) NOT NULL,
  "feature_date" date NOT NULL,
  "available_at" date NOT NULL,
  "feature_set_version" varchar(24) NOT NULL,
  "features" jsonb NOT NULL,
  "sources" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "feature_snapshots_uidx" ON "feature_snapshots" ("entity_type","entity_id","feature_date","feature_set_version");
CREATE INDEX IF NOT EXISTS "feature_snapshots_date_idx" ON "feature_snapshots" ("feature_date");

CREATE TABLE IF NOT EXISTS "ml_model_registry" (
  "id" serial PRIMARY KEY,
  "model_id" varchar(80) NOT NULL,
  "model_type" varchar(48) NOT NULL,
  "version" varchar(32) NOT NULL,
  "target" varchar(48) NOT NULL,
  "feature_set_version" varchar(24) NOT NULL,
  "training_period" varchar(64),
  "validation_period" varchar(64),
  "test_period" varchar(64),
  "hyperparameters" jsonb,
  "metrics" jsonb,
  "artifact" jsonb,
  "known_limitations" text,
  "status" varchar(24) NOT NULL DEFAULT 'EXPERIMENTAL',
  "trained_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ml_model_registry_uidx" ON "ml_model_registry" ("model_id","version","target");

CREATE TABLE IF NOT EXISTS "ml_training_runs" (
  "id" serial PRIMARY KEY,
  "run_id" varchar(64) NOT NULL,
  "fold" varchar(64),
  "model_type" varchar(48) NOT NULL,
  "target" varchar(48) NOT NULL,
  "train_from" date,
  "train_to" date,
  "validate_from" date,
  "validate_to" date,
  "test_from" date,
  "test_to" date,
  "sample_train" integer,
  "sample_validate" integer,
  "sample_test" integer,
  "metrics" jsonb,
  "status" varchar(24) NOT NULL DEFAULT 'COMPLETED',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ml_predictions" (
  "id" serial PRIMARY KEY,
  "model_id" varchar(80) NOT NULL,
  "version" varchar(32) NOT NULL,
  "entity_type" varchar(16) NOT NULL,
  "entity_id" integer NOT NULL,
  "entity_name" varchar(240) NOT NULL,
  "as_of" date NOT NULL,
  "target" varchar(48) NOT NULL,
  "raw_probability" numeric(12,6),
  "calibrated_probability" numeric(12,6),
  "predicted_return" numeric(12,6),
  "actual_return" numeric(12,6),
  "actual_drawdown" numeric(12,6),
  "regime" varchar(32),
  "sector" varchar(80),
  "features" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ml_predictions_uidx" ON "ml_predictions" ("model_id","version","entity_type","entity_id","as_of","target");
CREATE INDEX IF NOT EXISTS "ml_predictions_asof_idx" ON "ml_predictions" ("as_of");

CREATE TABLE IF NOT EXISTS "ai_research_memory" (
  "id" serial PRIMARY KEY,
  "entity_type" varchar(16) NOT NULL,
  "entity_id" integer NOT NULL,
  "as_of" date NOT NULL,
  "role" varchar(24) NOT NULL,
  "thesis" text,
  "analysis" jsonb,
  "prediction" jsonb,
  "actual_outcome" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_prediction_scorecard" (
  "id" serial PRIMARY KEY,
  "prediction_date" date NOT NULL,
  "entity_type" varchar(16) NOT NULL,
  "entity_id" integer NOT NULL,
  "entity_name" varchar(240) NOT NULL,
  "ml_model" varchar(80),
  "llm_model" varchar(80),
  "prediction" jsonb,
  "probability" numeric(12,6),
  "reason" text,
  "actual_outcome" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "rag_documents" (
  "id" serial PRIMARY KEY,
  "source" varchar(120) NOT NULL,
  "title" varchar(240) NOT NULL,
  "document_type" varchar(48) NOT NULL,
  "company" varchar(160),
  "document_date" date,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "rag_chunks" (
  "id" serial PRIMARY KEY,
  "document_id" integer NOT NULL REFERENCES "rag_documents"("id") ON DELETE CASCADE,
  "chunk_index" integer NOT NULL,
  "text" text NOT NULL,
  "embedding" jsonb,
  "embedding_model" varchar(80)
);
CREATE UNIQUE INDEX IF NOT EXISTS "rag_chunks_uidx" ON "rag_chunks" ("document_id","chunk_index");

CREATE TABLE IF NOT EXISTS "ai_debate_runs" (
  "id" serial PRIMARY KEY,
  "entity_type" varchar(16) NOT NULL,
  "entity_id" integer NOT NULL,
  "as_of" date NOT NULL,
  "analyst" jsonb,
  "critic" jsonb,
  "synthesis" jsonb,
  "confidence" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
