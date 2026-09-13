import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { featureSnapshots, mlPredictions, stocks, stockFundamentals } from "@/db/schema";
import { loadStockBars } from "@/services/stock-metrics";
import { loadScannerRows, latestMetricDate } from "@/services/queries";
import { latestMarketContext } from "@/services/market-context";
import { historicalAnalogues } from "@/services/signal-tracker";
import { featuresFromBars } from "@/feature-store/features";
import { buildLabeledRows } from "@/model-training/dataset";
import { trainHorizonBundle, type TrainedBundle } from "@/model-training/train";
import { FEATURE_SET_VERSION, ML_MODEL_FAMILY } from "@/config/local-ai";
import { latestModel, listModels, registerBundle } from "@/model-registry/registry";
import { predictFromBundle, emptyPrediction } from "@/prediction-engine/predict";
import { scenariosFromMl } from "@/prediction-engine/scenarios";
import { blendResearchScore, mlScoreFromProbability } from "@/prediction-engine/blend";
import { detectConflicts } from "@/prediction-engine/contradiction";
import { detectHardware } from "@/ai/hardware";
import { probeOllama } from "@/ai/ollama";
import { localLlm } from "@/ai/local-llm";
import { runDebate } from "@/ai-agents/debate";
import type { MarketContext } from "@/ai/market-context";
import { getSettings } from "@/services/settings";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { detectDecay } from "@/ai-evaluation/decay";
import { rankTournament } from "@/ai-evaluation/tournament";
import { classificationMetrics, financialMetrics } from "@/ml/metrics";

function num(v: string | number | null | undefined) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function localAiStatus() {
  const [hardware, ollama, models, settings] = await Promise.all([
    detectHardware(),
    probeOllama(),
    listModels().catch(() => []),
    getSettings(),
  ]);
  return {
    offlineFirst: true,
    apiCostInr: 0,
    paidApis: "disabled",
    localAiEnabled: env().LOCAL_AI_ENABLED || settings.local_ai.enabled,
    settings: settings.local_ai,
    hardware,
    ollama,
    resolvedModels: {
      analyst: await localLlm.resolveModel("analyst"),
      critic: await localLlm.resolveModel("critic"),
      synthesizer: await localLlm.resolveModel("synthesizer"),
      fast: await localLlm.resolveModel("fast"),
    },
    registry: models.map((m) => ({
      id: m.id,
      modelId: m.modelId,
      version: m.version,
      target: m.target,
      status: m.status,
      trainedAt: m.trainedAt,
      limitations: m.knownLimitations,
    })),
    note: "Never auto-downloads weights. Train ML locally. Pull Ollama models yourself.",
  };
}

export async function trainLocalModels(opts?: { index?: string; limit?: number; every?: number }) {
  const db = getDb();
  const all = await db.select().from(stocks).where(eq(stocks.active, true));
  const index = opts?.index ?? "NIFTY500";
  let universe = all.filter((s) => ((s.indexMemberships as string[] | null) ?? []).includes(index));
  if (universe.length < 20) universe = all;
  if (opts?.limit) universe = universe.slice(0, opts.limit);
  logger.info({ n: universe.length, index }, "Building PIT ML dataset from official bars");
  const rows = [];
  for (const stock of universe) {
    const bars = await loadStockBars(stock.id);
    rows.push(...buildLabeledRows({ id: stock.id, name: stock.symbol }, bars, { every: opts?.every ?? 21 }));
  }
  const horizons = ["1M", "3M", "6M", "1Y"] as const;
  const trained: { horizon: string; target: string; folds: number; samples: number }[] = [];
  const version = `wf-${new Date().toISOString().slice(0, 10)}`;
  for (const horizon of horizons) {
    for (const target of ["positive", "gain10", "gain20", "dd20"] as const) {
      const subset = rows.filter((r) => r.horizon === horizon);
      if (subset.length < 80) continue;
      const bundle = trainHorizonBundle(rows, horizon, target);
      await registerBundle({
        modelId: ML_MODEL_FAMILY,
        modelType: "ensemble",
        version: `${version}-${horizon}-${target}`,
        target: `${horizon}:${target}`,
        featureSetVersion: FEATURE_SET_VERSION,
        bundle,
        status: "EXPERIMENTAL",
      });
      trained.push({ horizon, target, folds: bundle.folds.length, samples: subset.length });
    }
  }
  return {
    trained,
    samples: rows.length,
    universe: universe.length,
    status: "EXPERIMENTAL",
    note: "Models are EXPERIMENTAL until you promote a version after reading walk-forward folds. No metrics were invented for skipped folds.",
  };
}

