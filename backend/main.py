import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Comma-separated origins — override via ALLOWED_ORIGINS env var in production
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001"
)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from routers import overview, inventory, procurement, production, forecasting, supplychain, advisor
from routers.anomaly_stream  import router as anomaly_router, init_simulator_broadcast, anomaly_stream
from routers.business_stream import router as business_router, init_business_broadcast
from services.sensor_simulator   import simulator
from services.business_simulator import business_simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────
    init_simulator_broadcast()        # wire sensor broadcast fn
    init_business_broadcast()         # wire business broadcast fn
    await simulator.start()           # sensor stream (every 3 s)
    await business_simulator.start()  # PO/SO/stock stream (every 30 s)
    yield
    # ── Shutdown ─────────────────────────────────────
    await simulator.stop()
    await business_simulator.stop()


app = FastAPI(
    title="FerroMind API",
    version="2.0.0",
    description="Ferrochrome Manufacturing Intelligence System — Phase 2",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing routers
app.include_router(overview.router,     prefix="/api/overview",     tags=["Overview"])
app.include_router(inventory.router,    prefix="/api/inventory",    tags=["Inventory"])
app.include_router(procurement.router,  prefix="/api/procurement",  tags=["Procurement"])
app.include_router(production.router,   prefix="/api/production",   tags=["Production"])
app.include_router(forecasting.router,  prefix="/api/forecasting",  tags=["Forecasting"])
app.include_router(supplychain.router,  prefix="/api/supplychain",  tags=["Supply Chain"])

# Phase 2
app.include_router(anomaly_router,   prefix="/api", tags=["Anomaly Stream"])
app.include_router(advisor.router,   prefix="/api", tags=["Advisor"])
app.include_router(business_router,  prefix="/api", tags=["Business Stream"])
app.add_api_websocket_route("/ws/anomalies", anomaly_stream)
from routers.business_stream import business_stream
app.add_api_websocket_route("/ws/business", business_stream)


@app.get("/")
def root():
    return {
        "message": "FerroMind API v2.0 — running",
        "docs":    "/docs",
        "streams": {
            "anomalies": "ws://localhost:8000/ws/anomalies",
            "business":  "ws://localhost:8000/ws/business",
        },
    }
