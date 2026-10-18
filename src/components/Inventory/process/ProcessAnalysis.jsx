import React, { useEffect } from "react";
import { pageSession } from "../../../lib/pageSession";
import { processOrders } from "../../../lib/processOrderApi";
import { duration, percent } from "../../../lib/processOrders";
import { formatDate, formatNumber } from "../../../utils/format";
import { PeriodSelect } from "../../lists/PeriodFilter";
import { usePeriodFilter } from "../../lists/usePeriodFilter";
import { DataTable, EmptyState, ErrorNote, Panel, Pill, Spinner, useAsync } from "../../accounting/kit";

// Inventory > Production > Analysis: over a period, how long orders took from release to finish, how many were on time
// and how much came out of what was ordered; then each step and each worker (in house or job worker): how often, how long
// a step waited before it was started and how long the work took, how often late, how much rejected and why. Worked out by
// the server from the orders (GET /process-orders/analysis); nothing is stored.

const session = pageSession("process-analysis");
const qty = (n) => formatNumber(n ?? 0, 3).replace(/\.?0+$/, "");

function Tile({ label, value, hint }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const rateTone = (p, bad) => (p == null ? "neutral" : p >= bad ? "danger" : p > 0 ? "warning" : "success");

function columns(first) {
  return [
    { key: "label", header: first, card: "title", cell: (r) => <span className="font-medium">{r.label}{r.mode === "job_work" && <span className="ms-2 text-xs font-normal text-muted-foreground">job worker</span>}</span> },
    { key: "done", header: "Done", align: "end", card: "badge", className: "tabular-nums", cell: (r) => r.done },
    { key: "wait", header: "Waited", align: "end", className: "whitespace-nowrap tabular-nums", cell: (r) => duration(r.waitHours) },
    { key: "work", header: "Took", align: "end", className: "whitespace-nowrap tabular-nums", cell: (r) => duration(r.workHours) },
    { key: "late", header: "Late", align: "end", className: "whitespace-nowrap", cell: (r) => (r.withDue ? <Pill tone={rateTone(r.latePct, 25)}>{r.late} of {r.withDue}</Pill> : "–") },
    { key: "rej", header: "Rejected", align: "end", card: "amount", className: "whitespace-nowrap tabular-nums", cell: (r) => (r.rejected ? `${qty(r.rejected)} (${percent(r.rejectPct)})` : "0") },
  ];
}

export default function ProcessAnalysis() {
  const period = usePeriodFilter({ restore: session.get("period") });
  useEffect(() => session.set("period", { preset: period.preset, from: period.from, to: period.to }), [period.preset, period.from, period.to]);
  const p = period.period;
  const params = p.all ? { from: "2000-01-01" } : { ...(p.from && { from: p.from }), ...(p.to && { to: p.to }) };
  const report = useAsync(() => processOrders.analysis(params), [JSON.stringify(params)]);
  const d = report.data;
  const busiest = Math.max(1, ...(d?.daily || []).map((x) => x.stepsDone));

  return (
    <Panel
      title="Analysis"
      description="How long orders take, how many finish on time, and where the time and the rejects go, by step and by worker."
      actions={<PeriodSelect filter={period} />}
    >
      {report.loading && !d && <Spinner label="Working out the analysis" />}
      {report.error && <ErrorNote error={report.error} onRetry={report.reload} />}
      {d && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Orders finished" value={d.orders.finished} hint={`${qty(d.orders.unitsMade)} made of ${qty(d.orders.unitsOrdered)} ordered`} />
            <Tile label="Yield" value={percent(d.orders.yieldPct)} hint="Good units out of what was ordered" />
            <Tile label="Average lead time" value={d.orders.avgLeadDays == null ? "–" : `${d.orders.avgLeadDays} days`} hint="From release to finish" />
            <Tile label="On time" value={percent(d.orders.onTimePct)} hint={d.orders.withDue ? `${d.orders.onTime} of ${d.orders.withDue} with a due date` : "No finished order had a due date"} />
          </div>

          {d.steps.length === 0 ? (
            <EmptyState title="Nothing done in this period" text="Steps marked done and orders finished in the period are measured here." />
          ) : (
            <>
              <section aria-labelledby="pa-steps">
                <h3 id="pa-steps" className="mb-2 text-sm font-semibold">By step</h3>
                <p className="mb-2 text-xs text-muted-foreground">Waited: from the step being ready to its start (for a job worker, to sending). Took: from start to done.</p>
                <DataTable caption="By step" rows={d.steps} rowKey={(r) => r.key} columns={columns("Step")} />
              </section>
              <section aria-labelledby="pa-people">
                <h3 id="pa-people" className="mb-2 text-sm font-semibold">By who did it</h3>
                <DataTable caption="By who did it" rows={d.people} rowKey={(r) => r.key} columns={columns("Person or job worker")} />
              </section>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
                <section aria-labelledby="pa-reasons">
                  <h3 id="pa-reasons" className="mb-2 text-sm font-semibold">Why units were rejected</h3>
                  {d.reasons.length === 0 ? <p className="text-sm text-muted-foreground">Nothing rejected in the period.</p> : (
                    <ul className="divide-y rounded-lg border text-sm">
                      {d.reasons.map((r) => <li key={r.reason} className="flex justify-between gap-3 px-3 py-2"><span className="min-w-0 truncate">{r.reason}</span><span className="shrink-0 tabular-nums">{qty(r.qty)}</span></li>)}
                    </ul>
                  )}
                </section>
                <section aria-labelledby="pa-daily">
                  <h3 id="pa-daily" className="mb-2 text-sm font-semibold">Day by day</h3>
                  <ul className="grid gap-1 text-sm" aria-label="Steps done and units finished each day">
                    {d.daily.map((x) => (
                      <li key={x.day} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(x.day)}</span>
                        <span className="h-2 rounded-full bg-muted" aria-hidden="true"><span className="block h-2 rounded-full bg-primary" style={{ width: `${(x.stepsDone / busiest) * 100}%` }} /></span>
                        <span className="whitespace-nowrap text-xs tabular-nums">{x.stepsDone} step{x.stepsDone === 1 ? "" : "s"}{x.unitsFinished ? ` · ${qty(x.unitsFinished)} made` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