export async function materializeFeatures(opts?: { limit?: number; asOf?: string }) {
  const db = getDb();
  const asOf = opts?.asOf ?? (await latestMetricDate("PR"));
  if (!asOf) return { stored: 0, asOf: null };
  const all = await db.select().from(stocks).where(eq(stocks.active, true));
  const slice = opts?.limit ? all.slice(0, opts.limit) : all;
  let stored = 0;
  for (const stock of slice) {
    const bars = await loadStockBars(stock.id);
    const feat = featuresFromBars(bars, asOf);
    if (!feat) continue;
    await db
      .insert(featureSnapshots)
      .values({
        entityType: "STOCK",
        entityId: stock.id,
        entityName: stock.symbol,
        featureDate: feat.asOf,
        availableAt: feat.availableAt,
        featureSetVersion: FEATURE_SET_VERSION,
        features: feat.values,
        sources: feat.sources,
      })
      .onConflictDoUpdate({
        target: [featureSnapshots.entityType, featureSnapshots.entityId, featureSnapshots.featureDate, featureSnapshots.featureSetVersion],
        set: { features: feat.values, sources: feat.sources },
      });
    stored += 1;
  }
  return { stored, asOf, version: FEATURE_SET_VERSION };
}

async function loadBundle(target: string): Promise<{ bundle: TrainedBundle; status: string } | null> {
  const row = await latestModel(target);
  if (!row?.artifact) return null;
  return { bundle: row.artifact as TrainedBundle, status: row.status };
}

export async function predictEntity(entityType: "STOCK" | "INDEX", entityId: number) {
  if (entityType !== "STOCK") {
    return { ...emptyPrediction("Index ML uses the same engine after you train on index bars. Stock models are trained first."), entityType, entityId };
  }
  const db = getDb();
  const [stock] = await db.select().from(stocks).where(eq(stocks.id, entityId)).limit(1);
  if (!stock) return { ...emptyPrediction("Stock not found"), entityType, entityId };
  const bars = await loadStockBars(entityId);
  const asOf = bars.at(-1)?.date;
  if (!asOf) return { ...emptyPrediction("No official price bars stored"), entityType, entityId };
  const feat = featuresFromBars(bars, asOf);
  if (!feat) return { ...emptyPrediction("Insufficient history to build a point-in-time feature row"), entityType, entityId };

  const horizons: Record<string, Awaited<ReturnType<typeof predictFromBundle>>> = {};
  for (const h of ["1M", "3M", "6M", "1Y"]) {
    const loaded = await loadBundle(`${h}:positive`);
    if (!loaded) continue;
    horizons[h] = predictFromBundle(loaded.bundle, feat.values, loaded.status);
  }
  const drawdown: Record<string, Awaited<ReturnType<typeof predictFromBundle>>> = {};
  for (const h of ["1M", "3M", "6M", "1Y"]) {
    const loaded = await loadBundle(`${h}:dd20`);
    if (!loaded) continue;
    drawdown[h] = predictFromBundle(loaded.bundle, feat.values, loaded.status);
  }
  const gains: Record<string, Awaited<ReturnType<typeof predictFromBundle>>> = {};
  for (const t of ["6M:gain10", "6M:gain20", "1Y:gain30"]) {
    const loaded = await loadBundle(t);
    if (!loaded) continue;
    gains[t] = predictFromBundle(loaded.bundle, feat.values, loaded.status);
  }

  if (!Object.keys(horizons).length) {
    return {
      ...emptyPrediction("No trained local model in the registry. Run npm run ml:train. The UI will not invent probabilities."),
      entityType,
      entityId,
      name: stock.symbol,
      asOf,
      features: feat.values,
    };
  }

  const prod = await latestModel("6M:positive", "PRODUCTION");
  const used = await latestModel("6M:positive");
  return {
    available: true,
    status: used?.status ?? "EXPERIMENTAL",
    experimental: (used?.status ?? "EXPERIMENTAL") !== "PRODUCTION",
    entityType,
    entityId,
    name: stock.symbol,
    asOf,
    features: feat.values,
    sources: feat.sources,
    horizons,
    drawdown,
    gains,
    scenarios: scenariosFromMl(horizons["6M"] ?? null),
    importance: (used?.artifact as TrainedBundle | undefined)?.featureImportance ?? [],
    modelCard: used
      ? {
          purpose: "Estimate forward-return probabilities from official EOD features",
          trainingPeriod: used.trainingPeriod,
          validationPeriod: used.validationPeriod,
          testPeriod: used.testPeriod,
          limitations: used.knownLimitations,
          status: used.status,
          lastValidation: used.trainedAt,
          productionAvailable: Boolean(prod),
        }
      : null,
  };
}

