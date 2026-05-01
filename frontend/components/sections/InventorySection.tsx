"use client";
import { useRef, useEffect, useState, useMemo } from "react";
import { AccentLine, Badge, Card, CardTitle, PageHeader, Table, Td, Th, Thead } from "@/components/ui/primitives";
import { InventoryLevelsChart } from "@/components/charts";
import { useLiveStream } from "@/components/business/BusinessStreamContext";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

// ── Material config (mirrors backend MATERIALS) ───────────────────────────────
const MATERIAL_META: Record<string, {
  reorder: number; min_safety: number; max_cap: number; daily_use: number;
}> = {
  "Chromite Ore":    { reorder: 45000, min_safety: 20000, max_cap: 80000, daily_use: 2350 },
  "Met. Coke":       { reorder: 4500,  min_safety: 3000,  max_cap: 12000, daily_use: 480  },
  "Quartzite":       { reorder: 4200,  min_safety: 2000,  max_cap: 9000,  daily_use: 210  },
  "Electrode Paste": { reorder: 120,   min_safety: 80,    max_cap: 400,   daily_use: 8.4  },
  "Lime":            { reorder: 900,   min_safety: 600,   max_cap: 3000,  daily_use: 62   },
  "FeCr (Finished)": { reorder: 800,   min_safety: 500,   max_cap: 5000,  daily_use: 0    },
};

const axisStyle    = { fill: "#6b7a8d", fontFamily: "'DM Mono',monospace", fontSize: 10 };
const tooltipStyle = { backgroundColor: "#1a2030", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 11 };
const MAX_TREND    = 40;

// ── Helpers ──────────────────────────────────────────────────────────────────
function stockStatus(v: number, m: typeof MATERIAL_META[string]) {
  if (v < m.min_safety) return { label: "Critical",        variant: "red"   as const, trend: "down" as const };
  if (v < m.reorder)    return { label: "Below reorder",   variant: "amber" as const, trend: "warn" as const };
  return                       { label: "Adequate",         variant: "green" as const, trend: "up"   as const };
}

function daysTo(stock: number, target: number, dailyUse: number): number | null {
  if (dailyUse <= 0 || stock <= target) return null;
  return +((stock - target) / dailyUse).toFixed(1);
}

// ── Animated stock number ────────────────────────────────────────────────────
function AnimatedStock({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    if (Math.abs(value - prev) < 0.5) return;
    const steps = 16;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplay(prev + (value - prev) * i / steps);
      if (i >= steps) { clearInterval(id); prevRef.current = value; }
    }, 25);
    return () => clearInterval(id);
  }, [value]);

  return <>{Math.round(display).toLocaleString()}</>;
}

