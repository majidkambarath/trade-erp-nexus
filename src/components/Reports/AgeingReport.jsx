import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { accounting } from "../../lib/accountingApi";
import { CURRENCY, downloadCSV, formatDateGB, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { EmptyState, ErrorNote, Field, PageHeader, Panel, Spinner, TextInput, useAsync, DateInput } from "../accounting/kit";
import { cn } from "../../lib/utils";

const money = (n) => (n ? formatNumber(n, 2) : "–");
const TYPES = {
  receivable: { label: "Receivables", party: "Customer", help: "What customers owe you, by how late it is." },
  payable: { label: "Payables", party: "Vendor", help: "What you owe vendors, by how late it is." },
};
const UNAPPLIED_LABEL = "Returns, credit notes and balances on account not set against an invoice";
// the older the bucket, the stronger the signal
const BUCKET_TONE = { current: "", d1_30: "", d31_60: "text-status-warning", d61_90: "text-status-warning", d90plus: "text-status-danger" };

export default function AgeingReport() {
  const [type, setType] = useState("receivable");
  const [asOf, setAsOf] = useState(todayInput());
  const [open, setOpen] = useState({});
  const { data, loading, error, reload } = useAsync(() => accounting.ageing({ type, asOf }), [type, asOf]);
  const t = TYPES[type];
  // What the party accounts hold in the books against the open invoices above: the two differ by the returns, credit notes and
  // balances on account that are not set against an invoice. Nothing is said when they agree.
  const tie = data?.reconciliation && Math.abs(Number(data.reconciliation.unapplied) || 0) >= 0.005 ? data.reconciliation : null;
  const ledgerLabel = `Per the ledger (${t.party.toLowerCase()} accounts)`;

  function exportCsv() {
    const heads = ["Party", "Terms", ...data.buckets.map((b) => b.label), "Total"];
    const rows = data.rows.map((r) => [r.partyName, r.paymentTerms || "", ...data.buckets.map((b) => r.buckets[b.key]), r.total]);
    rows.push(["Total", "", ...data.buckets.map((b) => data.totals[b.key]), data.totals.total]);
    if (tie) {
      const blank = data.buckets.map(() => "");
      rows.push([UNAPPLIED_LABEL, "", ...blank, tie.unapplied], [ledgerLabel, "", ...blank, tie.ledger]);
    }
    downloadCSV(`ageing-${type}-${asOf}.csv`, heads, rows);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Ageing" description={`${t.help} Each open invoice is placed by its due date, which is the invoice date plus the party's payment terms.`}
        actions={<Button variant="outline" onClick={exportCsv} disabled={!data?.rows?.length}><Download className="h-4 w-4" aria-hidden="true" />Export CSV</Button>} />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Ageing type" className="inline-flex rounded-full bg-secondary/80 p-1">
          {Object.entries(TYPES).map(([k, v]) => (
            <button key={k} role="tab" type="button" aria-selected={type === k} onClick={() => setType(k)}
              className={cn("min-h-10 rounded-full px-4 py-1.5 text-sm font-semibold transition-all lg:min-h-0", type === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{v.label}</button>
          ))}
        </div>
        <Field label="As at"><DateInput value={asOf} max={todayInput()} onChange={(e) => e.target.value && setAsOf(e.target.value)} className="w-44" /></Field>
      </div>

      {data && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Total outstanding" count={formatNumber(data.totals.total, 2)} subText={CURRENCY} tone="teal" />
          <StatCard title="Overdue" count={formatNumber(data.overdue, 2)} subText={data.totals.total ? `${Math.round((data.overdue / data.totals.total) * 100)}% of the total` : CURRENCY} tone={data.overdue > 0 ? "warning" : "neutral"} />
          <StatCard title="Not yet due" count={formatNumber(data.totals.current, 2)} subText={CURRENCY} tone="olive" />
          <StatCard title="Over 90 days" count={formatNumber(data.totals.d90plus, 2)} subText={CURRENCY} tone={data.totals.d90plus > 0 ? "danger" : "neutral"} />
        </div>
      )}

      <Panel bodyClassName="p-0" title={data ? `${data.rows.length} ${data.rows.length === 1 ? "party" : "parties"}` : t.label}>
        {loading && !data && <Spinner label="Working out the ageing" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data?.rows?.length === 0 && <EmptyState title="Nothing outstanding" text={`There are no unpaid approved ${type === "receivable" ? "sales" : "purchase"} invoices as at this date.`} />}
        {data?.rows?.length > 0 && (
          <div className="erp-scroll table-pin-first overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 text-start">{t.party}</th>
                  {data.buckets.map((b) => <th key={b.key} className="px-3 py-2 text-end">{b.label}</th>)}
                  <th className="px-5 py-2 text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const expanded = open[r.partyId];
                  return (
                    <React.Fragment key={r.partyId}>
                      <tr className="border-t border-border hover:bg-accent/40">
                        <td className="px-5 py-2.5">
                          <button type="button" aria-expanded={!!expanded} aria-label={`${expanded ? "Hide" : "Show"} invoices of ${r.partyName}`}
                            onClick={() => setOpen((o) => ({ ...o, [r.partyId]: !o[r.partyId] }))} className="inline-flex items-center gap-1.5 text-start font-medium text-foreground">
                            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                            {r.partyName}
                          </button>
                          {r.paymentTerms && <span className="ms-2 text-xs text-muted-foreground">{r.paymentTerms}</span>}
                        </td>
                        {data.buckets.map((b) => <td key={b.key} className={cn("px-3 py-2.5 text-end tabular-nums", r.buckets[b.key] && BUCKET_TONE[b.key])}>{money(r.buckets[b.key])}</td>)}
                        <td className="px-5 py-2.5 text-end font-semibold tabular-nums">{formatNumber(r.total, 2)}</td>
                      </tr>
                      {expanded && (
                        <tr className="bg-secondary/30">
                          <td colSpan={data.buckets.length + 2} className="px-5 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground"><tr><th className="py-1 text-start">Invoice</th><th className="py-1 text-start">Date</th><th className="py-1 text-start">Due</th><th className="py-1 text-end">Days late</th><th className="py-1 text-end">Invoice total</th><th className="py-1 text-end">Outstanding</th></tr></thead>
                              <tbody>
                                {r.invoices.map((i) => (
                                  <tr key={i.transactionId} className="border-t border-border/60">
                                    <td className="py-1.5 font-mono">{i.transactionNo}</td><td>{formatDateGB(i.date)}</td><td>{formatDateGB(i.dueDate)}</td>
                                    <td className={cn("text-end tabular-nums", i.daysPastDue > 60 && "text-status-danger", i.daysPastDue > 30 && i.daysPastDue <= 60 && "text-status-warning")}>{i.daysPastDue || "–"}</td>
                                    <td className="text-end tabular-nums">{formatNumber(i.total, 2)}</td><td className="text-end font-medium tabular-nums">{formatNumber(i.outstanding, 2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <Link className="mt-2 inline-block text-xs font-semibold text-foreground underline underline-offset-2" to={`/statement?partyType=${t.party}&partyId=${r.partyId}`}>Open statement of account</Link>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td className="px-5 py-2.5">Total</td>
                  {data.buckets.map((b) => <td key={b.key} className="px-3 py-2.5 text-end tabular-nums">{money(data.totals[b.key])}</td>)}
                  <td className="px-5 py-2.5 text-end tabular-nums">{formatNumber(data.totals.total, 2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {tie && (
          <dl aria-label="Ageing against the ledger" className="space-y-2 border-t border-border px-4 py-3 text-sm sm:px-5">
            <div className="flex items-baseline justify-between gap-4 text-muted-foreground">
              <dt className="min-w-0 flex-1">Open invoices, as aged above</dt>
              <dd className="shrink-0 whitespace-nowrap tabular-nums">{formatNumber(data.totals.total, 2)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="min-w-0 flex-1">{UNAPPLIED_LABEL}</dt>
              <dd className="shrink-0 whitespace-nowrap tabular-nums">{formatNumber(tie.unapplied, 2)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2 font-semibold">
              <dt className="min-w-0 flex-1">{ledgerLabel}</dt>
              <dd className="shrink-0 whitespace-nowrap tabular-nums">{formatNumber(tie.ledger, 2)}</dd>
            </div>
          </dl>
        )}
      </Panel>
    </div>
  );
}
