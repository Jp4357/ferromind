"""
Business Simulator — FerroMind
Background asyncio task that advances PO/SO state machines,
consumes inventory, triggers auto-reorders, and broadcasts live
events to all connected WebSocket clients.

Tick rate : 30 seconds real time
Timeline  : 1 tick ≈ 30 min simulated time (compressed for demo)
"""

import asyncio, random
from datetime import datetime, timezone

# ── Material catalogue ────────────────────────────────────────────────────────

MATERIALS: dict = {
    "Chromite Ore":    {"stock": 42100, "daily_use": 2350, "reorder": 45000, "min_safety": 20000, "max_cap": 80000, "order_qty": 8000, "supplier": "Nkwe Mining",    "lead_ticks": 12},
    "Met. Coke":       {"stock": 6840,  "daily_use": 480,  "reorder": 4500,  "min_safety": 3000,  "max_cap": 12000, "order_qty": 2500, "supplier": "ArcelorMittal",  "lead_ticks": 10},
    "Quartzite":       {"stock": 3980,  "daily_use": 210,  "reorder": 4200,  "min_safety": 2000,  "max_cap": 9000,  "order_qty": 5000, "supplier": "Lafarge SA",     "lead_ticks": 8},
    "Electrode Paste": {"stock": 218,   "daily_use": 8.4,  "reorder": 120,   "min_safety": 80,    "max_cap": 400,   "order_qty": 120,  "supplier": "SGL Carbon",     "lead_ticks": 14},
    "Lime":            {"stock": 1240,  "daily_use": 62,   "reorder": 900,   "min_safety": 600,   "max_cap": 3000,  "order_qty": 800,  "supplier": "PPC Ltd",        "lead_ticks": 6},
}

# FeCr finished goods tracked separately (produced, not purchased)
FECR_DAILY_PRODUCTION = 475   # t/d from 2 active furnaces
FECR_INITIAL_STOCK    = 2140

PO_STATES = ["Draft", "Pending Approval", "Approved", "Ordered", "In Transit", "Received"]
SO_STATES = ["Pending", "Confirmed", "Allocated", "Shipped", "Invoiced"]

# Ticks to spend in each state (min, max) before advancing
PO_STATE_TICKS: dict = {
    "Draft":            (1, 2),
    "Pending Approval": (2, 4),
    "Approved":         (1, 2),
    "Ordered":          (2, 4),
    "In Transit":       (6, 14),
}
SO_STATE_TICKS: dict = {
    "Pending":   (1, 3),
    "Confirmed": (1, 3),
    "Allocated": (1, 2),
    "Shipped":   (3, 8),
}

CUSTOMERS   = ["Baosteel Group", "POSCO", "Acerinox SA", "Aperam", "Nippon Steel", "ArcelorMittal"]
TICK_SECONDS = 30


# ── Simulator ─────────────────────────────────────────────────────────────────

