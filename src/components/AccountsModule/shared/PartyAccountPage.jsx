import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Banknote, Clock, FileText, Gauge, Hourglass, ListChecks, Mail, Phone, RefreshCw, Scale, User, Wallet } from "lucide-react";
import { CURRENCY, formatNumber } from "../../../utils/format";
import { partyAccountApi } from "../../../lib/partyAccountApi";
import { Button } from "../../ui/button";
import StatCard from "../../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Balance, ErrorNote, Pill, useAsync } from "../../accounting/kit";
import { CreditUsedCard, Skeleton } from "./partyAccountParts";
import { KINDS, creditPosition, netOf, overdueAmount, overdueInvoiceCount, partyStatusTone } from "./partyAccountUtils";
import StatementTab from "./StatementTab";
import OpenInvoicesTab from "./OpenInvoicesTab";
import PartyDetailsTab from "./PartyDetailsTab";

const TABS = [
  { id: "statement", label: "Statement" },
  { id: "open", label: "Open invoices" },
  { id: "details", label: "Details" },
];

function balanceNote(k, balance) {
  const n = Number(balance) || 0;
  if (Math.abs(n) < 0.005) return "Settled";
  if (k.kind === "customer") return n > 0 ? "Customer owes you this amount" : "Customer is in credit";
  return n > 0 ? "You owe this amount" : "Paid ahead of invoices";
}

function Fact({ icon, label, children }) {
  const Icon = icon;
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-foreground">{children || <span className="text-muted-foreground">Not provided</span>}</dd>
    </div>
  );
}

/**
 * One customer's or vendor's account: who they are, where the balance stands, and the ledger
 * statement, open invoices and details behind it. `kind` is "customer" or "vendor"; the two pages
 * differ only in wording, routes and which way the balance reads.
 */
