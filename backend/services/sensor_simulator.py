"""
Sensor Simulator — FerroMind Phase 2
Background asyncio task that continuously generates realistic SAF furnace
sensor readings and scores them through the Isolation Forest model.
Anomalies are broadcast to all connected WebSocket clients instantly.

Normal readings:  every 3 seconds per active furnace
Anomaly rate:     ~3-5% (injected realistically — one sensor spikes first,
                  others follow slightly, mimicking real equipment behaviour)
"""

import asyncio, json, os, random
from collections import deque
import numpy as np
from datetime import datetime, timezone
from typing import Optional

# ── Sensor normal operating ranges ──────────────────────────────────────────
SENSOR_PROFILES = {
    "electrode_current_ka":  {"mean": 85.0, "std": 3.5,  "unit": "kA",    "label": "Electrode current"},
    "bath_temperature_c":    {"mean": 1680, "std": 25.0,  "unit": "°C",    "label": "Bath temperature"},
    "power_input_mw":        {"mean": 38.0, "std": 2.2,  "unit": "MW",    "label": "Power input"},
    "off_gas_co_pct":        {"mean": 72.0, "std": 4.0,  "unit": "%",     "label": "Off-gas CO"},
    "slag_basicity":         {"mean": 1.05, "std": 0.04, "unit": "ratio", "label": "Slag basicity"},
    "feed_rate_t_hr":        {"mean": 12.5, "std": 0.8,  "unit": "t/hr",  "label": "Feed rate"},
    "electrode_position_mm": {"mean": 450,  "std": 20.0,  "unit": "mm",    "label": "Electrode position"},
    "cooling_water_temp_c":  {"mean": 32.0, "std": 2.0,  "unit": "°C",    "label": "Cooling water temp"},
}

# Anomaly scenarios — realistic failure modes for submerged arc furnaces
ANOMALY_SCENARIOS = [
    {
        "name":     "Bath temperature excursion",
        "severity": "critical",
        "sensors":  {"bath_temperature_c": 1.10, "power_input_mw": 1.12, "cooling_water_temp_c": 1.25},
        "message":  "Bath temperature spike — possible electrode short circuit",
    },
    {
        "name":     "Electrode fault",
        "severity": "critical",
        "sensors":  {"electrode_current_ka": 1.55, "electrode_position_mm": 1.40, "power_input_mw": 1.35},
        "message":  "Electrode current surge — check electrode break or slipping",
    },
    {
        "name":     "Feed rate drop",
        "severity": "warning",
        "sensors":  {"feed_rate_t_hr": 0.45, "off_gas_co_pct": 0.60},
        "message":  "Feed rate below normal — possible bin blockage or conveyor fault",
    },
    {
        "name":     "Cooling system stress",
        "severity": "warning",
        "sensors":  {"cooling_water_temp_c": 1.75, "bath_temperature_c": 1.06},
        "message":  "Cooling water temperature elevated — check flow rate",
    },
    {
        "name":     "Off-gas deviation",
        "severity": "warning",
        "sensors":  {"off_gas_co_pct": 0.50, "slag_basicity": 1.28},
        "message":  "Off-gas CO drop — possible air ingress or burden collapse",
    },
    {
        "name":     "Power imbalance",
        "severity": "critical",
        "sensors":  {"power_input_mw": 1.48, "electrode_current_ka": 1.38, "electrode_position_mm": 0.62},
        "message":  "Power input spike with electrode position anomaly",
    },
]

FURNACES     = ["SAF-01", "SAF-02", "SAF-03", "SAF-04"]
ACTIVE_FURNACES = ["SAF-01", "SAF-02"]   # SAF-03 standby, SAF-04 maintenance
INTERVAL_SEC = 3      # seconds between readings per furnace
ANOMALY_PROB = 0.04   # 4% chance per reading


def _generate_normal_reading(furnace: str) -> dict:
    """Generate a single normal sensor reading with realistic noise."""
    reading = {"furnace": furnace}
    for sensor, cfg in SENSOR_PROFILES.items():
        reading[sensor] = round(
            float(np.random.normal(cfg["mean"], cfg["std"])), 3
        )
    return reading


