"use client";
import { AnomalyAlert } from "./useAnomalyStream";

const severityColor: Record<string, string> = {
  critical: "#e8524a",
  warning:  "#f0a500",
  info:     "#4a9eff",
};

const severityIcon: Record<string, string> = {
  critical: "⚠",
  warning:  "◈",
  info:     "◉",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-ZA", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: "Africa/Johannesburg",
    });
  } catch { return ""; }
}

interface ToastContainerProps {
  toasts:  AnomalyAlert[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  const latest    = toasts[0];
  const extraCount = toasts.length - 1;
  const color     = severityColor[latest.severity] ?? "#e8524a";

  const dismissAll = () => toasts.forEach(t => onClose(t.id));

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20,
      zIndex: 9999, width: 300,
      animation: "toastIn 0.2s ease",
    }}>
      {/* Main compact bar */}
      <div style={{
        background: "#141c2b",
        border: `1px solid ${color}55`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{ color, fontSize: 13, flexShrink: 0 }}>
          {severityIcon[latest.severity]}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600,
            color, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {latest.furnace} — {latest.scenario}
          </p>
          <p style={{
            fontFamily: "'DM Mono',monospace", fontSize: 10,
            color: "var(--muted, #6b7a8d)", margin: "2px 0 0",
          }}>
            {formatTime(latest.timestamp)} · score {latest.anomaly_score.toFixed(2)}
          </p>
        </div>

        <button
          onClick={dismissAll}
          title="Dismiss all"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted, #6b7a8d)", fontSize: 15, lineHeight: 1,
            padding: "0 2px", flexShrink: 0,
          }}>×</button>
      </div>

      {/* Extra count badge */}
      {extraCount > 0 && (
        <div style={{
          marginTop: 4,
          fontFamily: "'DM Mono',monospace", fontSize: 10,
          color: "var(--muted, #6b7a8d)",
          textAlign: "right", paddingRight: 4,
          cursor: "pointer",
        }} onClick={dismissAll}>
          +{extraCount} more alert{extraCount > 1 ? "s" : ""} — click × to clear all
        </div>
      )}

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// Keep named export for backward compat but it's no longer used directly
export function AnomalyToast({ alert, onClose }: { alert: AnomalyAlert; onClose: (id: string) => void }) {
  return <ToastContainer toasts={[alert]} onClose={onClose} />;
}
