"""
Demand Forecaster — FerroMind Phase 2
Model: XGBoost regressor with seasonal Fourier features + lag features.
Outputs: point forecast + upper/lower confidence intervals (bootstrapped).
Trained on 2 years of weekly ferrochrome output data.
"""

import numpy as np
import pandas as pd
import joblib, json, os
from datetime import datetime, timedelta
from typing import Optional

try:
    import xgboost as xgb
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.metrics import mean_absolute_percentage_error
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False
    from sklearn.ensemble import GradientBoostingRegressor


FEATURE_COLS = [
    "active_furnaces", "avg_cr_pct", "avg_kwh_per_t",
    "chromite_stock", "chromite_cover",
    "week_of_year", "month", "quarter",
    "sin_week", "cos_week", "sin_month", "cos_month",
    "lag_1w", "lag_2w", "lag_4w", "rolling_4w", "rolling_8w",
]

MODEL_NAME    = "demand_forecaster"
MODEL_VERSION = "2.0.0"


def load_features(data_dir: str = "data") -> pd.DataFrame:
    path = os.path.join(data_dir, "demand_features.parquet")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Features not found at {path}. Run synthetic_generator.py first."
        )
    return pd.read_parquet(path)


def build_model():
    if XGB_AVAILABLE:
        return xgb.XGBRegressor(
            n_estimators=400,
            learning_rate=0.05,
            max_depth=5,
            subsample=0.85,
            colsample_bytree=0.85,
            min_child_weight=3,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
        )
    # Fallback: scikit-learn GBM
    return GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.85,
        random_state=42,
    )


def train(data_dir: str = "data", artifact_dir: str = "artifacts") -> dict:
    os.makedirs(artifact_dir, exist_ok=True)
    df = load_features(data_dir)

    X = df[FEATURE_COLS].values
    y = df["target"].values

    # Time-series split — last 12 weeks as validation
    split_idx = len(df) - 12
    X_train, X_val = X[:split_idx], X[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_val_s   = scaler.transform(X_val)

    model = build_model()
    model.fit(X_train_s, y_train)

    y_pred_val = model.predict(X_val_s)
    mape = mean_absolute_percentage_error(y_val, y_pred_val) * 100
    residuals = y_val - y_pred_val

    # Bootstrap confidence intervals from residual distribution
    residual_std = np.std(residuals)
    ci_80_half   = 1.282 * residual_std   # ~80% CI
    ci_90_half   = 1.645 * residual_std   # ~90% CI

    print(f"  Demand Forecaster — val MAPE: {mape:.2f}%  |  residual std: {residual_std:.1f} t")

    # Save artefacts
    joblib.dump(model,  f"{artifact_dir}/demand_model.joblib")
    joblib.dump(scaler, f"{artifact_dir}/demand_scaler.joblib")

    meta = {
        "model_name":      MODEL_NAME,
        "model_version":   MODEL_VERSION,
        "model_type":      "XGBoost" if XGB_AVAILABLE else "GradientBoosting",
        "trained_at":      datetime.now().isoformat(),
        "training_rows":   int(split_idx),
        "validation_rows": len(y_val),
        "mape_pct":        round(mape, 3),
        "residual_std":    round(residual_std, 2),
        "ci_80_half":      round(ci_80_half, 2),
        "ci_90_half":      round(ci_90_half, 2),
        "feature_cols":    FEATURE_COLS,
        "status":          "production",
    }
    with open(f"{artifact_dir}/demand_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    return meta


def _last_known_features(df: pd.DataFrame) -> dict:
    """Extract the most recent row's features as a starting context."""
    last = df.iloc[-1]
    return {
        "active_furnaces":  last.get("active_furnaces", 2.0),
        "avg_cr_pct":       last.get("avg_cr_pct", 52.0),
        "avg_kwh_per_t":    last.get("avg_kwh_per_t", 49.5),
        "chromite_stock":   last.get("chromite_stock", 42000),
        "chromite_cover":   last.get("chromite_cover", 18),
        "rolling_4w":       last.get("rolling_4w", last["total_output_t"]),
        "rolling_8w":       last.get("rolling_8w", last["total_output_t"]),
        "lag_1w":           last["total_output_t"],
        "lag_2w":           df.iloc[-2]["total_output_t"] if len(df) > 1 else last["total_output_t"],
        "lag_4w":           df.iloc[-4]["total_output_t"] if len(df) > 3 else last["total_output_t"],
    }


def predict(
    horizon_weeks: int = 12,
    artifact_dir: str = "artifacts",
    data_dir: str = "data",
) -> dict:
    model  = joblib.load(f"{artifact_dir}/demand_model.joblib")
    scaler = joblib.load(f"{artifact_dir}/demand_scaler.joblib")
    with open(f"{artifact_dir}/demand_meta.json") as f:
        meta = json.load(f)

    df   = load_features(data_dir)
    ctx  = _last_known_features(df)
    base_date = datetime.now()

    forecasts, labels = [], []
    lag1 = ctx["lag_1w"]
    lag2 = ctx["lag_2w"]
    lag4 = ctx["lag_4w"]
    r4   = ctx["rolling_4w"]
    r8   = ctx["rolling_8w"]

    for w in range(1, horizon_weeks + 1):
        fdate = base_date + timedelta(weeks=w)
        woy   = int(fdate.isocalendar()[1])
        month = fdate.month
        qtr   = (month - 1) // 3 + 1

        row = [
            ctx["active_furnaces"],
            ctx["avg_cr_pct"],
            ctx["avg_kwh_per_t"],
            ctx["chromite_stock"],
            ctx["chromite_cover"],
            woy, month, qtr,
            np.sin(2 * np.pi * woy / 52),
            np.cos(2 * np.pi * woy / 52),
            np.sin(2 * np.pi * month / 12),
            np.cos(2 * np.pi * month / 12),
            lag1, lag2, lag4, r4, r8,
        ]

        X_s   = scaler.transform([row])
        pred  = float(model.predict(X_s)[0])
        ci_h  = meta["ci_80_half"]

        forecasts.append({
            "week":       f"W{woy}",
            "week_num":   w,
            "date":       fdate.strftime("%Y-%m-%d"),
            "forecast_t": round(pred, 0),
            "upper_ci":   round(pred + ci_h, 0),
            "lower_ci":   round(max(0, pred - ci_h), 0),
            "confidence": 80.0,
        })

        # Roll lags forward
        lag4 = lag2
        lag2 = lag1
        lag1 = pred
        r4   = (r4 * 3 + pred) / 4
        r8   = (r8 * 7 + pred) / 8

    return {
        "model_name":    meta["model_name"],
        "model_version": meta["model_version"],
        "model_type":    meta["model_type"],
        "mape":          meta["mape_pct"],
        "generated_at":  datetime.now().isoformat(),
        "horizon_weeks": horizon_weeks,
        "forecasts":     forecasts,
    }


if __name__ == "__main__":
    result = train()
    print(json.dumps(result, indent=2))
