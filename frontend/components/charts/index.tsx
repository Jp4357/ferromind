"use client";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

const COLORS = {
  accent: "#f0a500", accent2: "#e05c2a", green: "#2ecc8b",
  red: "#e8524a", blue: "#4a9eff", teal: "#2ab8b0", muted: "#6b7a8d",
};

const tooltipStyle = {
  backgroundColor: "#1a2030", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, fontFamily: "'DM Mono', monospace", fontSize: 11,
};
const axisStyle = { fill: "#6b7a8d", fontFamily: "'DM Mono', monospace", fontSize: 11 };

/* ── Production vs Forecast (bar + line) ─────── */
export function ProductionForecastChart({ data }: { data: { labels: string[]; actual: number[]; forecast: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, Actual: data.actual[i], Forecast: data.forecast[i] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={d} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e8ecf0" }} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
        <Bar dataKey="Actual" fill={COLORS.teal} opacity={0.85} radius={[3,3,0,0]} />
        <Line type="monotone" dataKey="Forecast" stroke={COLORS.accent} dot={{ r: 4 }} strokeWidth={2} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Donut / Pie ─────────────────────────────── */
const PIE_COLORS = [COLORS.blue, COLORS.accent, COLORS.teal, COLORS.green, COLORS.muted];
export function DonutChart({ data }: { data: { labels: string[]; values: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, value: data.values[i] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={d} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
          {d.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Inventory levels bar + reorder line ─────── */
export function InventoryLevelsChart({ data }: { data: { labels: string[]; current: number[]; reorder: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, Current: data.current[i], Reorder: data.reorder[i] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={d}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e8ecf0" }} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
        <Bar dataKey="Current" radius={[3,3,0,0]}
          fill="transparent"
          label={false}>
          {d.map((entry, i) => (
            <Cell key={i} fill={entry.Current < entry.Reorder ? `${COLORS.red}99` : `${COLORS.green}99`} />
          ))}
        </Bar>
        <Line type="monotone" dataKey="Reorder" stroke={`${COLORS.accent}bb`} strokeDasharray="5 4" dot={{ r: 4 }} strokeWidth={1.5} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Chromite trend area ─────────────────────── */
export function ChromiteTrendChart({ data }: { data: { labels: string[]; stock: number[]; reorder_point: number } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, Stock: data.stock[i], Reorder: data.reorder_point }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={d}>
        <defs>
          <linearGradient id="chromGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
            <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e8ecf0" }} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
        <Area type="monotone" dataKey="Stock" stroke={COLORS.blue} fill="url(#chromGrad)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Reorder" stroke={`${COLORS.red}99`} strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Stacked spend bar ───────────────────────── */
export function SpendChart({ data }: { data: { labels: string[]; chromite: number[]; coke: number[]; other: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, Chromite: data.chromite[i], Coke: data.coke[i], Other: data.other[i] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={d}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e8ecf0" }} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
        <Bar dataKey="Chromite" fill={`${COLORS.blue}cc`} stackId="a" radius={[0,0,0,0]} />
        <Bar dataKey="Coke"     fill={`${COLORS.teal}cc`} stackId="a" />
        <Bar dataKey="Other"    fill={`${COLORS.muted}99`} stackId="a" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Daily production vs plan ────────────────── */
export function DailyProductionChart({ data }: { data: { labels: string[]; actual: number[]; plan: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, Actual: data.actual[i], Plan: data.plan[i] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={d}>
        <defs>
          <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.12} />
            <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[70, 82]} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e8ecf0" }} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
        <Area type="monotone" dataKey="Actual" stroke={COLORS.green} fill="url(#prodGrad)" strokeWidth={2} dot={{ r: 4, fill: COLORS.green }} />
        <Line type="monotone" dataKey="Plan" stroke={`${COLORS.accent}88`} strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Dual-axis energy chart ──────────────────── */
export function EnergyChart({ data }: { data: { labels: string[]; mwh_day: number[]; kwh_per_t: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, "MWh/day": data.mwh_day[i], "kWh/t": data.kwh_per_t[i] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={d}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left"  tick={axisStyle} axisLine={false} tickLine={false} domain={[3700,4000]} />
        <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} domain={[47,56]} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e8ecf0" }} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
        <Line yAxisId="left"  type="monotone" dataKey="MWh/day" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 4 }} />
        <Line yAxisId="right" type="monotone" dataKey="kWh/t"   stroke={COLORS.teal}   strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── 12-week demand forecast with CI ─────────── */
export function ForecastChart({ data }: { data: { labels: string[]; forecast: number[]; upper_ci: number[]; lower_ci: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({
    name: l, Forecast: data.forecast[i], Upper: data.upper_ci[i], Lower: data.lower_ci[i],
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={d}>
        <defs>
          <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.1} />
            <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e8ecf0" }} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
        <Area type="monotone" dataKey="Upper"    stroke={`${COLORS.blue}44`} strokeDasharray="4 3" fill="url(#ciGrad)" strokeWidth={1} dot={false} />
        <Line type="monotone" dataKey="Forecast" stroke={COLORS.blue} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.blue }} />
        <Area type="monotone" dataKey="Lower"    stroke={`${COLORS.blue}44`} strokeDasharray="4 3" fill="transparent" strokeWidth={1} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Forecast accuracy history ───────────────── */
export function ForecastAccuracyChart({ data }: { data: { labels: string[]; actual: number[]; forecast: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, Actual: data.actual[i], Forecast: data.forecast[i] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={d}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e8ecf0" }} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
        <Line type="monotone" dataKey="Actual"   stroke={COLORS.green} strokeWidth={2} dot={{ r: 5 }} />
        <Line type="monotone" dataKey="Forecast" stroke={COLORS.accent} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Lead time comparison ────────────────────── */
export function LeadTimeChart({ data }: { data: { labels: string[]; target: number[]; actual: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, Target: data.target[i], Actual: data.actual[i] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={d} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e8ecf0" }} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
        <Bar dataKey="Target" fill={`${COLORS.teal}88`} radius={[3,3,0,0]} />
        <Bar dataKey="Actual" radius={[3,3,0,0]}>
          {d.map((e, i) => <Cell key={i} fill={e.Actual > e.Target ? `${COLORS.red}cc` : `${COLORS.green}cc`} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Supply cost pie ─────────────────────────── */
export function SupplyCostChart({ data }: { data: { labels: string[]; values: number[] } }) {
  if (!data?.labels?.length) return null;
  const d = data.labels.map((l, i) => ({ name: l, value: data.values[i] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={d} cx="50%" cy="50%" outerRadius={80} paddingAngle={2} dataKey="value">
          {d.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#6b7a8d" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
