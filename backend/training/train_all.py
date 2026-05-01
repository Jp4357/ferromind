"""
Master training script — runs all 3 models in sequence.
Usage:
    cd backend
    python training/train_all.py
"""
import time, sys, os
sys.path.insert(0, os.path.dirname(__file__))

from generate_data      import main as gen_main
from train_demand       import train as train_demand
from train_sc_optimizer import train as train_sc
from train_anomaly      import train as train_anomaly

if __name__ == "__main__":
    print("=" * 60)
    print("FerroMind Phase 2 — Training Pipeline")
    print("=" * 60)

    t0 = time.time()

    print("\n[1/4] Generating synthetic dataset...")
    import importlib, training.generate_data as gd
    gd.main() if hasattr(gd, "main") else exec(open(
        os.path.join(os.path.dirname(__file__), "generate_data.py")).read())

    print("\n[2/4] Training demand forecaster...")
    demand_meta = train_demand()

    print("\n[3/4] Training supply chain optimizer...")
    sc_meta = train_sc()

    print("\n[4/4] Training anomaly detector...")
    anomaly_meta = train_anomaly()

    elapsed = time.time() - t0
    print(f"\n{'=' * 60}")
    print(f"Training complete in {elapsed:.1f}s")
    print(f"  Demand MAPE         : {demand_meta['mape']:.2f}%")
    print(f"  SC confidence       : {sc_meta['overall_confidence']}%")
    print(f"  Anomaly precision   : {anomaly_meta['precision_pct']}%")
    print(f"  Anomaly recall      : {anomaly_meta['recall_pct']}%")
    print(f"Models saved to backend/models/")
    print("=" * 60)
