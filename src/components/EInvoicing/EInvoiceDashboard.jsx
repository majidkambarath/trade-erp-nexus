import React, { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarDays, FlaskConical } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { pageSession } from "../../lib/pageSession";
import { CURRENCY, formatDate, formatNumber } from "../../utils/format";
import { Button } from "../ui/button";
import { PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { ErrorNote, PageSpinner, useAsync } from "../accounting/kit";
import { CountUp } from "../Dashborad/CountUp";
import { RankedBars } from "../Dashborad/FlowCharts";
import { compactAmount, gold, ink, monthLabel, monthYearLabel, tip } from "../Dashborad/helpers";
import { StatusPill } from "./shared";
import { AttentionCard, BentoCard, Delta, Meter, OpsRows, RecentList, cardClass, useDashMotion } from "./dashParts";
import JourneysPanel, { StatusMix } from "./LegsPanel";
import ConnectionCard from "./ConnectionCard";
import MandateTimeline from "./MandateTimeline";

const session = pageSession("einvoicing-dashboard");
const money = (n) => `${CURRENCY} ${formatNumber(n || 0, 2)}`;
const docLink = (r) => `${r.invoiceTypeCode === "381" ? "/sales-return" : "/sales-order"}?search=${encodeURIComponent(r.documentNo)}`;
const ACTION = { retry: "Retry", correct: "Resend correction", credit_note: "Issue a credit note" };

function MonthTip({ active, payload }) {
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

// Home's centre card: three headline figures over one large area chart.
function Headline({ data }) {
  const t = data.totals;
  const prev = data.previous || {};
  const months = data.monthly || [];
  const peak = months.reduce((best, m) => (m.sentAmount > (best?.sentAmount ?? -Infinity) ? m : best), null);
  const figures = [
    { key: "payable", label: "Net payable", value: t.net.payable, money: true, before: prev.payable },
    { key: "invoices", label: "Invoices sent", value: t.invoices.count, before: prev.invoices },
    { key: "suppliers", label: "From suppliers", value: data.inboundPeriod.received, before: prev.received },
  ];
  return (
    <BentoCard role="region" aria-label="This period" className="h-full">
      <div className="grid w-full grid-cols-1 gap-4 min-[420px]:grid-cols-3">
        {figures.map((f) => (
          <div key={f.key} className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
            <p className="mt-1 flex items-baseline gap-1 whitespace-nowrap text-2xl font-extrabold tracking-tight sm:text-3xl xl:text-2xl 2xl:text-3xl">
              {f.money && <span className="text-sm font-semibold text-muted-foreground">{CURRENCY}</span>}
              <CountUp value={f.value} format={(v) => (f.money ? formatNumber(v, 2) : formatNumber(Math.round(v), 0))} />
            </p>
            <div className="mt-1.5"><Delta now={f.value} before={f.before} /></div>
          </div>
        ))}
      </div>
      <div className="mt-4 h-[250px]" role="img" aria-label={`Amount sent by month: ${months.map((m) => `${monthLabel(m.month)} ${compactAmount(m.sentAmount)}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={months} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="einvSentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} fontSize={12} />
            <YAxis hide />
            <Tooltip content={<MonthTip />} cursor={{ stroke: "var(--border)" }} />
            <Area type="monotone" dataKey="sentAmount" name="Amount sent" stroke={ink} strokeWidth={2.5} fill="url(#einvSentFill)"
              dot={{ r: 3, fill: ink, strokeWidth: 0 }} activeDot={{ r: 6, fill: gold, stroke: ink, strokeWidth: 2 }} animationDuration={1100} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ink }} aria-hidden="true" />Amount sent, six months</span>
        {peak?.sentAmount > 0 && <span>Peak {monthLabel(peak.month)} · {CURRENCY} {compactAmount(peak.sentAmount)}</span>}
      </div>
    </BentoCard>
  );
}

// Home's "Collection rate" card, for delivery: the rate in big type, a bar, two lines that explain it.
function DeliveredCard({ data }) {
  const p = data.pipeline;
  const sent = Object.entries(p.delivery).filter(([k]) => k !== "pending").reduce((t, [, v]) => t + v, 0);
  const rate = p.deliveredRate;
  return (
    <BentoCard data-anim="hero">
      <p className="text-sm font-medium text-muted-foreground">Delivered to buyers</p>
      <p className="mt-1 text-5xl font-extrabold tracking-tight">
        {rate == null ? "—" : <><CountUp value={rate} format={(v) => formatNumber(v, rate % 1 ? 1 : 0)} /><span className="text-muted-foreground/50">%</span></>}
      </p>
      <Meter value={rate || 0} className="mt-4" barClassName="bg-status-success" label={rate == null ? "Nothing sent" : `${rate}% delivered`} />
      <p className="mt-2 text-xs text-muted-foreground">{p.delivery.delivered} of {sent} sent this period</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{rate == null ? "none sent yet" : `${rate}% of those sent`}</p>
      {data.sandbox && <p className="mt-0.5 text-xs text-muted-foreground">Tax authority: not reported in test mode</p>}
    </BentoCard>
  );
}

function StatusCard({ todo }) {
  const n = (key) => todo.find((t) => t.key === key) || { count: 0 };
  const row = (key, label, link, badTone) => {
    const t = n(key);
    return { key, label, link: t.link || link, value: `${t.count} ${t.count === 1 ? "document" : "documents"}${t.amount ? ` · ${money(t.amount)}` : ""}`, tone: t.count ? badTone : "ok", tag: t.count ? (badTone === "danger" ? "Fix" : "Waiting") : "Clear" };
  };
  const rejected = n("rejectedByBuyer").count + n("rejectedByFta").count;
  const rows = [
    row("notSent", "Not sent", "/e-invoicing/outbound?status=NOT_SENT", "warn"),
    row("failed", "Failed", "/e-invoicing/outbound?status=FAILED", "danger"),
    { key: "rejected", label: "Rejected", link: "/e-invoicing/outbound?status=REJECTED", value: `${rejected} ${rejected === 1 ? "document" : "documents"}`, tone: rejected ? "danger" : "ok", tag: rejected ? "Fix" : "Clear" },
    row("inboundToReview", "Supplier invoices to review", "/e-invoicing/inbound?status=RECEIVED", "warn"),
  ];
  return (
    <BentoCard title="E-invoice status" description="As of today, whatever the period." className="flex-1">
      <OpsRows rows={rows} />
    </BentoCard>
  );
}

function CreditCard({ data }) {
  const t = data.totals;
  return (
    <BentoCard bodyClassName="p-5">
      <p className="text-sm font-medium text-muted-foreground">Credit notes</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight"><CountUp value={t.creditNotes.count} /></p>
      <p className="mt-1 text-xs text-muted-foreground">{money(t.creditNotes.payable)}</p>
      <div className="mt-2"><Delta now={t.creditNotes.count} before={data.previous?.creditNotes} upIsGood={false} /></div>
    </BentoCard>
  );
}

function VatCard({ t }) {
  const total = t.invoices.payable + t.creditNotes.payable;
  return (
    <BentoCard bodyClassName="p-5">
      <p className="text-sm font-medium text-muted-foreground">VAT this period</p>
      <p className="mt-1 flex items-baseline gap-1 text-3xl font-extrabold tracking-tight"><span className="text-sm font-semibold text-muted-foreground">{CURRENCY}</span>{formatNumber(t.net.tax, 2)}</p>
      <p className="mt-1 text-xs text-muted-foreground">on {money(t.net.net)} net, invoices less credit notes</p>
      {total > 0 && (
        <div className="mt-3">
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Invoices ${money(t.invoices.payable)}, credit notes ${money(t.creditNotes.payable)}`}>
            <span data-meter className="origin-left rounded-full" style={{ width: `${(t.invoices.payable / total) * 100}%`, background: ink }} />
            {t.creditNotes.payable > 0 && <span data-meter className="origin-left rounded-full" style={{ width: `${(t.creditNotes.payable / total) * 100}%`, background: gold }} />}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: ink }} aria-hidden="true" />Invoices</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: gold }} aria-hidden="true" />Credit notes</span>
          </div>
        </div>
      )}
    </BentoCard>
  );
}

function Top({ title, rows, empty }) {
  return (
    <BentoCard title={title} className="h-full">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <>
          <RankedBars rows={rows.map((r) => ({ key: r.name, name: r.name, value: r.amount }))} valueText={compactAmount}
            describe={(r) => { const row = rows.find((x) => x.name === r.name); return `${money(row?.amount)} · ${row?.count} ${row?.count === 1 ? "document" : "documents"}`; }} />
          <ul className="sr-only">{rows.map((r) => <li key={r.name}>{r.name}: {money(r.amount)}</li>)}</ul>
        </>
      )}
    </BentoCard>
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
  useDashMotion(root, data ? period.key : null);

  if (loading && !data) return <PageSpinner />;
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  const t = data.totals;
  const prev = data.previous || {};
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

      <div className={`${cardClass} border border-border bg-card p-5`} data-anim="hero">
        <div className="flex flex-wrap items-end gap-4">
          <PeriodSelect filter={filter} labelled />
          <p className="flex items-center gap-2 pb-2.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Showing <strong className="font-semibold text-foreground">{period.name || period.label}</strong> by invoice date{prev.from ? ` · compared with ${formatDate(prev.from)} – ${formatDate(prev.to)}` : ""}</span>
          </p>
        </div>
        {filter.problem && <p role="alert" className="mt-2 text-sm text-status-danger">{filter.problem}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 xl:col-span-3 xl:flex xl:gap-5">
          <DeliveredCard data={data} />
          <StatusCard todo={data.todo} />
        </div>
        <div className="flex flex-col gap-4 xl:col-span-6 xl:gap-5">
          <Headline data={data} />
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5">
            <CreditCard data={data} />
            <VatCard t={t} />
          </div>
        </div>
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 xl:col-span-3 xl:flex xl:gap-5">
          <AttentionCard todo={data.todo} />
          <BentoCard title="Recent activity" className="flex-1" actions={<Link to="/e-invoicing/outbound" className="text-xs font-semibold text-muted-foreground hover:text-foreground">View all</Link>}>
            <RecentList rows={data.recent} />
          </BentoCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:gap-5">
        <JourneysPanel pipeline={data.pipeline} sandbox={data.sandbox} />
        <StatusMix pipeline={data.pipeline} />
        <Top title="Top customers" rows={data.topCustomers} empty="No invoices sent in this period." />
      </div>

      <div className={`grid grid-cols-1 gap-4 xl:gap-5 ${data.attention.length ? "lg:grid-cols-2" : ""}`}>
        {data.attention.length > 0 && (
          <BentoCard title="Failed or rejected" description="What went wrong with each, and the next step." bodyClassName="p-6 pb-3">
            <ul className="-mx-2 divide-y divide-border">
              {data.attention.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-3 text-sm">
                  <Link to={docLink(r)} className="font-mono text-xs font-semibold text-primary hover:underline">{r.documentNo}</Link>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.buyerName}</span>
                  <StatusPill status={r.status} />
                  <p className="w-full text-xs text-muted-foreground">{r.reason}</p>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => navigate(`/e-invoicing/outbound?status=${r.status}&search=${encodeURIComponent(r.documentNo)}`)}>{ACTION[r.action] || "Open"}</Button>
                </li>
              ))}
            </ul>
          </BentoCard>
        )}
        <Top title="Top suppliers" rows={data.topSuppliers} empty="No supplier invoices received in this period." />
      </div>

      <div data-anim="bento"><ConnectionCard settings={settings} period={{ from: period.from || (period.all ? "2000-01-01" : ""), to: period.to }} ours={books} /></div>

      <details className={`${cardClass} border border-border bg-card px-6 py-4`}>
        <summary className="cursor-pointer text-sm font-semibold">UAE mandate dates</summary>
        <div className="mt-3"><MandateTimeline /></div>
      </details>
    </div>
  );
}
