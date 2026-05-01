"""
Supply Chain Optimizer — FerroMind Phase 2
Approach: Multi-objective Linear Programming (PuLP) + Monte Carlo simulation.
For each material it finds the order quantity that best balances:
  - Minimise cost
  - Maximise service level (days cover)
  - Minimise stockout risk
  - Minimise working capital
Confidence scores come from running the LP solution through 1,200 Monte Carlo scenarios.
"""

import numpy as np
import pandas as pd
import json, os, joblib
from datetime import datetime
from typing import Optional

try:
    import pulp
    PULP_AVAILABLE = True
except ImportError:
    PULP_AVAILABLE = False

from data.synthetic_generator import MATERIALS, DISRUPTION_EVENTS


MODEL_NAME    = "supply_chain_optimizer"
MODEL_VERSION = "2.0.0"
MC_RUNS       = 1200
SAFETY_STOCK_BUFFER = 1.15   # 15% buffer above stated minimum


def load_current_state(data_dir: str = "data") -> dict:
    """Load the most recent inventory and procurement snapshot."""
    inv_path  = os.path.join(data_dir, "inventory.parquet")
    proc_path = os.path.join(data_dir, "procurement.parquet")

    if not os.path.exists(inv_path):
        # Return sensible demo state if data not generated yet
        return {
            mat: {
                "qty_on_hand":   cfg["reorder"] * 0.9,
                "daily_use":     cfg["daily_use"],
                "unit_cost":     cfg["unit_cost"],
                "safety_stock":  cfg["safety_stock"],
                "reorder_point": cfg["reorder"],
                "max_stock":     cfg["max"],
                "lead_days":     cfg["lead_days"],
                "days_cover":    int(cfg["reorder"] * 0.9 / cfg["daily_use"]),
            }
            for mat, cfg in MATERIALS.items()
        }

    inv_df  = pd.read_parquet(inv_path)
    proc_df = pd.read_parquet(proc_path)

    latest = inv_df.groupby("material").last().reset_index()
    result = {}
    for _, row in latest.iterrows():
        mat = row["material"]
        if mat not in MATERIALS:
            continue
        cfg = MATERIALS[mat]

        # Estimate current lead time from recent POs
        recent_pos = proc_df[proc_df["material"] == mat].tail(10)
        avg_lead = recent_pos["lead_time_days"].mean() if len(recent_pos) else cfg["lead_days"]
        lead_std = recent_pos["lead_time_days"].std() if len(recent_pos) > 2 else avg_lead * 0.15

        result[mat] = {
            "qty_on_hand":    float(row["qty_on_hand"]),
            "daily_use":      cfg["daily_use"],
            "unit_cost":      float(row["unit_cost"]),
            "safety_stock":   cfg["safety_stock"],
            "reorder_point":  cfg["reorder"],
            "max_stock":      cfg["max"],
            "lead_days":      float(avg_lead),
            "lead_std":       float(lead_std if not np.isnan(lead_std) else avg_lead * 0.15),
            "days_cover":     int(row.get("days_cover", 0) or 0),
        }
    return result


