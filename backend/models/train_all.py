"""
train_all.py — FerroMind Phase 2
Single entry point: generates synthetic data, trains all 3 ML models,
registers them in the local model registry.

Usage:
    cd backend
    python models/train_all.py

Expected runtime: ~2-4 minutes depending on machine.
"""

import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.synthetic_generator import generate_all
from models.demand_forecaster import train as train_demand, MODEL_VERSION as DV
from models.supply_chain_optimizer import optimize as run_optimizer, MODEL_VERSION as OV
from models.anomaly_detector import train as train_anomaly, MODEL_VERSION as AV
from registry.model_registry import register_model, print_registry

ARTIFACT_DIR = "artifacts"
DATA_DIR     = "data"


def banner(msg: str):
    w = 60
    print("\n" + "─" * w)
    print(f"  {msg}")
    print("─" * w)


def main():
    total_start = time.time()

    # ── Step 1: Generate synthetic data ──────────────────────────
    banner("Step 1/4  Generating 2 years of synthetic data")
    t = time.time()
    stats = generate_all(DATA_DIR)
    print(f"  Done in {time.time()-t:.1f}s")

    # ── Step 2: Demand forecaster ─────────────────────────────────
    banner("Step 2/4  Training demand forecaster (XGBoost)")
    t = time.time()
    demand_meta = train_demand(DATA_DIR, ARTIFACT_DIR)
    register_model("demand_forecaster", DV, ARTIFACT_DIR, demand_meta, promote_to="production")
    print(f"  MAPE: {demand_meta['mape_pct']:.2f}%  |  Done in {time.time()-t:.1f}s")

    # ── Step 3: Supply chain optimizer ────────────────────────────
    banner("Step 3/4  Running supply chain optimizer (LP + Monte Carlo)")
    t = time.time()
    opt_result = run_optimizer(DATA_DIR, ARTIFACT_DIR)
    opt_meta   = {
        "model_name":    opt_result["model_name"],
        "model_version": opt_result["model_version"],
        "model_type":    opt_result["solver"],
        "mc_runs":       opt_result["mc_runs"],
        "status":        "production",
    }
    register_model("supply_chain_optimizer", OV, ARTIFACT_DIR, opt_meta, promote_to="production")
    print(f"  Avg service level: {opt_result['avg_service_level']:.1f}%  |  Done in {time.time()-t:.1f}s")

    # ── Step 4: Anomaly detector ──────────────────────────────────
    banner("Step 4/4  Training anomaly detector (Isolation Forest)")
    t = time.time()
    anomaly_meta = train_anomaly(DATA_DIR, ARTIFACT_DIR)
    register_model("anomaly_detector", AV, ARTIFACT_DIR, anomaly_meta, promote_to="production")
    print(
        f"  Precision: {anomaly_meta['precision']:.3f}  "
        f"Recall: {anomaly_meta['recall']:.3f}  "
        f"F1: {anomaly_meta['f1']:.3f}  |  Done in {time.time()-t:.1f}s"
    )

    # ── Summary ───────────────────────────────────────────────────
    banner(f"All done in {time.time()-total_start:.1f}s")
    print_registry()

    # Write a combined training summary for the API to serve
    summary = {
        "trained_at":   __import__("datetime").datetime.now().isoformat(),
        "data_stats":   stats,
        "demand_forecaster": {
            "mape_pct":      demand_meta["mape_pct"],
            "model_type":    demand_meta["model_type"],
            "training_rows": demand_meta["training_rows"],
            "status":        "production",
        },
        "supply_chain_optimizer": {
            "solver":          opt_result["solver"],
            "mc_runs":         opt_result["mc_runs"],
            "avg_service_lvl": opt_result["avg_service_level"],
            "status":          "production",
        },
        "anomaly_detector": {
            "precision":   anomaly_meta["precision"],
            "recall":      anomaly_meta["recall"],
            "f1":          anomaly_meta["f1"],
            "model_type":  anomaly_meta["model_type"],
            "status":      "production",
        },
    }
    with open(f"{ARTIFACT_DIR}/training_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\n  Summary saved → {ARTIFACT_DIR}/training_summary.json")


if __name__ == "__main__":
    main()
