"use client";
import { useRef, useEffect, useState } from "react";
import { AccentLine, AlertItem, Card, CardTitle, PageHeader, StatCard, Table, Td, Th, Thead, TimelineItem, Badge, statusToBadge } from "@/components/ui/primitives";
import { ProductionForecastChart, DonutChart } from "@/components/charts";
import { useLiveStream } from "@/components/business/BusinessStreamContext";

function AnimatedNum({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    if (Math.abs(value - prev) < 0.1) return;
    const steps = 16;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplay(prev + (value - prev) * i / steps);
      if (i >= steps) { clearInterval(id); prevRef.current = value; }
    }, 25);
    return () => clearInterval(id);
  }, [value]);

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</>;
}

export default function OverviewSection({ data }: { data: any }) {
  const { kpis, productionChart, alerts, furnaces, materialFlow, activity } = data;
  const { connected, stock, kpis: liveKpis, events } = useLiveStream();

  const hasLive = Object.keys(stock).length > 0;

  // Live KPI overlays
  const chromiteStock    = hasLive ? Math.round(stock["Chromite Ore"] || 0) : kpis.chromite_stock.value;
  const chromiteCovDays  = hasLive ? +((stock["Chromite Ore"] || 0) / 2350).toFixed(1) : kpis.chromite_stock.coverage_days;
  const openPOs          = hasLive ? liveKpis.open_pos : kpis.open_purchase_orders.value;
  const overduePOs       = hasLive ? liveKpis.overdue  : kpis.open_purchase_orders.overdue;
  const chromiteCritical = hasLive && (stock["Chromite Ore"] || 0) < 20000;

  // Live alerts: inject warning/error events at top, keep static alerts below
  const liveAlerts = events
    .filter(e => e.severity === "warning" || e.severity === "error")
    .slice(0, 2)
    .map(e => ({
      id:      e.ts,
      level:   e.severity === "error" ? "critical" : "warning",
      message: e.message,
      time:    e.ts ? new Date(e.ts).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : "",
    }));
  const allAlerts = [...liveAlerts, ...alerts].slice(0, 5);

  // Live activity feed: prepend recent simulator events
  const liveActivity = events.slice(0, 4).map(e => ({
    color: e.severity === "success" ? "var(--green)"
         : e.severity === "warning" ? "var(--accent)"
         : e.severity === "error"   ? "var(--red)"
         : "var(--muted)",
    title: e.message,
    meta:  e.ts ? new Date(e.ts).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : "",
  }));
  const allActivity = liveActivity.length > 0
    ? [...liveActivity, ...activity].slice(0, 6)
    : activity;

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <PageHeader title="Operations Overview"
          subtitle="VANTECH FERROCHROME PLANT — WITBANK, SOUTH AFRICA  |  WEEK 17, 2025  |  DATA AS OF 07:42 SAST" />
        <div style={{ paddingTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: connected ? "var(--green)" : "var(--muted)",
            display: "inline-block",
            animation: connected ? "pulse 2s infinite" : "none",
          }} />
          <span className="font-mono text-[10px]" style={{ color: connected ? "var(--green)" : "var(--muted)" }}>
            {connected ? "LIVE" : "CONNECTING…"}
          </span>
        </div>
      </div>
      <AccentLine />

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatCard
          label="FeCr Output (MTD)"
          value={<>{kpis.fecr_output_mtd.value.toLocaleString()}<span className="text-sm font-normal" style={{ color: "var(--muted)" }}> t</span></>}
          sub={`↑ ${kpis.fecr_output_mtd.vs_plan} vs plan`}
          trend="up"
        />
        <StatCard
          label="Chromite Ore Stock"
          value={<><AnimatedNum value={chromiteStock} /><span className="text-sm" style={{ color: "var(--muted)" }}> t</span></>}
          sub={`⚠ ${chromiteCovDays}d coverage`}
          trend={chromiteCritical ? "down" : "warn"}
        />
        <StatCard
          label="Energy Consumption"
          value={<>{kpis.energy_consumption.value.toLocaleString()}<span className="text-sm" style={{ color: "var(--muted)" }}> MWh</span></>}
          sub={`↓ ${kpis.energy_consumption.vs_baseline} vs baseline`}
          trend="up"
        />
        <StatCard
          label="Open Purchase Orders"
          value={<AnimatedNum value={openPOs} />}
          sub={`${overduePOs} overdue`}
          trend={overduePOs > 0 ? "down" : "up"}
        />
        <StatCard
          label="Forecast Accuracy (ML)"
          value={<>{kpis.forecast_accuracy.value}<span className="text-sm" style={{ color: "var(--muted)" }}>%</span></>}
          sub={`↑ MAPE ${kpis.forecast_accuracy.mape}%`}
          trend="up"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>Monthly Output vs ML Forecast (t FeCr)</CardTitle>
          <ProductionForecastChart data={productionChart} />
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <CardTitle>Active Alerts</CardTitle>
            {liveAlerts.length > 0 && (
              <span className="font-mono text-[9px] px-2 py-[2px] rounded-full"
                style={{ background: "rgba(240,165,0,0.1)", color: "var(--accent)", border: "1px solid rgba(240,165,0,0.2)" }}>
                {liveAlerts.length} live
              </span>
            )}
          </div>
          {allAlerts.map((a: any) => (
            <AlertItem key={a.id} level={a.level} message={a.message} time={a.time} />
          ))}
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardTitle>Furnace Status</CardTitle>
          <Table>
            <Thead><tr><Th>Unit</Th><Th>Status</Th><Th>Load %</Th><Th>Output t/d</Th></tr></Thead>
            <tbody>
              {furnaces.map((f: any) => (
                <tr key={f.unit}>
                  <Td>{f.unit}</Td>
                  <Td><Badge variant={statusToBadge(f.status)}>{f.status}</Badge></Td>
                  <Td>{f.load !== null ? `${f.load}%` : "—"}</Td>
                  <Td>{f.output ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardTitle>Daily Material Consumption (t/d)</CardTitle>
          <DonutChart data={materialFlow} />
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <CardTitle>Recent System Actions</CardTitle>
            {liveActivity.length > 0 && (
              <span className="font-mono text-[9px]" style={{ color: "var(--green)" }}>● live</span>
            )}
          </div>
          {allActivity.map((a: any, i: number) => (
            <TimelineItem key={i} color={a.color} title={a.title} meta={a.meta} />
          ))}
        </Card>
      </div>
    </div>
  );
}
