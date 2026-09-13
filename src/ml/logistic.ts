import type { BinaryModel } from "./types";

function sigmoid(z: number) {
  if (z >= 20) return 1;
  if (z <= -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function trainLogistic(
  X: number[][],
  y: number[],
  opts?: { lr?: number; epochs?: number; l2?: number },
): BinaryModel & { weights: number[]; bias: number } {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const lr = opts?.lr ?? 0.05;
  const epochs = opts?.epochs ?? 80;
  const l2 = opts?.l2 ?? 0.001;
  const w = new Array(d).fill(0);
  let b = 0;
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * X[i][j];
      const err = sigmoid(z) - y[i];
      gb += err;
      for (let j = 0; j < d; j++) gw[j] += err * X[i][j];
    }
    b -= (lr * gb) / Math.max(1, n);
    for (let j = 0; j < d; j++) w[j] -= (lr * (gw[j] / Math.max(1, n) + l2 * w[j]));
  }
  return {
    kind: "logistic",
    featureKeys: [],
    weights: w,
    bias: b,
    predictProba(x: number[]) {
      let z = b;
      for (let j = 0; j < w.length; j++) z += w[j] * (x[j] ?? 0);
      return sigmoid(z);
    },
  };
}

export function trainRidge(X: number[][], y: number[], l2 = 0.1) {
  const n = X.length;
  const d = (X[0]?.length ?? 0) + 1;
  const xtx: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  const xty = new Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    const row = [1, ...X[i]];
    for (let a = 0; a < d; a++) {
      xty[a] += row[a] * y[i];
      for (let b = 0; b < d; b++) xtx[a][b] += row[a] * row[b];
    }
  }
  for (let i = 1; i < d; i++) xtx[i][i] += l2;
  const beta = solve(xtx, xty);
  return {
    kind: "ridge" as const,
    featureKeys: [] as string[],
    beta,
    predict(x: number[]) {
      let s = beta[0] ?? 0;
      for (let j = 0; j < x.length; j++) s += (beta[j + 1] ?? 0) * x[j];
      return s;
    },
  };
}

function solve(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[max][i])) max = r;
    [M[i], M[max]] = [M[max], M[i]];
    const pivot = M[i][i] || 1e-9;
    for (let j = i; j <= n; j++) M[i][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r][i];
      for (let j = i; j <= n; j++) M[r][j] -= f * M[i][j];
    }
  }
  return M.map((row) => row[n]);
}