def _inject_anomaly(furnace: str) -> tuple[dict, dict]:
    """
    Generate an anomalous reading by selecting a random failure scenario
    and multiplying affected sensors by their anomaly factors.
    Returns (reading, scenario).
    """
    scenario = random.choice(ANOMALY_SCENARIOS)
    reading  = {"furnace": furnace}

    for sensor, cfg in SENSOR_PROFILES.items():
        base = float(np.random.normal(cfg["mean"], cfg["std"] * 0.5))
        factor = scenario["sensors"].get(sensor, 1.0)
        # Add extra noise to anomalous sensors
        if factor != 1.0:
            noise = np.random.normal(0, cfg["std"] * 0.3)
            reading[sensor] = round(base * factor + noise, 3)
        else:
            reading[sensor] = round(base, 3)

    return reading, scenario


def _compute_anomaly_score(reading: dict, model, scaler, buffer: deque) -> tuple[float, bool]:
    """
    Returns (display_score 0-1, is_anomaly_by_model).
    Uses model.predict() for the binary decision (correct contamination-calibrated threshold).
    Normalises display score so the model boundary maps to 0.5.
    """
    import pandas as pd

    sensor_cols = list(SENSOR_PROFILES.keys())

    # Build a DataFrame from the rolling buffer (includes current reading)
    df = pd.DataFrame([{c: r[c] for c in sensor_cols} for r in buffer])

    # Engineer features exactly as in training (anomaly_detector.py::engineer_features)
    out = df[sensor_cols].copy()
    for col in sensor_cols:
        out[f"{col}_roll4_mean"] = df[col].rolling(4, min_periods=1).mean()
        out[f"{col}_roll4_std"]  = df[col].rolling(4, min_periods=1).std().fillna(0)
    out["power_per_feed"]   = df["power_input_mw"] / df["feed_rate_t_hr"].clip(lower=0.1)
    out["temp_per_current"] = df["bath_temperature_c"] / df["electrode_current_ka"].clip(lower=1)

    X_s          = scaler.transform(out.iloc[[-1]])   # DataFrame → feature names preserved
    raw_score    = float(model.score_samples(X_s)[0])
    is_anomaly   = bool(model.predict(X_s)[0] == -1)  # uses model's own calibrated threshold

    # Normalise for display: model.offset_ is the decision boundary in raw-score space.
    # boundary → 0.5, normal (score > boundary) → <0.5, anomaly → >0.5
    boundary     = float(model.offset_)   # e.g. -0.496
    display      = float(np.clip(0.5 - (raw_score - boundary) / 0.5, 0, 1))
    return round(display, 4), is_anomaly


def _identify_triggered_sensors(reading: dict, scenario: Optional[dict]) -> list[str]:
    """Return list of sensors that exceeded 2.5σ from normal."""
    triggered = []
    for sensor, cfg in SENSOR_PROFILES.items():
        val = reading.get(sensor, cfg["mean"])
        z   = abs(val - cfg["mean"]) / max(cfg["std"], 1e-6)
        if z > 2.5:
            triggered.append({
                "sensor": sensor,
                "label":  cfg["label"],
                "value":  val,
                "unit":   cfg["unit"],
                "z_score": round(z, 1),
            })
    return triggered


