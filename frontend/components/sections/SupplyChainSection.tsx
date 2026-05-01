"use client";
import { AccentLine, Badge, Card, CardTitle, PageHeader, StatCard, Table, Td, Th, Thead, statusToBadge } from "@/components/ui/primitives";
import { LeadTimeChart, SupplyCostChart } from "@/components/charts";
import { useLiveStream } from "@/components/business/BusinessStreamContext";

// Stock safety thresholds — matches backend MATERIALS
const SAFETY: Record<string, number> = {
  "Chromite Ore":    20000,
  "Met. Coke":       3000,
  "Quartzite":       2000,
  "Electrode Paste": 80,
  "Lime":            600,
};

// Primary material each supplier provides (for active-PO badges)
const SUPPLIER_MATERIAL: Record<string, string> = {
  "Nkwe Mining":     "Chromite Ore",
  "Samancor Chrome": "Chromite Ore",
  "Xstrata Chrome":  "Chromite Ore",
  "ArcelorMittal":   "Met. Coke",
  "Glencore Coal":   "Met. Coke",
  "Lafarge SA":      "Quartzite",
  "SGL Carbon":      "Electrode Paste",
};

const STATUS_COLOR: Record<string, string> = {
  Primary:        "green",
  Backup:         "teal",
  "Under Review": "amber",
};

export default function SupplyChainSection({ data }: { data: any }) {
  const { kpis, suppliers, riskMatrix, leadTimeChart, costChart } = data;
  const { connected, stock, pos, sos } = useLiveStream();

  const hasLive = Object.keys(stock).length > 0;

  // Shipments in transit = active SOs in Shipped or Allocated state
  const liveShipments = hasLive
    ? sos.filter(s => s.status === "Shipped" || s.status === "Allocated").length
    : kpis.shipments_transit.value;

  // POs currently in transit (for the sub-label)
  const posInTransit = pos.filter(p => p.status === "In Transit").length;

  // Which material has which active PO status (one PO per material by design)
  const activePOsByMaterial = new Map<string, string>(
    pos.map(p => [p.material, p.status] as [string, string])
  );

  // Elevate risk level when live stock drops below safety threshold
  const liveRiskMatrix = riskMatrix.map((r: any) => {
    if (!hasLive) return r;
    const s         = stock[r.material] || 0;
    const threshold = SAFETY[r.material];
    if (threshold && s > 0 && s < threshold) {
      return { ...r, risk_level: "Critical", _elevated: true };
    }
    return r;
  });

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <PageHeader title="Supply Chain Intelligence" subtitle="SUPPLIER NETWORK · LEAD TIMES · RISK MATRIX · LOGISTICS" />
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

      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Active Suppliers"
          value={kpis.active_suppliers.value}
          sub={kpis.active_suppliers.note}
          trend="up"
        />
        <StatCard
          label="Supply Risk Score"
          value={<>{kpis.supply_risk_score.value}<span className="text-sm" style={{ color: "var(--muted)" }}>/10</span></>}
          sub={`↓ ${kpis.supply_risk_score.level} risk`}
          trend="up"
        />
        <StatCard
          label="Avg Transport Cost"
          value={<>${kpis.avg_transport_cost.value}<span className="text-sm" style={{ color: "var(--muted)" }}>/t</span></>}
          sub={`↓ ${kpis.avg_transport_cost.vs_last_q} vs last Q`}
          trend="up"
        />
        <StatCard
          label="Shipments In Transit"
          value={liveShipments}
          sub={hasLive
            ? `${posInTransit} PO${posInTransit !== 1 ? "s" : ""} in transit`
            : `${kpis.shipments_transit.delayed} delayed`}
          trend="warn"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Supplier network with live PO badges */}
        <Card>
          <CardTitle>Supplier Network</CardTitle>
          {suppliers.map((s: any) => {
            const material = SUPPLIER_MATERIAL[s.name];
            const poStatus = material ? activePOsByMaterial.get(material) : undefined;
            return (
              <div key={s.name} className="flex items-center gap-3 py-[10px]"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="font-mono text-[12px] min-w-[130px]" style={{ color: "var(--text)" }}>
                  {s.name}
                </span>
                <span className="font-mono text-[11px] flex-1" style={{ color: "var(--muted)" }}>
                  {s.material} · {s.location} · {s.distance} · {s.lead_time}
                </span>
                {poStatus && (
                  <span className="font-mono text-[9px] px-2 py-[2px] rounded"
                    style={{
                      background: poStatus === "In Transit" ? "rgba(46,204,139,0.1)" : "rgba(240,165,0,0.1)",
                      color:      poStatus === "In Transit" ? "var(--green)"          : "var(--accent)",
                      border:     `1px solid ${poStatus === "In Transit" ? "rgba(46,204,139,0.25)" : "rgba(240,165,0,0.2)"}`,
                      marginRight: 6,
                      whiteSpace: "nowrap",
                    }}>
                    PO · {poStatus}
                  </span>
                )}
                <Badge variant={(STATUS_COLOR[s.status] as any) || "muted"}>{s.status}</Badge>
              </div>
            );
          })}
        </Card>

        {/* Risk matrix with live elevation */}
        <Card>
          <CardTitle>Supply Risk Matrix</CardTitle>
          <Table>
            <Thead>
              <tr><Th>Material</Th><Th>Supply Risk</Th><Th>Price Vol.</Th><Th>Alt. Suppliers</Th><Th>Risk Level</Th></tr>
            </Thead>
            <tbody>
              {liveRiskMatrix.map((r: any) => (
                <tr key={r.material}
                  style={{ background: r._elevated ? "rgba(232,82,74,0.05)" : "transparent" }}>
                  <Td>{r.material}</Td>
                  <Td>{r.supply_risk}</Td>
                  <Td>{r.price_vol}</Td>
                  <Td>{r.alt_suppliers}</Td>
                  <Td>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Badge variant={statusToBadge(r.risk_level)}>{r.risk_level}</Badge>
                      {r._elevated && (
                        <span className="font-mono text-[9px]" style={{ color: "var(--red)" }}>↑ live</span>
                      )}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardTitle>Lead Time Trends by Material (days)</CardTitle>
          <LeadTimeChart data={leadTimeChart} />
        </Card>
        <Card>
          <CardTitle>Monthly Cost Breakdown — Total Supply Chain ($000)</CardTitle>
          <SupplyCostChart data={costChart} />
        </Card>
      </div>
    </div>
  );
}
