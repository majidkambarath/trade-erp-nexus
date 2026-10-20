// How the selling is going: the funnel, where the enquiries come from, who wins and why deals are lost.
//
// Every figure is the server's own arithmetic (utils/crm.js `analysis`), and a rate with nothing to measure reads as a
// dash, never as 0% - a month with no closed deals has no win rate, and pretending otherwise reads as failure.
import React, { useState } from "react";
import { Download } from "lucide-react";
import { PageHeader, Panel, Spinner, ErrorNote, DataTable, TableScroll, useAsync, Field, DateInput } from "../accounting/kit.jsx";
import StatCard from "../ui/stat-card.jsx";
import { formatCurrencyAED, formatDate, downloadCSV } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";

const rate = (value) => (value === null || value === undefined ? "–" : `${value}%`);
const days = (value) => (value === null || value === undefined ? "–" : `${value} days`);

export default function CrmAnalysis() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, loading, error, reload } = useAsync(() => crm.analysis({ from: from || undefined, to: to || undefined }), [from, to]);

  const exportFunnel = () => {
    if (!data) return;
    const { headers, rows } = rules.pipelineCsv(data.funnel);
    downloadCSV(`crm-pipeline-${data.period.from}-to-${data.period.to}.csv`, headers, rows);
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="CRM analysis"
        description={data ? `${formatDate(data.period.from)} to ${formatDate(data.period.to)}` : "The last 30 days"}
        actions={
          data && (
            <button type="button" onClick={exportFunnel} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
              <Download className="h-4 w-4" aria-hidden="true" /> Export
            </button>
          )
        }
      />

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <Field label="From" className="w-full sm:w-44">
          <DateInput value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" className="w-full sm:w-44">
          <DateInput value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      {loading && !data && <Spinner label="Working it out" />}
      {error && <ErrorNote error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Enquiries" count={data.leads.total} subText={`${data.leads.converted} became customers`} />
            <StatCard title="Enquiries converted" count={rate(data.leads.conversionRate)} tone="teal" subText={`${data.leads.lost} came to nothing`} />
            <StatCard title="Deals won" count={data.deals.won} subText={formatCurrencyAED(data.deals.wonValue)} tone="teal" />
            <StatCard title="Win rate" count={rate(data.deals.winRate)} subText={`${days(data.deals.averageDaysToWin)} to win, on average`} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard title="Open deals" count={data.deals.open} subText={formatCurrencyAED(data.deals.openValue)} />
            <StatCard title="Likely to close" count={formatCurrencyAED(data.deals.weightedValue)} subText="Weighted by each stage's chance" />
            <StatCard title="Follow-ups" count={data.activity.done} subText={`${data.activity.open} open, ${data.activity.overdue} late`} tone={data.activity.overdue ? "warning" : undefined} />
          </div>

          <Panel title="The funnel" description="Open deals by stage, in pipeline order" className="mt-6" bodyClassName="p-0">
            <TableScroll label="The funnel">
              <table className="w-full text-sm">
                <caption className="sr-only">Open deals by stage</caption>
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 text-start font-medium">Stage</th>
                    <th className="px-4 py-2 text-end font-medium">Chance</th>
                    <th className="px-4 py-2 text-end font-medium">Deals</th>
                    <th className="px-4 py-2 text-end font-medium">Value</th>
                    <th className="px-4 py-2 text-end font-medium">Likely</th>
                  </tr>
                </thead>
                <tbody>
                  {data.funnel.map((s) => (
                    <tr key={s.key} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="px-4 py-2 text-start font-medium">{s.name}</th>
                      <td className="px-4 py-2 text-end tabular-nums">{s.probability}%</td>
                      <td className="px-4 py-2 text-end tabular-nums">{s.count}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{formatCurrencyAED(s.value)}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{formatCurrencyAED(s.weighted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Panel>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <Panel title="Where the enquiries come from" bodyClassName="p-0">
              {data.bySource.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No enquiries in this period.</p>
              ) : (
                <DataTable
                  caption="Enquiries by source"
                  rows={data.bySource}
                  rowKey={(r) => r.source}
                  columns={[
                    { key: "label", header: "Source", card: "primary", cell: (r) => r.label },
                    { key: "leads", header: "Enquiries", align: "end", card: "meta", cell: (r) => r.leads },
                    { key: "converted", header: "Converted", align: "end", card: "meta", cell: (r) => r.converted },
                    { key: "conversionRate", header: "Rate", align: "end", card: "badge", cell: (r) => rate(r.conversionRate) },
                    { key: "value", header: "Value", align: "end", card: "amount", cell: (r) => formatCurrencyAED(r.value) },
                  ]}
                />
              )}
            </Panel>

            <Panel title="Who is selling" bodyClassName="p-0">
              {data.byOwner.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
              ) : (
                <DataTable
                  caption="By person"
                  rows={data.byOwner}
                  rowKey={(r) => r.ownerId || "unassigned"}
                  columns={[
                    { key: "name", header: "Who", card: "primary", cell: (r) => r.name },
                    { key: "deals", header: "Deals", align: "end", card: "meta", cell: (r) => r.deals },
                    { key: "won", header: "Won", align: "end", card: "meta", cell: (r) => r.won },
                    { key: "winRate", header: "Win rate", align: "end", card: "badge", cell: (r) => rate(r.winRate) },
                    { key: "wonValue", header: "Value won", align: "end", card: "amount", cell: (r) => formatCurrencyAED(r.wonValue) },
                  ]}
                />
              )}
            </Panel>
          </div>

          <Panel title="Why deals are lost" description="The reason is required when a deal is marked lost, which is what makes this list worth reading" className="mt-6" bodyClassName="p-0">
            {data.lostReasons.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing was lost in this period.</p>
            ) : (
              <DataTable
                caption="Lost reasons"
                rows={data.lostReasons}
                rowKey={(r) => r.reason}
                columns={[
                  { key: "label", header: "Reason", card: "primary", cell: (r) => r.label },
                  { key: "deals", header: "Deals", align: "end", card: "meta", cell: (r) => r.deals },
                  { key: "value", header: "Value", align: "end", card: "amount", cell: (r) => formatCurrencyAED(r.value) },
                ]}
              />
            )}
          </Panel>

          {data.capped && <p className="mt-4 text-xs text-muted-foreground">Only the first few thousand records of the period were read. Narrow the dates for an exact answer.</p>}
        </>
      )}
    </div>
  );
}
