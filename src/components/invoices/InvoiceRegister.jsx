import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import axiosInstance from "../../axios/axios";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { DataTable, ErrorNote, PageHeader, Panel, Pill, Spinner, useAsync } from "../accounting/kit";
import { PillTabs } from "../salesDocs/parts";
import FilterBar, { FilterSelect } from "../lists/FilterBar";
import ListEmpty from "../lists/ListEmpty";
import ListPager from "../lists/ListPager";
import PaymentBadge from "../lists/PaymentBadge";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { fetchAllTransactions } from "../../lib/transactionList";
import { DEFAULT_LIST_PERIOD, inPeriod } from "../../lib/listPeriod";
import { DEFAULT_PAGE_SIZE, pageSlice } from "../../lib/pagination";
import { paymentStatus } from "../../lib/paymentStatus";
import { formatDate, formatNumber, toInputDate, CURRENCY } from "../../utils/format";

// The invoice register: every invoice of the period, what has been collected (or paid) against it, and what is still open.
//
// An invoice is the document that reaches the accounts. A DRAFT is not in the books at all - no ledger entry, no stock, no
// customer or vendor balance - and the register says so beside it; only a CONFIRMED (approved) invoice is. "Paid" is read from
// the amounts that receipts and payments keep (lib/paymentStatus.js), never from a stored status.
//
// It reads the same documents as the Orders screens (a sales invoice is a `sales_order` transaction once approved, a purchase
// invoice a `purchase_order`), so nothing here can disagree with them; opening a row goes to the document itself.
const SIDES = {
  sales: {
    type: "sales_order",
    title: "Sales invoices",
    description: "What has been invoiced to customers, what has been received against it and what is still owed. Only a confirmed invoice is in the accounts.",
    noun: "invoices",
    one: "invoice",
    party: "Customer",
    parties: "All customers",
    settled: "Received",
    settledNoun: "received",
    open: (no) => `/sales-order?search=${encodeURIComponent(no)}`,
    partyOf: (t) => t.partyName || t.party?.customerName || "",
  },
  purchase: {
    type: "purchase_order",
    title: "Purchase invoices",
    description: "What vendors have invoiced you, what has been paid against it and what is still to pay. Only a confirmed invoice is in the accounts.",
    noun: "invoices",
    one: "invoice",
    party: "Vendor",
    parties: "All vendors",
    settled: "Paid",
    settledNoun: "paid",
    open: (no) => `/purchase-order?search=${encodeURIComponent(no)}`,
    partyOf: (t) => t.partyName || t.party?.vendorName || "",
  },
};

const INVOICE_TABS = [["CONFIRMED", "Confirmed"], ["DRAFT", "Draft"], ["ALL", "All"]];
const PAYMENT_OPTIONS = [["PAID", "Paid"], ["PARTIAL", "Partly paid"], ["UNPAID", "Unpaid"]];
const TOLERANCE = 0.005;
const money = (n) => formatNumber(Number(n) || 0, 2);
const DAY = 86400000;

// When an invoice falls due: the date stored on it, else its date plus the days in the party's payment terms ("Net 30",
// "45 days"; no number means due on the day). It is the rule the ageing report uses, so the two cannot disagree. Most documents
// carry no stored due date (only opening invoices do), which is why the terms are needed.
const termDays = (terms) => {
  const m = /(\d+)/.exec(String(terms || ""));
  return m ? Number(m[1]) : 0;
};
const dueOf = (t) => {
  if (t.dueDate) return new Date(t.dueDate);
  if (!t.date) return null;
  return new Date(new Date(t.date).getTime() + termDays(t.party?.paymentTerms) * DAY);
};
// past due once a whole day has gone by since it fell due, and only while something is still owed
const isPastDue = (t, now = Date.now()) => {
  const p = paymentStatus(t);
  const due = dueOf(t);
  return Boolean(p && p.key !== "PAID" && due && Math.floor((now - due.getTime()) / DAY) > 0);
};

// An invoice that counts (the register's totals ignore drafts, rejections and cancellations).
const isConfirmed = (t) => ["APPROVED", "INVOICED", "PAID", "PARTIAL", "UNPAID"].includes(String(t.status).toUpperCase());
const isDraft = (t) => ["DRAFT", "PENDING"].includes(String(t.status).toUpperCase());

