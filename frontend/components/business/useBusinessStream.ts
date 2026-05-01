"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
  .replace(/^http/, "ws") + "/ws/business";

const MAX_EVENTS = 60;

export interface PORow {
  id:       string;
  material: string;
  qty:      string;
  supplier: string;
  status:   string;
  auto:     boolean;
}

export interface SORow {
  id:       string;
  customer: string;
  product:  string;
  qty:      string;
  value:    string;
  status:   string;
}

export interface BusinessEvent {
  type:     string;
  message:  string;
  severity: "info" | "success" | "warning" | "error";
  ts:       string;
  // optional fields
  po_id?:    string;
  so_id?:    string;
  material?: string;
  customer?: string;
  new_status?: string;
}

export interface BizKpis {
  open_pos:       number;
  auto_generated: number;
  overdue:        number;
  open_sos:       number;
}

export interface BusinessState {
  connected:  boolean;
  stock:      Record<string, number>;
  pos:        PORow[];
  sos:        SORow[];
  kpis:       BizKpis;
  events:     BusinessEvent[];
  // tracks which row ids just changed for flash animation
  flashedPos: Set<string>;
  flashedSos: Set<string>;
}

const DEFAULT_KPIS: BizKpis = { open_pos: 0, auto_generated: 0, overdue: 0, open_sos: 0 };

export function useBusinessStream(): BusinessState {
  const [connected,  setConnected]  = useState(false);
  const [stock,      setStock]      = useState<Record<string, number>>({});
  const [pos,        setPos]        = useState<PORow[]>([]);
  const [sos,        setSos]        = useState<SORow[]>([]);
  const [kpis,       setKpis]       = useState<BizKpis>(DEFAULT_KPIS);
  const [events,     setEvents]     = useState<BusinessEvent[]>([]);
  const [flashedPos, setFlashedPos] = useState<Set<string>>(new Set());
  const [flashedSos, setFlashedSos] = useState<Set<string>>(new Set());

  const wsRef      = useRef<WebSocket | null>(null);
  const retryRef   = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const applyState = useCallback((state: any) => {
    if (!state) return;
    if (state.stock) setStock(state.stock);
    if (state.pos)   setPos(state.pos);
    if (state.sos)   setSos(state.sos);
    if (state.kpis)  setKpis(state.kpis);
  }, []);

  const flashRows = useCallback((evts: BusinessEvent[]) => {
    const poIds = new Set(evts.filter(e => e.po_id).map(e => e.po_id!));
    const soIds = new Set(evts.filter(e => e.so_id).map(e => e.so_id!));
    if (poIds.size) {
      setFlashedPos(poIds);
      setTimeout(() => setFlashedPos(new Set()), 1800);
    }
    if (soIds.size) {
      setFlashedSos(soIds);
      setTimeout(() => setFlashedSos(new Set()), 1800);
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === "connected") {
          applyState(msg.state);
        }

        if (msg.type === "business_update") {
          applyState(msg.state);
          if (msg.events?.length) {
            flashRows(msg.events);
            setEvents(prev => [...msg.events, ...prev].slice(0, MAX_EVENTS));
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      retryRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [applyState, flashRows]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Keepalive ping every 20 s
  useEffect(() => {
    const id = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 20_000);
    return () => clearInterval(id);
  }, []);

  return { connected, stock, pos, sos, kpis, events, flashedPos, flashedSos };
}
