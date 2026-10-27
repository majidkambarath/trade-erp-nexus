import React, { useRef } from "react";
import StatCard from "../ui/stat-card";
import { CountUp } from "../Dashborad/CountUp";
import { RankedBars } from "../Dashborad/FlowCharts";
import { useGarageReveal } from "./useGarageReveal";
import { jobCards } from "../../lib/garageApi";
import { EmptyState, ErrorNote, Panel, PageHeader, PageSpinner, useAsync } from "../accounting/kit";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { formatCurrencyAED, formatNumber } from "../../utils/format";

// Inventory > Garage > Reports: the workshop's own numbers over a period - revenue by stream (parts, labour,
// sublet, consumable), technician efficiency (hours sold against hours taken, the trade's own definition),
// the effective labour rate, on-time delivery and the comeback rate. All worked out server-side from
// delivered job cards (GET /garage/job-cards/analysis, utils/garage.js analysis - already pure-tested); this
// screen only draws it. A rate with nothing to measure reads as "–", never 0.
const STREAM_LABEL = { part: "Parts", labour: "Labour", sublet: "Sublet", consumable: "Consumables" };
const STREAM_COLOR = { part: "var(--chart-2)", labour: "var(--chart-1)", sublet: "var(--chart-3)", consumable: "var(--chart-4)" };

const DESCRIPTION = "The workshop's own numbers: revenue by stream, technician efficiency, and how reliably jobs go out on time.";

const pct = (n) => (n == null ? "–" : `${formatNumber(n, 1)}%`);
const hrs = (n) => (n == null ? "–" : `${formatNumber(n, 1)} h`);
const money = (n) => (n == null ? "–" : formatCurrencyAED(n));

export default function GarageReports() {
  const filter = usePeriodFilter();
  const { period } = filter;
  const report = useAsync(() => jobCards.analysis({ from: period.from || undefined, to: period.to || undefined }), [period.key]);
  const scope = useRef(null);
  useGarageReveal(scope, Boolean(report.data));

  if (report.loading && !report.data) return <PageSpinner label="Reading the numbers" />;
  if (report.error) return <ErrorNote error={report.error} onRetry={report.reload} />;
  const j = report.data?.jobs;
  const people = report.data?.people || [];
  // A server that answers without `jobs` - an older build, or a period it has nothing for - must still leave
  // the page usable. This returned null, which is a blank window: no heading, no message and no period picker,
  // so there was no way to ask for another period. The five sibling garage pages all keep their shell.
  if (!j) {
    return (
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        <PageHeader title="Reports" description={DESCRIPTION} />
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <PeriodSelect filter={filter} labelled />
        </div>
        <Panel className="mt-6">
          <EmptyState
            title="Nothing to report for this period"
            text="No job cards were delivered in it. Pick another period, or deliver a job card and its numbers appear here."
          />
        </Panel>
      </div>
    );
  }

  const revenueTotal = j.revenue?.total || 0;
  const streamRows = Object.keys(STREAM_LABEL)
    .map((key) => ({ key, name: STREAM_LABEL[key], value: j.revenue?.[key] || 0, color: STREAM_COLOR[key] }))
    .filter((r) => r.value > 0);
  const peopleRows = people.map((p) => ({ key: p.key, name: p.label, value: p.hoursTaken || 0 }));

  return (
    <div ref={scope} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Reports" description={DESCRIPTION} />

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <PeriodSelect filter={filter} labelled />
      </div>
      <PeriodNote filter={filter} count={j.delivered} noun="jobs delivered" className="mt-2" />

      <ul data-reveal className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <li><StatCard title="Delivered" count={<CountUp value={j.delivered || 0} format={(v) => String(Math.round(v))} />} /></li>
        <li><StatCard title="Revenue" count={money(j.revenue?.total)} tone="teal" /></li>
        <li><StatCard title="Average invoice" count={money(j.avgInvoice)} /></li>
        <li><StatCard title="On time" count={pct(j.onTimePct)} tone={j.onTimePct != null && j.onTimePct < 80 ? "warning" : "olive"} /></li>
        <li><StatCard title="Comebacks" count={pct(j.comebackPct)} tone={j.comebackPct > 0 ? "danger" : "neutral"} /></li>
        <li><StatCard title="Efficiency" count={pct(j.efficiencyPct)} tone="plum" /></li>
      </ul>

      <div data-reveal className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Revenue by stream" description="What the money is actually made of.">
          {streamRows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing delivered in this period.</p> : (
            <RankedBars
              rows={streamRows}
              valueText={(v) => formatCurrencyAED(v)}
              axisText={(v) => formatCurrencyAED(v)}
              describe={(r) => `${formatCurrencyAED(r.value)} of ${formatCurrencyAED(revenueTotal)} revenue (${revenueTotal > 0 ? formatNumber((r.value / revenueTotal) * 100, 0) : 0}%)`}
            />
          )}
        </Panel>
        <Panel title="Hours taken, by technician" description="Who did the work this period.">
          {peopleRows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing to show yet.</p> : (
            <RankedBars
              rows={peopleRows}
              valueText={(v) => `${formatNumber(v, 1)} h`}
              axisText={(v) => `${formatNumber(v, 0)}h`}
              describe={(r) => {
                const p = people.find((x) => x.key === r.key);
                return p ? `${p.done} job${p.done === 1 ? "" : "s"} done · ${pct(p.efficiencyPct)} efficiency` : `${formatNumber(r.value, 1)} h`;
              }}
            />
          )}
        </Panel>
      </div>

      <div data-reveal className="mt-6">
        <Panel title="The shop's own figures" description="Hours sold against hours taken, and what an hour actually earned.">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Hours sold</dt><dd className="text-lg font-semibold">{hrs(j.hoursSold)}</dd></div>
            <div><dt className="text-muted-foreground">Hours taken</dt><dd className="text-lg font-semibold">{hrs(j.hoursTaken)}</dd></div>
            <div><dt className="text-muted-foreground">Avg hours / job</dt><dd className="text-lg font-semibold">{hrs(j.avgHoursPerJob)}</dd></div>
            <div><dt className="text-muted-foreground">Effective labour rate</dt><dd className="text-lg font-semibold">{money(j.effectiveLabourRate)}/h</dd></div>
            <div><dt className="text-muted-foreground">Average turnaround</dt><dd className="text-lg font-semibold">{j.avgTurnaroundHours != null ? `${formatNumber(j.avgTurnaroundHours, 0)} h` : "–"}</dd></div>
            <div><dt className="text-muted-foreground">Promised and kept</dt><dd className="text-lg font-semibold">{j.withPromise ?? 0} jobs</dd></div>
          </dl>
        </Panel>
      </div>

      {people.length > 0 && (
        <div data-reveal className="mt-6">
          <Panel title="By technician" description="Done, hours sold against taken, and how long a task waited to start.">
            <ul className="divide-y rounded-lg border text-sm">
              {people.map((p) => (
                <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 font-medium">{p.label}</span>
                  <span className="text-muted-foreground">{p.done} done</span>
                  <span className="tabular-nums">{hrs(p.hoursSold)} sold</span>
                  <span className="tabular-nums">{hrs(p.hoursTaken)} taken</span>
                  <span className="tabular-nums text-muted-foreground">{pct(p.efficiencyPct)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
