from fastapi import APIRouter

router = APIRouter()

@router.get("/kpis")
def get_kpis():
    return {
        "open_pos": {"value": 12, "overdue": 2},
        "auto_approved": {"value": 8, "pct": "67%"},
        "committed_spend": {"value": "$4.2M", "status": "Within budget"},
        "avg_lead_time": {"value": 11.4, "unit": "d", "vs_target": "+1.8d"},
    }

@router.get("/purchase-orders")
def get_purchase_orders():
    return [
        {"po": "PO-2025-0441", "material": "Chromite Ore",    "qty": "8,000 t", "supplier": "Nkwe Mining",    "eta": "May 14", "status": "Auto-Generated"},
        {"po": "PO-2025-0438", "material": "Met. Coke",       "qty": "2,500 t", "supplier": "ArcelorMittal",  "eta": "May 18", "status": "Confirmed"},
        {"po": "PO-2025-0436", "material": "Quartzite",       "qty": "5,000 t", "supplier": "Lafarge SA",     "eta": "May 10", "status": "Pending Approval"},
        {"po": "PO-2025-0431", "material": "Electrode Paste", "qty": "120 t",   "supplier": "SGL Carbon",     "eta": "May 22", "status": "Confirmed"},
        {"po": "PO-2025-0427", "material": "Met. Coke",       "qty": "1,800 t", "supplier": "Glencore Coal",  "eta": "Apr 30", "status": "Overdue"},
        {"po": "PO-2025-0422", "material": "Lime",            "qty": "800 t",   "supplier": "PPC Ltd",        "eta": "May 6",  "status": "In Transit"},
    ]

@router.get("/vendor-scorecard")
def get_vendor_scorecard():
    return [
        {"supplier": "Nkwe Mining",    "material": "Chromite Ore",    "on_time": "94%", "quality": "97%", "score": "A+"},
        {"supplier": "Samancor Chrome","material": "Chromite Ore",    "on_time": "88%", "quality": "95%", "score": "A"},
        {"supplier": "ArcelorMittal",  "material": "Met. Coke",       "on_time": "91%", "quality": "92%", "score": "A"},
        {"supplier": "Glencore Coal",  "material": "Met. Coke",       "on_time": "74%", "quality": "89%", "score": "B"},
        {"supplier": "Lafarge SA",     "material": "Quartzite",       "on_time": "96%", "quality": "98%", "score": "A+"},
        {"supplier": "SGL Carbon",     "material": "Electrode Paste", "on_time": "89%", "quality": "96%", "score": "A"},
    ]

@router.get("/spend-chart")
def get_spend_chart():
    return {
        "labels": ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"],
        "chromite": [1420, 1380, 1510, 1480, 1560, 1620],
        "coke":     [680,  640,  720,  700,  730,  750],
        "other":    [210,  230,  200,  220,  240,  230],
    }

@router.get("/automation-rules")
def get_automation_rules():
    return [
        {"rule": "Chromite Reorder",  "condition": "Stock < 45,000 t",       "action": "Draft PO (8,000 t)",   "state": "Active"},
        {"rule": "Coke Reorder",      "condition": "Stock < 4,500 t",        "action": "Draft PO (2,500 t)",   "state": "Active"},
        {"rule": "Quartzite Reorder", "condition": "Stock < 4,200 t",        "action": "Draft PO (5,000 t)",   "state": "Active"},
        {"rule": "Vendor Switch",     "condition": "Score < B for 2 weeks",  "action": "Alert + Alt Supplier", "state": "Active"},
        {"rule": "Emergency Expedite","condition": "Days cover < 7",         "action": "Flag + Escalate",      "state": "Active"},
    ]
