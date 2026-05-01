"use client";
import { AccentLine, Badge, Card, CardTitle, PageHeader } from "@/components/ui/primitives";

// ── Problem card ──────────────────────────────────────────────────────────────
function PainPoint({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{
      display: "flex", gap: 14, padding: "14px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div>
        <p className="font-head text-[13px] font-semibold mb-1" style={{ color: "var(--text)" }}>{title}</p>
        <p className="font-mono text-[11px]" style={{ color: "var(--muted)", lineHeight: 1.6 }}>{body}</p>
      </div>
    </div>
  );
}

// ── Value transformation row ──────────────────────────────────────────────────
function Transform({ from, to }: { from: string; to: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 0", borderBottom: "1px solid var(--border)",
    }}>
      <div style={{
        flex: 1, background: "rgba(232,82,74,0.06)",
        border: "1px solid rgba(232,82,74,0.15)",
        borderRadius: 8, padding: "8px 12px",
      }}>
        <p className="font-mono text-[11px]" style={{ color: "var(--red)" }}>✗ {from}</p>
      </div>
      <span className="font-head text-[18px]" style={{ color: "var(--accent)", flexShrink: 0 }}>→</span>
      <div style={{
        flex: 1, background: "rgba(46,204,139,0.06)",
        border: "1px solid rgba(46,204,139,0.15)",
        borderRadius: 8, padding: "8px 12px",
      }}>
        <p className="font-mono text-[11px]" style={{ color: "var(--green)" }}>✓ {to}</p>
      </div>
    </div>
  );
}