// ── Fill bar ─────────────────────────────────────────────────────────────────
function StockBar({ value, meta }: { value: number; meta: typeof MATERIAL_META[string] }) {
  const pct   = Math.min(100, (value / meta.max_cap) * 100);
  const color = value < meta.min_safety ? "var(--red)"
              : value < meta.reorder    ? "var(--accent)"
              : "var(--green)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.8s ease, background 0.4s" }} />
      </div>
      <span className="font-mono text-[10px]" style={{ color: "var(--muted)", minWidth: 28, textAlign: "right" }}>{Math.round(pct)}%</span>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function LiveStatCard({ label, value, meta }: { label: string; value: number; meta: typeof MATERIAL_META[string] }) {
  const { label: sub, trend } = stockStatus(value, meta);
  const subColor = trend === "up" ? "var(--green)" : trend === "down" ? "var(--red)" : "var(--accent)";
  const prevRef  = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (Math.abs(value - prevRef.current) > 0.5) {
      setFlash(true);
      setTimeout(() => setFlash(false), 800);
      prevRef.current = value;
    }
  }, [value]);

  return (
    <div className="card-hover rounded-[10px] border p-[18px_20px]"
      style={{ background: flash ? "rgba(240,165,0,0.05)" : "var(--panel)", borderColor: flash ? "rgba(240,165,0,0.3)" : "var(--border)", transition: "background 0.4s, border-color 0.4s" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="font-head text-[26px] font-bold leading-none" style={{ color: "var(--text)" }}>
        <AnimatedStock value={value} />
        <span className="text-sm font-normal ml-1" style={{ color: "var(--muted)" }}>t</span>
      </p>
      <StockBar value={value} meta={meta} />
      <p className="font-mono text-[11px] mt-[6px]" style={{ color: subColor }}>{sub}</p>
    </div>
  );
}

// ── Live rolling trend chart (appends a point every tick) ────────────────────
function LiveTrendChart({ material, stock, reorder, minSafety }: {
  material: string; stock: number; reorder: number; minSafety: number;
}) {
  const [history, setHistory] = useState<{ t: string; v: number }[]>([]);

  useEffect(() => {
    if (stock <= 0) return;
    const t = new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setHistory(prev => [...prev.slice(-(MAX_TREND - 1)), { t, v: Math.round(stock) }]);
  }, [stock]); // eslint-disable-line react-hooks/exhaustive-deps

  if (history.length < 2) {
    return (
      <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>Collecting data…</p>
      </div>
    );
  }

  const color = stock < minSafety ? "#e8524a" : stock < reorder ? "#f0a500" : "#2ecc8b";
  const gradId = `trendGrad_${material.replace(/\s/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={history}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="t" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={52}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()} t`, material]} />
        <ReferenceLine y={reorder}    stroke="#f0a500" strokeDasharray="5 4" strokeOpacity={0.7}
          label={{ value: "reorder", position: "insideTopRight", fill: "#f0a500", fontSize: 9, fontFamily: "'DM Mono',monospace" }} />
        <ReferenceLine y={minSafety} stroke="#e8524a" strokeDasharray="3 3" strokeOpacity={0.5}
          label={{ value: "safety",  position: "insideBottomRight", fill: "#e8524a", fontSize: 9, fontFamily: "'DM Mono',monospace" }} />
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#${gradId})`} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Optimizer status row ─────────────────────────────────────────────────────
function OptimizerPanel({ stock, pos }: { stock: Record<string, number>; pos: any[] }) {
  const rows = useMemo(() => Object.entries(MATERIAL_META)
    .filter(([, m]) => m.daily_use > 0)
    .map(([material, meta]) => {
      const current    = stock[material] ?? 0;
      const hasOpenPO  = pos.some(p => p.material === material);
      const daysReorder = daysTo(current, meta.reorder,    meta.daily_use);
      const daysSafety  = daysTo(current, meta.min_safety, meta.daily_use);
      const { label, variant } = stockStatus(current, meta);
      return { material, current, meta, hasOpenPO, daysReorder, daysSafety, label, variant };
    })
  , [stock, pos]);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <CardTitle>Stock Optimizer — Reorder Intelligence</CardTitle>
        <span className="font-mono text-[9px] px-2 py-[2px] rounded-full"
          style={{ background: "rgba(46,204,139,0.1)", color: "var(--green)", border: "1px solid rgba(46,204,139,0.25)", marginBottom: 8 }}>
          AUTO-MANAGED
        </span>
      </div>
      <Table>
        <Thead>
          <tr>
            <Th>Material</Th>
            <Th>Stock</Th>
            <Th>Days → Reorder</Th>
            <Th>Days → Safety</Th>
            <Th>Active PO</Th>
            <Th>Status</Th>
          </tr>
        </Thead>
        <tbody>
          {rows.map(({ material, current, meta, hasOpenPO, daysReorder, daysSafety, label, variant }) => {
            const urgentReorder = daysReorder !== null && daysReorder < 3;
            const urgentSafety  = daysSafety  !== null && daysSafety  < 5;
            return (
              <tr key={material}
                style={{ background: urgentSafety ? "rgba(232,82,74,0.04)" : urgentReorder ? "rgba(240,165,0,0.03)" : "transparent" }}>
                <Td>{material}</Td>
                <Td>
                  <span style={{ fontWeight: 500 }}><AnimatedStock value={current} /> t</span>
                </Td>
                <Td>
                  {daysReorder != null ? (
                    <span className="font-mono text-[11px]" style={{ color: urgentReorder ? "var(--red)" : "var(--text)" }}>
                      {daysReorder}d
                    </span>
                  ) : (
                    <span className="font-mono text-[11px]" style={{ color: "var(--red)" }}>at reorder</span>
                  )}
                </Td>
                <Td>
                  {daysSafety != null ? (
                    <span className="font-mono text-[11px]" style={{ color: urgentSafety ? "var(--red)" : "var(--muted)" }}>
                      {daysSafety}d
                    </span>
                  ) : (
                    <span className="font-mono text-[11px]" style={{ color: "var(--red)" }}>below safety</span>
                  )}
                </Td>
                <Td>
                  {hasOpenPO ? (
                    <Badge variant="green">✓ Open PO</Badge>
                  ) : current < meta.reorder ? (
                    <Badge variant="amber">Triggering…</Badge>
                  ) : (
                    <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>—</span>
                  )}
                </Td>
                <Td><Badge variant={variant}>{label}</Badge></Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────
export default function InventorySection({ data }: { data: any }) {
  const { levelsChart } = data;
  const { connected, stock, pos } = useLiveStream();

  const hasLive = Object.keys(stock).length > 0;

  const liveStock: Record<string, number> = hasLive ? stock : {
    "Chromite Ore":    data.summary.chromite_ore.value,
    "Met. Coke":       data.summary.met_coke.value,
    "Quartzite":       data.summary.quartzite.value,
    "Electrode Paste": data.summary.electrode_paste.value,
    "FeCr (Finished)": data.summary.fecr_finished.value,
    "Lime":            1240,
  };

  // Live levels chart (updates with stock)
  const liveChartData = {
    labels:  levelsChart.labels,
    current: [
      (liveStock["Chromite Ore"]    || 0) / 100,
      (liveStock["Met. Coke"]       || 0) / 100,
      (liveStock["Quartzite"]       || 0) / 100,
       liveStock["Electrode Paste"] || 0,
      (liveStock["Lime"]            || 0) / 100,
    ],
    reorder: levelsChart.reorder,
  };

  // Parameters table derived from live stock
  const parameters = Object.entries(MATERIAL_META).map(([material, meta]) => {
    const current = liveStock[material] ?? 0;
    const { label, variant } = stockStatus(current, meta);
    const days = meta.daily_use > 0 ? +(current / meta.daily_use).toFixed(1) : null;
    const pct  = Math.min(100, Math.round(current / meta.max_cap * 100));
    return { material, current, meta, label, variant, days, pct };
  });

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <PageHeader title="Inventory Management" subtitle="LIVE STOCK LEVELS · AUTO-REORDER · SAFETY STOCK OPTIMIZATION" />
        <div style={{ paddingTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "var(--green)" : "var(--muted)", display: "inline-block", animation: connected ? "pulse 2s infinite" : "none" }} />
          <span className="font-mono text-[10px]" style={{ color: connected ? "var(--green)" : "var(--muted)" }}>
            {connected ? "LIVE · updates every 30s" : "CONNECTING…"}
          </span>
        </div>
      </div>
      <AccentLine />

      {/* Live stat cards */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <LiveStatCard label="Chromite Ore"     value={liveStock["Chromite Ore"]    || 0} meta={MATERIAL_META["Chromite Ore"]} />
        <LiveStatCard label="Met. Coke"        value={liveStock["Met. Coke"]       || 0} meta={MATERIAL_META["Met. Coke"]} />
        <LiveStatCard label="Quartzite / Flux" value={liveStock["Quartzite"]       || 0} meta={MATERIAL_META["Quartzite"]} />
        <LiveStatCard label="FeCr Finished"    value={liveStock["FeCr (Finished)"] || 0} meta={MATERIAL_META["FeCr (Finished)"]} />
        <LiveStatCard label="Electrode Paste"  value={liveStock["Electrode Paste"] || 0} meta={MATERIAL_META["Electrode Paste"]} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>Stock Levels vs Reorder Thresholds</CardTitle>
          <InventoryLevelsChart data={liveChartData} />
        </Card>

        {/* Live chromite rolling trend — replaces static chart */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <CardTitle>Chromite Ore — Live Stock Trend</CardTitle>
            {connected && (
              <span className="font-mono text-[9px]" style={{ color: "var(--green)", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse 2s infinite" }} />
                LIVE
              </span>
            )}
          </div>
          <LiveTrendChart
            material="Chromite Ore"
            stock={liveStock["Chromite Ore"] || 0}
            reorder={45000}
            minSafety={20000}
          />
        </Card>
      </div>

      {/* Optimizer panel */}
      <div className="mb-4">
        <OptimizerPanel stock={liveStock} pos={pos} />
      </div>

      {/* Parameters table */}
      <Card>
        <CardTitle>Full Inventory Parameters</CardTitle>
        <Table>
          <Thead>
            <tr>
              <Th>Material</Th><Th>Stock</Th><Th>Fill</Th>
              <Th>Reorder Pt</Th><Th>Min Safety</Th>
              <Th>Daily Use</Th><Th>Days Cover</Th><Th>Status</Th>
            </tr>
          </Thead>
          <tbody>
            {parameters.map(({ material, current, meta, label, variant, days, pct }) => (
              <tr key={material}>
                <Td>{material}</Td>
                <Td><span style={{ fontWeight: 500 }}><AnimatedStock value={current} /> t</span></Td>
                <Td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 48, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%", borderRadius: 2, transition: "width 0.8s ease",
                        background: variant === "green" ? "var(--green)" : variant === "red" ? "var(--red)" : "var(--accent)",
                      }} />
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>{pct}%</span>
                  </div>
                </Td>
                <Td>{meta.reorder.toLocaleString()} t</Td>
                <Td>{meta.min_safety.toLocaleString()} t</Td>
                <Td>{meta.daily_use > 0 ? `${meta.daily_use.toLocaleString()} t/d` : "—"}</Td>
                <Td>{days != null ? `${days}d` : "—"}</Td>
                <Td><Badge variant={variant}>{label}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
