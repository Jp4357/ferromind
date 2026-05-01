# FerroMind — Ferrochrome Intelligence System

Full-stack demo: **FastAPI backend + Next.js frontend** with Tailwind CSS + shadcn/ui aesthetics.
Replicates the 6-tab stakeholder dashboard with realistic demo data.

---

## Project Structure

```
ferrochrome/
├── backend/
│   ├── main.py                  ← FastAPI app entry point
│   ├── requirements.txt
│   └── routers/
│       ├── overview.py
│       ├── inventory.py
│       ├── procurement.py
│       ├── production.py
│       ├── forecasting.py
│       └── supplychain.py
│
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx              ← Main dashboard with nav + tab routing
    │   └── globals.css
    ├── components/
    │   ├── ui/primitives.tsx     ← Card, Badge, StatCard, Table, Alert, Timeline
    │   ├── charts/index.tsx      ← All Recharts chart components
    │   └── sections/
    │       ├── OverviewSection.tsx
    │       ├── InventorySection.tsx
    │       ├── ProcurementSection.tsx
    │       ├── ProductionSection.tsx
    │       ├── ForecastingSection.tsx
    │       └── SupplyChainSection.tsx
    ├── lib/
    │   ├── api.ts                ← Typed API fetch client
    │   └── utils.ts              ← cn() utility
    ├── package.json
    ├── tailwind.config.js
    ├── next.config.js
    └── tsconfig.json
```

---

## Quick Start

### 1 — Backend (Python 3.9+)

```bash
cd ferrochrome/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 2 — Frontend (Node 18+)

```bash
cd ferrochrome/frontend
npm install
npm run dev
```

Open: http://localhost:3000

---

## Dashboard Tabs

| Tab | What it shows |
|---|---|
| Overview | KPIs, production vs forecast chart, alerts, furnace status, activity log |
| Inventory | Stock levels, reorder thresholds, chromite trend, parameter table |
| Procurement | Active POs, vendor scorecard, spend chart, automation rules |
| Production | Daily output vs plan, energy efficiency, batch log, shift schedule |
| ML Forecasting | Model cards, 12-week demand forecast with CI, accuracy history, optimizer recommendations |
| Supply Chain | Supplier network, risk matrix, lead time chart, cost breakdown |

---

## Phase 2 Roadmap (ML Integration)

When ready, each forecasting endpoint in `backend/routers/forecasting.py` can be replaced
with real model inference:

```python
# Replace demo data with:
from models.demand_forecaster import predict_demand
return predict_demand(horizon_weeks=12)
```

The frontend requires zero changes — it consumes the same JSON shape.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL |
