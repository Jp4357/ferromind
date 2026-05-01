"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export type WsStatus = "connecting" | "connected" | "disconnected" | "error";

export interface AnomalyAlert {
  id:               string;
  timestamp:        string;
  furnace:          string;
  scenario:         string;
  message:          string;
  severity:         "critical" | "warning" | "info";
  anomaly_score:    number;
  triggered_sensors: { sensor: string; label: string; value: number; unit: string; z_score: number }[];
  stats:            { total_readings: number; total_anomalies: number; anomaly_rate_pct: number };
}

export interface SensorReading {
  timestamp:    string;
  furnace:      string;
  anomaly_score:number;
  is_anomaly:   boolean;
  key_sensors:  Record<string, number>;
  stats:        { total_readings: number; total_anomalies: number; anomaly_rate_pct: number };
}

export interface ChartPoint {
  time:       string;
  saf01:      number | null;
  saf02:      number | null;
  saf01_anom: boolean;
  saf02_anom: boolean;
}

const WS_URL      = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/anomalies";
const RECONNECT_DELAY = 3000;
const MAX_ALERTS  = 50;
const MAX_TS      = 60;

function toSAST(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-ZA", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: "Africa/Johannesburg",
    });
  } catch { return ""; }
}

export function useAnomalyStream() {
  const [status,       setStatus]       = useState<WsStatus>("connecting");
  const [alerts,       setAlerts]       = useState<AnomalyAlert[]>([]);
  const [lastReading,  setLastReading]  = useState<Record<string, SensorReading>>({});
  const [streamStats,  setStreamStats]  = useState({ total_readings: 0, total_anomalies: 0, anomaly_rate_pct: 0 });
  const [toasts,       setToasts]       = useState<AnomalyAlert[]>([]);
  const [clientCount,  setClientCount]  = useState(0);
  const [timeSeries,   setTimeSeries]   = useState<ChartPoint[]>([]);

  const wsRef        = useRef<WebSocket | null>(null);
  const pingRef      = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const pushToTimeSeries = useCallback((furnace: string, score: number, isAnomaly: boolean, time: string) => {
    const scoreKey = furnace === "SAF-01" ? "saf01" : "saf02";
    const anomKey  = furnace === "SAF-01" ? "saf01_anom" : "saf02_anom";
    setTimeSeries(prev => {
      const last = prev.at(-1);
      if (last && last[scoreKey] === null) {
        return [...prev.slice(0, -1), { ...last, [scoreKey]: score, [anomKey]: isAnomaly }];
      }
      const pt: ChartPoint = { time, saf01: null, saf02: null, saf01_anom: false, saf02_anom: false };
      pt[scoreKey] = score;
      pt[anomKey]  = isAnomaly;
      return [...prev, pt].slice(-MAX_TS);
    });
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "anomaly") {
          const alert: AnomalyAlert = msg;
          setAlerts(prev => [alert, ...prev].slice(0, MAX_ALERTS));
          setToasts(prev => [alert, ...prev].slice(0, 5));
          if (alert.stats) setStreamStats(alert.stats);
          setTimeout(() => dismissToast(alert.id), 8000);
          pushToTimeSeries(msg.furnace, msg.anomaly_score, true, toSAST(msg.timestamp));

        } else if (msg.type === "reading") {
          const r: SensorReading = msg;
          setLastReading(prev => ({ ...prev, [r.furnace]: r }));
          if (r.stats) setStreamStats(r.stats);
          pushToTimeSeries(r.furnace, r.anomaly_score, false, toSAST(r.timestamp));

        } else if (msg.type === "history") {
          setAlerts(msg.alerts || []);

        } else if (msg.type === "connected") {
          setClientCount(msg.clients || 1);
        }
      } catch {}
    };

    ws.onclose = () => {
      setStatus("disconnected");
      if (pingRef.current) clearInterval(pingRef.current);
      reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      setStatus("error");
      ws.close();
    };
  }, [dismissToast, pushToTimeSeries]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current)        wsRef.current.close();
      if (pingRef.current)      clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return { status, alerts, lastReading, streamStats, toasts, clientCount, dismissToast, timeSeries };
}
