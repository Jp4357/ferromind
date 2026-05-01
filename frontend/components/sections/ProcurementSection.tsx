"use client";
import { AccentLine, Badge, Card, CardTitle, PageHeader, StatCard, Table, Td, Th, Thead, statusToBadge } from "@/components/ui/primitives";
import { SpendChart } from "@/components/charts";
import { useLiveStream } from "@/components/business/BusinessStreamContext";

const SEV_COLOR: Record<string, string> = {
  success: "var(--green)",
  warning: "var(--accent)",
  error:   "var(--red)",
  info:    "var(--muted)",
};

const SEV_ICON: Record<string, string> = {
  success: "✓",
  warning: "⚠",
  error:   "✗",
  info:    "·",
};

function ConnDot({ connected }: { connected: boolean }) {
  return (
    <span style={{
      display:      "inline-flex", alignItems: "center", gap: 5,
      fontFamily:   "'DM Mono',monospace", fontSize: 10,
      padding:      "2px 8px", borderRadius: 20,
      background:   connected ? "rgba(46,204,139,0.1)" : "rgba(107,122,141,0.1)",
      border:       `1px solid ${connected ? "rgba(46,204,139,0.25)" : "rgba(107,122,141,0.2)"}`,
      color:        connected ? "var(--green)" : "var(--muted)",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: connected ? "var(--green)" : "var(--muted)", display: "inline-block", animation: connected ? "pulse 2s infinite" : "none" }} />
      {connected ? "LIVE" : "CONNECTING"}
    </span>
  );
}

