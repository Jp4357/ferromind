import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001"
)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import jwt

from routers import overview, inventory, procurement, production, forecasting, supplychain, advisor
from routers.auth        import router as auth_router
from routers.anomaly_stream  import router as anomaly_router, init_simulator_broadcast, anomaly_stream
from routers.business_stream import router as business_router, init_business_broadcast
from services.sensor_simulator   import simulator
from services.business_simulator import business_simulator

JWT_SECRET = os.getenv("JWT_SECRET", "ferromind-dev-secret")


def verify_token(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        jwt.decode(authorization[7:], JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_simulator_broadcast()
    init_business_broadcast()
    await simulator.start()
    await business_simulator.start()
    yield
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

# Auth router — no token required
app.include_router(auth_router, prefix="/api", tags=["Auth"])

# All other routers require a valid JWT
_auth = [Depends(verify_token)]
app.include_router(overview.router,    prefix="/api/overview",    tags=["Overview"],        dependencies=_auth)
app.include_router(inventory.router,   prefix="/api/inventory",   tags=["Inventory"],       dependencies=_auth)
app.include_router(procurement.router, prefix="/api/procurement", tags=["Procurement"],     dependencies=_auth)
app.include_router(production.router,  prefix="/api/production",  tags=["Production"],      dependencies=_auth)
app.include_router(forecasting.router, prefix="/api/forecasting", tags=["Forecasting"],     dependencies=_auth)
app.include_router(supplychain.router, prefix="/api/supplychain", tags=["Supply Chain"],    dependencies=_auth)
app.include_router(anomaly_router,     prefix="/api",             tags=["Anomaly Stream"],  dependencies=_auth)
app.include_router(advisor.router,     prefix="/api",             tags=["Advisor"],         dependencies=_auth)
app.include_router(business_router,    prefix="/api",             tags=["Business Stream"], dependencies=_auth)

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
