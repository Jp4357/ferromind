"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  AccentLine, Badge, Card, CardTitle,
  PageHeader, Table, Td, Th, Thead, statusToBadge,
} from "@/components/ui/primitives";
import { ForecastChart, ForecastAccuracyChart } from "@/components/charts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const modelColor:     Record<string, string> = { blue: "var(--blue)", teal: "var(--teal)", amber: "var(--accent)" };
const highlightColor: Record<string, string> = { green: "var(--green)" };
const HORIZONS = [4, 8, 12, 24];

// ── Animated counter ─────────────────────────────────────────────────────────
function LiveCount({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(value ?? 0);
  const prev = useRef(value ?? 0);

  useEffect(() => {
    if (value === prev.current) return;
    const diff  = value - prev.current;
    const steps = 12;
    let   i     = 0;
    const id = setInterval(() => {
      i++;
      setDisplay(Math.round(prev.current + (diff * i) / steps));
      if (i >= steps) { clearInterval(id); prev.current = value; }
    }, 30);
    return () => clearInterval(id);
  }, [value]);

  return <>{(display ?? 0).toLocaleString()}{suffix}</>;
}

// ── Model card — third one gets live anomaly stats injected ──────────────────
function ModelCard({ model, liveStats }: { model: any; liveStats: any }) {
  const isAnomaly = model.name === "Anomaly Detector";
  return (
    <div className="card-hover rounded-[10px] border p-[18px]"
      style={{ background: "var(--bg3)", borderColor: "var(--border)" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <p className="font-head text-[14px] font-bold" style={{ color: modelColor[model.color] }}>
          {model.name}
        </p>
        {isAnomaly && liveStats?.status === "live" && (
          <span className="font-mono text-[9px] px-2 py-[2px] rounded-full"
            style={{ background: "rgba(46,204,139,0.12)", color: "var(--green)", border: "1px solid rgba(46,204,139,0.25)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse 2s infinite" }} />
            LIVE
          </span>
        )}
      </div>

      <p className="font-mono text-[10px] mb-3" style={{ color: "var(--muted)" }}>{model.type}</p>

      {model.metrics.map((met: any) => (
        <div key={met.label} className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>{met.label}</span>
          {met.badge
            ? <Badge variant={met.badge}>{met.value}</Badge>
            : <span className="font-mono text-[11px] font-medium"
                style={{ color: met.highlight ? highlightColor[met.highlight] : "var(--text)" }}>
                {met.value}
              </span>
          }
        </div>
      ))}

      {/* Live stats appended to Anomaly Detector card */}
      {isAnomaly && liveStats && !liveStats.error && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(46,204,139,0.15)" }}>
          <div className="flex justify-between py-[6px]">
            <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>Live readings</span>
            <span className="font-mono text-[11px] font-medium" style={{ color: "var(--green)" }}>
              <LiveCount value={liveStats.total_readings} />
            </span>
          </div>
          <div className="flex justify-between py-[6px]">
            <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>Live anomaly rate</span>
            <span className="font-mono text-[11px] font-medium"
              style={{ color: liveStats.anomaly_rate_pct > 6 ? "var(--red)" : "var(--green)" }}>
              <LiveCount value={liveStats.anomaly_rate_pct} suffix="%" />
            </span>
          </div>
          <div className="flex justify-between py-[6px]">
            <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>Anomalies flagged</span>
            <span className="font-mono text-[11px] font-medium" style={{ color: "var(--red)" }}>
              <LiveCount value={liveStats.total_anomalies} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── What-If Simulator ────────────────────────────────────────────────────────
function WhatIfSimulator() {
  const [horizon,    setHorizon]    = useState(12);
  const [factor,     setFactor]     = useState(1.0);
  const [result,     setResult]     = useState<any>(null);
  const [running,    setRunning]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const run = useCallback(async (h: number, f: number) => {
    setRunning(true);
    try {
      const res = await fetch(`${API}/api/forecasting/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon_weeks: h, demand_factor: f }),
      });
      setResult(await res.json());
    } catch {}
    setRunning(false);
  }, []);

  const trigger = (h: number, f: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => run(h, f), 500);
  };

  // Run on mount
  useEffect(() => { run(horizon, factor); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onHorizon = (h: number) => { setHorizon(h); trigger(h, factor); };
  const onFactor  = (f: number) => { setFactor(f);  trigger(horizon, f); };

  const pct     = Math.round((factor - 1) * 100);
  const pctColor = pct > 0 ? "var(--green)" : pct < 0 ? "var(--red)" : "var(--muted)";
  const totalForecast = result?.forecast?.reduce((a: number, b: number) => a + b, 0);

  return (
    <Card className="mb-4">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <CardTitle>Live What-If Simulator</CardTitle>
        {running && (
          <span className="font-mono text-[9px] px-2 py-[2px] rounded-full"
            style={{ background: "rgba(240,165,0,0.1)", color: "var(--accent)", border: "1px solid rgba(240,165,0,0.25)", marginBottom: 8 }}>
            COMPUTING…
          </span>
        )}
        {result && !running && (
          <span className="font-mono text-[9px] px-2 py-[2px] rounded-full"
            style={{ background: "rgba(46,204,139,0.08)", color: "var(--green)", border: "1px solid rgba(46,204,139,0.2)", marginBottom: 8 }}>
            ✓ {result.scenario}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>

        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Horizon selector */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2" style={{ color: "var(--muted)" }}>
              Forecast horizon
            </p>
            <div style={{ display: "flex", gap: 4 }}>
              {HORIZONS.map(h => (
                <button key={h} onClick={() => onHorizon(h)}
                  className="font-mono text-[11px] flex-1 py-[6px] rounded cursor-pointer border transition-all"
                  style={{
                    background:   horizon === h ? "rgba(240,165,0,0.12)" : "rgba(255,255,255,0.03)",
                    borderColor:  horizon === h ? "rgba(240,165,0,0.35)" : "rgba(255,255,255,0.08)",
                    color:        horizon === h ? "var(--accent)" : "var(--muted)",
                  }}>
                  {h}W
                </button>
              ))}
            </div>
          </div>

          {/* Demand scenario slider */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
                Demand scenario
              </p>
              <span className="font-mono text-[13px] font-bold" style={{ color: pctColor }}>
                {pct >= 0 ? "+" : ""}{pct}%
              </span>
            </div>
            <input type="range"
              min={-30} max={30} step={1}
              value={pct}
              onChange={e => onFactor(1 + parseInt(e.target.value) / 100)}
              style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span className="font-mono text-[9px]" style={{ color: "var(--muted)" }}>−30% Bear</span>
              <span className="font-mono text-[9px]" style={{ color: "var(--muted)" }}>Base</span>
              <span className="font-mono text-[9px]" style={{ color: "var(--muted)" }}>+30% Bull</span>
            </div>
          </div>

          {/* Summary stats */}
          {result && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>Horizon</span>
                <span className="font-mono text-[11px] font-medium" style={{ color: "var(--text)" }}>{horizon} weeks</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>Total forecast</span>
                <span className="font-mono text-[11px] font-medium" style={{ color: "var(--accent)" }}>
                  {totalForecast?.toLocaleString()} t
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>Peak week</span>
                <span className="font-mono text-[11px] font-medium" style={{ color: "var(--text)" }}>
                  {result.forecast ? Math.max(...result.forecast).toLocaleString() : "—"} t
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>Model</span>
                <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>{result.model || "XGBoost"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Result chart */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] mb-3" style={{ color: "var(--muted)" }}>
            Adjusted forecast — {horizon}-week horizon
            {pct !== 0 && <span style={{ color: pctColor }}> · {pct >= 0 ? "+" : ""}{pct}% demand</span>}
          </p>
          {running && !result && (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>Computing…</p>
            </div>
          )}
          {result && (
            <div style={{ opacity: running ? 0.5 : 1, transition: "opacity 0.2s" }}>
              <ForecastChart data={result} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function ForecastingSection({ data }: { data: any }) {
  const { models, demandForecast: initialForecast, accuracyHistory, recommendations } = data;

  // ── Auto-refreshing base forecast ─────────────────────────────────────────
  const [forecastData,  setForecastData]  = useState(initialForecast);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [secondsAgo,    setSecondsAgo]    = useState(0);
  const [refreshing,    setRefreshing]    = useState(false);

  const refreshForecast = useCallback(async () => {
    setRefreshing(true);
    try {
      const res  = await fetch(`${API}/api/forecasting/demand-forecast`);
      const json = await res.json();
      setForecastData(json);
      setLastRefreshed(Date.now());
    } catch {}
    setRefreshing(false);
  }, []);

  // Auto-refresh every 60 s
  useEffect(() => {
    const id = setInterval(refreshForecast, 60_000);
    return () => clearInterval(id);
  }, [refreshForecast]);

  // "Updated X seconds ago" ticker
  useEffect(() => {
    const id = setInterval(() => setSecondsAgo(Math.round((Date.now() - lastRefreshed) / 1000)), 1000);
    return () => clearInterval(id);
  }, [lastRefreshed]);

  // ── Live anomaly stats (polls every 3 s) ──────────────────────────────────
  const [liveStats, setLiveStats] = useState<any>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/forecasting/live-stats`);
        setLiveStats(await res.json());
      } catch {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const refreshLabel = secondsAgo < 5 ? "just now"
    : secondsAgo < 60 ? `${secondsAgo}s ago`
    : `${Math.round(secondsAgo / 60)}m ago`;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="ML Forecasting Models"
        subtitle="DEMAND PREDICTION · SUPPLY OPTIMIZATION · ANOMALY DETECTION · MODEL PERFORMANCE"
      />
      <AccentLine />

      {/* Model cards — anomaly card gets live stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {models.map((m: any, i: number) => (
          <ModelCard key={m.name} model={m} liveStats={i === 2 ? liveStats : null} />
        ))}
      </div>

      {/* Charts row — forecast has live refresh indicator */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          {/* Header row with refresh controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <CardTitle>12-Week Demand Forecast — FeCr (t)</CardTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: refreshing ? "var(--accent)" : "var(--green)", display: "inline-block", marginRight: 5, animation: "pulse 2s infinite" }} />
                {refreshing ? "refreshing…" : `updated ${refreshLabel}`}
              </span>
              <button
                onClick={refreshForecast}
                disabled={refreshing}
                className="font-mono text-[10px] px-2 py-[2px] rounded cursor-pointer border"
                style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "var(--muted)", opacity: refreshing ? 0.4 : 1 }}>
                ↻
              </button>
            </div>
          </div>
          <div style={{ opacity: refreshing ? 0.5 : 1, transition: "opacity 0.3s" }}>
            <ForecastChart data={forecastData} />
          </div>
        </Card>

        <Card>
          <CardTitle>Forecast vs Actual — Last 6 Months</CardTitle>
          <ForecastAccuracyChart data={accuracyHistory} />
        </Card>
      </div>

      {/* What-If Simulator */}
      <WhatIfSimulator />

      {/* Recommendations */}
      <Card>
        <CardTitle>Supply Chain Optimizer — Top Recommended Actions (This Week)</CardTitle>
        <Table>
          <Thead>
            <tr><Th>Priority</Th><Th>Action</Th><Th>Expected Impact</Th><Th>Confidence</Th><Th>State</Th></tr>
          </Thead>
          <tbody>
            {recommendations.map((r: any) => (
              <tr key={r.priority}>
                <Td><Badge variant={statusToBadge(r.level)}>{r.priority}</Badge></Td>
                <Td>{r.action}</Td>
                <Td>{r.impact}</Td>
                <Td>{r.confidence}</Td>
                <Td><Badge variant={statusToBadge(r.state)}>{r.state}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
