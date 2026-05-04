"use client";
import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

import { authHeaders } from "@/lib/api";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const C = { accent:"#f0a500", green:"#2ecc8b", red:"#e8524a", blue:"#4a9eff", teal:"#2ab8b0", muted:"#6b7a8d", purple:"#7F77DD", coral:"#e05c2a" };
const DONUT_COLORS = [C.blue, C.teal, C.green, C.accent, C.muted];
const tooltipStyle = { backgroundColor:"#1a2030", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:11 };
const axisStyle    = { fill:"#6b7a8d", fontFamily:"'DM Mono',monospace", fontSize:11 };

const AGENT_LIST = [
  { label:"Market",      icon:"📈", color:C.blue   },
  { label:"Competitive", icon:"🔍", color:C.purple },
  { label:"Industry",    icon:"🏭", color:C.green  },
  { label:"Plant Data",  icon:"📊", color:C.teal   },
  { label:"Charts",      icon:"📉", color:C.accent },
  { label:"Advisor",     icon:"🎯", color:C.coral  },
];

// ── Primitives ───────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:"#1a2030", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"16px 18px", ...style }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#6b7a8d", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>
      {children}
    </p>
  );
}

function SectionHead({ title, color="#f0a500" }: { title: string; color?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, margin:"24px 0 12px" }}>
      <div style={{ width:3, height:18, background:color, borderRadius:2, flexShrink:0 }} />
      <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:"#e8ecf0", margin:0 }}>{title}</h2>
    </div>
  );
}

function Pill({ children, color="var(--muted)" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, padding:"2px 8px", borderRadius:12, background:`${color}22`, color, border:`1px solid ${color}44`, marginRight:4, display:"inline-block", marginBottom:2 }}>
      {children}
    </span>
  );
}

