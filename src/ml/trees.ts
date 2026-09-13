import type { BinaryModel } from "./types";

type Node =
  | { leaf: true; p: number }
  | { leaf: false; feature: number; threshold: number; left: Node; right: Node };

function gini(y: number[]) {
  if (!y.length) return 0;
  const pos = y.reduce((a, v) => a + v, 0) / y.length;
  return 2 * pos * (1 - pos);
}

function split(X: number[][], y: number[], extra: boolean, rng: () => number) {
  const d = X[0]?.length ?? 0;
  let best = { gain: -1, feature: 0, threshold: 0, leftI: [] as number[], rightI: [] as number[] };
  const features = extra
    ? Array.from({ length: Math.max(1, Math.floor(Math.sqrt(d))) }, () => Math.floor(rng() * d))
    : Array.from({ length: d }, (_, i) => i);
  const parent = gini(y);
  for (const f of features) {
    const vals = X.map((r) => r[f]);
    const uniq = [...new Set(vals)].sort((a, b) => a - b);
    const step = Math.max(1, Math.floor(uniq.length / 8));
    for (let i = 0; i < uniq.length - 1; i += step) {
      const t = (uniq[i] + uniq[i + 1]) / 2;
      const leftI: number[] = [];
      const rightI: number[] = [];
      for (let r = 0; r < X.length; r++) (X[r][f] <= t ? leftI : rightI).push(r);
      if (!leftI.length || !rightI.length) continue;
      const lg = gini(leftI.map((k) => y[k]));
      const rg = gini(rightI.map((k) => y[k]));
      const gain = parent - (leftI.length / y.length) * lg - (rightI.length / y.length) * rg;
      if (gain > best.gain) best = { gain, feature: f, threshold: t, leftI, rightI };
    }
  }
  return best;
}

function build(X: number[][], y: number[], depth: number, maxDepth: number, extra: boolean, rng: () => number): Node {
  const pos = y.reduce((a, v) => a + v, 0);
  if (!y.length) return { leaf: true, p: 0.5 };
  if (depth >= maxDepth || new Set(y).size === 1 || y.length < 8) {
    return { leaf: true, p: pos / y.length };
  }
  const s = split(X, y, extra, rng);
  if (s.gain <= 0) return { leaf: true, p: pos / y.length };
  return {
    leaf: false,
    feature: s.feature,
    threshold: s.threshold,
    left: build(s.leftI.map((i) => X[i]), s.leftI.map((i) => y[i]), depth + 1, maxDepth, extra, rng),
    right: build(s.rightI.map((i) => X[i]), s.rightI.map((i) => y[i]), depth + 1, maxDepth, extra, rng),
  };
}

function walk(node: Node, x: number[]): number {
  if (node.leaf) return node.p;
  return x[node.feature] <= node.threshold ? walk(node.left, x) : walk(node.right, x);
}

function mulberry(seed: number) {
  let s = seed || 1;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trainForest(
  X: number[][],
  y: number[],
  opts?: { trees?: number; maxDepth?: number; extra?: boolean; seed?: number },
): BinaryModel & { trees: Node[] } {
  const nTrees = opts?.trees ?? 21;
  const maxDepth = opts?.maxDepth ?? 5;
  const extra = opts?.extra ?? false;
  const rng = mulberry(opts?.seed ?? 7);
  const trees: Node[] = [];
  for (let t = 0; t < nTrees; t++) {
    const idx: number[] = [];
    for (let i = 0; i < X.length; i++) idx.push(Math.floor(rng() * X.length));
    trees.push(
      build(
        idx.map((i) => X[i]),
        idx.map((i) => y[i]),
        0,
        maxDepth,
        extra,
        rng,
      ),
    );
  }
  return {
    kind: extra ? "extra_trees" : "random_forest",
    featureKeys: [],
    trees,
    predictProba(x: number[]) {
      return trees.reduce((a, tr) => a + walk(tr, x), 0) / trees.length;
    },
  };
}

export function treeImportances(model: { trees: Node[] }, dim: number) {
  const counts = new Array(dim).fill(0);
  const visit = (n: Node) => {
    if (n.leaf) return;
    counts[n.feature] += 1;
    visit(n.left);
    visit(n.right);
  };
  for (const t of model.trees) visit(t);
  const sum = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.map((c) => c / sum);
}
