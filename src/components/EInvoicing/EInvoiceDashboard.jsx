import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, FlaskConical, Inbox, Receipt, Send, Truck, ShieldCheck, FileMinus2 } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { pageSession } from "../../lib/pageSession";
import { CURRENCY, formatNumber } from "../../utils/format";
import { StatCard } from "../ui/stat-card";
import { Button } from "../ui/button";
import { PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { EmptyState, ErrorNote, Panel, PageSpinner, formatDateTime, useAsync } from "../accounting/kit";
import { StatusPill, deliveryText, ftaText } from "./shared";
import TodoStrip from "./TodoStrip";
import LegsPanel from "./LegsPanel";
import ConnectionCard from "./ConnectionCard";
import MandateTimeline from "./MandateTimeline";

const session = pageSession("einvoicing-dashboard");
const money = (n) => `${CURRENCY} ${formatNumber(n || 0, 2)}`;
const docLink = (r) => `${r.invoiceTypeCode === "381" ? "/sales-return" : "/sales-order"}?search=${encodeURIComponent(r.documentNo)}`;
const ACTION = { retry: "Retry", correct: "Resend correction", credit_note: "Issue a credit note" };

function Trend({ months }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.sent, m.received]));
  return (
    <div>
      <div className="flex h-32 items-end gap-2" role="img" aria-label={`Invoices sent and received, last ${months.length} months`}>
        {months.map((m) => (
          <div key={m.month} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1" title={`${m.month}: ${m.sent} sent (${money(m.sentAmount)}), ${m.received} received (${money(m.receivedAmount)})`}>
            <span className="w-1/2 max-w-5 rounded-t bg-accent-teal" style={{ height: `${(m.sent / max) * 100}%`, minHeight: m.sent ? 4 : 0 }} />
            <span className="w-1/2 max-w-5 rounded-t bg-muted-foreground/60" style={{ height: `${(m.received / max) * 100}%`, minHeight: m.received ? 4 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-center text-[11px] text-muted-foreground">{months.map((m) => <span key={m.month} className="min-w-0 flex-1 truncate">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>)}</div>
      <div className="mt-3 flex gap-4 text-xs"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent-teal" aria-hidden="true" />Sent</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/60" aria-hidden="true" />Received</span></div>
    </div>
  );
}

function Top({ title, rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
  return (
    <Panel title={title}>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.name} className="text-sm">
              <div className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate">{r.name}</span><span className="shrink-0 tabular-nums">{money(r.amount)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-accent-teal" style={{ width: `${(Math.abs(r.amount) / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function EInvoiceDashboard({ settings }) {
  const navigate = useNavigate();
  const filter = usePeriodFilter({ restore: session.get("period") });
  const { period } = filter;
  const key = period.key;
  const { data, loading, error, reload } = useAsync(() => {
    session.set("period", { preset: filter.preset, from: filter.from, to: filter.to });
    return einvoice.dashboard({ from: period.from || (period.all ? "2000-01-01" : undefined), to: period.to || undefined });
  }, [key]);
  const books = useMemo(() => ({ sent: data?.totals.invoices.count + data?.totals.creditNotes.count || 0, received: data?.inboundPeriod.received || 0 }), [data]);

  if (loading && !data) return <PageSpinner />;
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  const t = data.totals;
  const p = data.pipeline;

  return (
    <div className="space-y-5">
      {!settings?.enabled && (
        <div role="note" className="flex flex-wrap items-center gap-3 rounded-2xl border border-status-warning/25 bg-status-warning-soft px-5 py-3 text-sm text-status-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">E-invoicing is switched off, so nothing can be sent yet.</span>
          <Link to="/e-invoicing/readiness" className="font-semibold underline underline-offset-2">Check readiness</Link>
        </div>
      )}
      {data.sandbox && settings?.enabled && (
        <div role="note" className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/60 px-5 py-3 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1"><strong className="font-semibold">Test mode.</strong> Nothing reaches the tax authority: sent invoices stop at Delivered. Switch to live in Settings when you are ready.</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3"><PeriodSelect filter={filter} labelled /><p className="pb-2 text-xs text-muted-foreground">{period.name || period.label}, by invoice date. “Needs you now” is always as of today.</p></div>
      {filter.problem && <p role="alert" className="text-sm text-status-danger">{filter.problem}</p>}

      <TodoStrip todo={data.todo} />

      <section aria-label="This period" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard title="Invoices sent" count={t.invoices.count} subText={money(t.invoices.payable)} tone="teal" icon={<Send />} fit />
        <StatCard title="Credit notes" count={t.creditNotes.count} subText={money(t.creditNotes.payable)} tone="neutral" icon={<FileMinus2 />} fit />
        <StatCard title="Delivered to buyers" count={p.delivery.delivered} subText={p.deliveredRate == null ? "none sent yet" : `${p.deliveredRate}% of those sent`} tone="olive" icon={<Truck />} />
        <StatCard title="Reported to the tax authority" count={p.fta.reported} subText={data.sandbox ? "not reported in test mode" : p.reportedRate == null ? "none sent yet" : `${p.reportedRate}% of those sent`} tone={data.sandbox ? "neutral" : "olive"} icon={<ShieldCheck />} />
        <StatCard title="Received from suppliers" count={data.inboundPeriod.received} subText={money(data.inboundPeriod.amount)} tone="plum" icon={<Inbox />} fit onClick={() => navigate("/e-invoicing/inbound")} />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LegsPanel pipeline={p} sandbox={data.sandbox} />
        <Panel title="Last six months" description="Invoices sent and supplier invoices received, by invoice date."><Trend months={data.monthly} /></Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Panel title="Needs attention" description="Failed or rejected invoices, and what to do about each." bodyClassName="p-0">
          {data.attention.length === 0 && <EmptyState title="Nothing failed or rejected" text="Invoices that cannot go through appear here with the next step." />}
          <ul className="divide-y divide-border">
            {data.attention.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <Link to={docLink(r)} className="font-mono text-xs font-semibold text-primary hover:underline">{r.documentNo}</Link>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.buyerName}</span>
                <StatusPill status={r.status} />
                <p className="w-full text-xs text-muted-foreground">{r.reason}</p>
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => navigate(`/e-invoicing/outbound?status=${r.status}&search=${encodeURIComponent(r.documentNo)}`)}>{ACTION[r.action] || "Open"}</Button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Tax on invoices sent" description="This period, invoices less credit notes.">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Invoices (net)</dt><dd className="text-end tabular-nums">{formatNumber(t.invoices.net, 2)}</dd>
            <dt className="text-muted-foreground">Credit notes (net)</dt><dd className="text-end tabular-nums">{formatNumber(-t.creditNotes.net, 2)}</dd>
            <dt className="text-muted-foreground">Net</dt><dd className="text-end tabular-nums">{formatNumber(t.net.net, 2)}</dd>
            <dt className="text-muted-foreground">VAT</dt><dd className="text-end tabular-nums">{formatNumber(t.net.tax, 2)}</dd>
            <dt className="font-semibold">Payable</dt><dd className="text-end font-semibold tabular-nums">{formatNumber(t.net.payable, 2)}</dd>
          </dl>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{CURRENCY}. Counts invoices that were sent, delivered or reported.</p>
        </Panel>
      </div>

      <Panel title="Recent activity" bodyClassName="p-0">
        {data.recent.length === 0 && <EmptyState title="Nothing sent yet" text="Send an approved sales invoice from the Outbound tab." />}
        <ul className="divide-y divide-border">
          {data.recent.map((r) => (
            <li key={r._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
              <Link to={docLink(r)} className="font-mono text-xs font-semibold text-primary hover:underline">{r.documentNo}</Link>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.buyerName}</span>
              <StatusPill status={r.status} />
              {(r.deliveryStatus || r.taxStatus) && <span className="text-xs text-muted-foreground">{[deliveryText(r.deliveryStatus), ftaText(r.taxStatus)].filter(Boolean).join(" · ")}</span>}
              <span className="text-xs text-muted-foreground">{formatDateTime(r.updatedAt)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Top title="Top customers" rows={data.topCustomers} empty="No invoices sent in this period." />
        <Top title="Top suppliers" rows={data.topSuppliers} empty="No supplier invoices received in this period." />
      </div>

      <ConnectionCard settings={settings} period={{ from: period.from || (period.all ? "2000-01-01" : ""), to: period.to }} ours={books} />

      <details className="rounded-2xl border border-border bg-card px-5 py-3 shadow-card">
        <summary className="cursor-pointer text-sm font-semibold">UAE mandate dates</summary>
        <div className="mt-3"><MandateTimeline /></div>
      </details>
    </div>
  );
}
