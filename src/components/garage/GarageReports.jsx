// Inventory > Garage > Reports: seven named answers, not one page of tables - the shape CrmReports.jsx
// already proved for the CRM. Before this the module had exactly one report (Overview, below, under its
// old name), and it only ever saw cars that had ALREADY LEFT (GET /garage/job-cards/analysis reads by
// delivery.gatePassAt alone) with "Revenue" reading the pre-VAT estimate value, never reconciled against
// what was actually invoiced. Work in progress and Vehicles are "as at today" - the range is drawn but
// disabled, with the reason stated, the same choice CrmReports.jsx made for Pipeline and Aging.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import StatCard from "../ui/stat-card.jsx";
import { CountUp } from "../Dashborad/CountUp";
import { RankedBars } from "../Dashborad/FlowCharts";
import { JobMixRing } from "./garageCharts.jsx";
import { useGarageReveal } from "./useGarageReveal";
import { reports as garageReports } from "../../lib/garageApi";
import { DataTable, EmptyState, ErrorNote, Panel, PageHeader, PageSpinner, Pill, TableScroll, useAsync, Field, DateInput } from "../accounting/kit.jsx";
import { PillTabs } from "../salesDocs/parts.jsx";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { pageSession } from "../../lib/pageSession";
import { formatCurrencyAED, formatCurrencyCompact, formatDate, formatNumber, downloadCSV, reportPreamble } from "../../utils/format";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { hueFor, REPORT_TABS, PERIODLESS_REPORTS, JOB_STATUS, AGE_BAND_LABEL, AGE_BAND_COLOR, BAY_KIND_LABEL } from "../../lib/garage";
import * as shape from "../../lib/garageReports";

const session = pageSession("garage-reports");

const pct = (n) => (n == null ? "–" : `${formatNumber(n, 1)}%`);
const hrs = (n) => (n == null ? "–" : `${formatNumber(n, 1)} h`);
const money = (n) => (n == null ? "–" : formatCurrencyAED(n));
const count = (n) => formatNumber(n || 0, 0);
// A trend badge for StatCard: up/down against the period before, silent when there is nothing to compare
// against (a shop that sold nothing last period is not "down 100%" - it is simply not comparable).
const trendText = (t) => (t?.changePct == null ? null : `${t.changePct > 0 ? "+" : ""}${formatNumber(t.changePct, 0)}% vs last period`);

const Nothing = ({ title, text }) => (
  <div className="grid min-h-32 place-items-center px-4 py-6">
    <EmptyState title={title} text={text} />
  </div>
);

/** The chart and the table behind it - the chart is how it is read, the table is how it is checked. */
function Chart({ rows, valueText = formatCurrencyCompact, describe, empty }) {
  if (!rows?.length) return <Nothing title={empty.title} text={empty.text} />;
  return <RankedBars rows={rows} valueText={valueText} describe={describe} />;
}

const Grid = ({ children }) => <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{children}</ul>;

/** The Export button every table carries - a report with no rows gets no button at all. */
function ExportButton({ rows, onClick }) {
  if (!rows?.length) return null;
  return (
    <button type="button" onClick={onClick} className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-input px-3 text-sm lg:h-10">
      <Download className="h-4 w-4" aria-hidden="true" /> Export
    </button>
  );
}