// ── Compact agent activity sidebar ──────────────────────────────────────────
function AgentSidebar({ events, phase, agentsDone }: { events: any[]; phase: string; agentsDone: Set<string> }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [events.length]);

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString("en-ZA", { hour:"2-digit", minute:"2-digit", second:"2-digit" }); }
    catch { return ""; }
  };

  const searchCount = events.filter(e => e.type === "agent_search").length;
  const doneCount   = agentsDone.size;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Agent status chips */}
      <Card>
        <Label>Agent team</Label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {AGENT_LIST.map(a => {
            const done = agentsDone.has(a.label) || phase === "done";
            return (
              <div key={a.label} style={{
                background: done ? `${a.color}12` : "rgba(255,255,255,0.03)",
                border: `1px solid ${done ? a.color + "33" : "rgba(255,255,255,0.06)"}`,
                borderRadius:6, padding:"7px 8px",
                display:"flex", alignItems:"center", gap:6,
                transition:"all 0.3s ease",
              }}>
                <span style={{ fontSize:13 }}>{a.icon}</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color: done ? a.color : C.muted, lineHeight:1.2 }}>
                  {a.label}
                </span>
                {done && <span style={{ marginLeft:"auto", color:C.green, fontSize:10 }}>✓</span>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Run stats (only when something is happening) */}
      {(phase === "running" || phase === "done") && (
        <Card>
          <Label>Run stats</Label>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted }}>Agents done</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.green, fontWeight:500 }}>{doneCount} / 6</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted }}>Web searches</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.blue, fontWeight:500 }}>{searchCount}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted }}>Status</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color: phase === "done" ? C.green : C.accent }}>
                {phase === "done" ? "Complete" : "Running…"}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Compact log — scrollable, fixed height */}
      {events.length > 0 && (
        <Card style={{ padding:"12px 14px" }}>
          <Label>Live log</Label>
          <div style={{ height:220, overflowY:"auto", fontFamily:"'DM Mono',monospace", fontSize:10 }} className="no-scrollbar">
            {events.map((e, i) => {
              const color = e.color || C.muted;
              const ts    = fmt(e.timestamp || "");
              return (
                <div key={i} style={{ display:"flex", flexDirection:"column", marginBottom:5, paddingBottom:5, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ color:"#3d3d3a", fontSize:9 }}>{ts}</span>
                  {e.type === "started" && (
                    <span style={{ color:C.accent }}>⚡ {e.message}</span>
                  )}
                  {e.type === "agent_start" && (
                    <span style={{ color }}>{e.icon} {e.agent} starting</span>
                  )}
                  {(e.type === "agent_search") && (
                    <span style={{ color:C.blue }}>🔎 {e.query || "searching…"}</span>
                  )}
                  {e.type === "agent_done" && (
                    <span style={{ color:C.green }}>✓ {e.agent} · {e.search_count} searches</span>
                  )}
                  {e.type === "agent_error" && (
                    <span style={{ color:C.red }}>✗ {e.message?.slice(0,60)}</span>
                  )}
                  {e.type === "parallel_complete" && (
                    <span style={{ color:C.accent }}>⚡ All research done — building brief…</span>
                  )}
                  {e.type === "complete" && (
                    <span style={{ color:C.green }}>🎯 Brief ready</span>
                  )}
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────
function ReportChart({ spec }: { spec: any }) {
  if (!spec) return null;

  if (spec.type === "area") {
    return (
      <Card>
        <Label>{spec.title}</Label>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={spec.data}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.blue} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[1100, 1600]} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v:any) => [`$${v}/t`]} />
            <Area type="monotone" dataKey="price" stroke={C.blue} fill="url(#priceGrad)" strokeWidth={2} dot={{ r:3 }} name="FeCr Price" />
            {spec.our_cost_line && <ReferenceLine y={spec.our_cost_line} stroke={`${C.green}88`} strokeDasharray="5 4" label={{ value:`Our cost $${spec.our_cost_line}`, fill:C.green, fontSize:10, fontFamily:"'DM Mono',monospace" }} />}
          </AreaChart>
        </ResponsiveContainer>
        {spec.insight && <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted, marginTop:8, lineHeight:1.5 }}>{spec.insight}</p>}
      </Card>
    );
  }

  if (spec.type === "bar" && spec.id === "competitor_capacity") {
    return (
      <Card>
        <Label>{spec.title}</Label>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={spec.data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize:10 }} axisLine={false} tickLine={false} width={90} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v:any) => [`${v}kt/yr`]} />
            <Bar dataKey="capacity" radius={[0,3,3,0]} name="Capacity (kt/yr)">
              {spec.data.map((d: any, i: number) => <Cell key={i} fill={d.ours ? C.accent : `${C.blue}88`} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {spec.insight && <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted, marginTop:8, lineHeight:1.5 }}>{spec.insight}</p>}
      </Card>
    );
  }

  if (spec.type === "bar" && spec.id === "technology_radar") {
    return (
      <Card>
        <Label>{spec.title}</Label>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={spec.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="tech" tick={{ ...axisStyle, fontSize:9 }} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted }} />
            <Bar dataKey="industry_adoption" fill={`${C.blue}88`}     radius={[3,3,0,0]} name="Industry %" />
            <Bar dataKey="our_score"         fill={`${C.accent}cc`}   radius={[3,3,0,0]} name="Our score %" />
          </BarChart>
        </ResponsiveContainer>
        {spec.insight && <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted, marginTop:8, lineHeight:1.5 }}>{spec.insight}</p>}
      </Card>
    );
  }

  if (spec.type === "donut") {
    return (
      <Card>
        <Label>{spec.title}</Label>
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie data={spec.data} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value">
              {spec.data.map((_: any, i: number) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:C.muted }} />
          </PieChart>
        </ResponsiveContainer>
        {spec.insight && <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted, marginTop:8, lineHeight:1.5 }}>{spec.insight}</p>}
      </Card>
    );
  }

  return null;
}

