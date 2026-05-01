from fastapi import APIRouter

router = APIRouter()

@router.get("/kpis")
def get_kpis():
    return {
        "output_today":    {"value": 78.5, "unit": "t FeCr", "vs_plan": "+4%",    "trend": "up"},
        "active_furnaces": {"value": "2 / 4", "note": "SAF-03 standby, SAF-04 maint.", "trend": "warn"},
        "energy_today":    {"value": 3840, "unit": "MWh",    "vs_baseline": "-2.1%","trend": "up"},
        "cr_recovery":     {"value": 88.2, "unit": "%",      "wow": "+0.4pp",       "trend": "up"},
    }

@router.get("/daily-production")
def get_daily_production():
    return {
        "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "actual": [74.2, 76.8, 78.1, 77.4, 78.5, 75.9, 76.2],
        "plan":   [75, 75, 75, 75, 75, 75, 75],
    }

@router.get("/energy")
def get_energy():
    return {
        "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "mwh_day":  [3960, 3890, 3840, 3820, 3840, 3780, 3800],
        "kwh_per_t":[53.4, 50.7, 49.2, 49.4, 48.9, 49.7, 49.8],
    }

@router.get("/batch-log")
def get_batch_log():
    return [
        {"batch": "B-4421", "furnace": "SAF-01", "tap_time": "06:12", "weight": 38.4, "cr_pct": 52.1, "fe_pct": 29.8, "grade": "HC FeCr"},
        {"batch": "B-4420", "furnace": "SAF-02", "tap_time": "05:48", "weight": 40.1, "cr_pct": 51.8, "fe_pct": 30.1, "grade": "HC FeCr"},
        {"batch": "B-4419", "furnace": "SAF-01", "tap_time": "04:30", "weight": 37.9, "cr_pct": 52.4, "fe_pct": 29.5, "grade": "HC FeCr"},
        {"batch": "B-4418", "furnace": "SAF-02", "tap_time": "03:15", "weight": 39.8, "cr_pct": 51.2, "fe_pct": 30.4, "grade": "Off-spec"},
        {"batch": "B-4417", "furnace": "SAF-01", "tap_time": "01:55", "weight": 38.6, "cr_pct": 52.3, "fe_pct": 29.9, "grade": "HC FeCr"},
        {"batch": "B-4416", "furnace": "SAF-02", "tap_time": "00:40", "weight": 40.3, "cr_pct": 52.0, "fe_pct": 30.0, "grade": "HC FeCr"},
    ]

@router.get("/shift-schedule")
def get_shift_schedule():
    return [
        {"date": "Mon Apr 28", "shift_a": "Team Khumalo",  "shift_b": "Team Dlamini", "shift_c": "Team Sithole"},
        {"date": "Tue Apr 29", "shift_a": "Team Khumalo",  "shift_b": "Team Dlamini", "shift_c": "Team Sithole"},
        {"date": "Wed Apr 30", "shift_a": "Team Nkosi",    "shift_b": "Team Khumalo", "shift_c": "Team Dlamini"},
        {"date": "Thu May 1",  "shift_a": "Team Nkosi",    "shift_b": "Team Khumalo", "shift_c": "Team Dlamini"},
        {"date": "Fri May 2",  "shift_a": "Team Sithole",  "shift_b": "Team Nkosi",   "shift_c": "Team Khumalo"},
    ]
