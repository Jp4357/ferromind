"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import { useAnomalyStream, AnomalyAlert, ChartPoint } from "./useAnomalyStream";
import { ToastContainer } from "./AnomalyToast";
import { AccentLine, Badge, Card, CardTitle, PageHeader, StatCard } from "@/components/ui/primitives";

const severityColor: Record<string, string> = {
  critical: "#e8524a",
  warning:  "#f0a500",
  info:     "#4a9eff",
};

const severityBadge: Record<string, "red" | "amber" | "blue"> = {
  critical: "red",
  warning:  "amber",
  info:     "blue",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-ZA", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: "Africa/Johannesburg",
    });
  } catch { return "—"; }
}

function StatusDot({ status }: { status: string }) {
  const color = status === "connected" ? "#2ecc8b" : status === "connecting" ? "#f0a500" : "#e8524a";
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7,
      borderRadius: "50%", background: color,
      marginRight: 6,
      animation: status === "connected" ? "pulse 2s infinite" : "none",
    }} />
  );
}

function LiveGauge({ label, value, unit, normal }: { label: string; value: number; unit: string; normal: number }) {
  const pct   = Math.min(100, (value / (normal * 1.4)) * 100);
  const color = Math.abs(value - normal) / normal > 0.15 ? "#e8524a"
              : Math.abs(value - normal) / normal > 0.07 ? "#f0a500"
              : "#2ecc8b";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--muted, #6b7a8d)" }}>{label}</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 500, color: "var(--text, #e8ecf0)" }}>
          {value.toFixed(1)} {unit}
        </span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease, background 0.4s ease" }} />
      </div>
    </div>
  );
}

function AnomalyDot(anomKey: "saf01_anom" | "saf02_anom", color: string) {
  // eslint-disable-next-line react/display-name
  return function CustomDot(props: Record<string, unknown>) {
    const { cx, cy, payload } = props as { cx: number; cy: number; payload: ChartPoint };
    if (!payload[anomKey]) return <g />;
    return <circle cx={cx} cy={cy} r={5} fill="#e8524a" stroke={color} strokeWidth={1.5} />;
  };
}