export default function ProcurementSection({ data }: { data: any }) {
  const { vendorScorecard, spendChart, automationRules } = data;
  const { connected, pos, sos, kpis, events, flashedPos, flashedSos } = useLiveStream();

  // Fall back to static data until WebSocket connects
  const activePOs = pos.length > 0 ? pos : data.purchaseOrders;
  const liveKpis  = kpis.open_pos > 0 ? kpis : null;

  const openPos   = liveKpis?.open_pos       ?? data.kpis.open_pos.value;
  const autoPOs   = liveKpis?.auto_generated ?? data.kpis.auto_approved.value;
  const overdue   = liveKpis?.overdue        ?? data.kpis.open_pos.overdue;
  const openSOs   = liveKpis?.open_sos       ?? 0;

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <PageHeader title="Procurement & Orders" subtitle="LIVE PURCHASE ORDERS · SALES ORDERS · VENDOR SCORING · AUTO-REORDER" />
        <div style={{ paddingTop: 6 }}><ConnDot connected={connected} /></div>
      </div>
      <AccentLine />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Open POs"             value={openPos}  sub={`${overdue} overdue`}              trend={overdue > 0 ? "down" : "up"} />
        <StatCard label="Auto-Generated POs"   value={autoPOs}  sub="by reorder rules"                 trend="up" />
        <StatCard label="Open Sales Orders"    value={openSOs}  sub="awaiting fulfilment"               trend="up" />
        <StatCard label="Committed Spend"      value={data.kpis.committed_spend.value} sub={data.kpis.committed_spend.status} trend="up" />
      </div>

      {/* PO + SO tables */}
      <div className="grid grid-cols-2 gap-4 mb-4">

        {/* Purchase Orders */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <CardTitle>Purchase Orders</CardTitle>
            <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
              {activePOs.length} active
            </span>
          </div>
          <Table>
            <Thead>
              <tr><Th>PO</Th><Th>Material</Th><Th>Qty</Th><Th>Supplier</Th><Th>Status</Th></tr>
            </Thead>
            <tbody>
              {activePOs.map((po: any) => {
                const id      = po.id || po.po;
                const flashed = flashedPos.has(id);
                return (
                  <tr key={id}
                    style={{
                      background:  flashed ? "rgba(240,165,0,0.07)" : po.status === "Overdue" ? "rgba(232,82,74,0.04)" : "transparent",
                      transition:  "background 0.6s ease",
                    }}>
                    <Td>
                      <span className="font-mono text-[11px]" style={{ color: "var(--text)" }}>{id}</span>
                      {po.auto && (
                        <span className="font-mono text-[9px] ml-2 px-1 py-[1px] rounded"
                          style={{ background: "rgba(240,165,0,0.1)", color: "var(--accent)", border: "1px solid rgba(240,165,0,0.2)" }}>
                          AUTO
                        </span>
                      )}
                    </Td>
                    <Td>{po.material}</Td>
                    <Td>{po.qty}</Td>
                    <Td>{po.supplier}</Td>
                    <Td><Badge variant={statusToBadge(po.status)}>{po.status}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        {/* Sales Orders */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <CardTitle>Sales Orders</CardTitle>
            <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
              {sos.length} active
            </span>
          </div>
          {sos.length === 0 ? (
            <p className="font-mono text-[12px] py-8 text-center" style={{ color: "var(--muted)" }}>
              {connected ? "No open sales orders" : "Connecting to live stream…"}
            </p>
          ) : (
            <Table>
              <Thead>
                <tr><Th>SO</Th><Th>Customer</Th><Th>Qty</Th><Th>Value</Th><Th>Status</Th></tr>
              </Thead>
              <tbody>
                {sos.map((so: any) => {
                  const flashed = flashedSos.has(so.id);
                  return (
                    <tr key={so.id}
                      style={{
                        background: flashed ? "rgba(46,204,139,0.06)" : "transparent",
                        transition: "background 0.6s ease",
                      }}>
                      <Td>{so.id}</Td>
                      <Td>{so.customer}</Td>
                      <Td>{so.qty}</Td>
                      <Td><span className="font-mono text-[11px]" style={{ color: "var(--green)" }}>{so.value}</span></Td>
                      <Td><Badge variant={statusToBadge(so.status)}>{so.status}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {/* Spend chart + event log */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>Monthly Procurement Spend by Category ($000)</CardTitle>
          <SpendChart data={spendChart} />
        </Card>

        {/* Live event log */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <CardTitle>Live Event Log</CardTitle>
            <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>{events.length} events</span>
          </div>
          {events.length === 0 ? (
            <p className="font-mono text-[12px] py-6 text-center" style={{ color: "var(--muted)" }}>
              {connected ? "Waiting for first tick…" : "Connecting…"}
            </p>
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto" }} className="no-scrollbar">
              {events.slice(0, 30).map((ev, i) => {
                const color = SEV_COLOR[ev.severity] || "var(--muted)";
                const icon  = SEV_ICON[ev.severity]  || "·";
                const time  = ev.ts ? new Date(ev.ts).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
                return (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)", alignItems: "flex-start" }}>
                    <span className="font-mono text-[10px]" style={{ color: "var(--muted)", flexShrink: 0, minWidth: 52 }}>{time}</span>
                    <span className="font-mono text-[10px]" style={{ color, flexShrink: 0 }}>{icon}</span>
                    <span className="font-mono text-[11px]" style={{ color: "var(--text)", lineHeight: 1.4 }}>{ev.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Vendor scorecard + automation rules */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardTitle>Vendor Scorecard</CardTitle>
          <Table>
            <Thead>
              <tr><Th>Supplier</Th><Th>Material</Th><Th>On-Time %</Th><Th>Quality %</Th><Th>Score</Th></tr>
            </Thead>
            <tbody>
              {vendorScorecard.map((v: any) => (
                <tr key={v.supplier}>
                  <Td>{v.supplier}</Td><Td>{v.material}</Td>
                  <Td>{v.on_time}</Td><Td>{v.quality}</Td>
                  <Td><Badge variant={statusToBadge(v.score)}>{v.score}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardTitle>Automation Rules — Active Triggers</CardTitle>
          <Table>
            <Thead>
              <tr><Th>Rule</Th><Th>Trigger Condition</Th><Th>Action</Th><Th>State</Th></tr>
            </Thead>
            <tbody>
              {automationRules.map((r: any) => (
                <tr key={r.rule}>
                  <Td>{r.rule}</Td><Td>{r.condition}</Td><Td>{r.action}</Td>
                  <Td><Badge variant="green">{r.state}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
