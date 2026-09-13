import { date, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const featureSnapshots = pgTable(
  "feature_snapshots",
  {
    id: serial("id").primaryKey(),
    entityType: varchar("entity_type", { length: 16 }).notNull(),
    entityId: integer("entity_id").notNull(),
    entityName: varchar("entity_name", { length: 240 }).notNull(),
    featureDate: date("feature_date").notNull(),
    availableAt: date("available_at").notNull(),
    featureSetVersion: varchar("feature_set_version", { length: 24 }).notNull(),
    features: jsonb("features").notNull(),
    sources: jsonb("sources"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("feature_snapshots_uidx").on(t.entityType, t.entityId, t.featureDate, t.featureSetVersion),
    index("feature_snapshots_date_idx").on(t.featureDate),
  ],
);

export const mlModelRegistry = pgTable(
  "ml_model_registry",
  {
    id: serial("id").primaryKey(),
    modelId: varchar("model_id", { length: 80 }).notNull(),
    modelType: varchar("model_type", { length: 48 }).notNull(),
    version: varchar("version", { length: 32 }).notNull(),
    target: varchar("target", { length: 48 }).notNull(),
    featureSetVersion: varchar("feature_set_version", { length: 24 }).notNull(),
    trainingPeriod: varchar("training_period", { length: 64 }),
    validationPeriod: varchar("validation_period", { length: 64 }),
    testPeriod: varchar("test_period", { length: 64 }),
    hyperparameters: jsonb("hyperparameters"),
    metrics: jsonb("metrics"),
    artifact: jsonb("artifact"),
    knownLimitations: text("known_limitations"),
    status: varchar("status", { length: 24 }).notNull().default("EXPERIMENTAL"),
    trainedAt: timestamp("trained_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ml_model_registry_uidx").on(t.modelId, t.version, t.target)],
);

export const mlTrainingRuns = pgTable("ml_training_runs", {
  id: serial("id").primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull(),
  fold: varchar("fold", { length: 64 }),
  modelType: varchar("model_type", { length: 48 }).notNull(),
  target: varchar("target", { length: 48 }).notNull(),
  trainFrom: date("train_from"),
  trainTo: date("train_to"),
  validateFrom: date("validate_from"),
  validateTo: date("validate_to"),
  testFrom: date("test_from"),
  testTo: date("test_to"),
  sampleTrain: integer("sample_train"),
  sampleValidate: integer("sample_validate"),
  sampleTest: integer("sample_test"),
  metrics: jsonb("metrics"),
  status: varchar("status", { length: 24 }).notNull().default("COMPLETED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mlPredictions = pgTable(
  "ml_predictions",
  {
    id: serial("id").primaryKey(),
    modelId: varchar("model_id", { length: 80 }).notNull(),
    version: varchar("version", { length: 32 }).notNull(),
    entityType: varchar("entity_type", { length: 16 }).notNull(),
    entityId: integer("entity_id").notNull(),
    entityName: varchar("entity_name", { length: 240 }).notNull(),
    asOf: date("as_of").notNull(),
    target: varchar("target", { length: 48 }).notNull(),
    rawProbability: numeric("raw_probability", { precision: 12, scale: 6 }),
    calibratedProbability: numeric("calibrated_probability", { precision: 12, scale: 6 }),
    predictedReturn: numeric("predicted_return", { precision: 12, scale: 6 }),
    actualReturn: numeric("actual_return", { precision: 12, scale: 6 }),
    actualDrawdown: numeric("actual_drawdown", { precision: 12, scale: 6 }),
    regime: varchar("regime", { length: 32 }),
    sector: varchar("sector", { length: 80 }),
    features: jsonb("features"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ml_predictions_uidx").on(t.modelId, t.version, t.entityType, t.entityId, t.asOf, t.target),
    index("ml_predictions_asof_idx").on(t.asOf),
  ],
);

export const aiResearchMemory = pgTable("ai_research_memory", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 16 }).notNull(),
  entityId: integer("entity_id").notNull(),
  asOf: date("as_of").notNull(),
  role: varchar("role", { length: 24 }).notNull(),
  thesis: text("thesis"),
  analysis: jsonb("analysis"),
  prediction: jsonb("prediction"),
  actualOutcome: jsonb("actual_outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiPredictionScorecard = pgTable("ai_prediction_scorecard", {
  id: serial("id").primaryKey(),
  predictionDate: date("prediction_date").notNull(),
  entityType: varchar("entity_type", { length: 16 }).notNull(),
  entityId: integer("entity_id").notNull(),
  entityName: varchar("entity_name", { length: 240 }).notNull(),
  mlModel: varchar("ml_model", { length: 80 }),
  llmModel: varchar("llm_model", { length: 80 }),
  prediction: jsonb("prediction"),
  probability: numeric("probability", { precision: 12, scale: 6 }),
  reason: text("reason"),
  actualOutcome: jsonb("actual_outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ragDocuments = pgTable("rag_documents", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 120 }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  documentType: varchar("document_type", { length: 48 }).notNull(),
  company: varchar("company", { length: 160 }),
  documentDate: date("document_date"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ragChunks = pgTable(
  "rag_chunks",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => ragDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    embedding: jsonb("embedding"),
    embeddingModel: varchar("embedding_model", { length: 80 }),
  },
  (t) => [uniqueIndex("rag_chunks_uidx").on(t.documentId, t.chunkIndex)],
);

export const aiDebateRuns = pgTable("ai_debate_runs", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 16 }).notNull(),
  entityId: integer("entity_id").notNull(),
  asOf: date("as_of").notNull(),
  analyst: jsonb("analyst"),
  critic: jsonb("critic"),
  synthesis: jsonb("synthesis"),
  confidence: jsonb("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
