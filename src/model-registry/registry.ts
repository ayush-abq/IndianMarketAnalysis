import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mlModelRegistry, mlTrainingRuns } from "@/db/schema";
import type { TrainedBundle } from "@/model-training/train";

export async function registerBundle(input: {
  modelId: string;
  modelType: string;
  version: string;
  target: string;
  featureSetVersion: string;
  bundle: TrainedBundle;
  status?: string;
}) {
  const db = getDb();
  const lastFold = input.bundle.folds.at(-1);
  await db
    .insert(mlModelRegistry)
    .values({
      modelId: input.modelId,
      modelType: input.modelType,
      version: input.version,
      target: input.target,
      featureSetVersion: input.featureSetVersion,
      trainingPeriod: lastFold ? `${lastFold.fold.trainFrom}→${lastFold.fold.trainTo}` : null,
      validationPeriod: lastFold ? `${lastFold.fold.validateFrom}→${lastFold.fold.validateTo}` : null,
      testPeriod: lastFold ? `${lastFold.fold.testFrom}→${lastFold.fold.testTo}` : null,
      hyperparameters: { members: input.bundle.members.map((m) => ({ id: m.id, weight: m.weight, oos: m.oosScore })) },
      metrics: { folds: input.bundle.folds, importance: input.bundle.featureImportance },
      artifact: input.bundle as unknown as Record<string, unknown>,
      knownLimitations: input.bundle.limitations.join(" "),
      status: input.status ?? "EXPERIMENTAL",
      trainedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [mlModelRegistry.modelId, mlModelRegistry.version, mlModelRegistry.target],
      set: {
        metrics: input.bundle.folds as unknown as Record<string, unknown>,
        artifact: input.bundle as unknown as Record<string, unknown>,
        status: input.status ?? "EXPERIMENTAL",
        trainedAt: new Date(),
      },
    });
  for (const fold of input.bundle.folds) {
    await db.insert(mlTrainingRuns).values({
      runId: input.version,
      fold: fold.fold.name,
      modelType: input.modelType,
      target: input.target,
      trainFrom: fold.fold.trainFrom,
      trainTo: fold.fold.trainTo,
      validateFrom: fold.fold.validateFrom,
      validateTo: fold.fold.validateTo,
      testFrom: fold.fold.testFrom,
      testTo: fold.fold.testTo,
      sampleTrain: fold.nTrain,
      sampleValidate: fold.nVal,
      sampleTest: fold.nTest,
      metrics: fold.metrics as Record<string, unknown>,
    });
  }
}

export async function latestModel(target: string, status?: string) {
  const db = getDb();
  const rows = await db.select().from(mlModelRegistry).orderBy(desc(mlModelRegistry.trainedAt));
  return rows.find((r) => r.target === target && (!status || r.status === status)) ?? rows.find((r) => r.target === target) ?? null;
}

export async function listModels() {
  const db = getDb();
  return db.select().from(mlModelRegistry).orderBy(desc(mlModelRegistry.trainedAt));
}

export async function setModelStatus(id: number, status: string) {
  const db = getDb();
  await db.update(mlModelRegistry).set({ status }).where(eq(mlModelRegistry.id, id));
}