// ── Executive Brief ───────────────────────────────────────────────────────────
function ExecutiveBrief({ brief, charts }: { brief: any; charts: any[] }) {
  if (!brief) return null;
  const impactColor = (v: string) => v === "High" ? C.red : v === "Medium" ? C.accent : C.green;
  const prioColor   = (v: string) => v === "High" ? C.red : C.accent;

  return (
    <div>
      {/* Headline banner */}
      <div style={{ background:"rgba(240,165,0,0.06)", border:"1px solid rgba(240,165,0,0.2)", borderLeft:`4px solid ${C.accent}`, borderRadius:"0 10px 10px 0", padding:"16px 20px", marginBottom:24 }}>
        <p style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:C.accent, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Strategic headline</p>
        <p style={{ fontFamily:"'Literata',serif", fontSize:17, lineHeight:1.75, color:"#e8ecf0" }}>{brief.headline}</p>
      </div>

      {/* Market position */}
      <SectionHead title="Market Position" color={C.blue} />
      <p style={{ fontFamily:"'Literata',serif", fontSize:14, lineHeight:1.85, color:"#e8ecf0", marginBottom:20 }}>{brief.market_position}</p>

      {/* Charts row 1 */}
      {charts.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
          {charts.filter((c: any) => ["fecr_price_trend","competitor_capacity"].includes(c.id)).map((c: any) => (
            <ReportChart key={c.id} spec={c} />
          ))}
        </div>
      )}

      {/* Key findings */}
      <SectionHead title="Key Findings" color={C.teal} />
      <div style={{ marginBottom:20 }}>
        {(brief.key_findings || []).map((f: string, i: number) => (
          <div key={i} style={{ display:"flex", gap:14, padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ color:C.teal, fontFamily:"'DM Mono',monospace", fontSize:13, flexShrink:0, fontWeight:700, minWidth:24 }}>0{i+1}</span>
            <p style={{ fontFamily:"'Literata',serif", fontSize:14, lineHeight:1.75, color:"#e8ecf0", margin:0 }}>{f}</p>
          </div>
        ))}
      </div>

      {/* Charts row 2 */}
      {charts.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
          {charts.filter((c: any) => ["ss_production_by_region","chrome_ore_supply","technology_radar"].includes(c.id)).map((c: any) => (
            <ReportChart key={c.id} spec={c} />
          ))}
        </div>
      )}

      {/* Recommendations */}
      <SectionHead title="Strategic Recommendations" color={C.accent} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
        {(brief.strategic_recommendations || []).map((r: any, i: number) => (
          <div key={i} style={{ background:"rgba(240,165,0,0.04)", border:"1px solid rgba(240,165,0,0.14)", borderRadius:8, padding:"14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <Pill color={prioColor(r.priority)}>{r.priority}</Pill>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:C.muted }}>{r.timeline}</span>
            </div>
            <p style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#e8ecf0", marginBottom:6, fontWeight:500, lineHeight:1.5 }}>{r.action}</p>
            <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted, lineHeight:1.55 }}>{r.rationale}</p>
          </div>
        ))}
      </div>

      {/* Risks & Opportunities */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
        <div>
          <SectionHead title="Risks" color={C.red} />
          {(brief.risks || []).map((r: any, i: number) => (
            <div key={i} style={{ padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#e8ecf0", fontWeight:500 }}>{r.title}</span>
                <Pill color={impactColor(r.impact)}>{r.impact}</Pill>
              </div>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted, lineHeight:1.5 }}>{r.mitigation}</p>
            </div>
          ))}
        </div>
        <div>
          <SectionHead title="Opportunities" color={C.green} />
          {(brief.opportunities || []).map((o: any, i: number) => (
            <div key={i} style={{ padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#e8ecf0", fontWeight:500, marginBottom:4 }}>{o.title}</p>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.green, marginBottom:2 }}>{o.upside}</p>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:C.muted }}>{o.confidence}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive position */}
      <SectionHead title="Competitive Position" color={C.purple} />
      <p style={{ fontFamily:"'Literata',serif", fontSize:14, lineHeight:1.85, color:"#e8ecf0", marginBottom:20 }}>{brief.competitive_position}</p>

      {/* Sources */}
      <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:6, flexWrap:"wrap" }}>
        {(brief.research_sources || []).map((s: string, i: number) => (
          <Pill key={i} color={C.muted}>{s}</Pill>
        ))}
      </div>
    </div>
  );
}

// ── Advisor Chat ──────────────────────────────────────────────────────────────
function AdvisorChat() {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: "advisor", text: "Research complete. Ask me anything about the findings — market position, competitive threats, recommendations, or specific risks." }
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role:"user", text:q }]);
    setLoading(true);
    let answer = "";
    setMessages(prev => [...prev, { role:"advisor", text:"…" }]);

    try {
      const res = await fetch(`${API}/api/advisor/chat`, {
        method:"POST", headers:{"Content-Type":"application/json", ...authHeaders()},
        body: JSON.stringify({ question: q }),
      });
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data:")) continue;
          try {
            const msg = JSON.parse(line.slice(5));
            if (msg.type === "chat_chunk") {
              answer += msg.text;
              setMessages(prev => [...prev.slice(0,-1), { role:"advisor", text:answer }]);
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev.slice(0,-1), { role:"advisor", text:"Couldn't reach backend. Make sure the API is running." }]);
    }
    setLoading(false);
  };

  const suggestions = [
    "Why is our margin at 12%?",
    "Biggest competitive threat?",
    "Should we activate SAF-03?",
    "Chromite ore supply risk?",
  ];

  return (
    <div>
      <div style={{ height:320, overflowY:"auto", marginBottom:12 }} className="no-scrollbar">
        {messages.map((m, i) => (
          <div key={i} style={{ display:"flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom:12 }}>
            <div style={{
              maxWidth:"82%", padding:"11px 15px",
              borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
              background: m.role === "user" ? "rgba(240,165,0,0.1)" : "rgba(255,255,255,0.04)",
              border: m.role === "user" ? "1px solid rgba(240,165,0,0.22)" : "1px solid rgba(255,255,255,0.07)",
              fontFamily:"'Literata',serif", fontSize:13, lineHeight:1.65,
              color: m.role === "user" ? C.accent : "#e8ecf0",
            }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => setInput(s)}
            style={{ fontFamily:"'DM Mono',monospace", fontSize:10, padding:"4px 10px", borderRadius:20, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", color:C.muted, cursor:"pointer" }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ display:"flex", gap:8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask the strategic advisor…"
          style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#e8ecf0", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none" }}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ padding:"10px 22px", background:"rgba(240,165,0,0.12)", border:"1px solid rgba(240,165,0,0.28)", borderRadius:8, color:C.accent, fontFamily:"'DM Mono',monospace", fontSize:12, cursor:"pointer", opacity: loading || !input.trim() ? 0.45 : 1, transition:"opacity 0.15s" }}>
          {loading ? "…" : "Ask"}
        </button>
      </div>
    </div>
  );
}

// ── Progress indicator while agents work ──────────────────────────────────────
function ResearchInProgress({ events }: { events: any[] }) {
  const searchCount = events.filter(e => e.type === "agent_search").length;
  const doneCount   = events.filter(e => e.type === "agent_done").length;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, gap:28 }}>
      {/* Animated ring */}
      <div style={{ position:"relative", width:80, height:80 }}>
        <div style={{ width:80, height:80, borderRadius:"50%", border:`3px solid rgba(240,165,0,0.15)`, position:"absolute" }} />
        <div style={{ width:80, height:80, borderRadius:"50%", border:`3px solid transparent`, borderTopColor:C.accent, position:"absolute", animation:"spin 1s linear infinite" }} />
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace", fontSize:11, color:C.accent }}>
          {doneCount}/6
        </div>
      </div>

      <div style={{ textAlign:"center" }}>
        <p style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:"#e8ecf0", marginBottom:8 }}>
          Agents Researching
        </p>
        <p style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:C.muted, lineHeight:1.6 }}>
          {doneCount} of 6 agents complete · {searchCount} web searches so far
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ width:280, height:4, background:"rgba(255,255,255,0.07)", borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${Math.round((doneCount / 6) * 100)}%`, background:`linear-gradient(90deg, ${C.accent}, ${C.coral})`, borderRadius:2, transition:"width 0.5s ease" }} />
      </div>

      <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(107,122,141,0.6)", maxWidth:340, textAlign:"center", lineHeight:1.6 }}>
        4 specialist agents run in parallel — market, competitive, industry, and plant data.
        Charts and strategic brief are built when all finish.
      </p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdvisorTeamSection() {
  const [phase,      setPhase]     = useState<"idle"|"running"|"done">("idle");
  const [events,     setEvents]    = useState<any[]>([]);
  const [report,     setReport]    = useState<any>(null);
  const [activeTab,  setActiveTab] = useState<"brief"|"chat">("brief");
  const [agentsDone, setAgentsDone] = useState<Set<string>>(new Set());

  const startResearch = async (force = false) => {
    setPhase("running");
    setEvents([]);
    setReport(null);
    setAgentsDone(new Set());

    try {
      const res = await fetch(`${API}/api/advisor/stream${force ? "?force=true" : ""}`, { headers: authHeaders() });
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Accumulate across chunks — the final "complete" event is large JSON
        // that spans many network packets and must be reassembled before parsing.
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";   // last part may be incomplete — keep it
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data:")) continue;
            try {
              const msg = JSON.parse(line.slice(5).trim());
              if (msg.type === "complete" || msg.type === "cached") {
                setReport(msg.report);
                setPhase("done");
              } else {
                if (msg.type === "agent_done" && msg.agent) {
                  const short = msg.agent.split(" ")[0];
                  setAgentsDone(prev => { const n = new Set(prev); n.add(short); return n; });
                }
                setEvents(prev => [...prev, msg]);
              }
            } catch {}
          }
        }
      }
    } catch {
      setEvents(prev => [...prev, { type:"error", message:"Connection failed — is the backend running?", timestamp: new Date().toISOString() }]);
      setPhase("idle");
    }
  };

  useEffect(() => {
    // Only check status — never auto-start streaming on mount.
    // If a cached report exists, load it directly via /api/advisor/report
    // so we avoid re-streaming and breaking CloudFront SSE buffering.
    fetch(`${API}/api/advisor/status`, { headers: authHeaders() })
      .then(r => r.json())
      .then(s => {
        if (s.has_report) {
          fetch(`${API}/api/advisor/report`, { headers: authHeaders() })
            .then(r => r.json())
            .then(data => {
              if (data.brief) {
                setReport(data);
                setPhase("done");
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSidebar = phase !== "idle";

  return (
    <div style={{ animation:"fadeIn 0.3s ease" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:700, letterSpacing:"-0.5px", color:"#e8ecf0", marginBottom:4 }}>
            Advisor Team
          </h1>
          <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted, letterSpacing:"0.05em" }}>
            AI RESEARCH TEAM · MARKET · COMPETITIVE ANALYSIS · STRATEGIC BRIEF
          </p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {phase === "done" && (
            <button onClick={() => startResearch(true)}
              style={{ padding:"8px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, color:C.muted, fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer" }}>
              Regenerate
            </button>
          )}
          {phase !== "running" && (
            <button onClick={() => startResearch(true)}
              style={{ padding:"10px 24px", background:"rgba(240,165,0,0.12)", border:"1px solid rgba(240,165,0,0.3)", borderRadius:8, color:C.accent, fontFamily:"'DM Mono',monospace", fontSize:12, cursor:"pointer" }}>
              {phase === "idle" ? "▶  Start Research" : "▶  New Research"}
            </button>
          )}
          {phase === "running" && (
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", background:"rgba(46,204,139,0.07)", border:"1px solid rgba(46,204,139,0.2)", borderRadius:8 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:C.green, animation:"pulse 1s infinite" }} />
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.green }}>AGENTS WORKING</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ height:2, background:"linear-gradient(90deg,#f0a500,#e05c2a,transparent)", borderRadius:2, marginBottom:22 }} />

      {/* Body: sidebar + main (or full-width idle) */}
      {phase === "idle" ? (
        <div style={{ textAlign:"center", padding:"80px 0 60px", color:C.muted }}>
          <div style={{ fontSize:52, marginBottom:20 }}>🔬</div>
          <p style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:600, color:"#e8ecf0", marginBottom:10 }}>Ready to research</p>
          <p style={{ fontFamily:"'DM Mono',monospace", fontSize:12, lineHeight:1.8, maxWidth:420, margin:"0 auto" }}>
            Click "Start Research" to deploy 4 specialist AI agents in parallel.<br />
            They search the web for live market data, competitive intel, and industry trends,<br />
            then combine everything with your plant KPIs into a strategic brief.
          </p>
          {/* Agent chips preview */}
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:28, flexWrap:"wrap" }}>
            {AGENT_LIST.map(a => (
              <div key={a.label} style={{ fontFamily:"'DM Mono',monospace", fontSize:11, padding:"6px 14px", borderRadius:20, background:`${a.color}12`, border:`1px solid ${a.color}33`, color:a.color }}>
                {a.icon} {a.label}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:18, alignItems:"start" }}>

          {/* Sidebar — sticks while brief scrolls */}
          <div style={{ position:"sticky", top:"calc(56px + 20px)", maxHeight:"calc(100vh - 96px)", overflowY:"auto" }} className="no-scrollbar">
            <AgentSidebar events={events} phase={phase} agentsDone={agentsDone} />
          </div>

          {/* Main area */}
          <div>
            {phase === "running" && <ResearchInProgress events={events} />}

            {phase === "done" && report && (
              <div>
                {/* Sub-tabs */}
                <div style={{ display:"flex", gap:4, marginBottom:14, alignItems:"center" }}>
                  {(["brief","chat"] as const).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)}
                      style={{ fontFamily:"'DM Mono',monospace", fontSize:11, padding:"8px 20px", borderRadius:6, cursor:"pointer", border:"none", background: activeTab===t ? "rgba(240,165,0,0.12)" : "transparent", color: activeTab===t ? C.accent : C.muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                      {t === "brief" ? "Research Brief" : "Advisor Chat"}
                    </button>
                  ))}
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(107,122,141,0.6)", marginLeft:"auto" }}>
                    {new Date(report.meta.generated_at).toLocaleString("en-ZA", { timeZone:"Africa/Johannesburg" })} · {report.meta.model}
                  </span>
                </div>

                {/* Brief scrolls inside a fixed-height panel */}
                {activeTab === "brief" && (
                  <Card style={{ maxHeight:"calc(100vh - 200px)", overflowY:"auto" }}>
                    <ExecutiveBrief brief={report.brief} charts={report.charts || []} />
                  </Card>
                )}

                {activeTab === "chat" && (
                  <Card>
                    <Label>Advisor chat — ask follow-up questions</Label>
                    <AdvisorChat />
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
