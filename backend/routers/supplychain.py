from fastapi import APIRouter

router = APIRouter()

@router.get("/kpis")
def get_kpis():
    return {
        "active_suppliers":   {"value": 9,      "note": "6 primary, 3 backup"},
        "supply_risk_score":  {"value": 3.2,    "out_of": 10, "level": "Low"},
        "avg_transport_cost": {"value": 18.4,   "unit": "$/t", "vs_last_q": "-4%"},
        "shipments_transit":  {"value": 4,      "delayed": 1},
    }

@router.get("/suppliers")
def get_suppliers():
    return [
        {"name": "Nkwe Mining",     "material": "Chromite ore",    "location": "Lephalale, LP",   "distance": "340 km", "lead_time": "6–8 days",   "status": "Primary"},
        {"name": "Samancor Chrome", "material": "Chromite ore",    "location": "Rustenburg, NW",  "distance": "420 km", "lead_time": "8–10 days",  "status": "Primary"},
        {"name": "Xstrata Chrome",  "material": "Chromite ore",    "location": "Steelpoort, LP",  "distance": "280 km", "lead_time": "5–7 days",   "status": "Backup"},
        {"name": "ArcelorMittal",   "material": "Met. Coke",       "location": "Newcastle, KZN",  "distance": "200 km", "lead_time": "7–9 days",   "status": "Primary"},
        {"name": "Glencore Coal",   "material": "Met. Coke",       "location": "eMalahleni, MP",  "distance": "90 km",  "lead_time": "4–6 days",   "status": "Under Review"},
        {"name": "Lafarge SA",      "material": "Quartzite",       "location": "Middelburg, MP",  "distance": "120 km", "lead_time": "3–5 days",   "status": "Primary"},
        {"name": "SGL Carbon",      "material": "Electrode Paste", "location": "Johannesburg",    "distance": "140 km", "lead_time": "10–14 days", "status": "Primary"},
    ]

@router.get("/risk-matrix")
def get_risk_matrix():
    return [
        {"material": "Chromite Ore",    "supply_risk": "Medium", "price_vol": "High",   "alt_suppliers": 3, "risk_level": "Moderate"},
        {"material": "Met. Coke",       "supply_risk": "Medium", "price_vol": "High",   "alt_suppliers": 2, "risk_level": "Moderate"},
        {"material": "Quartzite",       "supply_risk": "Low",    "price_vol": "Low",    "alt_suppliers": 4, "risk_level": "Low"},
        {"material": "Electrode Paste", "supply_risk": "High",   "price_vol": "Medium", "alt_suppliers": 1, "risk_level": "High"},
        {"material": "Electricity",     "supply_risk": "Medium", "price_vol": "Medium", "alt_suppliers": 0, "risk_level": "Moderate"},
        {"material": "Lime",            "supply_risk": "Low",    "price_vol": "Low",    "alt_suppliers": 5, "risk_level": "Low"},
    ]

@router.get("/lead-time-chart")
def get_lead_time_chart():
    return {
        "labels":  ["Chromite Ore", "Met. Coke", "Quartzite", "Electrode Paste", "Lime"],
        "target":  [7, 7, 4, 12, 5],
        "actual":  [8, 13, 4, 11, 5],
    }

@router.get("/cost-chart")
def get_cost_chart():
    return {
        "labels": ["Chromite Ore", "Met. Coke", "Transport", "Quartzite", "Other"],
        "values": [1620, 750, 380, 140, 150],
    }
