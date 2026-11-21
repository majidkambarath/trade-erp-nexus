import React, { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowUpRight, FlaskConical, Receipt } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { pageSession } from "../../lib/pageSession";
import { CURRENCY, formatNumber } from "../../utils/format";
import { Button } from "../ui/button";
import { PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { EmptyState, ErrorNote, Panel, PageSpinner, formatDateTime, useAsync } from "../accounting/kit";
import { CountUp } from "../Dashborad/CountUp";
import { RankedBars } from "../Dashborad/FlowCharts";
import { compactAmount, gold, ink, monthLabel, monthYearLabel, tip } from "../Dashborad/helpers";
import { useReveal } from "../crm/useReveal";
import { StatusPill, deliveryText, ftaText } from "./shared";
import TodoStrip from "./TodoStrip";
import JourneyRings from "./LegsPanel";
import ConnectionCard from "./ConnectionCard";
import MandateTimeline from "./MandateTimeline";

const session = pageSession("einvoicing-dashboard");
const money = (n) => `${CURRENCY} ${formatNumber(n || 0, 2)}`;
const docLink = (r) => `${r.invoiceTypeCode === "381" ? "/sales-return" : "/sales-order"}?search=${encodeURIComponent(r.documentNo)}`;
const ACTION = { retry: "Retry", correct: "Resend correction", credit_note: "Issue a credit note" };

// One headline figure, then the few that explain it. Not four equal tiles: the payable amount is what the period is worth.
function Mini({ label, value, sub, onClick }) {
  const Root = onClick ? "button" : "div";
  return (
    <Root {...(onClick ? { type: "button", onClick } : {})} className={`min-w-0 rounded-xl px-3 py-2 text-start ${onClick ? "transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{sub}</p>
    </Root>
  );
}

function SentTip({ active, payload }) {
  const m = active ? payload?.[0]?.payload : null;
  if (!m) return null;
  return (
    <div style={{ ...tip, padding: "8px 12px" }} className="text-sm">
      <p className="font-semibold">{monthYearLabel(m.month)}</p>
      <p className="text-muted-foreground">Sent {m.sent} · {money(m.sentAmount)}</p>
      <p className="text-muted-foreground">Received {m.received} · {money(m.receivedAmount)}</p>
    </div>
  );
}

function Hero({ data, onInbound }) {
  const t = data.totals;
  const p = data.pipeline;
  return (
    <section data-reveal aria-label="This period" className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,1fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Payable on e-invoices this period</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums sm:text-4xl">
            <span className="me-1.5 text-base font-medium text-muted-foreground">{CURRENCY}</span>
            <CountUp value={t.net.payable} format={(v) => formatNumber(v, 2)} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.invoices.count} {t.invoices.count === 1 ? "invoice" : "invoices"} less {t.creditNotes.count} {t.creditNotes.count === 1 ? "credit note" : "credit notes"} · VAT {formatNumber(t.net.tax, 2)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          <Mini label="Invoices sent" value={t.invoices.count} sub={money(t.invoices.payable)} />
          <Mini label="Delivered to buyers" value={p.delivery.delivered} sub={p.deliveredRate == null ? "none sent yet" : `${p.deliveredRate}% of those sent`} />
          <Mini label="Reported to the tax authority" value={p.fta.reported} sub={data.sandbox ? "not reported in test mode" : p.reportedRate == null ? "none sent yet" : `${p.reportedRate}% of those sent`} />
          <Mini label="Received from suppliers" value={data.inboundPeriod.received} sub={money(data.inboundPeriod.amount)} onClick={onInbound} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Sent, last six months</p>
          <div className="h-20" role="img" aria-label={`Amount sent by month: ${data.monthly.map((m) => `${monthLabel(m.month)} ${compactAmount(m.sentAmount)}`).join(", ")}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                <Tooltip content={<SentTip />} cursor={{ stroke: "var(--border)" }} />
                <Area type="monotone" dataKey="sentAmount" stroke={ink} strokeWidth={2} fill={ink} fillOpacity={0.08} isAnimationActive={false} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

// Counts on one axis; the amounts are in the tooltip (two scales on one chart mislead).
function Trend({ months }) {
  const any = months.some((m) => m.sent || m.received);
  if (!any) return <p className="py-10 text-center text-sm text-muted-foreground">Nothing sent or received in the last six months.</p>;
  return (
    <div>
      <div className="h-56" role="img" aria-label={`Invoices sent and received by month: ${months.map((m) => `${monthLabel(m.month)} ${m.sent} sent, ${m.received} received`).join("; ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={40} />
            <Tooltip content={<SentTip />} cursor={{ fill: "var(--secondary)", opacity: 0.5 }} />
            <Bar dataKey="sent" name="Sent" fill={ink} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="received" name="Received" fill={gold} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ink }} aria-hidden="true" />Sent</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: gold }} aria-hidden="true" />Received</span>
      </div>
    </div>
  );
}

// Invoices against credit notes, as one bar cut in two (a 2px gap between the parts), with the figures written beside it.
function Split({ invoices, creditNotes }) {
  const total = invoices + creditNotes;
  if (!total) return null;
  return (
    <div className="mt-4">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Invoices ${money(invoices)}, credit notes ${money(creditNotes)}`}>
        <span className="rounded-full" style={{ width: `${(invoices / total) * 100}%`, background: ink }} />
        {creditNotes > 0 && <span className="rounded-full" style={{ width: `${(creditNotes / total) * 100}%`, background: gold }} />}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: ink }} aria-hidden="true" />Invoices</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: gold }} aria-hidden="true" />Credit notes</span>
      </div>
    </div>
  );
}

