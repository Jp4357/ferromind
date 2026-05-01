"""
Synthetic data generator for FerroMind Phase 2.
Produces 2 years of realistic daily ferrochrome plant data:
  - Production output (FeCr tonnes/day)
  - Raw material consumption & inventory
  - Sensor readings (furnace temperature, energy, Cr recovery)
  - Supply chain events (lead time variability, disruptions)
  - Demand signals
Feel: clean operations with occasional realistic anomalies
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json, os

RNG = np.random.default_rng(42)

START  = datetime(2023, 1, 1)
END    = datetime(2024, 12, 31)
DATES  = pd.date_range(START, END, freq="D")
N      = len(DATES)
OUT    = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT, exist_ok=True)

# ── helpers ──────────────────────────────────────────────────────────────────

def seasonal(dates, base, amp, phase=0):
    """Smooth annual + weekly seasonality."""
    doy  = np.array([d.timetuple().tm_yday for d in dates])
    dow  = np.array([d.weekday() for d in dates])
    ann  = amp * np.sin(2 * np.pi * doy / 365 + phase)
    week = 0.03 * base * (dow >= 5)          # slight weekend dip
    return base + ann + week

def inject_anomalies(series, dates, n_events=6, severity_range=(0.12, 0.28)):
    """Inject n short-duration dip/spike events (1-4 days each)."""
    arr = series.copy()
    event_indices = RNG.choice(range(30, N - 30), size=n_events, replace=False)
    for idx in event_indices:
        duration  = int(RNG.integers(1, 5))
        severity  = RNG.uniform(*severity_range)
        direction = RNG.choice([-1, 1])
        for j in range(duration):
            if idx + j < N:
                arr[idx + j] *= (1 + direction * severity)
    return arr

def smooth_noise(size, scale, corr=0.85):
    """AR(1) correlated noise — more realistic than iid."""
    noise = np.zeros(size)
    noise[0] = RNG.normal(0, scale)
    for i in range(1, size):
        noise[i] = corr * noise[i-1] + RNG.normal(0, scale * np.sqrt(1 - corr**2))
    return noise

# ── 1. PRODUCTION DATA ────────────────────────────────────────────────────────

def gen_production():
    base_output = 78.0          # t FeCr / day per 2 active furnaces
    trend       = np.linspace(0, 4.0, N)    # slight 4t ramp over 2 years
    output_base = seasonal(DATES, base_output, 4.5, phase=np.pi/6) + trend
    output_base += smooth_noise(N, 1.8)

    # Furnace maintenance windows (SAF-04 offline 2×/year ~10 days each)
    output_base = inject_anomalies(output_base, DATES, n_events=5, severity_range=(0.08, 0.20))

    # Planned Q3 ramp when SAF-03 brought online (2024-07 onward +20%)
    ramp_start = pd.Timestamp("2024-07-01")
    ramp_mask  = DATES >= ramp_start
    output_base[ramp_mask] *= 1.18

    output     = np.clip(output_base, 55, 115)
    energy_mwh = output * (49.5 + smooth_noise(N, 1.2))   # ~49.5 kWh/t base
    cr_recovery = np.clip(88.0 + smooth_noise(N, 0.6) + 0.5 * np.sin(2*np.pi*np.arange(N)/180), 84, 93)

    df = pd.DataFrame({
        "date":              DATES,
        "fecr_output_t":     np.round(output, 2),
        "energy_mwh":        np.round(energy_mwh, 1),
        "kwh_per_tonne":     np.round(energy_mwh / output, 2),
        "cr_recovery_pct":   np.round(cr_recovery, 2),
        "active_furnaces":   np.where(ramp_mask, 3, 2),
    })
    df.to_csv(f"{OUT}/production.csv", index=False)
    print(f"  production.csv          {len(df)} rows")
    return df

# ── 2. INVENTORY DATA ─────────────────────────────────────────────────────────

def gen_inventory(prod_df):
    records = []
    materials = {
        "chromite_ore":   {"stock": 55000, "daily": 2350, "reorder": 45000, "safety": 20000, "price": 198},
        "met_coke":       {"stock": 8000,  "daily": 480,  "reorder": 4500,  "safety": 3000,  "price": 312},
        "quartzite_flux": {"stock": 6500,  "daily": 210,  "reorder": 4200,  "safety": 2000,  "price": 28},
        "electrode_paste":{"stock": 280,   "daily": 8.4,  "reorder": 120,   "safety": 80,    "price": 1840},
        "lime":           {"stock": 1800,  "daily": 62,   "reorder": 900,   "safety": 600,   "price": 44},
    }

    state = {m: cfg["stock"] for m, cfg in materials.items()}

    for i, (date, row) in enumerate(prod_df.iterrows()):
        output_factor = row["fecr_output_t"] / 78.0
        for mat, cfg in materials.items():
            daily_use = cfg["daily"] * output_factor * RNG.uniform(0.97, 1.03)
            state[mat] = max(0, state[mat] - daily_use)
            # Trigger replenishment with realistic lead time
            if state[mat] < cfg["reorder"]:
                lt    = int(RNG.integers(6, 14))         # 6-13 day lead time
                order = cfg["reorder"] * RNG.uniform(1.6, 2.2)
                # Deliver after lead time
                future = i + lt
                if future < N:
                    state[mat] += order * RNG.uniform(0.95, 1.0)  # occasional short delivery

            days_cover = state[mat] / cfg["daily"] if cfg["daily"] > 0 else 0
            if state[mat] < cfg["safety"]:
                status = "below_safety"
            elif state[mat] < cfg["reorder"]:
                status = "below_reorder"
            else:
                status = "ok"

            records.append({
                "date":         DATES[i].strftime("%Y-%m-%d"),
                "material":     mat,
                "qty_on_hand":  round(state[mat], 1),
                "daily_use":    round(daily_use, 2),
                "days_cover":   round(days_cover, 1),
                "unit_cost":    cfg["price"] * RNG.uniform(0.97, 1.04),
                "stock_status": status,
            })

    df = pd.DataFrame(records)
    df.to_csv(f"{OUT}/inventory.csv", index=False)
    print(f"  inventory.csv           {len(df)} rows")
    return df

# ── 3. DEMAND / FECR ORDER BOOK ───────────────────────────────────────────────

def gen_demand():
    # FeCr demand driven by global stainless steel production cycles
    base_demand = seasonal(DATES, 14_500, 1_800, phase=-np.pi/4)
    base_demand += np.linspace(0, 2_500, N)     # structural growth
    base_demand += smooth_noise(N, 400, corr=0.9)

    # 2024-Q1 demand surge (stainless market tightening)
    surge_mask = (DATES >= "2024-01-01") & (DATES < "2024-04-01")
    base_demand[surge_mask] *= 1.14

    # Demand dip (market correction mid-2023)
    dip_mask = (DATES >= "2023-06-01") & (DATES < "2023-08-01")
    base_demand[dip_mask] *= 0.91

    demand = np.clip(base_demand, 9_000, 22_000)

    df = pd.DataFrame({
        "date":        DATES,
        "demand_t":    np.round(demand, 0).astype(int),
        "price_usd_t": np.round(1_380 + smooth_noise(N, 45, corr=0.95) + np.linspace(0, 120, N), 2),
    })
    df.to_csv(f"{OUT}/demand.csv", index=False)
    print(f"  demand.csv              {len(df)} rows")
    return df

# ── 4. SENSOR READINGS (for anomaly detection) ────────────────────────────────

def gen_sensors():
    records = []
    furnaces = ["SAF-01", "SAF-02"]

    sensors = {
        "temperature_c":    {"base": 1620, "std": 18,  "unit": "°C"},
        "electrode_pos_mm": {"base": 1850, "std": 25,  "unit": "mm"},
        "power_mw":         {"base": 38.2, "std": 1.4, "unit": "MW"},
        "off_gas_co_pct":   {"base": 62.0, "std": 2.1, "unit": "%"},
        "tap_weight_t":     {"base": 38.5, "std": 1.8, "unit": "t"},
        "cr_yield_pct":     {"base": 88.2, "std": 0.8, "unit": "%"},
    }

    # Pre-generate anomaly days — ~18 anomaly days over 2 years
    anomaly_days = set(RNG.choice(range(N), size=18, replace=False).tolist())

    for i, date in enumerate(DATES):
        is_anomaly_day = i in anomaly_days
        for furnace in furnaces:
            # SAF-02 offline some periods
            if furnace == "SAF-02" and date.year == 2023 and date.month in [3, 9]:
                continue

            for sensor, cfg in sensors.items():
                noise = RNG.normal(0, cfg["std"])
                value = cfg["base"] + noise + smooth_noise(3, cfg["std"] * 0.3)[1]

                is_anomaly = False
                anomaly_score = 0.0

                if is_anomaly_day and RNG.random() < 0.35:
                    # Realistic anomaly: temperature spike, power dip, etc.
                    anomaly_direction = RNG.choice([-1, 1])
                    anomaly_magnitude = RNG.uniform(3.5, 7.0) * cfg["std"]
                    value += anomaly_direction * anomaly_magnitude
                    is_anomaly    = True
                    anomaly_score = round(float(RNG.uniform(0.72, 0.98)), 4)

                records.append({
                    "date":          DATES[i].strftime("%Y-%m-%d"),
                    "furnace":       furnace,
                    "sensor_tag":    f"{furnace}_{sensor.upper()}",
                    "sensor_type":   sensor,
                    "value":         round(float(value), 3),
                    "unit":          cfg["unit"],
                    "is_anomaly":    is_anomaly,
                    "anomaly_score": anomaly_score,
                })

    df = pd.DataFrame(records)
    df.to_csv(f"{OUT}/sensor_readings.csv", index=False)
    print(f"  sensor_readings.csv     {len(df)} rows")
    return df

# ── 5. SUPPLY CHAIN / PROCUREMENT ─────────────────────────────────────────────

def gen_procurement():
    records = []
    po_num  = 2023001
    suppliers = {
        "chromite_ore":    [("Nkwe Mining", 8, 0.94, 198), ("Samancor Chrome", 9, 0.88, 194)],
        "met_coke":        [("ArcelorMittal", 8, 0.91, 312), ("Glencore Coal", 5, 0.74, 298)],
        "quartzite_flux":  [("Lafarge SA", 4, 0.96, 28)],
        "electrode_paste": [("SGL Carbon", 12, 0.89, 1840)],
        "lime":            [("PPC Ltd", 5, 0.92, 44)],
    }

    for i, date in enumerate(DATES[::14]):   # every ~2 weeks
        for mat, sups in suppliers.items():
            sup_idx = 0
            # Occasionally use backup supplier for chromite/coke
            if mat in ["chromite_ore", "met_coke"] and RNG.random() < 0.18:
                sup_idx = min(1, len(sups) - 1)

            name, base_lt, reliability, price = sups[sup_idx]
            # Lead time variability — unreliable suppliers have fatter tails
            lt_noise  = RNG.normal(0, 2 if reliability < 0.85 else 1)
            actual_lt = max(1, int(base_lt + lt_noise))
            on_time   = RNG.random() < reliability

            # Occasional port/logistics disruption
            disruption = False
            if mat == "met_coke" and date.month in [4, 10] and RNG.random() < 0.25:
                actual_lt  += int(RNG.integers(3, 8))
                on_time     = False
                disruption  = True

            qty   = RNG.uniform(1.5, 2.5) * {
                "chromite_ore": 8000, "met_coke": 2500,
                "quartzite_flux": 5000, "electrode_paste": 120, "lime": 800
            }[mat]

            records.append({
                "po_number":     f"PO-{po_num}",
                "date":          date.strftime("%Y-%m-%d"),
                "material":      mat,
                "supplier":      name,
                "qty_ordered":   round(qty, 0),
                "unit_price":    round(price * RNG.uniform(0.97, 1.04), 2),
                "base_lead_days": base_lt,
                "actual_lead_days": actual_lt,
                "on_time":       on_time,
                "disruption":    disruption,
                "supplier_reliability": reliability,
            })
            po_num += 1

    df = pd.DataFrame(records)
    df.to_csv(f"{OUT}/procurement.csv", index=False)
    print(f"  procurement.csv         {len(df)} rows")
    return df

# ── MAIN ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Generating 2-year synthetic ferrochrome dataset...")
    prod_df  = gen_production()
    inv_df   = gen_inventory(prod_df)
    dem_df   = gen_demand()
    sens_df  = gen_sensors()
    proc_df  = gen_procurement()

    # Summary metadata
    meta = {
        "start":       START.isoformat(),
        "end":         END.isoformat(),
        "days":        N,
        "anomaly_days": int(sens_df["is_anomaly"].sum()),
        "total_fecr_t": float(prod_df["fecr_output_t"].sum().round(0)),
        "avg_daily_output": float(prod_df["fecr_output_t"].mean().round(2)),
        "procurement_events": len(proc_df),
    }
    with open(f"{OUT}/meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nDataset summary:")
    for k, v in meta.items():
        print(f"  {k}: {v}")
    print(f"\nAll files written to {OUT}/")
