"""
Optional local boosting trainer.

Reads a point-in-time CSV written by the TypeScript feature store:
  as_of, entity_id, label, feature columns...

Writes model artifacts next to the CSV. Does not call any cloud API.
Does not auto-download data.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--target", default="label")
    parser.add_argument("--out", default="python/ml/artifacts")
    args = parser.parse_args()
    try:
        import pandas as pd
        from sklearn.metrics import average_precision_score
    except ImportError as exc:
        raise SystemExit(
            "Install optional deps: pip install -r python/ml/requirements.txt"
        ) from exc

    df = pd.read_csv(args.csv)
    if args.target not in df.columns:
        raise SystemExit(f"Missing target column {args.target}")
    y = df[args.target]
    X = df.drop(columns=[c for c in ("as_of", "entity_id", "entity_name", args.target) if c in df.columns])
    split = int(len(df) * 0.8)
    Xtr, Xte, ytr, yte = X.iloc[:split], X.iloc[split:], y.iloc[:split], y.iloc[split:]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    scores = {}
    for name in ("xgboost", "lightgbm", "catboost"):
        model = _fit(name, Xtr, ytr)
        if model is None:
            continue
        proba = model.predict_proba(Xte)[:, 1]
        scores[name] = {"pr_auc": float(average_precision_score(yte, proba))}
        model_path = out / f"{name}.json"
        _save(name, model, model_path)
    (out / "metrics.json").write_text(json.dumps(scores, indent=2))
    print(json.dumps(scores, indent=2))


def _fit(name: str, X, y):
    if name == "xgboost":
        from xgboost import XGBClassifier

        m = XGBClassifier(n_estimators=80, max_depth=4, eval_metric="logloss")
        m.fit(X, y)
        return m
    if name == "lightgbm":
        from lightgbm import LGBMClassifier

        m = LGBMClassifier(n_estimators=80, max_depth=4)
        m.fit(X, y)
        return m
    if name == "catboost":
        from catboost import CatBoostClassifier

        m = CatBoostClassifier(iterations=80, depth=4, verbose=False)
        m.fit(X, y)
        return m
    return None


def _save(name: str, model, path: Path) -> None:
    if name == "xgboost":
        model.save_model(path)
    elif name == "lightgbm":
        model.booster_.save_model(str(path))
    else:
        model.save_model(str(path))


if __name__ == "__main__":
    main()
