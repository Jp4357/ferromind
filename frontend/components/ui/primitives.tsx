"use client";
import { cn } from "@/lib/utils";

/* ─── Card ─────────────────────────────────────── */
export function Card({ className, children, hover = false, style }: { className?: string; children: React.ReactNode; hover?: boolean; style?: React.CSSProperties }) {
  return (
    <div className={cn("rounded-[10px] border p-5", hover && "card-hover", className)}
      style={{ background: "var(--panel)", borderColor: "var(--border)", ...style }}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.1em] mb-3"
      style={{ color: "var(--muted)" }}>
      {children}
    </p>
  );
}

/* ─── StatCard ──────────────────────────────────── */
type Trend = "up" | "down" | "warn";
export function StatCard({
  label, value, sub, trend,
}: { label: string; value: React.ReactNode; sub?: string; trend?: Trend }) {
  const subColor = trend === "up" ? "var(--green)" : trend === "down" ? "var(--red)" : "var(--accent)";
  return (
    <div className="card-hover rounded-[10px] border p-[18px_20px]"
      style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="font-head text-[28px] font-bold leading-none" style={{ color: "var(--text)" }}>{value}</p>
      {sub && <p className="font-mono text-[11px] mt-[6px]" style={{ color: subColor }}>{sub}</p>}
    </div>
  );
}

/* ─── Badge ─────────────────────────────────────── */
type BadgeVariant = "green" | "red" | "amber" | "blue" | "teal" | "muted";
const badgeStyles: Record<BadgeVariant, React.CSSProperties> = {
  green: { background: "rgba(46,204,139,0.12)", color: "var(--green)",  border: "1px solid rgba(46,204,139,0.25)" },
  red:   { background: "rgba(232,82,74,0.12)",  color: "var(--red)",    border: "1px solid rgba(232,82,74,0.25)" },
  amber: { background: "rgba(240,165,0,0.12)",  color: "var(--accent)", border: "1px solid rgba(240,165,0,0.25)" },
  blue:  { background: "rgba(74,158,255,0.12)", color: "var(--blue)",   border: "1px solid rgba(74,158,255,0.25)" },
  teal:  { background: "rgba(42,184,176,0.12)", color: "var(--teal)",   border: "1px solid rgba(42,184,176,0.25)" },
  muted: { background: "rgba(107,122,141,0.12)",color: "var(--muted)",  border: "1px solid rgba(107,122,141,0.25)" },
};

export function Badge({ variant = "muted", children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] px-[9px] py-[3px] rounded-full tracking-[0.04em] font-medium"
      style={badgeStyles[variant]}>
      {children}
    </span>
  );
}

export function statusToBadge(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (["ok", "running", "confirmed", "active", "production", "a+", "a", "approved", "shipping ready"].some(v => s.includes(v))) return "green";
  if (["overdue", "critical", "high", "off-spec"].some(v => s.includes(v))) return "red";
  if (["warn", "below reorder", "pending", "standby", "review", "b"].some(v => s.includes(v))) return "amber";
  if (["auto", "info", "blue"].some(v => s.includes(v))) return "blue";
  if (["transit", "teal"].some(v => s.includes(v))) return "teal";
  return "muted";
}

/* ─── Table primitives ───────────────────────────── */
export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full border-collapse">{children}</table>;
}
export function Thead({ children }: { children: React.ReactNode }) {
  return <thead style={{ borderBottom: "1px solid var(--border2)" }}>{children}</thead>;
}
export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="font-mono text-[10px] uppercase tracking-[0.08em] text-left px-3 py-2 font-normal"
      style={{ color: "var(--muted)" }}>{children}</th>
  );
}
export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("font-mono text-[12px] px-3 py-[10px] align-middle", className)}
      style={{ borderBottom: "1px solid var(--border)", color: "var(--text)" }}>
      {children}
    </td>
  );
}

/* ─── Alert ──────────────────────────────────────── */
type AlertLevel = "critical" | "warning" | "info";
const alertStyles: Record<AlertLevel, React.CSSProperties> = {
  critical: { background: "rgba(232,82,74,0.08)",  border: "1px solid rgba(232,82,74,0.2)" },
  warning:  { background: "rgba(240,165,0,0.07)",  border: "1px solid rgba(240,165,0,0.2)" },
  info:     { background: "rgba(74,158,255,0.07)", border: "1px solid rgba(74,158,255,0.2)" },
};
const alertIcon: Record<AlertLevel, string> = { critical: "🔴", warning: "🟡", info: "🔵" };

export function AlertItem({ level, message, time }: { level: AlertLevel; message: string; time: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg p-3 mb-2" style={alertStyles[level]}>
      <span className="text-sm mt-[1px] shrink-0">{alertIcon[level]}</span>
      <div>
        <p className="font-mono text-[11px] leading-[1.5]" style={{ color: "var(--text)" }}>{message}</p>
        <p className="font-mono text-[10px] mt-[2px]" style={{ color: "var(--muted)" }}>{time}</p>
      </div>
    </div>
  );
}

/* ─── Timeline ───────────────────────────────────── */
const dotColor: Record<string, string> = {
  green: "var(--green)", blue: "var(--blue)", amber: "var(--accent)",
  teal: "var(--teal)", muted: "var(--muted)",
};

export function TimelineItem({ color, title, meta }: { color: string; title: string; meta: string }) {
  return (
    <div className="flex gap-[14px] py-[10px]" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: dotColor[color] || "var(--muted)" }} />
      <div>
        <p className="font-mono text-[12px]" style={{ color: "var(--text)" }}>{title}</p>
        <p className="font-mono text-[10px] mt-[2px]" style={{ color: "var(--muted)" }}>{meta}</p>
      </div>
    </div>
  );
}

/* ─── Section header ─────────────────────────────── */
export function AccentLine() {
  return (
    <div className="h-[2px] rounded-sm mb-5"
      style={{ background: "linear-gradient(90deg, var(--accent), var(--accent2), transparent)" }} />
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-7">
      <h1 className="font-head font-bold tracking-[-0.5px]"
        style={{ color: "var(--text)", fontSize: "clamp(20px, 3vw, 28px)" }}>
        {title}
      </h1>
      <p className="font-mono text-[11px] mt-1 tracking-[0.05em] leading-relaxed"
        style={{ color: "var(--muted)" }}>
        {subtitle}
      </p>
    </div>
  );
}
