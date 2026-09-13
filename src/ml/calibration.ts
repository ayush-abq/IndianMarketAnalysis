import type { Calibrator } from "./types";

function sigmoid(z: number) {
  if (z >= 20) return 1;
  if (z <= -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

/** Platt scaling: logistic on raw scores. */
export function fitPlatt(raw: number[], y: number[]): Calibrator & { a: number; b: number } {
  let a = 1;
  let b = 0;
  const n = raw.length;
  for (let e = 0; e < 60; e++) {
    let ga = 0;
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(a * raw[i] + b);
      const err = p - y[i];
      ga += err * raw[i];
      gb += err;
    }
    a -= (0.05 * ga) / Math.max(1, n);
    b -= (0.05 * gb) / Math.max(1, n);
  }
  return {
    kind: "platt",
    a,
    b,
    apply(r: number) {
      return sigmoid(a * r + b);
    },
  };
}

/** Isotonic regression via pool-adjacent-violators. */
export function fitIsotonic(raw: number[], y: number[]): Calibrator & { xs: number[]; ys: number[] } {
  const pts = raw.map((x, i) => ({ x, y: y[i] })).sort((a, b) => a.x - b.x);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const w = pts.map(() => 1);
  let i = 0;
  while (i < ys.length - 1) {
    if (ys[i] <= ys[i + 1] + 1e-12) {
      i += 1;
      continue;
    }
    const nw = w[i] + w[i + 1];
    const ny = (ys[i] * w[i] + ys[i + 1] * w[i + 1]) / nw;
    ys.splice(i, 2, ny);
    xs.splice(i, 2, (xs[i] * w[i] + xs[i + 1] * w[i + 1]) / nw);
    w.splice(i, 2, nw);
    i = Math.max(0, i - 1);
  }
  return {
    kind: "isotonic",
    xs,
    ys,
    apply(r: number) {
      if (!xs.length) return r;
      if (r <= xs[0]) return ys[0];
      if (r >= xs[xs.length - 1]) return ys[ys.length - 1];
      let lo = 0;
      let hi = xs.length - 1;
      while (lo < hi - 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (xs[mid] <= r) lo = mid;
        else hi = mid;
      }
      const t = (r - xs[lo]) / Math.max(1e-9, xs[hi] - xs[lo]);
      return ys[lo] * (1 - t) + ys[hi] * t;
    },
  };
}

export function applyCalibrator(c: Calibrator | null | undefined, raw: number) {
  if (!c) return raw;
  return Math.min(1, Math.max(0, c.apply(raw)));
}