// ============================================================================================================
// Overview - what the module's one report used to answer, plus what was actually invoiced and a trend.
// ============================================================================================================
function Overview({ data, exportCsv, filter }) {
  const j = data.jobs;
  const streamRows = ["part", "labour", "sublet", "consumable"]
    .map((key, i) => ({ key, name: { part: "Parts", labour: "Labour", sublet: "Sublet", consumable: "Consumables" }[key], value: j.revenue?.[key] || 0, color: hueFor(i) }))
    .filter((r) => r.value > 0);
  const people = data.people || [];
  const jobRows = data.jobRows || [];
  const revenueTotal = j.revenue?.total || 0;
  // Each technician gets their own colour by position - without one RankedBars falls back to ink for every
  // bar (FlowCharts.jsx: fill={r.color || ink}), which is the D-something that started the earlier design pass.
  const peopleRows = people.map((p, i) => ({ key: p.key, name: p.label, value: p.hoursTaken || 0, color: hueFor(i) }));

  return (
    <>
      {filter && <PeriodNote filter={filter} count={j.delivered} noun="jobs delivered" className="mb-4" />}
      <Grid>
        <li><StatCard title="Delivered" count={<CountUp value={j.delivered || 0} format={(v) => String(Math.round(v))} />} subText="jobs handed back" trend={trendText(data.trend?.delivered)} /></li>
        <li><StatCard title="Revenue (estimate)" count={money(j.revenue?.total)} tone="teal" subText={j.delivered ? `across ${j.delivered} job${j.delivered === 1 ? "" : "s"}` : undefined} trend={trendText(data.trend?.revenue)} /></li>
        {/* THE JOIN THE OLD REPORT NEVER MADE: what was actually invoiced, against the estimate value above. */}
        <li><StatCard title="Invoiced" count={money(data.invoiced?.total)} subText={data.invoiced?.gapFromEstimate > 0.01 ? `${money(data.invoiced.gapFromEstimate)} not yet invoiced` : "matches the estimate"} /></li>
        <li><StatCard title="Average invoice" count={money(j.avgInvoice)} /></li>
        <li><StatCard title="On time" count={pct(j.onTimePct)} tone={j.onTimePct != null && j.onTimePct < 80 ? "warning" : "olive"} subText={j.withPromise ? `of ${j.withPromise} with a promised date` : "no promised dates to measure"} /></li>
        <li><StatCard title="Comebacks" count={pct(j.comebackPct)} tone={j.comebackPct > 0 ? "danger" : "neutral"} subText={j.comebacks ? `${j.comebacks} came back` : "none came back"} /></li>
        <li><StatCard title="Efficiency" count={pct(j.efficiencyPct)} tone="plum" subText={`${hrs(j.hoursSold)} sold / ${hrs(j.hoursTaken)} taken`} trend={trendText(data.trend?.efficiencyPct)} /></li>
      </Grid>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Revenue by stream" description="What the money is actually made of.">
          <Chart rows={streamRows} describe={(r) => `${formatCurrencyAED(r.value)} of ${formatCurrencyAED(revenueTotal)} revenue (${revenueTotal > 0 ? formatNumber((r.value / revenueTotal) * 100, 0) : 0}%)`} empty={{ title: "Nothing delivered in this period", text: "" }} />
        </Panel>
        <Panel title="Hours taken, by technician" description="Who did the work this period.">
          <Chart
            rows={peopleRows}
            valueText={(v) => `${formatNumber(v, 1)} h`}
            describe={(r) => { const p = people.find((x) => x.key === r.key); return p ? `${p.done} job${p.done === 1 ? "" : "s"} done · ${pct(p.efficiencyPct)} efficiency` : `${formatNumber(r.value, 1)} h`; }}
            empty={{ title: "Nothing to show yet", text: "" }}
          />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="The shop's own figures" description="Hours sold against hours taken, and what an hour actually earned.">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Hours sold</dt><dd className="text-lg font-semibold">{hrs(j.hoursSold)}</dd></div>
            <div><dt className="text-muted-foreground">Hours taken</dt><dd className="text-lg font-semibold">{hrs(j.hoursTaken)}</dd></div>
            <div><dt className="text-muted-foreground">Avg hours / job</dt><dd className="text-lg font-semibold">{hrs(j.avgHoursPerJob)}</dd></div>
            <div><dt className="text-muted-foreground">Effective labour rate</dt><dd className="text-lg font-semibold">{money(j.effectiveLabourRate)}/h</dd></div>
            <div><dt className="text-muted-foreground">Average turnaround</dt><dd className="text-lg font-semibold">{j.avgTurnaroundHours != null ? `${formatNumber(j.avgTurnaroundHours, 0)} h` : "–"}</dd></div>
            {/* Promised AND KEPT, not merely promised - j.onTime is the kept count, read correctly now. */}
            <div><dt className="text-muted-foreground">Promised and kept</dt><dd className="text-lg font-semibold">{j.onTime ?? 0} of {j.withPromise ?? 0}</dd></div>
          </dl>
        </Panel>
      </div>

      {people.length > 0 && (
        <div className="mt-4">
          <Panel title="By technician" description="Done, hours sold against taken, and how long a task waited to start." bodyClassName="p-0">
            <DataTable
              caption="By technician"
              rows={people}
              rowKey={(p) => p.key}
              columns={[
                { key: "label", header: "Person", card: "primary", cell: (p) => p.label },
                { key: "done", header: "Done", card: "meta", align: "end", cell: (p) => count(p.done) },
                { key: "sold", header: "Sold", card: "meta", align: "end", cell: (p) => hrs(p.hoursSold) },
                { key: "taken", header: "Taken", card: "meta", align: "end", cell: (p) => hrs(p.hoursTaken) },
                { key: "wait", header: "Waiting", card: "hidden", align: "end", cell: (p) => hrs(p.waitHours) },
                { key: "eff", header: "Efficiency", card: "badge", align: "end", cell: (p) => pct(p.efficiencyPct) },
              ]}
            />
          </Panel>
        </div>
      )}

      {/* G6: one row per delivered job, so a figure above can be traced to the job that made it. */}
      {jobRows.length > 0 && (
        <div className="mt-4">
          <Panel
            title="Jobs delivered this period"
            description="What the figures above are made of - revenue, hours and whether it went out on time, job by job."
            actions={<ExportButton rows={jobRows} onClick={() => exportCsv(shape.jobRowsCsv(jobRows), "garage-jobs")} />}
          >
            <ul className="divide-y rounded-lg border text-sm">
              {jobRows.map((r) => (
                <li key={r.jobCardId}>
                  <Link to={`/garage/job-cards?open=${r.jobCardId}`} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-secondary/50 lg:min-h-0">
                    <span className="font-mono text-xs text-muted-foreground">{r.jobNo || "(draft)"}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{r.plate || r.vehicle || "–"}</span>
                    <span className="truncate text-muted-foreground">{r.customer}</span>
                    {r.onTime === false && <Pill tone="danger">Late</Pill>}
                    {r.comeback && <Pill tone="warning">Comeback</Pill>}
                    <span className="text-xs text-muted-foreground">{formatDate(r.deliveredAt)}</span>
                    <span className="tabular-nums text-muted-foreground">{hrs(r.hoursSold)} / {hrs(r.hoursTaken)}</span>
                    <span className="tabular-nums font-semibold">{money(r.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}

// ============================================================================================================
// Work in progress - as at today. What is on the floor, by stage and age, what is on hold, what is owed.
// ============================================================================================================
function WorkInProgress({ data, exportCsv }) {
  const v = data.value;
  // The same five colours the Board's own ring uses for these exact five stages (GarageBoard.jsx RING_ROWS)
  // - so "in progress" is never confused with "ready for collection" by sharing one blue, and a status
  // reads the same colour wherever on the module it is drawn.
  const STAGE_RING_COLOR = { DRAFT: "var(--muted-foreground)", AWAITING_APPROVAL: "var(--status-warning)", IN_PROGRESS: "var(--chart-2)", READY: "var(--status-success)", DELIVERED: "var(--status-danger)" };
  const ringRows = (data.byStage || []).map((s) => ({ key: s.status, name: JOB_STATUS[s.status]?.label || s.status, value: s.value, color: STAGE_RING_COLOR[s.status] || "var(--muted-foreground)" }));
  const stageTotal = ringRows.reduce((t, r) => t + r.value, 0);
  const ageRows = (data.byAge || []).map((a) => ({ key: a.band, name: AGE_BAND_LABEL[a.band] || a.band, value: a.value, color: AGE_BAND_COLOR[a.band] }));
  const rows = data.rows || [];
  const onHold = data.onHold || [];

  return (
    <>
      <Grid>
        <li><StatCard title="Value on the floor" count={money(v.estimated)} tone="teal" subText="approved lines, every live job" /></li>
        <li><StatCard title="Approved, not billed" count={money(v.approvedNotBilled)} /></li>
        <li><StatCard title="Delivered, not invoiced" count={money(v.deliveredNotInvoiced?.value)} tone={v.deliveredNotInvoiced?.count ? "warning" : "neutral"} subText={v.deliveredNotInvoiced?.count ? `${count(v.deliveredNotInvoiced.count)} job${v.deliveredNotInvoiced.count === 1 ? "" : "s"}` : "none"} /></li>
        <li><StatCard title="Owed by customers" count={money(v.owed)} tone={v.owed > 0 ? "danger" : "neutral"} subText="on approved, unsettled invoices" /></li>
      </Grid>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Where the work stands" description="The value on the floor, by stage.">
          {ringRows.filter((r) => r.value > 0).length === 0 ? <Nothing title="Nothing on the floor" text="" /> : <JobMixRing rows={ringRows} total={stageTotal} label="value on the floor" />}
        </Panel>
        <Panel title="How long it has been waiting" description="Value on the floor, by days since the car was received.">
          <Chart rows={ageRows} describe={(r) => { const a = (data.byAge || []).find((x) => x.band === r.key); return `${count(a?.count)} job${a?.count === 1 ? "" : "s"}`; }} empty={{ title: "Nothing on the floor", text: "" }} />
        </Panel>
      </div>

      {onHold.length > 0 && (
        <div className="mt-4">
          <Panel title="Stuck, and why" description="A task with a reason it could not be finished." actions={<ExportButton rows={onHold} onClick={() => exportCsv(shape.onHoldCsv(onHold), "garage-wip-on-hold")} />} bodyClassName="p-0">
            <DataTable
              caption="Jobs on hold"
              rows={onHold}
              rowKey={(r) => `${r.jobCardId}-${r.taskName}`}
              columns={[
                { key: "jobNo", header: "Job", card: "primary", cell: (r) => <Link to={`/garage/job-cards?open=${r.jobCardId}`} className="hover:underline">{r.jobNo}</Link> },
                { key: "task", header: "Task", card: "title", cell: (r) => r.taskName },
                { key: "reason", header: "Held for", card: "badge", cell: (r) => <Pill tone="warning">{r.holdReason}</Pill> },
                { key: "days", header: "Days in workshop", card: "meta", align: "end", cell: (r) => count(r.daysIn) },
              ]}
            />
          </Panel>
        </div>
      )}

      <div className="mt-4">
        <Panel title="Every job on the floor" description={`${count(rows.length)} in all, oldest first.`} actions={<ExportButton rows={rows} onClick={() => exportCsv(shape.wipCsv(rows), "garage-wip")} />} bodyClassName="p-0">
          <TableScroll label="Every job on the floor">
            <DataTable
              className="table-pin-first"
              caption="Work in progress"
              rows={rows}
              rowKey={(r) => r.jobCardId}
              empty={<Nothing title="Nothing on the floor" text="" />}
              columns={[
                { key: "jobNo", header: "Job", card: "primary", cell: (r) => <Link to={`/garage/job-cards?open=${r.jobCardId}`} className="hover:underline">{r.jobNo}</Link> },
                { key: "vehicle", header: "Vehicle", card: "title", cell: (r) => r.plate || r.vehicle || "–" },
                { key: "customer", header: "Customer", card: "meta", cell: (r) => r.customer },
                { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={JOB_STATUS[r.status]?.tone}>{JOB_STATUS[r.status]?.label || r.status}</Pill> },
                { key: "age", header: "Days in workshop", card: "meta", align: "end", cell: (r) => (r.ageBand ? <span className={r.ageBand === "o15" ? "font-semibold text-status-danger" : ""}>{count(r.daysIn)}</span> : "–") },
                { key: "owed", header: "Owed", card: "hidden", align: "end", cell: (r) => (r.owed > 0 ? money(r.owed) : "–") },
                { key: "value", header: "Value", card: "amount", align: "end", cell: (r) => money(r.value) },
              ]}
            />
          </TableScroll>
        </Panel>
      </div>
    </>
  );
}

// ============================================================================================================
// Profit - revenue against cost, per stream.
// ============================================================================================================
function Profit({ data, exportCsv }) {
  const streamRows = (data.streams || []).map((s, i) => ({ key: s.kind, name: s.label, value: s.revenue, color: hueFor(i) })).filter((r) => r.value > 0);
  return (
    <>
      <Grid>
        <li><StatCard title="Revenue" count={money(data.revenue?.total)} tone="teal" /></li>
        <li><StatCard title="Cost" count={money(data.margin?.total != null ? (data.revenue?.total || 0) - data.margin.total : null)} /></li>
        <li><StatCard title="Margin" count={money(data.margin?.total)} tone={data.margin?.total != null && data.margin.total < 0 ? "danger" : "olive"} subText={data.margin?.marginPct != null ? `${formatNumber(data.margin.marginPct, 1)}% of revenue` : "not fully costed"} /></li>
        <li><StatCard title="Uncosted labour" count={`${formatNumber(data.uncostedLabourHours || 0, 1)} h`} subText={data.uncostedLabourHours > 0 ? "no contract rate on file" : "all labour costed"} /></li>
      </Grid>

      <div className="mt-4">
        <Panel title="Revenue by stream" description="What the money is actually made of.">
          <Chart rows={streamRows} describe={(r) => { const s = (data.streams || []).find((x) => x.kind === r.key); return `${money(s?.cost)} cost · ${money(s?.margin)} margin`; }} empty={{ title: "Nothing delivered in this period", text: "" }} />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Revenue, cost and margin per stream"
          description="A stream with no known cost shows a blank margin, never a zero one - zero would read as free."
          actions={<ExportButton rows={data.streams} onClick={() => exportCsv(shape.profitStreamsCsv(data.streams), "garage-profit")} />}
          bodyClassName="p-0"
        >
          <DataTable
            caption="Profit by stream"
            rows={data.streams || []}
            rowKey={(r) => r.kind}
            columns={[
              { key: "label", header: "Stream", card: "primary", cell: (r) => r.label },
              { key: "revenue", header: "Revenue", card: "meta", align: "end", cell: (r) => money(r.revenue) },
              { key: "cost", header: "Cost", card: "meta", align: "end", cell: (r) => money(r.cost) },
              { key: "margin", header: "Margin", card: "amount", align: "end", cell: (r) => money(r.margin) },
              { key: "basis", header: "Basis", card: "hidden", cell: (r) => r.basis },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

// ============================================================================================================
// People & bays - hours sold against taken, by technician and by bay.
// ============================================================================================================
function PeopleBays({ data, exportCsv }) {
  const people = data.people || [];
  const bays = data.bays || [];
  const peopleRows = people.map((p, i) => ({ key: p.key, name: p.label, value: p.hoursTaken || 0, color: hueFor(i) }));
  const bayRows = bays.map((b, i) => ({ key: b.bayId || b.name, name: b.name, value: b.hoursTaken || 0, color: hueFor(i) }));
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Hours taken, by technician" description="Who did the work this period.">
          <Chart rows={peopleRows} valueText={(v) => `${formatNumber(v, 1)} h`} describe={(r) => { const p = people.find((x) => x.key === r.key); return p ? `${p.done} job${p.done === 1 ? "" : "s"} done · ${pct(p.efficiencyPct)} efficiency` : ""; }} empty={{ title: "Nothing to show yet", text: "" }} />
        </Panel>
        <Panel title="Hours taken, by bay" description="Where the hours actually went.">
          <Chart rows={bayRows} valueText={(v) => `${formatNumber(v, 1)} h`} describe={(r) => { const b = bays.find((x) => (x.bayId || x.name) === r.key); return b ? `${b.jobsDone} job${b.jobsDone === 1 ? "" : "s"} · ${BAY_KIND_LABEL[b.kind] || "Kind not set"}` : ""; }} empty={{ title: "Nothing to show yet", text: "" }} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="By technician" actions={<ExportButton rows={people} onClick={() => exportCsv(shape.peopleCsv(people), "garage-people")} />} bodyClassName="p-0">
          <DataTable
            caption="By technician"
            rows={people}
            rowKey={(p) => p.key}
            empty={<Nothing title="Nothing to show yet" text="" />}
            columns={[
              { key: "label", header: "Person", card: "primary", cell: (p) => p.label },
              { key: "done", header: "Done", card: "meta", align: "end", cell: (p) => count(p.done) },
              { key: "sold", header: "Sold", card: "meta", align: "end", cell: (p) => hrs(p.hoursSold) },
              { key: "taken", header: "Taken", card: "meta", align: "end", cell: (p) => hrs(p.hoursTaken) },
              { key: "wait", header: "Waiting", card: "hidden", align: "end", cell: (p) => hrs(p.waitHours) },
              { key: "eff", header: "Efficiency", card: "badge", align: "end", cell: (p) => pct(p.efficiencyPct) },
            ]}
          />
        </Panel>
        <Panel title="By bay" actions={<ExportButton rows={bays} onClick={() => exportCsv(shape.baysCsv(bays), "garage-bays")} />} bodyClassName="p-0">
          <DataTable
            caption="By bay"
            rows={bays}
            rowKey={(b) => b.bayId || b.name}
            empty={<Nothing title="Nothing to show yet" text="" />}
            columns={[
              { key: "name", header: "Bay", card: "primary", cell: (b) => b.name },
              { key: "kind", header: "Kind", card: "badge", cell: (b) => BAY_KIND_LABEL[b.kind] || "–" },
              { key: "done", header: "Done", card: "meta", align: "end", cell: (b) => count(b.jobsDone) },
              { key: "taken", header: "Hours taken", card: "amount", align: "end", cell: (b) => hrs(b.hoursTaken) },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

// ============================================================================================================
// Customers - spend, repeat visits, average repair order.
// ============================================================================================================
function Customers({ data, exportCsv }) {
  const rows = data.rows || [];
  const s = data.summary || {};
  return (
    <>
      <Grid>
        <li><StatCard title="Customers" count={count(s.customers)} /></li>
        <li><StatCard title="Repeat customers" count={pct(s.repeatPct)} subText={`${count(s.repeatCustomers)} of ${count(s.customers)}`} /></li>
        <li><StatCard title="Average repair order" count={money(s.averageRepairOrder)} tone="teal" /></li>
      </Grid>
      <div className="mt-4">
        <Panel title="Every customer, highest spend first" actions={<ExportButton rows={rows} onClick={() => exportCsv(shape.customersCsv(rows), "garage-customers")} />} bodyClassName="p-0">
          <TableScroll label="Every customer">
            <DataTable
              className="table-pin-first"
              caption="Customers"
              rows={rows}
              rowKey={(r) => r.customerId}
              empty={<Nothing title="Nobody delivered to in this period" text="" />}
              columns={[
                { key: "name", header: "Customer", card: "primary", cell: (r) => r.name },
                { key: "jobs", header: "Jobs", card: "meta", align: "end", cell: (r) => count(r.jobs) },
                { key: "repeat", header: "Repeat", card: "badge", cell: (r) => (r.repeat ? <Pill tone="info">Repeat</Pill> : "–") },
                { key: "estimated", header: "Estimated", card: "hidden", align: "end", cell: (r) => money(r.estimated) },
                { key: "invoiced", header: "Invoiced", card: "amount", align: "end", cell: (r) => money(r.invoiced) },
                { key: "avg", header: "Avg invoice", card: "hidden", align: "end", cell: (r) => money(r.avgInvoice) },
                { key: "last", header: "Last visit", card: "hidden", cell: (r) => (r.last ? formatDate(r.last) : "–") },
              ]}
            />
          </TableScroll>
        </Panel>
      </div>
    </>
  );
}

// ============================================================================================================
// Vehicles - as at today. The fleet, what is due or expiring, which cars come back the most.
// ============================================================================================================
function Vehicles({ data, exportCsv }) {
  const fleet = data.fleet || {};
  const makeRows = (fleet.byMake || []).map((m, i) => ({ key: m.make, name: m.make, value: m.count, color: hueFor(i) }));
  const reg = data.registrationExpiring || [];
  const pol = data.policyExpiring || [];
  const due = data.serviceDue || [];
  const top = data.topVisited || [];
  return (
    <>
      <Grid>
        <li><StatCard title="Fleet" count={count(fleet.total)} subText={`${count(fleet.active)} active`} /></li>
        <li><StatCard title="Registration expiring" count={count(reg.length)} tone={reg.some((r) => r.state === "overdue") ? "danger" : reg.length ? "warning" : "neutral"} subText="within 30 days" /></li>
        <li><StatCard title="Policy expiring" count={count(pol.length)} tone={pol.some((r) => r.state === "overdue") ? "danger" : pol.length ? "warning" : "neutral"} subText="within 30 days" /></li>
        <li><StatCard title="Service due" count={count(due.length)} tone={due.some((r) => r.overdue) ? "danger" : due.length ? "warning" : "neutral"} /></li>
      </Grid>

      <div className="mt-4">
        <Panel title="The fleet" description="By make.">
          <Chart rows={makeRows} valueText={(v) => count(v)} describe={(r) => `${count(r.value)} vehicle${r.value === 1 ? "" : "s"}`} empty={{ title: "No vehicles yet", text: "" }} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Registration expiring" actions={<ExportButton rows={reg} onClick={() => exportCsv(shape.registrationExpiringCsv(reg), "garage-registration-expiring")} />} bodyClassName="p-0">
          <DataTable
            caption="Registration expiring"
            rows={reg}
            rowKey={(r) => r.vehicleId}
            empty={<Nothing title="Nothing due soon" text="" />}
            columns={[
              { key: "plate", header: "Plate", card: "primary", cell: (r) => r.plate },
              { key: "customer", header: "Customer", card: "meta", cell: (r) => r.customer },
              { key: "day", header: "Expires", card: "amount", cell: (r) => <span className={r.state === "overdue" ? "font-semibold text-status-danger" : "text-status-warning"}>{formatDate(r.day)}</span> },
            ]}
          />
        </Panel>
        <Panel title="Insurance policy expiring" actions={<ExportButton rows={pol} onClick={() => exportCsv(shape.policyExpiringCsv(pol), "garage-policy-expiring")} />} bodyClassName="p-0">
          <DataTable
            caption="Policy expiring"
            rows={pol}
            rowKey={(r) => r.vehicleId}
            empty={<Nothing title="Nothing due soon" text="" />}
            columns={[
              { key: "plate", header: "Plate", card: "primary", cell: (r) => r.plate },
              { key: "customer", header: "Customer", card: "meta", cell: (r) => r.customer },
              { key: "insurer", header: "Insurer", card: "hidden", cell: (r) => r.insurer || "–" },
              { key: "day", header: "Expires", card: "amount", cell: (r) => <span className={r.state === "overdue" ? "font-semibold text-status-danger" : "text-status-warning"}>{formatDate(r.day)}</span> },
            ]}
          />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Service due" actions={<ExportButton rows={due} onClick={() => exportCsv(shape.serviceDueCsv(due), "garage-service-due")} />} bodyClassName="p-0">
          <DataTable
            caption="Service due"
            rows={due}
            rowKey={(r) => r.vehicleId}
            empty={<Nothing title="Nothing due" text="" />}
            columns={[
              { key: "plate", header: "Plate", card: "primary", cell: (r) => r.plate },
              { key: "customer", header: "Customer", card: "meta", cell: (r) => r.customer },
              { key: "dueDay", header: "Due day", card: "hidden", cell: (r) => (r.dueDay ? formatDate(r.dueDay) : "–") },
              { key: "dueOdo", header: "Due odometer", card: "hidden", align: "end", cell: (r) => (r.dueOdometer ? formatNumber(r.dueOdometer, 0) : "–") },
              { key: "overdue", header: "Overdue", card: "badge", cell: (r) => (r.overdue ? <Pill tone="danger">Overdue</Pill> : <Pill tone="neutral">Due soon</Pill>) },
            ]}
          />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Most visited" description="Delivered and closed jobs, all time." actions={<ExportButton rows={top} onClick={() => exportCsv(shape.topVisitedCsv(top), "garage-top-visited")} />} bodyClassName="p-0">
          <DataTable
            caption="Most visited"
            rows={top}
            rowKey={(r) => r.vehicleId}
            empty={<Nothing title="Nothing delivered yet" text="" />}
            columns={[
              { key: "plate", header: "Plate", card: "primary", cell: (r) => r.plate },
              { key: "vehicle", header: "Vehicle", card: "title", cell: (r) => `${r.make} ${r.model}`.trim() },
              { key: "customer", header: "Customer", card: "meta", cell: (r) => r.customer },
              { key: "jobs", header: "Visits", card: "meta", align: "end", cell: (r) => count(r.jobs) },
              { key: "value", header: "Value", card: "amount", align: "end", cell: (r) => money(r.value) },
              { key: "last", header: "Last visit", card: "hidden", cell: (r) => (r.lastVisit ? formatDate(r.lastVisit) : "–") },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

// ============================================================================================================
// Insurers - claimed vs approved, the shortfall, excess and depreciation, rejection - and who still owes.
// ============================================================================================================
function Insurers({ data, exportCsv }) {
  const rows = data.rows || [];
  const t = data.totals || {};
  const claimedRows = rows.map((r, i) => ({ key: r.insurerId, name: r.insurer, value: r.claimed, color: hueFor(i) })).filter((r) => r.value > 0);
  return (
    <>
      <Grid>
        <li><StatCard title="Claims" count={count(t.claims)} /></li>
        <li><StatCard title="Claimed" count={money(t.claimed)} tone="teal" /></li>
        <li><StatCard title="Approved" count={money(t.approved)} subText={t.claimed ? money(t.claimed - t.approved) + " shortfall" : undefined} /></li>
        {/* THE GAP CLOSED HERE: claimAgeing filters rejected claims out; this report does not. */}
        <li><StatCard title="Rejected" count={count(t.rejected)} tone={t.rejected ? "danger" : "neutral"} subText={t.claims ? `of ${count(t.claims)}` : undefined} /></li>
      </Grid>

      <div className="mt-4">
        <Panel title="Claimed, by insurer" description="Where the accident work actually goes.">
          <Chart rows={claimedRows} describe={(r) => { const row = rows.find((x) => x.insurerId === r.key); return `${count(row?.claims)} claim${row?.claims === 1 ? "" : "s"} · ${pct(row?.rejectedPct)} rejected`; }} empty={{ title: "No claims this period", text: "" }} />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Every insurer" actions={<ExportButton rows={rows} onClick={() => exportCsv(shape.insurersCsv(rows), "garage-insurers")} />} bodyClassName="p-0">
          <TableScroll label="Every insurer">
            <DataTable
              className="table-pin-first"
              caption="Insurers"
              rows={rows}
              rowKey={(r) => r.insurerId}
              empty={<Nothing title="No claims this period" text="" />}
              columns={[
                { key: "insurer", header: "Insurer", card: "primary", cell: (r) => r.insurer },
                { key: "claims", header: "Claims", card: "meta", align: "end", cell: (r) => count(r.claims) },
                { key: "claimed", header: "Claimed", card: "hidden", align: "end", cell: (r) => money(r.claimed) },
                { key: "approved", header: "Approved", card: "meta", align: "end", cell: (r) => money(r.approved) },
                { key: "shortfall", header: "Shortfall", card: "hidden", align: "end", cell: (r) => money(r.shortfall) },
                {
                  // THE GAP CLOSED HERE, on screen: claimAgeing leaves a rejected claim out entirely, so
                  // neither its count nor its value was ever visible anywhere before this report.
                  key: "rejected", header: "Rejected", card: "badge", align: "end",
                  cell: (r) => (r.rejected ? <span className="font-semibold text-status-danger">{count(r.rejected)} ({money(r.rejectedValue)})</span> : "–"),
                },
                { key: "outstanding", header: "Outstanding", card: "amount", align: "end", cell: (r) => money(r.outstanding) },
                { key: "days", header: "Avg days to decide", card: "hidden", align: "end", cell: (r) => (r.avgDaysToDecide != null ? formatNumber(r.avgDaysToDecide, 1) : "–") },
              ]}
            />
          </TableScroll>
        </Panel>
      </div>
    </>
  );
}

// ============================================================================================================
// The shell: tabs, the period row, and one ReportFrame per tab - EACH WITH ITS OWN useAsync.
//
// A single shared async state across all seven (one useAsync swapping its loader by tab) looks tempting,
// but React keeps the PREVIOUS tab's data on screen while the new tab's fetch is still loading
// (useAsync's own contract - loading is a flag, not a data reset), so a render in between would read, say,
// Overview's { jobs, people } shape while `tab === "wip"` had already switched the body to WorkInProgress,
// which reads data.value - a crash, caught by a test that actually switches tabs rather than only mounting
// on one. One ReportFrame per tab, each its own component instance, fixes it the way CrmReports.jsx's
// Aging/Deals/Communications already do: switching tabs unmounts the old frame (and its stale data) before
// the new one ever renders.
// ============================================================================================================
const DESCRIPTION = "The workshop's own numbers: what is on the floor, what it is worth, who is doing the work, and who still owes.";

function downloadFrom({ headers, rows }, base, preambleFn) {
  downloadCSV(`${base}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows, preambleFn ? { preamble: preambleFn() } : {});
}

function ReportFrame({ loader, deps, children }) {
  const r = useAsync(loader, deps);
  const scope = useRef(null);
  useGarageReveal(scope, Boolean(r.data) && !r.loading);
  if (r.loading && !r.data) return <PageSpinner label="Reading the numbers" />;
  if (r.error) return <ErrorNote error={r.error} onRetry={r.reload} />;
  if (!r.data) return null;
  return (
    <div ref={scope}>
      <div data-reveal>{children(r.data)}</div>
      {r.data.capped && <p className="mt-4 text-xs text-muted-foreground">More than this period holds was read; the figures cover the newest of it.</p>}
    </div>
  );
}

export default function GarageReports() {
  const [tab, setTab] = useState(() => session.get("tab", "overview"));
  const filter = usePeriodFilter({ restore: session.get("period") });
  const { period } = filter;
  const profile = useCompanyProfile();
  const periodLess = PERIODLESS_REPORTS.has(tab);

  useEffect(() => session.set("tab", tab), [tab]);
  useEffect(() => session.set("period", { preset: period.preset, from: period.from, to: period.to }), [period.preset, period.from, period.to]);

  // period.key already encodes preset/from/to (lib/listPeriod.js: "the stable effect dependency garage
  // Reports uses"), so it is the one dependency that matters here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const params = useMemo(() => ({ from: period.from || undefined, to: period.to || undefined }), [period.key]);

  // Every export carries the organisation's own letterhead, the report's own title and the period it
  // covers - the same reportPreamble every other export in the product writes, through useExportPreamble's
  // own two primitives directly (the title varies per report, so the hook's baked-in title does not fit).
  const reportTitle = REPORT_TABS.find((t) => t[0] === tab)?.[1] || "Report";
  const exportCsv = (csvShape, base) => downloadFrom(csvShape, base, () => reportPreamble({ company: profile.companyName, title: `Garage - ${reportTitle}`, period: periodLess ? undefined : (period.from && period.to ? `${formatDate(period.from)} to ${formatDate(period.to)}` : undefined) }));

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Reports" description={DESCRIPTION} />

      <div className="mt-6">
        <PillTabs tabs={REPORT_TABS} value={tab} onChange={setTab} label="Which report" />
      </div>

      {/* The range is drawn for every report so the toolbar does not jump about, and is simply disabled
          where it means nothing - saying so beats hiding it and leaving a person to wonder where it went. */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <PeriodSelect filter={filter} labelled disabled={periodLess} />
        {periodLess && <p className="pb-2.5 text-xs text-muted-foreground">This report is as at today.</p>}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <ReportFrame loader={() => garageReports.overview(params)} deps={[params]}>
            {(data) => <Overview data={data} exportCsv={exportCsv} filter={filter} />}
          </ReportFrame>
        )}
        {tab === "wip" && (
          <ReportFrame loader={() => garageReports.workInProgress()} deps={[]}>
            {(data) => <WorkInProgress data={data} exportCsv={exportCsv} />}
          </ReportFrame>
        )}
        {tab === "profit" && (
          <ReportFrame loader={() => garageReports.profit(params)} deps={[params]}>
            {(data) => <Profit data={data} exportCsv={exportCsv} />}
          </ReportFrame>
        )}
        {tab === "people" && (
          <ReportFrame loader={() => garageReports.people(params)} deps={[params]}>
            {(data) => <PeopleBays data={data} exportCsv={exportCsv} />}
          </ReportFrame>
        )}
        {tab === "customers" && (
          <ReportFrame loader={() => garageReports.customers(params)} deps={[params]}>
            {(data) => <Customers data={data} exportCsv={exportCsv} />}
          </ReportFrame>
        )}
        {tab === "vehicles" && (
          <ReportFrame loader={() => garageReports.vehicles()} deps={[]}>
            {(data) => <Vehicles data={data} exportCsv={exportCsv} />}
          </ReportFrame>
        )}
        {tab === "insurers" && (
          <ReportFrame loader={() => garageReports.insurers(params)} deps={[params]}>
            {(data) => <Insurers data={data} exportCsv={exportCsv} />}
          </ReportFrame>
        )}
      </div>
    </div>
  );
}