// ── Module card ───────────────────────────────────────────────────────────────
function ModuleCard({
  icon, title, tagline, outcomes, accentColor,
}: {
  icon: string; title: string; tagline: string; outcomes: string[]; accentColor: string;
}) {
  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderTop: `3px solid ${accentColor}`,
      borderRadius: 10,
      padding: "20px",
    }}>
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <p className="font-head text-[14px] font-bold mb-1" style={{ color: "var(--text)" }}>{title}</p>
      <p className="font-mono text-[11px] mb-3" style={{ color: "var(--muted)" }}>{tagline}</p>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        {outcomes.map(o => (
          <div key={o} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
            <span style={{ color: accentColor, flexShrink: 0 }}>→</span>
            <p className="font-mono text-[11px]" style={{ color: "var(--text)", lineHeight: 1.5 }}>{o}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Impact stat ───────────────────────────────────────────────────────────────
function ImpactStat({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "20px 12px",
      borderRight: "1px solid var(--border)",
    }}>
      <p className="font-head text-[28px] font-extrabold" style={{
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>
        {value}
      </p>
      <p className="font-head text-[13px] font-semibold mt-1" style={{ color: "var(--text)" }}>{label}</p>
      <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>{sub}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProjectPlanSection() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="FerroMind — Business Intelligence Platform"
        subtitle="PRODUCT OVERVIEW · VALUE PROPOSITION · BUSINESS OUTCOMES"
      />
      <AccentLine />

      {/* ── Tagline ──────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", padding: "8px 0 28px" }}>
        <p className="font-head text-[22px] font-bold" style={{ color: "var(--text)", lineHeight: 1.5 }}>
          One platform. Every critical decision in your ferrochrome plant —
        </p>
        <p className="font-head text-[22px] font-bold" style={{
          background: "linear-gradient(90deg, var(--accent), var(--accent2))",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          informed, automated, and acted on in real time.
        </p>
      </div>

      {/* ── The problem ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>The Problem Today</CardTitle>
          <PainPoint
            icon="📋"
            title="Decisions made on yesterday's data"
            body="Plant managers rely on morning shift reports and weekly spreadsheets. By the time a stockout risk is spotted, it's already a production stoppage."
          />
          <PainPoint
            icon="🔔"
            title="Equipment failures catch you off guard"
            body="Furnace anomalies — irregular current draw, temperature spikes — go unnoticed until they cause unplanned downtime worth hundreds of thousands of dollars per day."
          />
          <PainPoint
            icon="📦"
            title="Inventory is managed by gut feel"
            body="Procurement teams over-order to stay safe, tying up working capital, or under-order and halt smelting. Neither is acceptable at scale."
          />
          <PainPoint
            icon="🔗"
            title="No visibility across the value chain"
            body="Procurement, production, supply chain, and finance each run their own tools. Cross-function decisions are slow and error-prone."
          />
        </Card>

        {/* ── What FerroMind does ─────────────────────────────────────────── */}
        <Card>
          <CardTitle>How FerroMind Fixes It</CardTitle>
          <Transform
            from="Morning reports on last night's data"
            to="Live dashboard updated every 3 seconds"
          />
          <Transform
            from="Anomalies discovered after the damage"
            to="AI flags deviations the moment they occur"
          />
          <Transform
            from="Manual purchase orders on spreadsheets"
            to="Auto-reorder triggered the instant stock dips below threshold"
          />
          <Transform
            from="Siloed teams, disconnected tools"
            to="One platform — procurement, production, and supply chain in sync"
          />
          <Transform
            from="Demand planning based on last year's numbers"
            to="ML forecast updated continuously, with what-if scenario modelling"
          />
        </Card>
      </div>

      {/* ── Business impact numbers ───────────────────────────────────────── */}
      <Card className="mb-4">
        <CardTitle>Business Impact at a Glance</CardTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginTop: 8 }}>
          <ImpactStat
            value="↓ 90%"
            label="Stockout Risk"
            sub="Auto-reorder fires before safety stock is breached"
          />
          <ImpactStat
            value="↑ 35%"
            label="Procurement Speed"
            sub="POs raised and approved without manual intervention"
          />
          <ImpactStat
            value="< 3 s"
            label="Anomaly Detected"
            sub="From sensor reading to alert on the dashboard"
          />
          <div style={{ textAlign: "center", padding: "20px 12px" }}>
            <p className="font-head text-[28px] font-extrabold" style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              6-in-1
            </p>
            <p className="font-head text-[13px] font-semibold mt-1" style={{ color: "var(--text)" }}>Tools Replaced</p>
            <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
              One platform replaces six disconnected systems
            </p>
          </div>
        </div>
      </Card>

      {/* ── Five business modules ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] mb-3" style={{ color: "var(--muted)" }}>
          What the platform covers
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <ModuleCard
            icon="📦"
            title="Inventory Intelligence"
            tagline="Know your stock position at all times"
            accentColor="var(--accent)"
            outcomes={[
              "Real-time stock levels for all 5 input materials",
              "Days-to-reorder countdown per material",
              "Visual alert when safety stock is threatened",
            ]}
          />
          <ModuleCard
            icon="🛒"
            title="Procurement Automation"
            tagline="Buy the right thing at the right time"
            accentColor="var(--green)"
            outcomes={[
              "Auto-generated POs when reorder point is hit",
              "Full PO lifecycle from draft to received",
              "Sales order fulfilment tracking end-to-end",
            ]}
          />
          <ModuleCard
            icon="🏭"
            title="Production Monitoring"
            tagline="Keep your furnaces running at peak"
            accentColor="var(--blue)"
            outcomes={[
              "Live furnace load, output, and efficiency",
              "Shift performance vs plan comparison",
              "Energy consumption vs baseline tracking",
            ]}
          />
          <ModuleCard
            icon="🔗"
            title="Supply Chain Risk"
            tagline="Manage supplier risk before it hits you"
            accentColor="var(--teal)"
            outcomes={[
              "Live PO status visible on each supplier row",
              "Risk level auto-elevates when stock is critical",
              "Shipments in transit tracked in real time",
            ]}
          />
          <ModuleCard
            icon="📈"
            title="Demand Forecasting"
            tagline="Plan production around what the market needs"
            accentColor="var(--accent2)"
            outcomes={[
              "ML forecast with confidence range, 24-week horizon",
              "What-if modelling for demand scenarios",
              "Scenario planning for price and volume shifts",
            ]}
          />
          <ModuleCard
            icon="🤝"
            title="AI Advisor Team"
            tagline="Your operational analyst, available 24/7"
            accentColor="var(--blue)"
            outcomes={[
              "6 specialist agents analyse every signal simultaneously — procurement, inventory, production, risk, forecasting, and strategy",
              "Produces a structured operational brief on demand in seconds — not hours",
              "Turns raw plant data into clear recommendations your team can act on immediately",
            ]}
          />
        </div>
      </div>

      {/* ── Who this is for ───────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardTitle>Who Benefits</CardTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, marginTop: 12 }}>
          {[
            {
              role:    "Plant Manager",
              icon:    "👷",
              benefit: "Full operational picture on one screen. Catch problems before they become stoppages. Make shift decisions backed by live data, not last night's report.",
            },
            {
              role:    "Procurement & Supply Chain",
              icon:    "📋",
              benefit: "Stop managing spreadsheets. Purchase orders are raised automatically. Vendor performance, lead times, and risk scores are visible without chasing anyone.",
            },
            {
              role:    "Finance & Executive Team",
              icon:    "📊",
              benefit: "See committed spend, open orders, and demand forecasts in one place. Quantify risk exposure. Share a live stakeholder view without preparing a report.",
            },
          ].map(({ role, icon, benefit }, i) => (
            <div key={role} style={{
              padding: "16px 20px",
              borderRight: i < 2 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
              <p className="font-head text-[13px] font-bold mb-2" style={{ color: "var(--text)" }}>{role}</p>
              <p className="font-mono text-[11px]" style={{ color: "var(--muted)", lineHeight: 1.7 }}>{benefit}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Why FerroMind ─────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardTitle>Why FerroMind</CardTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 12 }}>
          {[
            { badge: "Industry-Specific" as const, text: "Built around ferrochrome operations — the materials, the suppliers, the production process, the KPIs that matter to this industry. Not a generic BI tool adapted to fit." },
            { badge: "Live, Not Lagged"  as const, text: "Every number on screen reflects what is happening right now, not what happened yesterday. Decisions made on live data are better decisions." },
            { badge: "Automated"         as const, text: "The platform acts on signals without waiting for a human to notice them. Reorder rules fire automatically. Alerts surface instantly. The system works for you around the clock." },
            { badge: "AI-Powered"        as const, text: "An AI advisor reads every data stream simultaneously and produces a structured operational brief on demand — something no analyst could do as fast or as consistently." },
          ].map(({ badge, text }) => (
            <div key={badge} style={{
              padding: "14px 16px",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}>
              <div style={{ marginBottom: 8 }}>
                <Badge variant="amber">{badge}</Badge>
              </div>
              <p className="font-mono text-[11px]" style={{ color: "var(--muted)", lineHeight: 1.7 }}>{text}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
        <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
          FerroMind v2.0 — Vantech Ferrochrome Plant, Witbank, South Africa
          <span style={{ margin: "0 10px", opacity: 0.3 }}>|</span>
          Confidential · For stakeholder review only
        </p>
      </div>
    </div>
  );
}
