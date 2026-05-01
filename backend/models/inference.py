"""
Model inference layer for FerroMind Phase 2.
Loads all trained models at startup and exposes clean prediction functions
consumed by the FastAPI routers.
"""

import numpy as np
import pandas as pd
import joblib, json, os
from functools import lru_cache
from datetime import datetime, timedelta

BASE = os.path.dirname(__file__)
DATA_DIR  = os.path.join(BASE, "..", "data")
MODEL_DIR = os.path.join(BASE, "..", "models")

# ── Lazy loaders (loaded once on first call) ───────────────────────────────────

@lru_cache(maxsize=1)
def _demand_bundle():
    return {
        "model":    joblib.load(f"{MODEL_DIR}/demand_forecaster.joblib"),
        "scaler":   joblib.load(f"{MODEL_DIR}/demand_scaler.joblib"),
        "features": joblib.load(f"{MODEL_DIR}/demand_feature_cols.joblib"),
        "meta":     json.load(open(f"{MODEL_DIR}/demand_meta.json")),
    }

@lru_cache(maxsize=1)
def _sc_bundle():
    return {
        "bundle": joblib.load(f"{MODEL_DIR}/sc_optimizer.joblib"),
        "meta":   json.load(open(f"{MODEL_DIR}/sc_meta.json")),
    }

@lru_cache(maxsize=1)
def _anomaly_bundle():
    return {
        "bundle": joblib.load(f"{MODEL_DIR}/anomaly_detector.joblib"),
        "meta":   json.load(open(f"{MODEL_DIR}/anomaly_meta.json")),
    }

# ── 1. Demand forecasting ──────────────────────────────────────────────────────

def get_demand_forecast():
    """Return 12-week ahead demand forecast with CIs."""
    b    = _demand_bundle()
    meta = b["meta"]
    return {
        "labels":   [f["week_label"] for f in meta["forecasts"]],
        "forecast": [int(f["forecast"]) for f in meta["forecasts"]],
        "upper_ci": [int(f["upper_ci"]) for f in meta["forecasts"]],
        "lower_ci": [int(f["lower_ci"]) for f in meta["forecasts"]],
    }

def get_forecast_accuracy():
    """Return historical actual vs forecast for accuracy chart."""
    meta = _demand_bundle()["meta"]
    ah   = meta["accuracy_history"]
    return {
        "labels":   ah["labels"],
        "actual":   [int(v) for v in ah["actual"]],
        "forecast": [int(v) for v in ah["forecast"]],
    }

def get_model_cards():
    """Return model performance cards for all 3 models."""
    dm = _demand_bundle()["meta"]
    sc = _sc_bundle()["meta"]
    am = _anomaly_bundle()["meta"]

    return [
        {
            "name": "Demand Forecaster", "color": "blue",
            "type": "XGBoost Regressor · Rolling 12-week horizon",
            "metrics": [
                {"label": "MAPE",             "value": f"{dm['mape']:.1f}%"},
                {"label": "Last retrained",   "value": dm["trained_at"][:10]},
                {"label": "Training samples", "value": f"{dm['train_weeks']} weeks"},
                {"label": "Features",         "value": str(dm["n_features"]),   "highlight": "green"},
                {"label": "Status",           "value": "Production",  "badge": "green"},
            ],
        },
        {
            "name": "Supply Chain Optimizer", "color": "teal",
            "type": "Multi-objective LP · Monte Carlo (1,200 scenarios)",
            "metrics": [
                {"label": "Scenarios / run",        "value": str(sc["n_simulations"])},
                {"label": "Last run",               "value": sc["trained_at"][:10]},
                {"label": "Monthly cost saving",    "value": f"${sc['monthly_saving_usd']:,.0f}",  "highlight": "green"},
                {"label": "Overall confidence",     "value": f"{sc['overall_confidence']}%"},
                {"label": "Status",                 "value": "Production", "badge": "green"},
            ],
        },
        {
            "name": "Anomaly Detector", "color": "amber",
            "type": "Isolation Forest · Real-time sensor stream",
            "metrics": [
                {"label": "Precision",           "value": f"{am['precision_pct']}%"},
                {"label": "Recall",              "value": f"{am['recall_pct']}%"},
                {"label": "Alerts (last 30d)",   "value": f"{am['flagged_last_30d']} flagged / {am['confirmed_last_30d']} confirmed"},
                {"label": "False positive rate", "value": f"{am['false_positive_rate']}%"},
                {"label": "Status",              "value": "Production", "badge": "green"},
            ],
        },
    ]

# ── 2. Supply chain optimizer ──────────────────────────────────────────────────

def get_sc_recommendations():
    """Return ranked optimizer recommendations."""
    return _sc_bundle()["meta"]["recommendations"]

