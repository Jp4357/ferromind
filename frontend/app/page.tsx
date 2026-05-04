"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import OverviewSection     from "@/components/sections/OverviewSection";
import InventorySection    from "@/components/sections/InventorySection";
import ProcurementSection  from "@/components/sections/ProcurementSection";
import ProductionSection   from "@/components/sections/ProductionSection";
import ForecastingSection  from "@/components/sections/ForecastingSection";
import SupplyChainSection  from "@/components/sections/SupplyChainSection";
import AnomalyStreamSection  from "@/components/anomaly/AnomalyStreamSection";
import AdvisorTeamSection   from "@/components/advisor/AdvisorTeamSection";
import { BusinessStreamProvider } from "@/components/business/BusinessStreamContext";
import ProjectPlanSection  from "@/components/sections/ProjectPlanSection";
import AuthGuard from "@/components/auth/AuthGuard";

const TABS = [
  { id: "overview",     label: "Overview"      },
  { id: "inventory",    label: "Inventory"     },
  { id: "procurement",  label: "Procurement"   },
  { id: "production",   label: "Production"    },
  { id: "forecasting",  label: "ML Forecasting"},
  { id: "supplychain",  label: "Supply Chain"  },
  { id: "anomalies",    label: "Live Anomalies", badge: true },
  { id: "advisor",      label: "Advisor Team"  },
  { id: "projectplan",  label: "Project Plan"  },
];