export default function PartyAccountPage({ kind, partyId }) {
  const k = KINDS[kind];
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "statement";
  const setTab = (id) =>
    setParams((p) => { const next = new URLSearchParams(p); next.set("tab", id); return next; }, { replace: true });

  const [range, setRange] = useState({ from: "", to: "" });

  const party = useAsync(() => partyAccountApi.party(kind, partyId), [kind, partyId]);
  const summary = useAsync(() => partyAccountApi.summary(kind, partyId), [kind, partyId]);
  const ageing = useAsync(() => partyAccountApi.ageing(kind), [kind, partyId]);
  const statement = useAsync(
    () => partyAccountApi.statement({ kind, partyId, from: range.from || undefined, to: range.to || undefined }),
    [kind, partyId, range.from, range.to]
  );

  const ageingRow = useMemo(() => (ageing.data?.rows || []).find((r) => String(r.partyId) === String(partyId)) || null, [ageing.data, partyId]);
  const p = party.data;
  const s = summary.data;
  const name = p?.[k.nameField] || statement.data?.party?.name || s?.partyName || "";
  const code = p?.[k.idField] || s?.partyCode || "";
  const terms = p?.paymentTerms || s?.paymentTerms || "";
  const credit = kind === "customer" && s ? creditPosition({ summary: s, party: p }) : null;
  const overdue = s ? overdueAmount({ summary: s, ageingRow }) : 0;
  const lateInvoices = overdueInvoiceCount(ageingRow?.invoices);
  const net = netOf(kind, s?.balance);

  const statementLink = `/statement?${new URLSearchParams({ partyType: k.partyType, partyId, ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) })}`;
  const refresh = () => { party.reload(); summary.reload(); ageing.reload(); statement.reload(); };
  const busy = party.loading || summary.loading || ageing.loading || statement.loading;

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <Link to={k.listPath} className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{k.listLabel}
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {name ? (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{name}</h1>
            ) : party.error && statement.error ? (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{k.partyType} account</h1>
            ) : (
              <Skeleton className="h-8 w-64" />
            )}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {code && <span>{k.partyType} ID <span className="font-mono text-foreground">{code}</span></span>}
              {p?.status && <Pill tone={partyStatusTone(p.status)}>{p.status}</Pill>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button type="button" variant="ghost" size="icon" onClick={refresh} disabled={busy} aria-label="Refresh account">
              <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            </Button>
            <Button asChild variant="outline"><Link to={statementLink}><FileText className="h-4 w-4" aria-hidden="true" />Statement of account</Link></Button>
            <Button asChild><Link to={k.payPath}><Banknote className="h-4 w-4" aria-hidden="true" />{k.payLabel}</Link></Button>
          </div>
        </div>

        {party.error && !p ? (
          <div className="mt-4"><ErrorNote error={party.error} onRetry={party.reload} /></div>
        ) : (
          <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-5 py-4 shadow-card sm:grid-cols-2 lg:grid-cols-5" aria-busy={party.loading || undefined}>
            {party.loading && !p ? (
              [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)
            ) : (
              <>
                <Fact icon={User} label="Contact person">{p?.contactPerson}</Fact>
                <Fact icon={Phone} label="Phone">{p?.phone && <a className="underline underline-offset-2" href={`tel:${p.phone}`}>{p.phone}</a>}</Fact>
                <Fact icon={Mail} label="Email">{p?.email && <a className="underline underline-offset-2" href={`mailto:${p.email}`}>{p.email}</a>}</Fact>
                <Fact icon={Clock} label="Payment terms">{terms}</Fact>
                <Fact icon={FileText} label="TRN">{p?.trnNumber || p?.trnNO}</Fact>
              </>
            )}
          </dl>
        )}
      </header>

      <section aria-label="Account summary" className="mb-6">
        {summary.error && !s ? (
          <ErrorNote error={summary.error} onRetry={summary.reload} />
        ) : summary.loading && !s ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : s ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={k.balanceTitle}
              icon={<Scale />}
              tone="teal"
              count={<Balance net={net} />}
              subText={`${CURRENCY} · ${balanceNote(k, s.balance)}`}
            />
            {kind === "customer" ? (
              <>
                <StatCard
                  title="Credit limit"
                  icon={<Gauge />}
                  tone="plum"
                  count={credit.limit > 0 ? formatNumber(credit.limit, 2) : "No limit"}
                  subText={credit.limit > 0 ? (credit.available >= 0 ? `${formatNumber(credit.available, 2)} available` : `Over by ${formatNumber(Math.abs(credit.available), 2)}`) : "No credit limit is set"}
                />
                <StatCard
                  title="Overdue"
                  icon={<AlertTriangle />}
                  tone={overdue > 0 ? "warning" : "olive"}
                  count={formatNumber(overdue, 2)}
                  subText={overdue > 0 ? `${CURRENCY} · past the due date` : "Nothing is overdue"}
                  trend={lateInvoices > 0 ? `${lateInvoices} ${lateInvoices === 1 ? "invoice" : "invoices"}` : undefined}
                />
                {credit.status !== "no-limit" ? (
                  <CreditUsedCard credit={credit} />
                ) : (
                  <StatCard title="Payment terms" icon={<Clock />} tone="neutral" count={terms || "Not set"} subText="Invoices fall due after this" />
                )}
              </>
            ) : (
              <>
                <StatCard
                  title="Overdue"
                  icon={<AlertTriangle />}
                  tone={overdue > 0 ? "warning" : "olive"}
                  count={formatNumber(overdue, 2)}
                  subText={overdue > 0 ? `${CURRENCY} · past the due date` : "Nothing is overdue"}
                  trend={lateInvoices > 0 ? `${lateInvoices} ${lateInvoices === 1 ? "invoice" : "invoices"}` : undefined}
                />
                <StatCard
                  title="Open invoices"
                  icon={<ListChecks />}
                  tone="plum"
                  count={ageing.data ? String(ageingRow?.invoices?.length || 0) : "–"}
                  subText={ageingRow ? `${formatNumber(ageingRow.total, 2)} ${CURRENCY} unpaid` : ageing.data ? "All invoices are paid" : "Loading"}
                />
                <StatCard title="Payment terms" icon={<Hourglass />} tone="neutral" count={terms || "Not set"} subText="Invoices fall due after this" />
              </>
            )}
          </div>
        ) : null}
        {s?.source === "documents" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" aria-hidden="true" />Ledger posting is off, so the balance is worked out from approved documents.</p>
        )}
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto print:hidden">
          <TabsList aria-label="Account sections">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
                {t.id === "open" && ageing.data && (
                  <span className="rounded-full bg-secondary px-1.5 text-xs tabular-nums text-muted-foreground">{ageingRow?.invoices?.length || 0}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="statement">
          <StatementTab k={k} name={name} statement={statement} range={range} onRange={setRange} />
        </TabsContent>
        <TabsContent value="open">
          <OpenInvoicesTab k={k} ageing={ageing} row={ageingRow} />
        </TabsContent>
        <TabsContent value="details">
          <PartyDetailsTab k={k} party={party} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