export function InvoiceRegister({ side }) {
  const cfg = SIDES[side];
  const navigate = useNavigate();
  const [tab, setTab] = useState("CONFIRMED");
  const [payment, setPayment] = useState("");
  const [partyId, setPartyId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const periodFilter = usePeriodFilter({ initial: DEFAULT_LIST_PERIOD });
  const { period } = periodFilter;

  const { data, loading, error, reload } = useAsync(
    () => fetchAllTransactions(axiosInstance, { type: cfg.type, period, serverDates: true }),
    [cfg.type, period.key]
  );

  const inRange = useMemo(() => (data?.rows || []).filter((t) => inPeriod(toInputDate(t.date), period)), [data, period]);
  // the people to pick from: those who appear in this period
  const partyOptions = useMemo(() => {
    const seen = new Map();
    for (const t of inRange) if (t.partyId && !seen.has(String(t.partyId))) seen.set(String(t.partyId), cfg.partyOf(t) || String(t.partyId));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => [id, name]);
  }, [inRange, cfg]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inRange
      .filter((t) => (tab === "CONFIRMED" ? isConfirmed(t) : tab === "DRAFT" ? isDraft(t) : isConfirmed(t) || isDraft(t)))
      .filter((t) => !partyId || String(t.partyId) === partyId)
      .filter((t) => !payment || paymentStatus(t)?.key === payment)
      .filter((t) => !needle || [t.transactionNo, cfg.partyOf(t), t.lpono, t.vendorReference, t.docno].some((v) => String(v || "").toLowerCase().includes(needle)))
      .sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.transactionNo).localeCompare(String(a.transactionNo)));
  }, [inRange, tab, partyId, payment, search, cfg]);

  // What the confirmed invoices of the period come to: invoiced, settled, open and how much of it is past due.
  const totals = useMemo(() => {
    const t = { count: 0, invoiced: 0, settled: 0, open: 0, overdue: 0, overdueCount: 0 };
    for (const d of inRange.filter(isConfirmed)) {
      const p = paymentStatus(d);
      t.count += 1;
      t.invoiced += Number(d.totalAmount) || 0;
      if (p) {
        t.settled += p.paid ?? 0;
        t.open += p.outstanding ?? 0;
        if (isPastDue(d)) {
          t.overdue += p.outstanding ?? 0;
          t.overdueCount += 1;
        }
      }
    }
    return t;
  }, [inRange]);
  const draftCount = inRange.filter(isDraft).length;

  const filtersOn = Boolean(search.trim() || payment || partyId);
  const clear = () => { setSearch(""); setPayment(""); setPartyId(""); setPage(1); };
  const view = pageSlice(shown, page, size);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title={cfg.title} description={cfg.description} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Invoiced" count={money(totals.invoiced)} subText={`${totals.count} confirmed ${totals.count === 1 ? cfg.one : cfg.noun} · ${CURRENCY}`} tone="teal" />
        <StatCard title={cfg.settled} count={money(totals.settled)} subText={`${CURRENCY} ${cfg.settledNoun} against them`} tone="plum" />
        <StatCard title="Outstanding" count={money(totals.open)} subText={`${CURRENCY} still open`} tone={totals.open > TOLERANCE ? "warning" : "neutral"} onClick={() => { setPayment("UNPAID"); setTab("CONFIRMED"); setPage(1); }} />
        <StatCard title="Past due" count={money(totals.overdue)} subText={totals.overdueCount ? `${totals.overdueCount} ${totals.overdueCount === 1 ? cfg.one : cfg.noun} past the due date` : "nothing late"} tone={totals.overdueCount ? "danger" : "neutral"} />
      </div>

      <div className="mb-4 space-y-3">
        <PillTabs
          tabs={INVOICE_TABS}
          value={tab}
          label={`${cfg.title} status`}
          counts={{ DRAFT: draftCount }}
          onChange={reset(setTab)}
        />
        <FilterBar search={search} onSearch={reset(setSearch)} placeholder={`Number, ${cfg.party.toLowerCase()} or reference…`} searchLabel={`Search ${cfg.noun}`} active={filtersOn} onClear={clear}>
          <FilterSelect label="Payment" value={payment} onChange={reset(setPayment)} options={PAYMENT_OPTIONS} allLabel="All payments" />
          <FilterSelect label={cfg.party} value={partyId} onChange={reset(setPartyId)} options={partyOptions} allLabel={cfg.parties} />
          <PeriodSelect filter={periodFilter} labelled />
        </FilterBar>
        <PeriodNote filter={periodFilter} count={inRange.length} noun={cfg.noun} one={cfg.one} extra={filtersOn ? `${shown.length} match` : undefined} limited={Boolean(data?.truncated)} />
      </div>

      {tab !== "CONFIRMED" && draftCount > 0 && (
        <p className="mb-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          A draft is not in the accounts: no ledger entry, no stock and no {cfg.party.toLowerCase()} balance until it is confirmed.
        </p>
      )}

      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label={`Loading ${cfg.noun}`} />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && shown.length === 0 && (
          <ListEmpty
            filter={periodFilter}
            noun={cfg.noun}
            inPeriod={inRange.length}
            filtered={filtersOn || tab !== "CONFIRMED"}
            onClearFilters={() => { clear(); setTab("CONFIRMED"); }}
            emptyTitle={`No ${cfg.noun} yet`}
            createText={side === "sales" ? "An invoice appears here once an order is approved." : "An invoice appears here once a purchase order is approved."}
          />
        )}
        {shown.length > 0 && (
          <DataTable
            caption={cfg.title}
            rows={view.rows}
            rowKey={(r) => r._id}
            onRowClick={(r) => navigate(cfg.open(r.transactionNo))}
            columns={[
              {
                key: "no", header: "Invoice", card: "primary",
                cell: (r) => (
                  <>
                    <span className="font-mono text-xs font-semibold">{r.transactionNo}</span>
                    {r.isOpening && <span className="block text-xs font-normal text-muted-foreground">Opening balance</span>}
                  </>
                ),
              },
              { key: "party", header: cfg.party, card: "title", className: "font-medium", cell: (r) => cfg.partyOf(r) || "-" },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap text-muted-foreground", cell: (r) => formatDate(r.date) },
              {
                key: "due", header: "Due", card: "meta", className: "whitespace-nowrap text-muted-foreground",
                cell: (r) => {
                  const due = dueOf(r);
                  const late = isPastDue(r);
                  return due ? <span className={late ? "font-medium text-status-danger" : undefined}>{formatDate(due)}{late ? " · past due" : ""}</span> : "-";
                },
              },
              { key: "total", header: "Total", align: "end", card: "amount", className: "whitespace-nowrap font-medium tabular-nums", cell: (r) => money(r.totalAmount) },
              {
                key: "paid", header: cfg.settled, align: "end", card: "meta", className: "whitespace-nowrap tabular-nums text-muted-foreground",
                cell: (r) => (paymentStatus(r) ? money(paymentStatus(r).paid) : "-"),
              },
              {
                key: "open", header: "Outstanding", align: "end", card: "meta", className: "whitespace-nowrap tabular-nums",
                cell: (r) => (paymentStatus(r) ? money(paymentStatus(r).outstanding) : "-"),
              },
              {
                key: "payment", header: "Payment", card: "badge",
                cell: (r) => (isDraft(r) ? <Pill tone="neutral">Draft · not in accounts</Pill> : <PaymentBadge doc={r} />),
              },
              {
                key: "actions", header: "", align: "end", card: "actions", className: "whitespace-nowrap",
                cell: (r) => (
                  <span onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => navigate(cfg.open(r.transactionNo))}><Eye className="h-3.5 w-3.5" aria-hidden="true" />Open</Button>
                  </span>
                ),
              },
            ]}
          />
        )}
      </Panel>

      <ListPager figures={view} onPage={setPage} onPageSize={(n) => { setSize(n); setPage(1); }} noun={cfg.noun} one={cfg.one} className="mt-4" />
    </div>
  );
}

export const SalesInvoices = () => <InvoiceRegister side="sales" />;
export const PurchaseInvoices = () => <InvoiceRegister side="purchase" />;
export default InvoiceRegister;