class SensorSimulator:
    """
    Runs as a FastAPI lifespan background task.
    Generates readings, scores them, and pushes anomalies to the
    WebSocket connection manager.
    """

    def __init__(self):
        self.model       = None
        self.scaler      = None
        self.running     = False
        self._task       = None
        self.total_readings  = 0
        self.total_anomalies = 0
        self._broadcast_fn   = None   # injected by WebSocket manager
        # Per-furnace rolling buffer (4 readings) for proper feature engineering
        self._buffers = {f: deque(maxlen=4) for f in FURNACES}
        # Latest complete reading per furnace — consumed by the plant context tool
        self.latest_readings: dict = {}

    def set_broadcast(self, fn):
        self._broadcast_fn = fn

    def _load_models(self):
        artifact_dir = os.path.join(
            os.path.dirname(__file__), "..", "artifacts"
        )
        model_path  = os.path.join(artifact_dir, "anomaly_model.joblib")
        scaler_path = os.path.join(artifact_dir, "anomaly_scaler.joblib")
        if os.path.exists(model_path):
            import joblib
            self.model  = joblib.load(model_path)
            self.scaler = joblib.load(scaler_path)
            print("  [simulator] Isolation Forest loaded ✓")
        else:
            print("  [simulator] No trained model found — anomaly scoring disabled")

    async def start(self):
        self._load_models()
        self.running = True
        self._task   = asyncio.create_task(self._run_loop())
        print("  [simulator] Sensor stream started")

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
        print("  [simulator] Sensor stream stopped")

    async def _run_loop(self):
        """Main loop — generates one reading per active furnace every INTERVAL_SEC."""
        while self.running:
            for furnace in ACTIVE_FURNACES:
                await self._process_furnace(furnace)
            await asyncio.sleep(INTERVAL_SEC)

    async def _process_furnace(self, furnace: str):
        inject   = random.random() < ANOMALY_PROB
        scenario = None

        if inject:
            reading, scenario = _inject_anomaly(furnace)
        else:
            reading = _generate_normal_reading(furnace)

        # Update rolling buffer before scoring so current reading is included
        self._buffers[furnace].append(reading)

        self.total_readings += 1
        ts = datetime.now(timezone.utc).isoformat()

        # Store latest reading for external consumers (e.g. plant context tool)
        self.latest_readings[furnace] = {**reading, "timestamp": ts}

        # Score with ML model if available
        if self.model is not None:
            anom_score, is_anomaly_ml = _compute_anomaly_score(reading, self.model, self.scaler, self._buffers[furnace])
            is_anomaly = is_anomaly_ml or inject
        else:
            anom_score = 0.92 if inject else round(random.uniform(0.02, 0.18), 3)
            is_anomaly = inject

        if is_anomaly:
            self.total_anomalies += 1
            triggered = _identify_triggered_sensors(reading, scenario)
            severity  = scenario["severity"] if scenario else (
                "critical" if anom_score > 0.75 else "warning"
            )

            alert = {
                "type":          "anomaly",
                "id":            f"anom-{self.total_anomalies:04d}",
                "timestamp":     ts,
                "furnace":       furnace,
                "scenario":      scenario["name"] if scenario else "Unknown anomaly",
                "message":       scenario["message"] if scenario else "Sensor readings outside normal bounds",
                "severity":      severity,
                "anomaly_score": anom_score,
                "triggered_sensors": triggered,
                "reading":       {k: v for k, v in reading.items() if k != "furnace"},
                "stats": {
                    "total_readings":  self.total_readings,
                    "total_anomalies": self.total_anomalies,
                    "anomaly_rate_pct": round(self.total_anomalies / self.total_readings * 100, 2),
                },
            }

            if self._broadcast_fn:
                await self._broadcast_fn(alert)
        else:
            # Broadcast a "heartbeat" reading so the frontend shows live data
            heartbeat = {
                "type":          "reading",
                "timestamp":     ts,
                "furnace":       furnace,
                "anomaly_score": anom_score,
                "is_anomaly":    False,
                "key_sensors": {
                    "bath_temperature_c":   reading["bath_temperature_c"],
                    "electrode_current_ka": reading["electrode_current_ka"],
                    "power_input_mw":       reading["power_input_mw"],
                    "feed_rate_t_hr":       reading["feed_rate_t_hr"],
                },
                "stats": {
                    "total_readings":  self.total_readings,
                    "total_anomalies": self.total_anomalies,
                    "anomaly_rate_pct": round(self.total_anomalies / self.total_readings * 100, 2) if self.total_readings else 0,
                },
            }
            if self._broadcast_fn:
                await self._broadcast_fn(heartbeat)


# Singleton — imported by main.py and the WebSocket router
simulator = SensorSimulator()
