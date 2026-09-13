# Optional Python boosting

The research terminal trains logistic / random-forest / extra-trees in TypeScript with walk-forward splits. That path has no Python dependency.

If you want XGBoost, LightGBM or CatBoost locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r python/ml/requirements.txt
python python/ml/train_boosting.py --csv path/to/pit_features.csv
```

Export the CSV from stored `feature_snapshots` plus PIT labels. Do not use future columns. This script does not download market data or call paid APIs.
