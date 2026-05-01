"""
Anomaly Detector — Model 3
Algorithm  : Isolation Forest (per-sensor + multivariate)
Features   : Rolling z-scores, inter-sensor correlations, rate-of-change
Threshold  : Dynamic contamination calibrated on labelled anomaly rate
Output     : models/anomaly_detector.joblib
             models/anomaly_meta.json
"""

import numpy as np
import pandas as pd
import joblib, json, os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import precision_score, recall_score, f1_score

DATA_DIR  = os.path.join(os.path.dirname(__file__), "..", "data")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(MODEL_DIR, exist_ok=True)

SENSOR_TYPES = [
    "temperature_c",
    "electrode_pos_mm",
    "power_mw",
    "off_gas_co_pct",
    "tap_weight_t",
    "cr_yield_pct",
]

def engineer_features(df):
    """Build statistical features per reading for anomaly detection."""
    df = df.copy().sort_values(["furnace", "date", "sensor_type"])
    feature_rows = []

    for (furnace, date), group in df.groupby(["furnace", "date"]):
        row = {"furnace": furnace, "date": date}
        for st in SENSOR_TYPES:
            subset = group[group["sensor_type"] == st]
            if subset.empty:
                row[f"{st}_val"]   = np.nan
                row[f"{st}_score"] = 0.0
            else:
                row[f"{st}_val"]   = float(subset["value"].iloc[0])
                row[f"{st}_score"] = float(subset["anomaly_score"].iloc[0])
        feature_rows.append(row)

    feat_df = pd.DataFrame(feature_rows).sort_values(["furnace", "date"])

    # Rolling z-scores (window 7 days)
    for st in SENSOR_TYPES:
        col = f"{st}_val"
        if col in feat_df.columns:
            roll_mean = feat_df.groupby("furnace")[col].transform(
                lambda x: x.rolling(7, min_periods=3).mean())
            roll_std  = feat_df.groupby("furnace")[col].transform(
                lambda x: x.rolling(7, min_periods=3).std().clip(lower=0.01))
            feat_df[f"{st}_zscore"] = (feat_df[col] - roll_mean) / roll_std

            # Rate of change
            feat_df[f"{st}_roc"] = feat_df.groupby("furnace")[col].pct_change().fillna(0)

    # Cross-sensor correlation features
    if "temperature_c_val" in feat_df and "power_mw_val" in feat_df:
        feat_df["temp_power_ratio"] = (
            feat_df["temperature_c_val"] / feat_df["power_mw_val"].clip(lower=1))

    if "cr_yield_pct_val" in feat_df and "temperature_c_val" in feat_df:
        feat_df["cr_temp_ratio"] = (
            feat_df["cr_yield_pct_val"] / feat_df["temperature_c_val"].clip(lower=1))

    return feat_df

def get_labels(df, feat_df):
    """Join ground-truth anomaly labels from raw sensor data."""
    # A day is anomalous if any sensor on that furnace/day flagged True
    labels = (df.groupby(["furnace", "date"])["is_anomaly"]
                .any()
                .reset_index()
                .rename(columns={"is_anomaly": "true_anomaly"}))
    merged = feat_df.merge(labels, on=["furnace", "date"], how="left")
    merged["true_anomaly"] = merged["true_anomaly"].fillna(False)
    return merged

def train():
    df      = pd.read_csv(f"{DATA_DIR}/sensor_readings.csv")
    feat_df = engineer_features(df)
    merged  = get_labels(df, feat_df)

    FEATURE_COLS = (
        [f"{st}_val"    for st in SENSOR_TYPES] +
        [f"{st}_zscore" for st in SENSOR_TYPES] +
        [f"{st}_roc"    for st in SENSOR_TYPES] +
        ["temp_power_ratio", "cr_temp_ratio"]
    )
    FEATURE_COLS = [c for c in FEATURE_COLS if c in merged.columns]

    X = merged[FEATURE_COLS].fillna(0).values
    y = merged["true_anomaly"].astype(int).values

    contamination = float(y.mean())       # calibrate to actual anomaly rate
    contamination = min(max(contamination, 0.01), 0.15)

    # Train/test split — last 20% as holdout
    split  = int(len(X) * 0.80)
    X_tr, X_te = X[:split], X[split:]
    y_tr, y_te = y[:split], y[split:]

    scaler   = StandardScaler()
    X_tr_s   = scaler.fit_transform(X_tr)
    X_te_s   = scaler.transform(X_te)

    model = IsolationForest(
        n_estimators=300,
        max_samples="auto",
        contamination=contamination,
        max_features=0.8,
        bootstrap=True,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_tr_s)

    # Isolation Forest outputs -1 (anomaly) / 1 (normal)
    raw_pred  = model.predict(X_te_s)
    y_pred    = (raw_pred == -1).astype(int)
    scores    = -model.score_samples(X_te_s)           # higher = more anomalous

    # Metrics
    precision = precision_score(y_te, y_pred, zero_division=0) * 100
    recall    = recall_score(y_te, y_pred, zero_division=0) * 100
    f1        = f1_score(y_te, y_pred, zero_division=0) * 100
    fp_rate   = (np.sum((y_pred == 1) & (y_te == 0)) / max(np.sum(y_te == 0), 1)) * 100

    # Recent anomaly events for the dashboard
    test_rows = merged.iloc[split:].copy().reset_index(drop=True)
    test_rows["pred_anomaly"] = y_pred
    test_rows["anomaly_score"] = scores

    anomaly_events = (test_rows[test_rows["pred_anomaly"] == 1]
                      .sort_values("anomaly_score", ascending=False)
                      .head(14)
                      [["furnace", "date", "anomaly_score"]]
                      .to_dict("records"))

    confirmed = int(sum(1 for r in anomaly_events
                        if merged[merged["date"] == r["date"]]["true_anomaly"].any()))

    bundle = {"model": model, "scaler": scaler, "feature_cols": FEATURE_COLS,
              "contamination": contamination}
    joblib.dump(bundle, f"{MODEL_DIR}/anomaly_detector.joblib")

    meta = {
        "model":              "IsolationForest",
        "n_estimators":       300,
        "contamination":      round(contamination, 4),
        "precision_pct":      round(precision, 1),
        "recall_pct":         round(recall, 1),
        "f1_pct":             round(f1, 1),
        "false_positive_rate":round(fp_rate, 1),
        "n_features":         len(FEATURE_COLS),
        "train_samples":      split,
        "anomaly_events":     anomaly_events[:14],
        "flagged_last_30d":   len(anomaly_events),
        "confirmed_last_30d": confirmed,
        "trained_at":         pd.Timestamp.now().isoformat(),
    }
    with open(f"{MODEL_DIR}/anomaly_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"  Anomaly detector  precision={precision:.1f}%  "
          f"recall={recall:.1f}%  f1={f1:.1f}%  fp_rate={fp_rate:.1f}%")
    return meta

if __name__ == "__main__":
    train()