def _solve_lp(
    state: dict,
    w_cost: float = 0.35,
    w_service: float = 0.45,
    w_wc: float = 0.20,
    budget_usd: float = 5_000_000,
) -> dict:
    """
    Solve the multi-objective LP.
    Returns recommended order qty per material.
    Falls back to rule-based if PuLP not available.
    """
    if not PULP_AVAILABLE:
        return _rule_based_fallback(state, budget_usd)

    prob = pulp.LpProblem("ferrochrome_supply_chain", pulp.LpMinimize)
    order_vars = {
        mat: pulp.LpVariable(f"order_{mat}", lowBound=0, upBound=cfg["max_stock"])
        for mat, cfg in state.items()
    }

    # Projected stock after order arrives
    projected = {
        mat: cfg["qty_on_hand"] + order_vars[mat] - cfg["daily_use"] * cfg["lead_days"]
        for mat, cfg in state.items()
    }

    # Objective: weighted combination
    cost_term    = pulp.lpSum(order_vars[mat] * cfg["unit_cost"] for mat, cfg in state.items())
    service_term = pulp.lpSum(
        -projected[mat] / max(cfg["daily_use"], 1) for mat, cfg in state.items()
    )
    wc_term      = pulp.lpSum(
        (cfg["qty_on_hand"] + order_vars[mat]) * cfg["unit_cost"]
        for mat, cfg in state.items()
    )

    prob += (
        w_cost    * cost_term / 1_000_000 +
        w_service * service_term / 100 +
        w_wc      * wc_term / 1_000_000
    )

    # Constraints
    # 1. Budget
    prob += pulp.lpSum(
        order_vars[mat] * cfg["unit_cost"] for mat, cfg in state.items()
    ) <= budget_usd, "budget"

    # 2. Safety stock must be maintained after delivery
    for mat, cfg in state.items():
        prob += projected[mat] >= cfg["safety_stock"] * SAFETY_STOCK_BUFFER, f"safety_{mat}"

    # 3. Don't exceed max capacity
    for mat, cfg in state.items():
        prob += cfg["qty_on_hand"] + order_vars[mat] <= cfg["max_stock"], f"max_{mat}"

    # 4. Only order if below reorder point
    for mat, cfg in state.items():
        if cfg["qty_on_hand"] > cfg["reorder_point"] * 1.05:
            prob += order_vars[mat] == 0, f"no_order_{mat}"

    status = prob.solve(pulp.PULP_CBC_CMD(msg=0))
    if pulp.LpStatus[status] in ("Optimal", "Feasible"):
        return {mat: max(0.0, pulp.value(order_vars[mat]) or 0.0) for mat in state}
    else:
        return _rule_based_fallback(state, budget_usd)


def _rule_based_fallback(state: dict, budget_usd: float) -> dict:
    """Simple rule-based ordering when PuLP is unavailable."""
    orders = {}
    remaining = budget_usd
    for mat, cfg in sorted(state.items(), key=lambda x: x[1]["days_cover"]):
        if cfg["qty_on_hand"] < cfg["reorder_point"]:
            qty = min(
                cfg["max_stock"] - cfg["qty_on_hand"],
                remaining / max(cfg["unit_cost"], 0.01),
            )
            qty = max(0, qty)
            orders[mat] = round(qty, 0)
            remaining -= qty * cfg["unit_cost"]
        else:
            orders[mat] = 0.0
    return orders


def _monte_carlo_confidence(
    order_qty: float,
    current_stock: float,
    daily_use: float,
    safety_stock: float,
    lead_days: float,
    lead_std: float,
    demand_variability: float = 0.08,
    n_runs: int = MC_RUNS,
) -> float:
    """
    Returns the fraction of MC scenarios where stock stays above safety stock.
    """
    rng = np.random.default_rng(42)
    simulated_leads    = rng.normal(lead_days, lead_std, n_runs)
    simulated_demands  = rng.normal(daily_use, daily_use * demand_variability, n_runs)
    simulated_leads    = np.clip(simulated_leads, 1, lead_days * 2.5)
    simulated_demands  = np.clip(simulated_demands, daily_use * 0.7, daily_use * 1.3)

    # Stock when order arrives = current - consumption during lead time
    stock_at_arrival   = current_stock - simulated_demands * simulated_leads + order_qty
    safe_count         = np.sum(stock_at_arrival >= safety_stock)
    return round(safe_count / n_runs, 4)