class BusinessSimulator:

    def __init__(self):
        self.running        = False
        self._task          = None
        self._broadcast     = None
        self.tick           = 0

        # In-memory state
        self.stock: dict[str, float] = {m: float(cfg["stock"]) for m, cfg in MATERIALS.items()}
        self.stock["FeCr (Finished)"] = float(FECR_INITIAL_STOCK)

        self.pos: list[dict]  = []
        self.sos: list[dict]  = []
        self._po_counter      = 450
        self._so_counter      = 100
        self._active_po_mats: set[str] = set()   # materials with an open PO

        self._seed_pos()
        self._seed_sos()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def set_broadcast(self, fn):
        self._broadcast = fn

    async def start(self):
        self.running = True
        self._task   = asyncio.create_task(self._run_loop())
        print("  [business_sim] started — tick every 30 s")

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
        print("  [business_sim] stopped")

    # ── Seeding ───────────────────────────────────────────────────────────────

    def _new_po(self, material: str, auto: bool = False, state_idx: int = 0) -> dict:
        cfg = MATERIALS[material]
        self._po_counter += 1
        mn, mx  = PO_STATE_TICKS.get(PO_STATES[state_idx], (2, 5))
        return {
            "id":         f"PO-2025-0{self._po_counter}",
            "material":   material,
            "qty_t":      cfg["order_qty"],
            "qty":        f"{cfg['order_qty']:,} t",
            "supplier":   cfg["supplier"],
            "state_idx":  state_idx,
            "status":     PO_STATES[state_idx],
            "ticks_left": random.randint(mn, mx),
            "auto":       auto,
        }

    def _new_so(self) -> dict:
        qty = random.randint(800, 2500)
        self._so_counter += 1
        return {
            "id":         f"SO-2025-{self._so_counter:04d}",
            "customer":   random.choice(CUSTOMERS),
            "product":    "FeCr (52% Cr)",
            "qty_t":      qty,
            "qty":        f"{qty:,} t",
            "value_usd":  qty * random.randint(1200, 1500),
            "state_idx":  0,
            "status":     SO_STATES[0],
            "ticks_left": random.randint(*SO_STATE_TICKS["Pending"]),
        }

    def _seed_pos(self):
        seeds = [
            ("Chromite Ore",    3, True),   # Ordered
            ("Met. Coke",       2, False),   # Approved
            ("Quartzite",       1, False),   # Pending Approval
            ("Electrode Paste", 4, False),   # In Transit
            ("Lime",            2, True),    # Approved
        ]
        for material, state_idx, auto in seeds:
            po = self._new_po(material, auto, state_idx)
            self.pos.append(po)
            self._active_po_mats.add(material)

    def _seed_sos(self):
        for i in range(4):
            so            = self._new_so()
            so["state_idx"] = i % len(SO_STATES)
            so["status"]    = SO_STATES[so["state_idx"]]
            if so["status"] in SO_STATE_TICKS:
                mn, mx = SO_STATE_TICKS[so["status"]]
                so["ticks_left"] = random.randint(mn, mx)
            self.sos.append(so)

    # ── Main loop ─────────────────────────────────────────────────────────────

    async def _run_loop(self):
        while self.running:
            await asyncio.sleep(TICK_SECONDS)
            self.tick += 1
            await self._advance()

    async def _advance(self):
        events: list[dict] = []
        ts = datetime.now(timezone.utc).isoformat()

        # 1. Consume raw material stocks ──────────────────────────────────────
        for material, cfg in MATERIALS.items():
            consume = cfg["daily_use"] * TICK_SECONDS / 86400
            self.stock[material] = max(0.0, self.stock[material] - consume)

        # 2. Produce FeCr finished goods ──────────────────────────────────────
        production = FECR_DAILY_PRODUCTION * TICK_SECONDS / 86400
        self.stock["FeCr (Finished)"] = min(5000.0, self.stock["FeCr (Finished)"] + production)

        # 3. Advance PO states ────────────────────────────────────────────────
        done_pos: list[dict] = []
        for po in self.pos:
            po["ticks_left"] -= 1
            if po["ticks_left"] > 0:
                continue

            old_status  = po["status"]
            po["state_idx"] += 1

            if po["state_idx"] >= len(PO_STATES):
                done_pos.append(po)
                continue

            new_status   = PO_STATES[po["state_idx"]]
            po["status"] = new_status

            if new_status in PO_STATE_TICKS:
                mn, mx = PO_STATE_TICKS[new_status]
                po["ticks_left"] = random.randint(mn, mx)

            if new_status == "Received":
                material = po["material"]
                qty      = po["qty_t"]
                self.stock[material] = min(MATERIALS[material]["max_cap"], self.stock[material] + qty)
                self._active_po_mats.discard(material)
                done_pos.append(po)
                events.append({
                    "type":     "po_received",
                    "po_id":    po["id"],
                    "material": material,
                    "qty_t":    qty,
                    "stock":    round(self.stock[material]),
                    "message":  f"{po['id']} received — {material} +{qty:,}t → {self.stock[material]:,.0f}t total",
                    "severity": "success",
                    "ts":       ts,
                })
            else:
                events.append({
                    "type":       "po_update",
                    "po_id":      po["id"],
                    "material":   po["material"],
                    "old_status": old_status,
                    "new_status": new_status,
                    "message":    f"{po['id']} ({po['material']}) → {new_status}",
                    "severity":   "info",
                    "ts":         ts,
                })

        for po in done_pos:
            self.pos.remove(po)

        # 4. Advance SO states ────────────────────────────────────────────────
        done_sos: list[dict] = []
        for so in self.sos:
            so["ticks_left"] -= 1
            if so["ticks_left"] > 0:
                continue

            old_status  = so["status"]
            so["state_idx"] += 1

            if so["state_idx"] >= len(SO_STATES):
                done_sos.append(so)
                continue

            new_status   = SO_STATES[so["state_idx"]]
            so["status"] = new_status

            if new_status in SO_STATE_TICKS:
                mn, mx = SO_STATE_TICKS[new_status]
                so["ticks_left"] = random.randint(mn, mx)

            if new_status == "Shipped":
                self.stock["FeCr (Finished)"] = max(0.0, self.stock["FeCr (Finished)"] - so["qty_t"])
                events.append({
                    "type":     "so_shipped",
                    "so_id":    so["id"],
                    "customer": so["customer"],
                    "qty_t":    so["qty_t"],
                    "message":  f"{so['id']} shipped → {so['customer']} ({so['qty_t']:,}t FeCr)",
                    "severity": "info",
                    "ts":       ts,
                })
            elif new_status == "Invoiced":
                done_sos.append(so)
                events.append({
                    "type":      "so_invoiced",
                    "so_id":     so["id"],
                    "customer":  so["customer"],
                    "value_usd": so["value_usd"],
                    "message":   f"{so['id']} invoiced — ${so['value_usd']:,} ({so['customer']})",
                    "severity":  "success",
                    "ts":        ts,
                })
            else:
                events.append({
                    "type":       "so_update",
                    "so_id":      so["id"],
                    "customer":   so["customer"],
                    "old_status": old_status,
                    "new_status": new_status,
                    "message":    f"{so['id']} ({so['customer']}) → {new_status}",
                    "severity":   "info",
                    "ts":         ts,
                })

        for so in done_sos:
            self.sos.remove(so)

        # 5. Auto-reorder when stock < reorder point ──────────────────────────
        for material, cfg in MATERIALS.items():
            if material in self._active_po_mats:
                continue
            if self.stock[material] < cfg["reorder"]:
                po = self._new_po(material, auto=True)
                self.pos.append(po)
                self._active_po_mats.add(material)
                days = self.stock[material] / cfg["daily_use"] if cfg["daily_use"] else 999
                events.append({
                    "type":       "po_auto_generated",
                    "po_id":      po["id"],
                    "material":   material,
                    "qty_t":      cfg["order_qty"],
                    "days_cover": round(days, 1),
                    "message":    f"AUTO-PO {po['id']}: {material} {cfg['order_qty']:,}t — {days:.1f}d cover remaining",
                    "severity":   "warning" if days < 10 else "info",
                    "ts":         ts,
                })

        # 6. Randomly generate new SOs ────────────────────────────────────────
        if len(self.sos) < 10 and random.random() < 0.18:
            so = self._new_so()
            self.sos.append(so)
            events.append({
                "type":     "so_created",
                "so_id":    so["id"],
                "customer": so["customer"],
                "qty_t":    so["qty_t"],
                "message":  f"New SO {so['id']}: {so['customer']} — {so['qty_t']:,}t FeCr",
                "severity": "info",
                "ts":       ts,
            })

        # 7. Broadcast ────────────────────────────────────────────────────────
        # Always emit state every tick; events only when something happened
        await self._emit(events, ts)

    async def _emit(self, events: list, ts: str):
        if not self._broadcast:
            return
        await self._broadcast({
            "type":   "business_update",
            "tick":   self.tick,
            "ts":     ts,
            "events": events,
            "state":  self.snapshot(),
        })

    # ── Public snapshot (REST + on-connect seed) ──────────────────────────────

    def snapshot(self) -> dict:
        return {
            "stock": {m: round(v, 1) for m, v in self.stock.items()},
            "pos":   [self._fmt_po(p) for p in self.pos],
            "sos":   [self._fmt_so(s) for s in self.sos],
            "kpis":  self._kpis(),
        }

    def _fmt_po(self, po: dict) -> dict:
        return {
            "id":       po["id"],
            "material": po["material"],
            "qty":      po["qty"],
            "supplier": po["supplier"],
            "status":   po["status"],
            "auto":     po["auto"],
        }

    def _fmt_so(self, so: dict) -> dict:
        return {
            "id":       so["id"],
            "customer": so["customer"],
            "product":  so["product"],
            "qty":      so["qty"],
            "value":    f"${so['value_usd']:,}",
            "status":   so["status"],
        }

    def _kpis(self) -> dict:
        return {
            "open_pos":       len(self.pos),
            "auto_generated": sum(1 for p in self.pos if p["auto"]),
            "overdue":        sum(1 for p in self.pos if p["status"] == "Overdue"),
            "open_sos":       len(self.sos),
        }


# Singleton
business_simulator = BusinessSimulator()