export async function buildStockMarketContext(stockId: number): Promise<MarketContext | null> {
  const db = getDb();
  const [stock] = await db.select().from(stocks).where(eq(stocks.id, stockId)).limit(1);
  if (!stock) return null;
  const bars = await loadStockBars(stockId);
  const asOf = bars.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
  const feat = featuresFromBars(bars, asOf);
  const pred = await predictEntity("STOCK", stockId);
  const sectors = await loadScannerRows({ returnType: "PR", includeBenchmarks: true }).catch(() => []);
  const regime = await latestMarketContext().catch(() => null);
  const sector = stock.sector
    ? sectors.find((s) => s.name.toLowerCase().includes(stock.sector!.toLowerCase().replace(/^nifty\s+/, "")))
    : undefined;
  const [fund] = await db.select().from(stockFundamentals).where(eq(stockFundamentals.stockId, stockId)).limit(1);
  const fundDate = fund?.sourceDate ?? fund?.date ?? null;
  const fundOk = !fundDate || fundDate <= asOf;
  const analogues =
    feat?.values.drawdown != null
      ? await historicalAnalogues({ drawdown: feat.values.drawdown, recovery: feat.values.recovery_score })
      : null;
  const missing = Object.entries(feat?.values ?? {})
    .filter(([, v]) => v == null)
    .map(([k]) => k);
  return {
    asOf,
    entity: { type: "STOCK", id: stock.id, name: stock.companyName ? `${stock.symbol} · ${stock.companyName}` : stock.symbol, symbol: stock.symbol },
    regime: { label: regime && "regime" in regime ? String(regime.regime) : null, score: regime && "score" in regime ? Number(regime.score) : null },
    breadth: {},
    sector: {
      name: sector?.name ?? stock.sector ?? null,
      signal: sector?.signal ?? null,
      return1y: sector?.return1y ?? null,
      drawdown: sector?.distanceFromAth ?? null,
    },
    fundamentals: fundOk
      ? { pe: num(fund?.pe), pb: num(fund?.pb), roe: num(fund?.roe), roce: num(fund?.roce), source: fund ? "stored" : "unavailable" }
      : { note: "Fundamentals dated after as-of were withheld (point-in-time)." },
    earnings: fundOk ? { eps: num(fund?.eps), pat: num(fund?.pat) } : { note: "N/A" },
    valuation: { pe: fundOk ? num(fund?.pe) : null, pb: fundOk ? num(fund?.pb) : null },
    technicals: feat?.values ?? {},
    relativeStrength: { rs_1y: feat?.values.rs_1y ?? null },
    institutionalFlows: { note: "Not in official bhavcopy. N/A." },
    catalysts: [],
    portfolioExposure: null,
    historicalAnalogues: analogues
      ? { comparable: analogues.comparable, median6m: analogues.median6m, median12m: analogues.median12m, note: analogues.note, fabricated: false }
      : null,
    ml: pred.available
      ? {
          status: pred.status,
          horizons: pred.horizons,
          drawdown: pred.drawdown,
          rawProbability: pred.horizons?.["6M"]?.rawProbability ?? null,
          calibratedProbability: pred.horizons?.["6M"]?.calibratedProbability ?? null,
          members: pred.horizons?.["6M"]?.members ?? [],
        }
      : { status: "NOT_TRAINED", note: "reason" in pred ? pred.reason : "No trained model" },
    risk: { drawdown: feat?.values.drawdown ?? null, vol20: feat?.values.volatility_20 ?? null },
    dataQuality: {
      score: missing.length > 10 ? 35 : 70,
      missing,
      note: "Missing features stay null. Licensed fundamentals are N/A unless stored with an available_at date.",
    },
  };
}

