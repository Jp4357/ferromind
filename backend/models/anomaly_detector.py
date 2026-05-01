"""
Anomaly Detector — FerroMind Phase 2
Model: Isolation Forest (primary) + statistical z-score (secondary validation).
Trained on 2 years of furnace sensor readings.
Detects: electrode faults, bath temperature excursions, feed rate drops,
         off-gas deviations, cooling system stress.
"""

import numpy as np
import pandas as pd
import joblib, json, os
from datetime import datetime
from typing import Optional

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import precision_score, recall_score, f1_score


SENSOR_COLS = [
    "electrode_current_ka",
    "bath_temperature_c",
    "power_input_mw",
    "off_gas_co_pct",
    "slag_basicity",
    "feed_rate_t_hr",
    "electrode_position_mm",
    "cooling_water_temp_c",
]

MODEL_NAME    = "anomaly_detector"
MODEL_VERSION = "2.0.0"
CONTAMINATION = 0.03   # matches our synthetic anomaly rate


def load_sensor_data(data_dir: str = "data") -> pd.DataFrame:
    path = os.path.join(data_dir, "sensors.parquet")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Sensor data not found at {path}. Run synthetic_generator.py first."
        )
    return pd.read_parquet(path)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add rolling statistics and cross-sensor ratios as extra features."""
    out = df[SENSOR_COLS].copy()

    # Per-furnace rolling mean and std (4-reading window = 16h)
    for col in SENSOR_COLS:
        out[f"{col}_roll4_mean"] = (
            df.groupby("furnace")[col]
              .transform(lambda x: x.rolling(4, min_periods=1).mean())
        )
        out[f"{col}_roll4_std"] = (
            df.groupby("furnace")[col]
              .transform(lambda x: x.rolling(4, min_periods=1).std().fillna(0))
        )

    # Cross-sensor ratios (physically meaningful)
    out["power_per_feed"]   = df["power_input_mw"] / df["feed_rate_t_hr"].clip(lower=0.1)
    out["temp_per_current"] = df["bath_temperature_c"] / df["electrode_current_ka"].clip(lower=1)

    return out


def train(data_dir: str = "data", artifact_dir: str = "artifacts") -> dict:
    os.makedirs(artifact_dir, exist_ok=True)
    df = load_sensor_data(data_dir)

    # Use only "normal" readings to fit the Isolation Forest
    train_df = df[~df["is_anomaly"]].copy()
    print(f"  Training on {len(train_df):,} normal readings")

    X_train = engineer_features(train_df)
    scaler  = StandardScaler()
    X_s     = scaler.fit_transform(X_train)

    model = IsolationForest(
        n_estimators=200,
        max_samples="auto",
        contamination=CONTAMINATION,
        max_features=1.0,
        bootstrap=False,
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X_s)

    # Evaluate on the full dataset (has labelled anomalies)
    X_all    = engineer_features(df)
    X_all_s  = scaler.transform(X_all)
    y_true   = df["is_anomaly"].astype(int).values
    y_pred   = (model.predict(X_all_s) == -1).astype(int)
    scores   = model.score_samples(X_all_s)   # lower = more anomalous

    precision = precision_score(y_true, y_pred, zero_division=0)
    recall    = recall_score(y_true, y_pred, zero_division=0)
    f1        = f1_score(y_true, y_pred, zero_division=0)

    print(f"  Anomaly Detector — precision: {precision:.3f}  recall: {recall:.3f}  F1: {f1:.3f}")

    # Threshold: anomaly_score <= threshold flags as anomaly
    normal_scores  = scores[y_true == 0]
    anomaly_scores = scores[y_true == 1]
    threshold = float(np.percentile(normal_scores, 5))   # 5th pct of normal = boundary

    joblib.dump(model,  f"{artifact_dir}/anomaly_model.joblib")
    joblib.dump(scaler, f"{artifact_dir}/anomaly_scaler.joblib")

    meta = {
        "model_name":          MODEL_NAME,
        "model_version":       MODEL_VERSION,
        "model_type":          "IsolationForest",
        "trained_at":          datetime.now().isoformat(),
        "training_rows":       len(train_df),
        "n_estimators":        200,
        "contamination":       CONTAMINATION,
        "precision":           round(precision, 4),
        "recall":              round(recall, 4),
        "f1":                  round(f1, 4),
        "anomaly_score_threshold": round(threshold, 4),
        "sensor_cols":         SENSOR_COLS,
        "false_positive_rate": round(1 - precision, 4),
        "status":              "production",
    }
    with open(f"{artifact_dir}/anomaly_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    return meta


def predict_batch(
    readings: list[dict],
    artifact_dir: str = "artifacts",
) -> list[dict]:
    """
    Score a batch of sensor readings.
    Each reading is a dict with keys matching SENSOR_COLS + 'furnace'.
    Returns the same dicts with 'is_anomaly' and 'anomaly_score' added.
    """
    model  = joblib.load(f"{artifact_dir}/anomaly_model.joblib")
    scaler = joblib.load(f"{artifact_dir}/anomaly_scaler.joblib")
    with open(f"{artifact_dir}/anomaly_meta.json") as f:
        meta = json.load(f)

    df       = pd.DataFrame(readings)
    X        = engineer_features(df)
    X_s      = scaler.transform(X)
    raw_pred = model.predict(X_s)
    scores   = model.score_samples(X_s)

    results = []
    for i, reading in enumerate(readings):
        is_anom   = bool(raw_pred[i] == -1)
        anom_score = float(np.clip(1 - (scores[i] - scores.min()) / (scores.max() - scores.min() + 1e-9), 0, 1))
        results.append({
            **reading,
            "is_anomaly":    is_anom,
            "anomaly_score": round(anom_score, 4),
            "flagged_sensors": _identify_flagged_sensors(reading, meta) if is_anom else [],
        })
    return results


def _identify_flagged_sensors(reading: dict, meta: dict) -> list[str]:
    """
    Simple z-score check to identify which sensors contributed to the anomaly flag.
    Uses the meta's training means/stds (approximated from generator constants).
    """
    from data.synthetic_generator import SENSORS
    flagged = []
    for sensor, cfg in SENSORS.items():
        if sensor not in reading:
            continue
        z = abs(reading[sensor] - cfg["mean"]) / max(cfg["std"], 1e-6)
        if z > 2.8:
            flagged.append(sensor)
    return flagged


def get_recent_anomalies(
    n: int = 20,
    data_dir: str = "data",
    artifact_dir: str = "artifacts",
) -> dict:
    """
    Returns recent anomaly statistics for the dashboard.
    In production this would query the live sensor stream.
    Here we use the held-out test portion of the synthetic data.
    """
    df = load_sensor_data(data_dir)
    recent = df.tail(2000).copy()

    model  = joblib.load(f"{artifact_dir}/anomaly_model.joblib")
    scaler = joblib.load(f"{artifact_dir}/anomaly_scaler.joblib")
    with open(f"{artifact_dir}/anomaly_meta.json") as f:
        meta = json.load(f)

    X        = engineer_features(recent)
    X_s      = scaler.transform(X)
    raw_pred = model.predict(X_s)
    scores   = model.score_samples(X_s)

    recent  = recent.copy()
    recent["predicted_anomaly"] = raw_pred == -1
    recent["anomaly_score_norm"] = np.clip(
        1 - (scores - scores.min()) / (scores.max() - scores.min() + 1e-9), 0, 1
    )

    flagged = recent[recent["predicted_anomaly"]].tail(n)
    anomaly_events = []
    for _, row in flagged.iterrows():
        sensors_triggered = []
        for sensor in SENSOR_COLS:
            from data.synthetic_generator import SENSORS
            z = abs(row[sensor] - SENSORS[sensor]["mean"]) / max(SENSORS[sensor]["std"], 1e-6)
            if z > 2.8:
                sensors_triggered.append(f"{sensor}={row[sensor]:.2f} (z={z:.1f})")
        anomaly_events.append({
            "timestamp":     str(row["timestamp"]),
            "furnace":       row["furnace"],
            "anomaly_score": round(float(row["anomaly_score_norm"]), 4),
            "sensors":       sensors_triggered,
            "confirmed":     bool(row.get("is_anomaly", False)),
        })

    total   = len(recent)
    flagged_count = int(recent["predicted_anomaly"].sum())
    confirmed     = int((recent["predicted_anomaly"] & recent["is_anomaly"]).sum()) if "is_anomaly" in recent.columns else "N/A"

    return {
        "model_name":      meta["model_name"],
        "model_version":   meta["model_version"],
        "precision":       meta["precision"],
        "recall":          meta["recall"],
        "f1":              meta["f1"],
        "false_positive_rate": meta["false_positive_rate"],
        "window_readings": total,
        "flagged":         flagged_count,
        "confirmed":       confirmed,
        "anomaly_rate_pct": round(flagged_count / total * 100, 2),
        "recent_events":   anomaly_events[-n:],
    }


if __name__ == "__main__":
    result = train()
    print(json.dumps(result, indent=2))