function AnomalyScoreChart({ data }: { data: ChartPoint[] }) {
  if (data.length < 2) {
    return (
      <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>Collecting readings — chart will appear shortly…</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="time"
          tick={{ fill: "#6b7a8d", fontSize: 9, fontFamily: "'DM Mono',monospace" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 1]}
          tickCount={5}
          tick={{ fill: "#6b7a8d", fontSize: 9, fontFamily: "'DM Mono',monospace" }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: "#141c2b", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, fontSize: 11, fontFamily: "'DM Mono',monospace",
          }}
          labelStyle={{ color: "#6b7a8d", marginBottom: 4 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(val: any, name: string) => [
            val != null ? (val as number).toFixed(3) : "—",
            name === "saf01" ? "SAF-01" : "SAF-02",
          ]}
        />
        <Legend
          formatter={(val) => val === "saf01" ? "SAF-01" : "SAF-02"}
          wrapperStyle={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "#6b7a8d" }}
        />
        <ReferenceLine
          y={0.5}
          stroke="#e8524a"
          strokeDasharray="5 4"
          strokeOpacity={0.7}
          label={{ value: "anomaly threshold", position: "insideTopRight", fill: "#e8524a", fontSize: 9 }}
        />
        <Line
          type="monotone" dataKey="saf01" name="saf01"
          stroke="#2ecc8b" strokeWidth={1.5}
          dot={AnomalyDot("saf01_anom", "#2ecc8b")}
          activeDot={{ r: 4 }}
          connectNulls
        />
        <Line
          type="monotone" dataKey="saf02" name="saf02"
          stroke="#4a9eff" strokeWidth={1.5}
          dot={AnomalyDot("saf02_anom", "#4a9eff")}
          activeDot={{ r: 4 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function AnomalyStreamSection() {
  const { status, alerts, lastReading, streamStats, toasts, clientCount, dismissToast, timeSeries } = useAnomalyStream();

  return (
    <div className="animate-fade-in">
      <ToastContainer toasts={toasts} onClose={dismissToast} />

      <PageHeader
        title="Live Anomaly Stream"
        subtitle="REAL-TIME SENSOR SCORING · ISOLATION FOREST · SAF-01 & SAF-02"
      />
      <AccentLine />

      {/* Stream KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="rounded-[10px] border p-[18px_20px]" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2" style={{ color: "var(--muted)" }}>Stream status</p>
          <p className="font-head text-[20px] font-bold" style={{ color: "var(--text)" }}>
            <StatusDot status={status} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </p>
          <p className="font-mono text-[11px] mt-[6px]" style={{ color: "var(--muted)" }}>{clientCount} client{clientCount !== 1 ? "s" : ""} connected</p>
        </div>
        <StatCard label="Total readings" value={streamStats.total_readings.toLocaleString()} sub="since server start" trend="up" />
        <StatCard label="Anomalies detected" value={streamStats.total_anomalies} sub={`${streamStats.anomaly_rate_pct}% rate`} trend={streamStats.anomaly_rate_pct > 5 ? "down" : "up"} />
        <StatCard label="Alerts in buffer" value={alerts.length} sub="last 50 events" trend="warn" />
      </div>

      {/* Time-series anomaly score chart */}
      <Card style={{ marginBottom: 16 }}>
        <CardTitle>Anomaly score — live time series</CardTitle>
        <p className="font-mono text-[10px] mb-3" style={{ color: "var(--muted)" }}>
          Isolation Forest score per reading · scores above 0.45 are flagged as anomalies
        </p>
        <AnomalyScoreChart data={timeSeries} />
      </Card>

      {/* Live gauges + latest anomaly */}
      <div className="grid grid-cols-3 gap-4 mb-4">

        <Card>
          <CardTitle>SAF-01 — live sensor readings</CardTitle>
          {lastReading["SAF-01"] ? (
            <>
              <LiveGauge label="Bath temperature"    value={lastReading["SAF-01"].key_sensors.bath_temperature_c}    unit="°C"   normal={1680} />
              <LiveGauge label="Electrode current"   value={lastReading["SAF-01"].key_sensors.electrode_current_ka}  unit="kA"   normal={85}   />
              <LiveGauge label="Power input"         value={lastReading["SAF-01"].key_sensors.power_input_mw}        unit="MW"   normal={38}   />
              <LiveGauge label="Feed rate"           value={lastReading["SAF-01"].key_sensors.feed_rate_t_hr}        unit="t/hr" normal={12.5} />
              <p className="font-mono text-[10px] mt-2" style={{ color: "var(--muted)" }}>
                Updated {formatTime(lastReading["SAF-01"].timestamp)} SAST
              </p>
            </>
          ) : (
            <p className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>Waiting for first reading…</p>
          )}
        </Card>

        <Card>
          <CardTitle>SAF-02 — live sensor readings</CardTitle>
          {lastReading["SAF-02"] ? (
            <>
              <LiveGauge label="Bath temperature"    value={lastReading["SAF-02"].key_sensors.bath_temperature_c}    unit="°C"   normal={1680} />
              <LiveGauge label="Electrode current"   value={lastReading["SAF-02"].key_sensors.electrode_current_ka}  unit="kA"   normal={85}   />
              <LiveGauge label="Power input"         value={lastReading["SAF-02"].key_sensors.power_input_mw}        unit="MW"   normal={38}   />
              <LiveGauge label="Feed rate"           value={lastReading["SAF-02"].key_sensors.feed_rate_t_hr}        unit="t/hr" normal={12.5} />
              <p className="font-mono text-[10px] mt-2" style={{ color: "var(--muted)" }}>
                Updated {formatTime(lastReading["SAF-02"].timestamp)} SAST
              </p>
            </>
          ) : (
            <p className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>Waiting for first reading…</p>
          )}
        </Card>

        <Card>
          <CardTitle>Latest anomaly detail</CardTitle>
          {alerts.length > 0 ? (() => {
            const a = alerts[0];
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Badge variant={severityBadge[a.severity] || "red"}>{a.severity.toUpperCase()}</Badge>
                  <span className="font-head text-[13px] font-bold" style={{ color: severityColor[a.severity] }}>{a.furnace}</span>
                </div>
                <p className="font-mono text-[12px] mb-1" style={{ color: "var(--text)" }}>{a.scenario}</p>
                <p className="font-mono text-[11px] mb-3" style={{ color: "var(--muted)", lineHeight: 1.5 }}>{a.message}</p>
                <div className="font-mono text-[11px] mb-3" style={{ color: "var(--muted)" }}>
                  Score: <span style={{ color: severityColor[a.severity], fontWeight: 500 }}>{a.anomaly_score.toFixed(3)}</span>
                  <span style={{ marginLeft: 12 }}>{formatTime(a.timestamp)} SAST</span>
                </div>
                {a.triggered_sensors?.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>Triggered sensors</p>
                    {a.triggered_sensors.map(s => (
                      <div key={s.sensor} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "5px 0", borderBottom: "1px solid var(--border)",
                      }}>
                        <span className="font-mono text-[11px]" style={{ color: "var(--text)" }}>{s.label}</span>
                        <span className="font-mono text-[11px]" style={{ color: severityColor[a.severity] }}>
                          {s.value.toFixed(2)} {s.unit} (z={s.z_score})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })() : (
            <p className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>No anomalies detected yet — stream is running normally.</p>
          )}
        </Card>
      </div>

      {/* Alert log */}
      <Card>
        <CardTitle>Anomaly event log — live feed</CardTitle>
        {alerts.length === 0 ? (
          <p className="font-mono text-[12px] py-4 text-center" style={{ color: "var(--muted)" }}>
            Stream running — no anomalies yet. Readings arriving every 3 seconds.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border2)" }}>
                {["Time", "Furnace", "Scenario", "Message", "Score", "Severity"].map(h => (
                  <th key={h} style={{
                    fontFamily: "'DM Mono',monospace", fontSize: 10,
                    color: "var(--muted)", textTransform: "uppercase",
                    letterSpacing: "0.08em", padding: "8px 12px",
                    textAlign: "left", fontWeight: 400,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 20).map((a, i) => (
                <tr key={a.id || i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "9px 12px", color: "var(--muted)" }}>
                    {formatTime(a.timestamp)}
                  </td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "9px 12px", color: "var(--text)", fontWeight: 500 }}>
                    {a.furnace}
                  </td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "9px 12px", color: "var(--text)" }}>
                    {a.scenario}
                  </td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "9px 12px", color: "var(--muted)", maxWidth: 200 }}>
                    {a.message}
                  </td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "9px 12px", color: severityColor[a.severity], fontWeight: 500 }}>
                    {a.anomaly_score.toFixed(3)}
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <Badge variant={severityBadge[a.severity] || "red"}>{a.severity}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
