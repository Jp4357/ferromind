from fastapi import APIRouter

router = APIRouter()

@router.get("/kpis")
def get_kpis():
    return {
        "fecr_output_mtd": {"value": 14280, "unit": "t", "vs_plan": "+6.4%", "trend": "up"},
        "chromite_stock": {"value": 42100, "unit": "t", "coverage_days": 18, "trend": "warn"},
        "energy_consumption": {"value": 3840, "unit": "MWh", "vs_baseline": "-2.1%", "trend": "up"},
        "open_purchase_orders": {"value": 12, "overdue": 2, "trend": "down"},
        "forecast_accuracy": {"value": 91.4, "unit": "%", "mape": 8.6, "trend": "up"},
    }

@router.get("/production-chart")
def get_production_chart():
    return {
        "labels": ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"],
        "actual": [12400, 11800, 13100, 13600, 13900, 14280],
        "forecast": [12200, 12100, 12900, 13200, 13700, 13400],
    }

@router.get("/alerts")
def get_alerts():
    return [
        {
            "id": 1, "level": "critical",
            "message": "Chromite ore stock at 42,100 t — reorder point breached (threshold: 45,000 t). Auto-PO draft generated for Supplier A.",
            "time": "Today 06:15 SAST",
        },
        {
            "id": 2, "level": "warning",
            "message": "Metallurgical coke lead time extended by 6 days due to Durban port congestion. Safety stock buffer projected to absorb delay.",
            "time": "Yesterday 18:30 SAST",
        },
        {
            "id": 3, "level": "info",
            "message": "Demand forecast revised upward for Q3. ML model updated with latest stainless steel order book data. Recommend reviewing procurement plan.",
            "time": "Yesterday 09:00 SAST",
        },
    ]

@router.get("/furnaces")
def get_furnaces():
    return [
        {"unit": "SAF-01", "status": "Running",     "load": 88, "output": 38.4},
        {"unit": "SAF-02", "status": "Running",     "load": 92, "output": 40.1},
        {"unit": "SAF-03", "status": "Standby",     "load": 0,  "output": None},
        {"unit": "SAF-04", "status": "Maintenance", "load": None, "output": None},
    ]

@router.get("/material-flow")
def get_material_flow():
    return {
        "labels": ["Chromite Ore", "Met. Coke", "Quartzite", "Electrode Paste", "Lime"],
        "values": [2350, 480, 210, 8, 62],
    }

@router.get("/activity")
def get_activity():
    return [
        {"color": "green",  "title": "PO-2025-0441 auto-approved — Chromite ore 8,000 t from Nkwe Mining",         "meta": "Today 06:20 · Procurement Automation"},
        {"color": "blue",   "title": "ML forecast model retrained on 3 new weeks of output data",                    "meta": "Today 03:00 · ML Pipeline"},
        {"color": "amber",  "title": "Quartzite reorder triggered — stock fell below 4,200 t threshold",             "meta": "Yesterday 22:10 · Inventory Automation"},
        {"color": "teal",   "title": "SAF-04 scheduled maintenance logged — ETA back online 3 days",                 "meta": "Yesterday 14:30 · Production"},
        {"color": "muted",  "title": "Weekly S&OP report generated and emailed to management",                        "meta": "Mon 08:00 · Reporting"},
    ]
