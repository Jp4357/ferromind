"""
Demand Forecaster — Model 1
Algorithm : XGBoost regressor with rich time-series feature engineering.
Target    : Weekly FeCr demand (tonnes)
Horizon   : 12 weeks ahead (multi-step via recursive strategy)
Output    : models/demand_forecaster.joblib
            models/demand_scaler.joblib
            models/demand_meta.json
"""

import numpy as np
import pandas as pd
import joblib, json, os
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_percentage_error
from xgboost import XGBRegressor

DATA_DIR  = os.path.join(os.path.dirname(__file__), "..", "data")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(MODEL_DIR, exist_ok=True)

def make_features(df):
    """Rich calendar + lag + rolling features."""
    df = df.copy().sort_values("ds")
    df["week"]        = df["ds"].dt.isocalendar().week.astype(int)
    df["month"]       = df["ds"].dt.month
    df["quarter"]     = df["ds"].dt.quarter
    df["year"]        = df["ds"].dt.year
    df["year_frac"]   = df["ds"].dt.dayofyear / 365.0
    # Fourier terms for seasonality
    df["sin_52"]      = np.sin(2 * np.pi * df["week"] / 52)
    df["cos_52"]      = np.cos(2 * np.pi * df["week"] / 52)
    df["sin_26"]      = np.sin(2 * np.pi * df["week"] / 26)
    df["cos_26"]      = np.cos(2 * np.pi * df["week"] / 26)
    df["sin_12"]      = np.sin(2 * np.pi * df["month"] / 12)
    df["cos_12"]      = np.cos(2 * np.pi * df["month"] / 12)
    # Lag features
    for lag in [1, 2, 3, 4, 8, 12]:
        df[f"lag_{lag}"] = df["y"].shift(lag)
    # Rolling statistics
    for window in [4, 8, 12]:
        df[f"roll_mean_{window}"] = df["y"].shift(1).rolling(window).mean()
        df[f"roll_std_{window}"]  = df["y"].shift(1).rolling(window).std()
    # Trend
    df["trend"] = np.arange(len(df))
    return df.dropna()

def train():
    # Load daily demand, resample to weekly
    dem = pd.read_csv(f"{DATA_DIR}/demand.csv", parse_dates=["date"])
    dem = dem.rename(columns={"date": "ds", "demand_t": "y"})
    weekly = dem.resample("W", on="ds").agg({"y": "sum"}).reset_index()
    weekly["y"] = weekly["y"] / 7          # keep as daily-equivalent average

    df = make_features(weekly)

    FEATURE_COLS = [c for c in df.columns if c not in ["ds", "y"]]
    X = df[FEATURE_COLS].values
    y = df["y"].values

    # Train/test split — last 12 weeks as holdout
    split  = len(X) - 12
    X_tr, X_te = X[:split], X[split:]
    y_tr, y_te = y[:split], y[split:]

    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)

    model = XGBRegressor(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.04,
        subsample=0.85,
        colsample_bytree=0.80,
        min_child_weight=3,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        verbosity=0,
    )
    model.fit(X_tr_s, y_tr, eval_set=[(X_te_s, y_te)], verbose=False)

    y_pred = model.predict(X_te_s)
    mape   = mean_absolute_percentage_error(y_te, y_pred) * 100

    # Forecast 12 weeks ahead recursively
    last_row  = df.iloc[-1:].copy()
    forecasts = []
    hist_y    = list(y)

    for step in range(1, 13):
        next_ds         = last_row["ds"].values[0] + pd.Timedelta(weeks=step)
        next_row        = last_row.copy()
        next_row["ds"]  = next_ds
        next_row["y"]   = np.mean(hist_y[-4:])   # placeholder for lag recalc

        row_f = make_features(
            pd.DataFrame({"ds": pd.date_range(weekly["ds"].iloc[-12], periods=13, freq="W"),
                          "y":  hist_y[-12:] + [np.mean(hist_y[-4:])]})
        ).iloc[-1:]

        if row_f.empty:
            break
        X_new = scaler.transform(row_f[FEATURE_COLS].values)
        pred  = float(model.predict(X_new)[0])

        # Confidence interval — ±8% based on historical residual std
        residual_std = float(np.std(y_te - y_pred))
        ci_width     = residual_std * 1.28    # 80% CI

        forecasts.append({
            "week":        step,
            "week_label":  f"W{(weekly['ds'].iloc[-1] + pd.Timedelta(weeks=step)).isocalendar()[1]}",
            "forecast":    round(pred * 7, 0),    # back to weekly total
            "upper_ci":    round((pred + ci_width) * 7, 0),
            "lower_ci":    round(max(0, pred - ci_width) * 7, 0),
            "confidence":  80.0,
        })
        hist_y.append(pred)

    # Persist
    joblib.dump(model,  f"{MODEL_DIR}/demand_forecaster.joblib")
    joblib.dump(scaler, f"{MODEL_DIR}/demand_scaler.joblib")
    joblib.dump(FEATURE_COLS, f"{MODEL_DIR}/demand_feature_cols.joblib")

    meta = {
        "model":            "XGBoostRegressor",
        "mape":             round(mape, 3),
        "n_features":       len(FEATURE_COLS),
        "train_weeks":      split,
        "holdout_weeks":    12,
        "forecasts":        forecasts,
        "accuracy_history": {
            "labels":   ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"],
            "actual":   [round(float(v), 0) for v in y_te[-6:]],
            "forecast": [round(float(v), 0) for v in y_pred[-6:]],
        },
        "trained_at":  pd.Timestamp.now().isoformat(),
    }
    with open(f"{MODEL_DIR}/demand_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"  Demand forecaster  MAPE={mape:.2f}%  n_features={len(FEATURE_COLS)}")
    return meta

if __name__ == "__main__":
    train()
