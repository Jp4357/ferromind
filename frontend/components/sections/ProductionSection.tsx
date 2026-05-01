"use client";
import { AccentLine, Badge, Card, CardTitle, PageHeader, StatCard, Table, Td, Th, Thead, statusToBadge } from "@/components/ui/primitives";
import { DailyProductionChart, EnergyChart } from "@/components/charts";

export default function ProductionSection({ data }: { data: any }) {
  const { kpis, dailyProduction, energy, batchLog, shiftSchedule } = data;
  return (
    <div className="animate-fade-in">
      <PageHeader title="Production Scheduling" subtitle="FURNACE PLANNING · SHIFT MANAGEMENT · BATCH TRACKING · ENERGY OPTIMIZATION" />
      <AccentLine />

      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Today's Output (t FeCr)" value={kpis.output_today.value}    sub={`↑ ${kpis.output_today.vs_plan} vs plan`}        trend="up" />
        <StatCard label="Active Furnaces"         value={kpis.active_furnaces.value} sub={kpis.active_furnaces.note}                        trend="warn" />
        <StatCard label="Energy Today"            value={<>{kpis.energy_today.value.toLocaleString()}<span className="text-sm" style={{color:"var(--muted)"}}> MWh</span></>} sub={`↓ ${kpis.energy_today.vs_baseline} vs baseline`} trend="up" />
        <StatCard label="Cr Recovery Rate"        value={<>{kpis.cr_recovery.value}<span className="text-sm" style={{color:"var(--muted)"}}>%</span></>} sub={`↑ ${kpis.cr_recovery.wow} WoW`} trend="up" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>Weekly Production vs Target (t/day FeCr)</CardTitle>
          <DailyProductionChart data={dailyProduction} />
        </Card>
        <Card>
          <CardTitle>Energy Consumption vs Output Efficiency</CardTitle>
          <EnergyChart data={energy} />
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardTitle>Batch Log — Last 10 Taps</CardTitle>
          <Table>
            <Thead><tr><Th>Batch</Th><Th>Furnace</Th><Th>Tap Time</Th><Th>Weight (t)</Th><Th>Cr%</Th><Th>Fe%</Th><Th>Grade</Th></tr></Thead>
            <tbody>
              {batchLog.map((b: any) => (
                <tr key={b.batch}>
                  <Td>{b.batch}</Td><Td>{b.furnace}</Td><Td>{b.tap_time}</Td>
                  <Td>{b.weight}</Td><Td>{b.cr_pct}</Td><Td>{b.fe_pct}</Td>
                  <Td><Badge variant={statusToBadge(b.grade)}>{b.grade}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardTitle>Shift Schedule — This Week</CardTitle>
          <Table>
            <Thead><tr><Th>Date</Th><Th>Shift A (06–14)</Th><Th>Shift B (14–22)</Th><Th>Shift C (22–06)</Th></tr></Thead>
            <tbody>
              {shiftSchedule.map((s: any) => (
                <tr key={s.date}>
                  <Td>{s.date}</Td><Td>{s.shift_a}</Td><Td>{s.shift_b}</Td><Td>{s.shift_c}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