export default function Home() {
  const [active,  setActive]  = useState("overview");
  const [allData, setAllData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [
          kpis, productionChart, alerts, furnaces, materialFlow, activity,
          invSummary, invParameters, invLevels, invTrend,
          procKpis, procPOs, procVendors, procSpend, procRules,
          prodKpis, prodDaily, prodEnergy, prodBatches, prodShifts,
          fcastModels, fcastDemand, fcastAccuracy, fcastRecs,
          scKpis, scSuppliers, scRisk, scLeadTime, scCost,
        ] = await Promise.all([
          apiFetch("/api/overview/kpis"),
          apiFetch("/api/overview/production-chart"),
          apiFetch("/api/overview/alerts"),
          apiFetch("/api/overview/furnaces"),
          apiFetch("/api/overview/material-flow"),
          apiFetch("/api/overview/activity"),
          apiFetch("/api/inventory/summary"),
          apiFetch("/api/inventory/parameters"),
          apiFetch("/api/inventory/levels-chart"),
          apiFetch("/api/inventory/chromite-trend"),
          apiFetch("/api/procurement/kpis"),
          apiFetch("/api/procurement/purchase-orders"),
          apiFetch("/api/procurement/vendor-scorecard"),
          apiFetch("/api/procurement/spend-chart"),
          apiFetch("/api/procurement/automation-rules"),
          apiFetch("/api/production/kpis"),
          apiFetch("/api/production/daily-production"),
          apiFetch("/api/production/energy"),
          apiFetch("/api/production/batch-log"),
          apiFetch("/api/production/shift-schedule"),
          apiFetch("/api/forecasting/models"),
          apiFetch("/api/forecasting/demand-forecast"),
          apiFetch("/api/forecasting/accuracy-history"),
          apiFetch("/api/forecasting/recommendations"),
          apiFetch("/api/supplychain/kpis"),
          apiFetch("/api/supplychain/suppliers"),
          apiFetch("/api/supplychain/risk-matrix"),
          apiFetch("/api/supplychain/lead-time-chart"),
          apiFetch("/api/supplychain/cost-chart"),
        ]);
        setAllData({
          overview:    { kpis, productionChart, alerts, furnaces, materialFlow, activity },
          inventory:   { summary: invSummary, parameters: invParameters, levelsChart: invLevels, chromiteTrend: invTrend },
          procurement: { kpis: procKpis, purchaseOrders: procPOs, vendorScorecard: procVendors, spendChart: procSpend, automationRules: procRules },
          production:  { kpis: prodKpis, dailyProduction: prodDaily, energy: prodEnergy, batchLog: prodBatches, shiftSchedule: prodShifts },
          forecasting: { models: fcastModels, demandForecast: fcastDemand, accuracyHistory: fcastAccuracy, recommendations: fcastRecs },
          supplychain: { kpis: scKpis, suppliers: scSuppliers, riskMatrix: scRisk, leadTimeChart: scLeadTime, costChart: scCost },
        });
      } catch (e) { console.error("API fetch error:", e); }
      finally     { setLoading(false); }
    }
    fetchAll();
  }, []);

  return (
    <AuthGuard>
    <BusinessStreamProvider>
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* ── NAV ─────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,12,15,0.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 var(--page-px)",
        display: "flex", alignItems: "center",
        height: "var(--nav-h)",
        gap: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 28, flexShrink: 0 }}>
          <div style={{
            width: 26, height: 26,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#0a0c0f", fontFamily: "var(--font-syne, sans-serif)", letterSpacing: "-0.5px" }}>F</span>
          </div>
          <span className="font-head text-[17px] font-extrabold tracking-[-0.5px]" style={{ color: "var(--text)" }}>
            FerroMind
          </span>
        </div>

        {/* Tab strip — scrollable on small screens */}
        <div
          className="no-scrollbar"
          style={{ display: "flex", gap: 2, flex: 1, overflowX: "auto", alignItems: "center" }}
        >
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`nav-tab font-mono text-[11px] uppercase tracking-[0.05em] px-4 py-[6px] rounded cursor-pointer border-none transition-all${active === tab.id ? " active" : ""}`}
              style={{
                background: active === tab.id ? "rgba(240,165,0,0.08)" : "transparent",
                color:      active === tab.id ? "var(--accent)" : "var(--muted)",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
              {tab.badge && (
                <span style={{
                  display: "inline-block", width: 6, height: 6,
                  background: "var(--red)", borderRadius: "50%",
                  marginLeft: 5, verticalAlign: "middle",
                  animation: "pulse 2s infinite",
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Live badge */}
        <div
          className="font-mono text-[10px] px-3 py-1 rounded-full"
          style={{
            background: "rgba(46,204,139,0.1)",
            color: "var(--green)",
            border: "1px solid rgba(46,204,139,0.25)",
            flexShrink: 0,
            marginLeft: 12,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{
            width: 6, height: 6,
            background: "var(--green)", borderRadius: "50%",
            display: "inline-block",
            animation: "pulse 2s infinite",
          }} />
          LIVE
        </div>

        {/* Logout */}
        <button
          onClick={() => { localStorage.removeItem("ferromind_token"); window.location.href = "/login"; }}
          className="font-mono text-[10px]"
          style={{
            flexShrink: 0, marginLeft: 10,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, padding: "5px 12px",
            color: "var(--muted)", cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = "rgba(232,82,74,0.4)"; (e.target as HTMLElement).style.color = "var(--red)"; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.target as HTMLElement).style.color = "var(--muted)"; }}
        >
          Logout
        </button>
      </nav>

      {/* ── CONTENT ─────────────────────────────────── */}
      <main style={{
        maxWidth: 1440,
        margin: "0 auto",
        padding: "clamp(20px, 3vw, 32px) var(--page-px) 56px",
      }}>
        {active === "projectplan" ? (
          <ProjectPlanSection />
        ) : active === "anomalies" ? (
          <AnomalyStreamSection />
        ) : active === "advisor" ? (
          <AdvisorTeamSection />
        ) : loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 420, gap: 16 }}>
            {/* Skeleton shimmer blocks */}
            <div className="skeleton" style={{ width: "100%", height: 28, borderRadius: 6 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, width: "100%" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 90, borderRadius: 10 }} />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%" }}>
              <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
              <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
            </div>
          </div>
        ) : (
          <>
            {active === "overview"    && allData.overview    && <OverviewSection    data={allData.overview} />}
            {active === "inventory"   && allData.inventory   && <InventorySection   data={allData.inventory} />}
            {active === "procurement" && allData.procurement && <ProcurementSection data={allData.procurement} />}
            {active === "production"  && allData.production  && <ProductionSection  data={allData.production} />}
            {active === "forecasting" && allData.forecasting && <ForecastingSection data={allData.forecasting} />}
            {active === "supplychain" && allData.supplychain && <SupplyChainSection data={allData.supplychain} />}
          </>
        )}
      </main>
    </div>
    </BusinessStreamProvider>
    </AuthGuard>
  );
}
