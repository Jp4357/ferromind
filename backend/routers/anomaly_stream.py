"""
Anomaly Stream Router — FerroMind Phase 2
WebSocket endpoint at /ws/anomalies.
Manages all connected browser clients and broadcasts alerts instantly
when the sensor simulator detects an anomaly.

Also exposes a REST endpoint /api/anomaly-stream/status for the dashboard
to show live stats without needing a WebSocket connection.
"""

import asyncio, json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Set
from datetime import datetime, timezone

router = APIRouter()


class ConnectionManager:
    """Tracks all open WebSocket connections and handles fan-out broadcasts."""

    def __init__(self):
        self.active: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.add(ws)
        print(f"  [ws] client connected  — {len(self.active)} total")

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self.active.discard(ws)
        print(f"  [ws] client disconnected — {len(self.active)} total")

    async def broadcast(self, message: dict):
        """Send a message to every connected client. Drop dead connections silently."""
        if not self.active:
            return
        payload = json.dumps(message)
        dead    = set()
        async with self._lock:
            targets = set(self.active)

        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)

        if dead:
            async with self._lock:
                self.active -= dead

    @property
    def client_count(self) -> int:
        return len(self.active)


# Singleton manager — shared between this router and the simulator
manager = ConnectionManager()

# Recent alerts buffer (last 50) — served to new clients on connect
_recent_alerts: list[dict] = []
_MAX_BUFFER = 50


async def _handle_broadcast(message: dict):
    """Called by the simulator for every reading / anomaly."""
    global _recent_alerts
    if message.get("type") == "anomaly":
        _recent_alerts.append(message)
        if len(_recent_alerts) > _MAX_BUFFER:
            _recent_alerts = _recent_alerts[-_MAX_BUFFER:]
    await manager.broadcast(message)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/anomalies")
async def anomaly_stream(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send buffered recent alerts immediately on connect
        if _recent_alerts:
            await websocket.send_text(json.dumps({
                "type":   "history",
                "alerts": _recent_alerts[-20:],
            }))

        # Send a welcome / status message
        await websocket.send_text(json.dumps({
            "type":    "connected",
            "message": "Connected to FerroMind anomaly stream",
            "clients": manager.client_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }))

        # Keep the connection alive — client sends pings, we echo
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                # Send server-side keepalive
                await websocket.send_text(json.dumps({"type": "keepalive"}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"  [ws] error: {e}")
    finally:
        await manager.disconnect(websocket)


# ── REST status endpoint ──────────────────────────────────────────────────────

@router.get("/anomaly-stream/status")
async def stream_status():
    from services.sensor_simulator import simulator
    return {
        "running":          simulator.running,
        "connected_clients":manager.client_count,
        "total_readings":   simulator.total_readings,
        "total_anomalies":  simulator.total_anomalies,
        "anomaly_rate_pct": round(
            simulator.total_anomalies / max(simulator.total_readings, 1) * 100, 2
        ),
        "recent_alerts":    _recent_alerts[-5:],
        "active_furnaces":  ["SAF-01", "SAF-02"],
    }


@router.get("/anomaly-stream/history")
async def stream_history(limit: int = 50):
    return {
        "count":  len(_recent_alerts),
        "alerts": _recent_alerts[-limit:],
    }


# Wire the broadcast function into the simulator
def init_simulator_broadcast():
    from services.sensor_simulator import simulator
    simulator.set_broadcast(_handle_broadcast)
