from fastapi import APIRouter

router = APIRouter()

@router.get("/summary")
def get_summary():
    return {
        "chromite_ore":      {"value": 42100, "unit": "t", "status": "warn",  "label": "Below reorder point"},
        "met_coke":          {"value": 6840,  "unit": "t", "status": "ok",    "label": "Adequate"},
        "quartzite":         {"value": 3980,  "unit": "t", "status": "down",  "label": "Order pending"},
        "fecr_finished":     {"value": 2140,  "unit": "t", "status": "ok",    "label": "12% vs target"},
        "electrode_paste":   {"value": 218,   "unit": "t", "status": "ok",    "label": "Adequate"},
    }

@router.get("/parameters")
def get_parameters():
    return [
        {"material": "Chromite Ore",     "current": "42,100 t", "min_safety": "20,000 t", "reorder": "45,000 t", "max_cap": "80,000 t", "daily_use": "2,350 t/d", "days_cover": 17.9, "status": "Below Reorder"},
        {"material": "Metallurgical Coke","current": "6,840 t",  "min_safety": "3,000 t",  "reorder": "4,500 t",  "max_cap": "12,000 t", "daily_use": "480 t/d",   "days_cover": 14.3, "status": "OK"},
        {"material": "Quartzite Flux",   "current": "3,980 t",  "min_safety": "2,000 t",  "reorder": "4,200 t",  "max_cap": "9,000 t",  "daily_use": "210 t/d",   "days_cover": 18.9, "status": "Below Reorder"},
        {"material": "Electrode Paste",  "current": "218 t",    "min_safety": "80 t",     "reorder": "120 t",    "max_cap": "400 t",    "daily_use": "8.4 t/d",   "days_cover": 25.9, "status": "OK"},
        {"material": "Lime",             "current": "1,240 t",  "min_safety": "600 t",    "reorder": "900 t",    "max_cap": "3,000 t",  "daily_use": "62 t/d",    "days_cover": 20.0, "status": "OK"},
        {"material": "FeCr (Finished)",  "current": "2,140 t",  "min_safety": "500 t",    "reorder": "800 t",    "max_cap": "5,000 t",  "daily_use": "—",         "days_cover": None, "status": "Shipping Ready"},
    ]

@router.get("/levels-chart")
def get_levels_chart():
    return {
        "labels": ["Chromite Ore\n(×100t)", "Met. Coke\n(×100t)", "Quartzite\n(×100t)", "Electrode Paste (t)", "Lime\n(×100t)"],
        "current": [421, 68.4, 39.8, 218, 124],
        "reorder": [450, 45, 42, 120, 90],
    }

@router.get("/chromite-trend")
def get_chromite_trend():
    vals = [58200,57100,55800,54600,53100,52000,50800,49700,48200,47400,
            46800,46100,45900,45200,44800,44100,43500,43000,42600,42300,
            42100,42100,42100,42100,42100,42100,42100,42100,42100,42100]
    return {
        "labels": [f"Apr {i+1}" for i in range(30)],
        "stock": vals,
        "reorder_point": 45000,
    }