function Top({ title, rows, empty }) {
  return (
    <Panel title={title} className="h-full">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <>
          <RankedBars rows={rows.map((r) => ({ key: r.name, name: r.name, value: r.amount }))} valueText={compactAmount}
            describe={(r) => { const row = rows.find((x) => x.name === r.name); return `${money(row?.amount)} · ${row?.count} ${row?.count === 1 ? "document" : "documents"}`; }} />
          <ul className="sr-only">{rows.map((r) => <li key={r.name}>{r.name}: {money(r.amount)}</li>)}</ul>
        </>
      )}
    </Panel>
  );
}

export default function EInvoiceDashboard({ settings }) {
  const navigate = useNavigate();
  const root = useRef(null);
  const filter = usePeriodFilter({ restore: session.get("period") });
  const { period } = filter;
  const { data, loading, error, reload } = useAsync(() => {
    session.set("period", { preset: filter.preset, from: filter.from, to: filter.to });
    return einvoice.dashboard({ from: period.from || (period.all ? "2000-01-01" : undefined), to: period.to || undefined });
  }, [period.key]);
  useReveal(root, Boolean(data));

  if (loading && !data) return <PageSpinner />;
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  const t = data.totals;
  const books = { sent: t.invoices.count + t.creditNotes.count, received: data.inboundPeriod.received };

  return (
    <div ref={root} className="space-y-5">
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

      <Hero data={data} onInbound={() => navigate("/e-invoicing/inbound")} />

      <TodoStrip todo={data.todo} />

      <JourneyRings pipeline={data.pipeline} sandbox={data.sandbox} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div data-reveal><Panel title="Last six months" description="Invoices sent and supplier invoices received, by invoice date." className="h-full"><Trend months={data.monthly} /></Panel></div>
        <div data-reveal>
          <Panel title="Tax on invoices sent" description="This period, invoices less credit notes." className="h-full">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Invoices (net)</dt><dd className="text-end tabular-nums">{formatNumber(t.invoices.net, 2)}</dd>
              <dt className="text-muted-foreground">Credit notes (net)</dt><dd className="text-end tabular-nums">{formatNumber(-t.creditNotes.net, 2)}</dd>
              <dt className="text-muted-foreground">Net</dt><dd className="text-end tabular-nums">{formatNumber(t.net.net, 2)}</dd>
              <dt className="text-muted-foreground">VAT</dt><dd className="text-end tabular-nums">{formatNumber(t.net.tax, 2)}</dd>
              <dt className="font-semibold">Payable</dt><dd className="text-end font-semibold tabular-nums">{formatNumber(t.net.payable, 2)}</dd>
            </dl>
            <Split invoices={t.invoices.payable} creditNotes={t.creditNotes.payable} />
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{CURRENCY}. Counts invoices that were sent, delivered or reported.</p>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div data-reveal>
          <Panel title="Needs attention" description="Failed or rejected invoices, and what to do about each." bodyClassName="p-0" className="h-full">
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
        </div>
        <div data-reveal>
          <Panel title="Recent activity" bodyClassName="p-0" className="h-full" actions={<Link to="/e-invoicing/outbound" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">All documents<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}>
            {data.recent.length === 0 && <EmptyState title="Nothing sent yet" text="Send an approved sales invoice from the Outbound tab." />}
            <ul className="divide-y divide-border">
              {data.recent.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                  <Link to={docLink(r)} className="font-mono text-xs font-semibold text-primary hover:underline">{r.documentNo}</Link>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.buyerName}</span>
                  <StatusPill status={r.status} />
                  {(r.deliveryStatus || r.taxStatus) && <span className="w-full text-xs text-muted-foreground">{[deliveryText(r.deliveryStatus), ftaText(r.taxStatus)].filter(Boolean).join(" · ")} · {formatDateTime(r.updatedAt)}</span>}
                  {!(r.deliveryStatus || r.taxStatus) && <span className="text-xs text-muted-foreground">{formatDateTime(r.updatedAt)}</span>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div data-reveal><Top title="Top customers" rows={data.topCustomers} empty="No invoices sent in this period." /></div>
        <div data-reveal><Top title="Top suppliers" rows={data.topSuppliers} empty="No supplier invoices received in this period." /></div>
      </div>

      <div data-reveal><ConnectionCard settings={settings} period={{ from: period.from || (period.all ? "2000-01-01" : ""), to: period.to }} ours={books} /></div>

      <details className="rounded-2xl border border-border bg-card px-5 py-3 shadow-card">
        <summary className="cursor-pointer text-sm font-semibold">UAE mandate dates</summary>
        <div className="mt-3"><MandateTimeline /></div>
      </details>
    </div>
  );
}
