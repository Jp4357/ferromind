"""
Synthetic Data Generator — FerroMind Phase 2
Generates 2 years of realistic ferrochrome plant data with:
  - Seasonal demand patterns (stainless steel market cycles)
  - Realistic material consumption tied to production output
  - Natural inventory fluctuations with occasional supply events
  - Sensor readings with realistic noise + rare anomalies (~3% rate)
  - Supplier lead time variability
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json, os, random

SEED = 42
np.random.seed(SEED)
random.seed(SEED)

# ── Constants ────────────────────────────────────────────────────────────────
START_DATE   = datetime(2023, 1, 1)
END_DATE     = datetime(2024, 12, 31)
PLANT_ID     = "vtc-wit-001"
ANOMALY_RATE = 0.03   # 3% of sensor readings are anomalous

MATERIALS = {
    "chromite_ore":    {"daily_use": 2350, "unit_cost": 198,  "safety_stock": 20000, "reorder": 45000, "max": 80000, "lead_days": 8},
    "met_coke":        {"daily_use": 480,  "unit_cost": 312,  "safety_stock": 3000,  "reorder": 4500,  "max": 12000, "lead_days": 9},
    "quartzite":       {"daily_use": 210,  "unit_cost": 28,   "safety_stock": 2000,  "reorder": 4200,  "max": 9000,  "lead_days": 4},
    "electrode_paste": {"daily_use": 8.4,  "unit_cost": 1840, "safety_stock": 80,    "reorder": 120,   "max": 400,   "lead_days": 12},
    "lime":            {"daily_use": 62,   "unit_cost": 45,   "safety_stock": 600,   "reorder": 900,   "max": 3000,  "lead_days": 5},
}

FURNACES = ["SAF-01", "SAF-02", "SAF-03", "SAF-04"]

SENSORS = {
    "electrode_current_ka":   {"mean": 85,   "std": 3.5,  "unit": "kA",   "anomaly_multiplier": 1.6},
    "bath_temperature_c":     {"mean": 1680, "std": 25,   "unit": "°C",   "anomaly_multiplier": 1.08},
    "power_input_mw":         {"mean": 38,   "std": 2.2,  "unit": "MW",   "anomaly_multiplier": 1.5},
    "off_gas_co_pct":         {"mean": 72,   "std": 4,    "unit": "%",    "anomaly_multiplier": 0.55},
    "slag_basicity":          {"mean": 1.05, "std": 0.04, "unit": "ratio","anomaly_multiplier": 1.35},
    "feed_rate_t_hr":         {"mean": 12.5, "std": 0.8,  "unit": "t/hr", "anomaly_multiplier": 0.6},
    "electrode_position_mm":  {"mean": 450,  "std": 20,   "unit": "mm",   "anomaly_multiplier": 1.4},
    "cooling_water_temp_c":   {"mean": 32,   "std": 2,    "unit": "°C",   "anomaly_multiplier": 1.7},
}

# Supply disruption events (date, material, duration_days, severity 0-1)
DISRUPTION_EVENTS = [
    ("2023-04-10", "met_coke",     6, 0.4),   # Port congestion
    ("2023-09-18", "chromite_ore", 4, 0.3),   # Supplier logistics
    ("2024-02-05", "quartzite",    3, 0.25),  # Weather delay
    ("2024-07-22", "met_coke",     8, 0.5),   # Strike action
    ("2024-11-01", "electrode_paste", 5, 0.35),
]

# Maintenance windows — furnaces offline
MAINTENANCE_EVENTS = [
    ("2023-03-15", "SAF-04", 12),
    ("2023-08-01", "SAF-02", 8),
    ("2024-01-20", "SAF-03", 15),
    ("2024-06-10", "SAF-04", 10),
    ("2024-10-05", "SAF-01", 7),
]


def seasonal_demand_multiplier(date: datetime) -> float:
    """
    Ferrochrome demand follows stainless steel production cycles.
    Peaks in Q1 (Jan–Feb restocking) and Q3 (pre-autumn build).
    Troughs in Q2 (spring slowdown) and late Q4 (year-end).
    """
    day_of_year = date.timetuple().tm_yday
    # Primary annual cycle
    base = 1.0 + 0.12 * np.sin(2 * np.pi * (day_of_year - 30) / 365)
    # Secondary half-year cycle (smaller amplitude)
    secondary = 0.04 * np.sin(4 * np.pi * (day_of_year - 15) / 365)
    # Long-term upward trend (3% YoY growth)
    years_elapsed = (date - START_DATE).days / 365
    trend = 1 + 0.03 * years_elapsed
    return (base + secondary) * trend


def active_furnaces_on_date(date: datetime) -> list:
    """Returns which furnaces are running on a given date."""
    offline = set()
    for event_date_str, furnace, duration in MAINTENANCE_EVENTS:
        event_date = datetime.strptime(event_date_str, "%Y-%m-%d")
        if event_date <= date < event_date + timedelta(days=duration):
            offline.add(furnace)
    return [f for f in FURNACES if f not in offline]


def disruption_factor_on_date(date: datetime, material: str) -> float:
    """Lead time multiplier due to disruptions (1.0 = normal)."""
    for event_date_str, mat, duration, severity in DISRUPTION_EVENTS:
        event_date = datetime.strptime(event_date_str, "%Y-%m-%d")
        if mat == material and event_date <= date < event_date + timedelta(days=duration):
            return 1.0 + severity
    return 1.0


# ── Generators ───────────────────────────────────────────────────────────────

def generate_production_data() -> pd.DataFrame:
    """Daily production output per furnace."""
    records = []
    dates = pd.date_range(START_DATE, END_DATE, freq="D")
    for date in dates:
        active = active_furnaces_on_date(date.to_pydatetime())
        season = seasonal_demand_multiplier(date.to_pydatetime())
        for furnace in active:
            base_output = 38.5 * season
            noise = np.random.normal(0, 1.2)
            output = max(0, base_output + noise)
            energy = output * (49.5 + np.random.normal(0, 1.8))
            cr_pct = np.clip(np.random.normal(52.0, 0.8), 49, 55)
            fe_pct = np.clip(np.random.normal(29.8, 0.6), 27, 33)
            grade = "HC FeCr" if cr_pct >= 50 and fe_pct <= 31 else "Off-spec"
            records.append({
                "date": date.date(),
                "furnace": furnace,
                "output_t": round(output, 2),
                "energy_mwh": round(energy, 1),
                "kwh_per_t": round(energy / output if output > 0 else 0, 1),
                "cr_pct": round(cr_pct, 2),
                "fe_pct": round(fe_pct, 2),
                "grade": grade,
                "active_furnaces": len(active),
            })
    return pd.DataFrame(records)


def generate_inventory_data(production_df: pd.DataFrame) -> pd.DataFrame:
    """Daily inventory snapshots for all materials."""
    records = []
    dates = pd.date_range(START_DATE, END_DATE, freq="D")

    # Starting stocks (mid-comfortable)
    stocks = {m: cfg["reorder"] * 1.3 for m, cfg in MATERIALS.items()}
    stocks["fecr_finished"] = 2000.0

    # Daily total plant output
    daily_output = production_df.groupby("date")["output_t"].sum().to_dict()

    for date in dates:
        d = date.date()
        output_today = daily_output.get(d, 0)
        season = seasonal_demand_multiplier(date.to_pydatetime())

        for mat, cfg in MATERIALS.items():
            # Consumption proportional to output + noise
            consumption_factor = (output_today / (38.5 * 2)) if output_today > 0 else 0.3
            daily_consumption = cfg["daily_use"] * consumption_factor * np.random.uniform(0.93, 1.07)

            # Disruption affects incoming supply (delayed receipts)
            disruption = disruption_factor_on_date(date.to_pydatetime(), mat)

            # Auto-reorder logic: if below reorder point, receive a shipment
            if stocks[mat] < cfg["reorder"] and disruption <= 1.2:
                reorder_qty = cfg["max"] - stocks[mat]
                receive_qty = reorder_qty * np.random.uniform(0.85, 1.0)
                stocks[mat] += receive_qty

            stocks[mat] = max(0, stocks[mat] - daily_consumption)
            stocks[mat] = min(stocks[mat], cfg["max"])

            days_cover = int(stocks[mat] / cfg["daily_use"]) if cfg["daily_use"] > 0 else None
            if stocks[mat] < cfg["safety_stock"]:
                status = "below_safety"
            elif stocks[mat] < cfg["reorder"]:
                status = "below_reorder"
            elif stocks[mat] > cfg["max"] * 0.9:
                status = "excess"
            else:
                status = "ok"

            records.append({
                "date": d,
                "material": mat,
                "qty_on_hand": round(stocks[mat], 1),
                "qty_available": round(stocks[mat] * 0.95, 1),
                "unit_cost": cfg["unit_cost"],
                "total_value": round(stocks[mat] * cfg["unit_cost"], 0),
                "days_cover": days_cover,
                "stock_status": status,
                "disruption_active": disruption > 1.0,
            })

        # Finished FeCr
        stocks["fecr_finished"] = max(
            500,
            min(5000, stocks["fecr_finished"] + output_today - (output_today * 0.92 * season))
        )

    return pd.DataFrame(records)


def generate_procurement_data() -> pd.DataFrame:
    """Purchase order history with lead time variability."""
    records = []
    po_num = 1000
    dates = pd.date_range(START_DATE, END_DATE, freq="D")

    for date in dates:
        for mat, cfg in MATERIALS.items():
            # Each material triggers a PO roughly on its reorder cycle
            cycle_days = int(cfg["max"] / cfg["daily_use"] * 0.6)
            if (date.dayofyear + hash(mat)) % max(cycle_days, 5) == 0:
                disruption = disruption_factor_on_date(date.to_pydatetime(), mat)
                base_lead = cfg["lead_days"]
                actual_lead = int(base_lead * disruption * np.random.uniform(0.9, 1.2))
                qty = cfg["max"] * np.random.uniform(0.4, 0.7)
                price = cfg["unit_cost"] * np.random.uniform(0.95, 1.06)
                on_time = actual_lead <= base_lead * 1.1
                auto_gen = np.random.random() < 0.65

                records.append({
                    "po_number": f"PO-{date.year}-{po_num:04d}",
                    "date_ordered": date.date(),
                    "material": mat,
                    "qty_ordered": round(qty, 0),
                    "unit_price": round(price, 2),
                    "total_value": round(qty * price, 0),
                    "lead_time_days": actual_lead,
                    "expected_lead_days": base_lead,
                    "on_time": on_time,
                    "auto_generated": auto_gen,
                    "status": "received",
                    "disruption_active": disruption > 1.0,
                    "date_received": (date + timedelta(days=actual_lead)).date(),
                })
                po_num += 1

    return pd.DataFrame(records)


def generate_sensor_data(production_df: pd.DataFrame) -> pd.DataFrame:
    """
    Hourly sensor readings per active furnace.
    3% anomaly rate — anomalies cluster slightly (realistic equipment behaviour).
    """
    records = []
    # Sample every 4 hours to keep dataset manageable (still 4380 rows/furnace/year)
    dates = pd.date_range(START_DATE, END_DATE, freq="4h")
    anomaly_streak = {f: 0 for f in FURNACES}

    for ts in dates:
        active = active_furnaces_on_date(ts.to_pydatetime())
        for furnace in active:
            # Anomaly logic: once one fires, slightly elevated chance for next reading
            is_anomaly_base = np.random.random() < ANOMALY_RATE
            streak = anomaly_streak[furnace]
            is_anomaly = is_anomaly_base or (streak > 0 and np.random.random() < 0.25)
            anomaly_streak[furnace] = min(streak + 1, 3) if is_anomaly else 0

            row = {
                "timestamp": ts,
                "furnace": furnace,
                "is_anomaly": is_anomaly,
            }
            for sensor, cfg in SENSORS.items():
                if is_anomaly:
                    val = cfg["mean"] * cfg["anomaly_multiplier"] + np.random.normal(0, cfg["std"] * 2)
                else:
                    val = cfg["mean"] + np.random.normal(0, cfg["std"])
                row[sensor] = round(val, 3)

            row["anomaly_score"] = round(
                np.random.uniform(0.6, 0.95) if is_anomaly else np.random.uniform(0.01, 0.18), 3
            )
            records.append(row)

    return pd.DataFrame(records)


def generate_demand_features(production_df: pd.DataFrame, inventory_df: pd.DataFrame) -> pd.DataFrame:
    """
    Weekly aggregated features for demand forecasting model.
    Target: next-week FeCr output in tonnes.
    """
    prod_daily = production_df.groupby("date").agg(
        total_output_t=("output_t", "sum"),
        active_furnaces=("furnace", "count"),
        avg_cr_pct=("cr_pct", "mean"),
        avg_kwh_per_t=("kwh_per_t", "mean"),
    ).reset_index()
    prod_daily["date"] = pd.to_datetime(prod_daily["date"])
    prod_daily.set_index("date", inplace=True)

    chromite = inventory_df[inventory_df["material"] == "chromite_ore"][
        ["date", "qty_on_hand", "days_cover"]
    ].copy()
    chromite["date"] = pd.to_datetime(chromite["date"])
    chromite.set_index("date", inplace=True)

    combined = prod_daily.join(chromite.rename(columns={
        "qty_on_hand": "chromite_stock",
        "days_cover": "chromite_cover",
    }))

    weekly = combined.resample("W").agg({
        "total_output_t": "sum",
        "active_furnaces": "mean",
        "avg_cr_pct": "mean",
        "avg_kwh_per_t": "mean",
        "chromite_stock": "mean",
        "chromite_cover": "mean",
    }).reset_index()

    weekly["week_of_year"]  = weekly["date"].dt.isocalendar().week.astype(int)
    weekly["month"]         = weekly["date"].dt.month
    weekly["quarter"]       = weekly["date"].dt.quarter
    weekly["sin_week"]      = np.sin(2 * np.pi * weekly["week_of_year"] / 52)
    weekly["cos_week"]      = np.cos(2 * np.pi * weekly["week_of_year"] / 52)
    weekly["sin_month"]     = np.sin(2 * np.pi * weekly["month"] / 12)
    weekly["cos_month"]     = np.cos(2 * np.pi * weekly["month"] / 12)
    weekly["lag_1w"]        = weekly["total_output_t"].shift(1)
    weekly["lag_2w"]        = weekly["total_output_t"].shift(2)
    weekly["lag_4w"]        = weekly["total_output_t"].shift(4)
    weekly["rolling_4w"]    = weekly["total_output_t"].rolling(4).mean()
    weekly["rolling_8w"]    = weekly["total_output_t"].rolling(8).mean()
    weekly["target"]        = weekly["total_output_t"].shift(-1)   # predict next week

    return weekly.dropna()


def generate_all(output_dir: str = "data") -> dict:
    """Generate all datasets and save to parquet + CSV."""
    os.makedirs(output_dir, exist_ok=True)
    print("Generating production data ...")
    prod_df   = generate_production_data()
    print(f"  {len(prod_df):,} furnace-day records")

    print("Generating inventory data ...")
    inv_df    = generate_inventory_data(prod_df)
    print(f"  {len(inv_df):,} inventory snapshots")

    print("Generating procurement data ...")
    proc_df   = generate_procurement_data()
    print(f"  {len(proc_df):,} purchase orders")

    print("Generating sensor data (this may take ~30s) ...")
    sensor_df = generate_sensor_data(prod_df)
    print(f"  {len(sensor_df):,} sensor readings  |  anomalies: {sensor_df['is_anomaly'].sum():,}")

    print("Building demand forecast features ...")
    feat_df   = generate_demand_features(prod_df, inv_df)
    print(f"  {len(feat_df):,} weekly feature rows")

    prod_df.to_parquet(f"{output_dir}/production.parquet", index=False)
    inv_df.to_parquet(f"{output_dir}/inventory.parquet", index=False)
    proc_df.to_parquet(f"{output_dir}/procurement.parquet", index=False)
    sensor_df.to_parquet(f"{output_dir}/sensors.parquet", index=False)
    feat_df.to_parquet(f"{output_dir}/demand_features.parquet", index=False)

    # Also save small CSVs for inspection
    prod_df.tail(60).to_csv(f"{output_dir}/production_sample.csv", index=False)
    sensor_df[sensor_df["is_anomaly"]].head(50).to_csv(f"{output_dir}/anomalies_sample.csv", index=False)

    stats = {
        "generated_at": datetime.now().isoformat(),
        "date_range": f"{START_DATE.date()} → {END_DATE.date()}",
        "production_records": len(prod_df),
        "inventory_snapshots": len(inv_df),
        "purchase_orders": len(proc_df),
        "sensor_readings": len(sensor_df),
        "anomaly_count": int(sensor_df["is_anomaly"].sum()),
        "anomaly_rate_pct": round(sensor_df["is_anomaly"].mean() * 100, 2),
        "demand_feature_rows": len(feat_df),
        "disruption_events": len(DISRUPTION_EVENTS),
        "maintenance_events": len(MAINTENANCE_EVENTS),
    }
    with open(f"{output_dir}/stats.json", "w") as f:
        json.dump(stats, f, indent=2)

    print("\nAll datasets saved.")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    return stats


if __name__ == "__main__":
    generate_all("data")