def run_sc_optimizer(weights: dict | None = None):
    """Re-run LP + Monte Carlo with custom weights. Returns new recommendations."""
    from training.train_sc_optimizer import (
        run_lp, monte_carlo, generate_recommendations, MATERIAL_CONFIG
    )
    sc  = _sc_bundle()
    lt_stats = sc["meta"]["lead_time_stats"]

    inv = pd.read_csv(f"{DATA_DIR}/inventory.csv")
    latest = inv[inv["date"] == inv["date"].max()]
    current_stock = {r["material"]: r["qty_on_hand"] for _, r in latest.iterrows()}

    w = weights or {"cost": 0.30, "service": 0.35, "stockout": 0.25, "wc": 0.10}
    orders   = run_lp(current_stock, {}, weights=w)
    mc_res, overall_conf = monte_carlo(orders, current_stock, lt_stats, n_sims=600)
    recs     = generate_recommendations(orders, mc_res, current_stock, lt_stats)
    return {"recommendations": recs, "overall_confidence": overall_conf, "orders": orders}

# ── 3. Anomaly detection ───────────────────────────────────────────────────────

def get_recent_anomalies(limit: int = 14):
    """Return recent anomaly events from training data."""
    meta = _anomaly_bundle()["meta"]
    events = meta.get("anomaly_events", [])[:limit]
    return [
        {
            "furnace":       e.get("furnace", "SAF-01"),
            "date":          e.get("date", "2024-12-01"),
            "anomaly_score": round(float(e.get("anomaly_score", 0.0)), 3),
            "severity":      "critical" if e.get("anomaly_score", 0) > 0.8
                             else "warning",
        }
        for e in events
    ]

def score_sensor_reading(reading: dict) -> dict:
    """
    Score a single sensor reading dict in real time.
    reading = {sensor_type: value, ...} for all 6 sensor types on one furnace/date.
    Returns: {is_anomaly, anomaly_score, contributing_features}
    """
    b       = _anomaly_bundle()["bundle"]
    model   = b["model"]
    scaler  = b["scaler"]
    feat_cols = b["feature_cols"]

    SENSOR_TYPES = [
        "temperature_c", "electrode_pos_mm", "power_mw",
        "off_gas_co_pct", "tap_weight_t", "cr_yield_pct",
    ]
    BASELINES = {
        "temperature_c": 1620, "electrode_pos_mm": 1850, "power_mw": 38.2,
        "off_gas_co_pct": 62.0, "tap_weight_t": 38.5, "cr_yield_pct": 88.2,
    }
    STDS = {
        "temperature_c": 18, "electrode_pos_mm": 25, "power_mw": 1.4,
        "off_gas_co_pct": 2.1, "tap_weight_t": 1.8, "cr_yield_pct": 0.8,
    }

    row = {}
    for st in SENSOR_TYPES:
        val = reading.get(st, BASELINES[st])
        row[f"{st}_val"]    = val
        row[f"{st}_zscore"] = (val - BASELINES[st]) / STDS[st]
        row[f"{st}_roc"]    = 0.0

    temp  = reading.get("temperature_c", BASELINES["temperature_c"])
    power = reading.get("power_mw",      BASELINES["power_mw"])
    cr    = reading.get("cr_yield_pct",  BASELINES["cr_yield_pct"])
    row["temp_power_ratio"] = temp / max(power, 0.01)
    row["cr_temp_ratio"]    = cr / max(temp, 0.01)

    X = np.array([[row.get(c, 0.0) for c in feat_cols]])
    X_s = scaler.transform(X)

    pred  = model.predict(X_s)[0]
    score = float(-model.score_samples(X_s)[0])
    is_anomaly = pred == -1

    top_features = sorted(
        [(c, abs(row.get(c, 0))) for c in feat_cols if "zscore" in c],
        key=lambda x: x[1], reverse=True
    )[:3]

    return {
        "is_anomaly":           bool(is_anomaly),
        "anomaly_score":        round(score, 4),
        "contributing_features": [f[0].replace("_zscore", "") for f in top_features],
    }

# ── 4. Live sensor simulation (for demo streaming) ────────────────────────────

def simulate_sensor_reading(furnace: str = "SAF-01", inject_anomaly: bool = False):
    """Generate a realistic real-time sensor reading (used for demo streaming)."""
    rng = np.random.default_rng()
    BASELINES = {
        "temperature_c": 1620, "electrode_pos_mm": 1850, "power_mw": 38.2,
        "off_gas_co_pct": 62.0, "tap_weight_t": 38.5, "cr_yield_pct": 88.2,
    }
    STDS = {
        "temperature_c": 18, "electrode_pos_mm": 25, "power_mw": 1.4,
        "off_gas_co_pct": 2.1, "tap_weight_t": 1.8, "cr_yield_pct": 0.8,
    }
    reading = {}
    for st, base in BASELINES.items():
        val = base + rng.normal(0, STDS[st])
        if inject_anomaly and st in ["temperature_c", "power_mw"]:
            val += rng.choice([-1, 1]) * rng.uniform(4, 7) * STDS[st]
        reading[st] = round(float(val), 3)
    result = score_sensor_reading(reading)
    return {
        "furnace":   furnace,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "readings":  reading,
        **result,
    }