def _build_recommendations(state: dict, orders: dict, mc_scores: dict) -> list:
    recommendations = []
    priority = 1

    for mat, cfg in sorted(state.items(), key=lambda x: x[1]["days_cover"]):
        qty = orders.get(mat, 0)
        conf = mc_scores.get(mat, 0.95)

        if qty <= 0 and cfg["days_cover"] > 30:
            continue

        if cfg["days_cover"] < 7:
            level = "critical"
            action = f"URGENT: expedite {mat.replace('_',' ')} — only {cfg['days_cover']}d cover remaining"
        elif qty > 0:
            cost = qty * cfg["unit_cost"] / 1000
            level = "warning" if cfg["days_cover"] < 14 else "info"
            action = (
                f"Order {qty:,.0f} t of {mat.replace('_',' ')} "
                f"(${cost:,.0f}K) — {cfg['days_cover']}d current cover"
            )
        else:
            level = "info"
            action = f"{mat.replace('_',' ')} stock adequate ({cfg['days_cover']}d cover) — no order needed"

        # Estimate cost saving vs doing nothing (cost of stockout risk avoided)
        risk_cost = cfg["daily_use"] * cfg["unit_cost"] * max(0, 7 - cfg["days_cover"]) * 0.15
        recommendations.append({
            "priority":          priority,
            "level":             level,
            "material":          mat,
            "action":            action,
            "order_qty_t":       round(qty, 0),
            "order_cost_usd":    round(qty * cfg["unit_cost"], 0),
            "confidence_pct":    round(conf * 100, 1),
            "risk_cost_avoided": round(risk_cost, 0),
            "days_cover_now":    cfg["days_cover"],
            "mc_runs":           MC_RUNS,
        })
        priority += 1

    return sorted(recommendations, key=lambda x: (x["level"] != "critical", x["days_cover_now"]))


def optimize(
    data_dir: str = "data",
    artifact_dir: str = "artifacts",
    w_cost: float = 0.35,
    w_service: float = 0.45,
    w_wc: float = 0.20,
    budget_usd: float = 5_000_000,
) -> dict:
    state  = load_current_state(data_dir)
    orders = _solve_lp(state, w_cost, w_service, w_wc, budget_usd)

    mc_scores = {}
    for mat, cfg in state.items():
        mc_scores[mat] = _monte_carlo_confidence(
            order_qty=orders.get(mat, 0),
            current_stock=cfg["qty_on_hand"],
            daily_use=cfg["daily_use"],
            safety_stock=cfg["safety_stock"],
            lead_days=cfg["lead_days"],
            lead_std=cfg.get("lead_std", cfg["lead_days"] * 0.15),
        )

    recommendations = _build_recommendations(state, orders, mc_scores)
    total_order_value = sum(orders.get(m, 0) * state[m]["unit_cost"] for m in state)
    avg_service_level = np.mean(list(mc_scores.values())) * 100

    result = {
        "model_name":         MODEL_NAME,
        "model_version":      MODEL_VERSION,
        "solver":             "PuLP CBC" if PULP_AVAILABLE else "Rule-based",
        "generated_at":       datetime.now().isoformat(),
        "mc_runs":            MC_RUNS,
        "budget_usd":         budget_usd,
        "total_order_value":  round(total_order_value, 0),
        "avg_service_level":  round(avg_service_level, 2),
        "objective_weights":  {"cost": w_cost, "service": w_service, "working_capital": w_wc},
        "order_plan":         {mat: {"qty_t": round(qty, 0), "cost_usd": round(qty * state[mat]["unit_cost"], 0)} for mat, qty in orders.items()},
        "mc_confidence":      {mat: round(v * 100, 1) for mat, v in mc_scores.items()},
        "recommendations":    recommendations,
    }

    os.makedirs(artifact_dir, exist_ok=True)
    meta = {
        "model_name":      MODEL_NAME,
        "model_version":   MODEL_VERSION,
        "solver":          result["solver"],
        "mc_runs":         MC_RUNS,
        "trained_at":      datetime.now().isoformat(),
        "status":          "production",
    }
    with open(f"{artifact_dir}/optimizer_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    return result


if __name__ == "__main__":
    result = optimize()
    print(json.dumps({k: v for k, v in result.items() if k != "recommendations"}, indent=2))
    print(f"\nTop {min(3, len(result['recommendations']))} recommendations:")
    for r in result["recommendations"][:3]:
        print(f"  P{r['priority']} [{r['confidence_pct']}%] {r['action']}")
