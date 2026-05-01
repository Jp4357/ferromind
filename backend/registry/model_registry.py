"""
Model Registry — FerroMind Phase 2
Lightweight local model registry (MLflow-compatible structure).
Tracks model versions, performance metrics, training lineage, and promotion status.
In Phase 3 (AWS) this is replaced by SageMaker Model Registry or MLflow on ECS.
"""

import json, os, hashlib, shutil
from datetime import datetime
from pathlib import Path
from typing import Optional


REGISTRY_DIR = "registry/store"
REGISTRY_DB  = "registry/models.json"


def _load_db() -> dict:
    os.makedirs("registry", exist_ok=True)
    if not os.path.exists(REGISTRY_DB):
        return {"models": {}}
    with open(REGISTRY_DB) as f:
        return json.load(f)


def _save_db(db: dict):
    os.makedirs("registry", exist_ok=True)
    with open(REGISTRY_DB, "w") as f:
        json.dump(db, f, indent=2)


def register_model(
    model_name: str,
    version: str,
    artifact_dir: str,
    meta: dict,
    promote_to: str = "staging",  # staging | production
) -> dict:
    """
    Register a trained model version in the registry.
    Copies artefacts to a versioned directory.
    """
    db = _load_db()
    if model_name not in db["models"]:
        db["models"][model_name] = {"versions": []}

    version_dir = f"{REGISTRY_DIR}/{model_name}/{version}"
    os.makedirs(version_dir, exist_ok=True)

    # Copy model artefacts
    prefix_map = {
        "demand_forecaster":        ["demand_model.joblib", "demand_scaler.joblib", "demand_meta.json"],
        "supply_chain_optimizer":   ["optimizer_meta.json"],
        "anomaly_detector":         ["anomaly_model.joblib", "anomaly_scaler.joblib", "anomaly_meta.json"],
    }
    copied = []
    for fname in prefix_map.get(model_name, []):
        src = os.path.join(artifact_dir, fname)
        if os.path.exists(src):
            shutil.copy2(src, version_dir)
            copied.append(fname)

    # Compute artefact hash for integrity
    art_hash = hashlib.md5(
        "".join(sorted(copied)).encode()
    ).hexdigest()[:8]

    entry = {
        "version":        version,
        "status":         promote_to,
        "registered_at":  datetime.now().isoformat(),
        "artifact_dir":   version_dir,
        "artifacts":      copied,
        "artifact_hash":  art_hash,
        "metrics":        _extract_metrics(meta),
        "tags":           {"framework": meta.get("model_type", "unknown")},
    }

    # Demote previous production version if promoting new one
    if promote_to == "production":
        for v in db["models"][model_name]["versions"]:
            if v["status"] == "production":
                v["status"] = "archived"

    db["models"][model_name]["versions"].append(entry)
    _save_db(db)
    return entry


def _extract_metrics(meta: dict) -> dict:
    keys = ["mape_pct", "precision", "recall", "f1", "residual_std",
            "false_positive_rate", "contamination", "mc_runs"]
    return {k: meta[k] for k in keys if k in meta}


def get_latest(model_name: str, status: str = "production") -> Optional[dict]:
    db = _load_db()
    versions = db.get("models", {}).get(model_name, {}).get("versions", [])
    matching = [v for v in versions if v["status"] == status]
    return matching[-1] if matching else None


def list_models() -> dict:
    db = _load_db()
    summary = {}
    for name, info in db.get("models", {}).items():
        versions = info.get("versions", [])
        prod = next((v for v in reversed(versions) if v["status"] == "production"), None)
        summary[name] = {
            "total_versions": len(versions),
            "production":     prod["version"] if prod else None,
            "metrics":        prod["metrics"] if prod else {},
            "registered_at":  prod["registered_at"] if prod else None,
        }
    return summary


def print_registry():
    models = list_models()
    if not models:
        print("Registry is empty. Run train_all.py first.")
        return
    print("\n=== FerroMind Model Registry ===")
    for name, info in models.items():
        print(f"\n  {name}")
        print(f"    Production version : {info['production']}")
        print(f"    Registered at      : {info['registered_at']}")
        for k, v in info.get("metrics", {}).items():
            print(f"    {k:<28}: {v}")


if __name__ == "__main__":
    print_registry()