export async function researchCard(stockId: number, opts?: { debate?: boolean }) {
  const ctx = await buildStockMarketContext(stockId);
  if (!ctx) return null;
  const pred = await predictEntity("STOCK", stockId);
  const settings = await getSettings();
  const p6 = pred.available ? pred.horizons?.["6M"]?.calibratedProbability ?? null : null;
  const quant = pred.available ? 50 : null;
  const blended = blendResearchScore({
    quantitative: quant,
    ml: mlScoreFromProbability(p6),
    ai: null,
    criticRisk: null,
    weights: settings.local_ai.blend,
  });
  const conflicts = detectConflicts({
    valuation: num((ctx.fundamentals as { pe?: number | null }).pe) != null ? 50 : null,
    earnings: null,
    return1m: ctx.technicals.return_1m as number | null,
    sectorReturn1y: ctx.sector.return1y,
    rs1y: ctx.relativeStrength.rs_1y,
  });
  const debate = opts?.debate && (env().LOCAL_AI_ENABLED || settings.local_ai.enabled) ? await runDebate(ctx, { persist: true }) : null;
  return {
    context: ctx,
    prediction: pred,
    blend: blended,
    conflicts,
    debate,
    aggressive: settings.local_ai.aggressive_mode
      ? {
          focus: ["early recovery", "earnings acceleration", "valuation dislocation", "sector inflection"],
          mustShow: ["max drawdown", "risk of loss", "model uncertainty", "liquidity", "event risk"],
        }
      : null,
    disclaimer: "Research signal. Historical probability / model estimate only. Not a buy call.",
  };
}

export async function performanceDashboard() {
  const db = getDb();
  const models = await listModels();
  const preds = await db.select().from(mlPredictions).orderBy(desc(mlPredictions.asOf)).limit(5000);
  const filled = preds.filter((p) => p.actualReturn != null && p.calibratedProbability != null);
  const y = filled.map((p) => (Number(p.actualReturn) > 0 ? 1 : 0));
  const pr = filled.map((p) => Number(p.calibratedProbability));
  const rets = filled.map((p) => (Number(p.calibratedProbability) >= 0.55 ? Number(p.actualReturn) : 0));
  const cls = classificationMetrics(y, pr);
  const fin = financialMetrics(rets);
  const decay = detectDecay({
    oosHitRate: typeof (models[0]?.metrics as { folds?: { metrics?: { logistic?: { classification?: { accuracy?: number } } } }[] })?.folds?.[0]?.metrics?.logistic?.classification?.accuracy === "number"
      ? ((models[0]?.metrics as { folds: { metrics: { logistic: { classification: { accuracy: number } } } }[] }).folds[0].metrics.logistic.classification.accuracy)
      : null,
    recentHitRate: cls.accuracy,
    oosSharpe: null,
    recentSharpe: fin.sharpe,
    calibrationGap: cls.brier,
    recentMaxDd: fin.maxDrawdown,
  });
  const tournament = rankTournament(
    models.slice(0, 6).map((m) => ({
      model: `${m.modelId}:${m.target}:${m.status}`,
      classification: cls,
      financial: fin,
    })),
  );
  const bySector = await db.execute(sql`
    select sector, count(*)::int as n
    from ml_predictions
    where actual_return is not null
    group by sector
    order by n desc
    limit 12
  `).catch(() => []);
  return {
    models,
    predictionCount: preds.length,
    scoredCount: filled.length,
    classification: cls,
    financial: fin,
    decay,
    tournament,
    bySector,
    note: "Accuracy is blank until forward returns are filled. We do not fabricate hit rates.",
  };
}

export async function persistLatestPredictions(limit = 200) {
  const db = getDb();
  const listed = await db.select().from(stocks).where(eq(stocks.active, true));
  const slice = listed.filter((s) => ((s.indexMemberships as string[] | null) ?? []).includes("NIFTY500")).slice(0, limit);
  let n = 0;
  for (const s of slice) {
    const pred = await predictEntity("STOCK", s.id);
    if (!pred.available || !pred.asOf) continue;
    for (const [horizon, row] of Object.entries(pred.horizons ?? {})) {
      if (row.calibratedProbability == null) continue;
      await db
        .insert(mlPredictions)
        .values({
          modelId: ML_MODEL_FAMILY,
          version: row.horizon,
          entityType: "STOCK",
          entityId: s.id,
          entityName: s.symbol,
          asOf: pred.asOf,
          target: `${horizon}:positive`,
          rawProbability: row.rawProbability != null ? String(row.rawProbability) : null,
          calibratedProbability: String(row.calibratedProbability),
          predictedReturn: row.expectedReturn != null ? String(row.expectedReturn) : null,
          sector: s.sector,
          features: pred.features,
        })
        .onConflictDoUpdate({
          target: [mlPredictions.modelId, mlPredictions.version, mlPredictions.entityType, mlPredictions.entityId, mlPredictions.asOf, mlPredictions.target],
          set: {
            rawProbability: row.rawProbability != null ? String(row.rawProbability) : null,
            calibratedProbability: String(row.calibratedProbability),
          },
        });
      n += 1;
    }
  }
  return { stored: n };
}
