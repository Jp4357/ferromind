"""
Business Stream Router — FerroMind
WebSocket /ws/business  — live PO/SO/stock events
GET /api/business/snapshot — current state (REST fallback)
"""

import asyncio, json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Set
from datetime import datetime, timezone

router = APIRouter()


class BizManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.add(ws)
        print(f"  [biz_ws] client connected — {len(self.active)} total")

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self.active.discard(ws)
        print(f"  [biz_ws] client disconnected — {len(self.active)} total")

    async def broadcast(self, message: dict):
        if not self.active:
            return
        payload = json.dumps(message, default=str)
        dead: Set[WebSocket] = set()
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


biz_manager = BizManager()


async def _broadcast_fn(message: dict):
    await biz_manager.broadcast(message)


@router.websocket("/ws/business")
async def business_stream(websocket: WebSocket):
    await biz_manager.connect(websocket)
    try:
        from services.business_simulator import business_simulator
        # Seed client with current state immediately
        await websocket.send_text(json.dumps({
            "type":  "connected",
            "state": business_simulator.snapshot(),
            "ts":    datetime.now(timezone.utc).isoformat(),
        }, default=str))

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "keepalive"}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"  [biz_ws] error: {e}")
    finally:
        await biz_manager.disconnect(websocket)


@router.get("/business/snapshot")
async def get_snapshot():
    from services.business_simulator import business_simulator
    return business_simulator.snapshot()


def init_business_broadcast():
    from services.business_simulator import business_simulator
    business_simulator.set_broadcast(_broadcast_fn)
