import React, { useState } from "react";
import { Eye, FilePlus2, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { ConfirmDialog, DataTable, ErrorNote, PageHeader, Panel, Pill, Spinner, TextInput, useAsync } from "../accounting/kit";
import { tradeOrders } from "../../lib/orderDocumentsApi";
import { ORDER_TABS, allowOrderActions, orderStatusLabel, progressTone } from "../../lib/orderDocuments";
import { statusTone } from "../../lib/status";
import { formatDate, formatNumber } from "../../utils/format";
import { PillTabs } from "../salesDocs/parts";
import { useDebounced } from "./hooks";
import { useOrganisation } from "../shell/OrganisationContext";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { useClampPage, useServerPage } from "../lists/useServerPage";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import ListPager from "../lists/ListPager";
import ListEmpty from "../lists/ListEmpty";
import { pageFigures } from "../../lib/pagination";

const WORDS = {
  sales: {
    title: "Sales orders", noun: "sales orders", one: "sales order", party: "Customer", add: "New sales order", perm: "sales.create",
    description: "What customers have asked for. An order posts nothing: goods are delivered against it, and the invoice is made from what was delivered.",
    search: "Number, customer, LPO or item…", empty: "Write down what a customer has ordered, then deliver against it and invoice what was delivered.",
  },
  purchase: {
    title: "Purchase orders", noun: "purchase orders", one: "purchase order", party: "Vendor", add: "New purchase order", perm: "purchase.create",
    description: "What you have asked vendors for. An order posts nothing: goods are received against it, and the invoice is made from what arrived.",
    search: "Number, vendor, reference or item…", empty: "Place an order with a vendor, then record the goods received against it and invoice what arrived.",
  },
};

// Orders to customers or from vendors: what is open, what is part-delivered, what is waiting for an invoice. Opening one shows the
// document and every action on it; the list only finds it, so there is one place for each.
export default function TradeOrderList({ kind, onOpen, onNew, onEdit, notify, reloadKey }) {
  const w = WORDS[kind];
  const { me, can } = useOrganisation();
  const mayAdd = can(w.perm);
  const acts = (r) => allowOrderActions(r.actions, me, kind);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const search = useDebounced(q);
  const periodFilter = usePeriodFilter();
  const { period } = periodFilter;
  const { page, pageSize, setPage, setPageSize } = useServerPage(`${kind}|${status}|${search}|${period.key}`);
  const summary = useAsync(() => tradeOrders.summary(kind), [kind, reloadKey]);
  const { data, loading, error, reload } = useAsync(
    () => tradeOrders.list({ kind, status: status || undefined, search: search || undefined, dateFrom: period.from || undefined, dateTo: period.to || undefined, page, limit: pageSize }),
    [kind, status, search, period.key, page, pageSize, reloadKey]
  );
  const rows = data?.rows || [];
  useClampPage({ pagination: data?.pagination, loaded: Boolean(data) && !loading, page, setPage });
  const s = summary.data?.byStatus || {};
  const total = Object.values(s).reduce((t, v) => t + v.count, 0);
  const counts = summary.data && period.all ? { "": total, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.count])) } : undefined;

  const remove = async () => {
    setBusy(true);
    try {
      await tradeOrders.remove(removing._id);
      notify(`${removing.orderNo} deleted`);
      setRemoving(null);
      reload();
      summary.reload();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={w.title}
        description={w.description}
        actions={mayAdd && <Button onClick={onNew}><FilePlus2 className="h-4 w-4" aria-hidden="true" />{w.add}</Button>}
      />

      {summary.data && (
        <div className="mb-5">
          <p className="mb-2 text-xs text-muted-foreground">All {w.noun}, whatever the period below</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Confirmed" count={formatNumber(s.CONFIRMED?.value || 0, 2)} subText={`${s.CONFIRMED?.count || 0} open ${s.CONFIRMED?.count === 1 ? w.one : w.noun}`} tone="teal" onClick={() => { setStatus("CONFIRMED"); periodFilter.choose("all"); }} />
            <StatCard title="Drafts" count={String(s.DRAFT?.count || 0)} subText="not confirmed yet" tone="plum" onClick={() => { setStatus("DRAFT"); periodFilter.choose("all"); }} />
            <StatCard title="Closed" count={String(s.CLOSED?.count || 0)} subText="finished early" tone="neutral" />
            <StatCard title="Cancelled" count={String(s.CANCELLED?.count || 0)} subText="never went ahead" tone="neutral" />
          </div>
        </div>
      )}

      <div className="mb-4 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <PillTabs tabs={ORDER_TABS} value={status} counts={counts} label="Order status" onChange={setStatus} />
          <div className="relative min-w-56 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <TextInput aria-label={`Search ${w.noun}`} className="ps-9" placeholder={w.search} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <PeriodSelect filter={periodFilter} labelled />
        </div>
        <PeriodNote filter={periodFilter} count={data ? data.pagination.total : null} noun={w.noun} one={w.one} extra={status ? `status: ${ORDER_TABS.find(([v]) => v === status)?.[1] || status}` : undefined} className="mt-3" />
      </div>

      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label={`Loading ${w.noun}`} />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && rows.length === 0 && (
          <ListEmpty
            filter={periodFilter}
            noun={w.noun}
            inPeriod={null}
            filtered={Boolean(status || search)}
            onClearFilters={() => { setStatus(""); setQ(""); }}
            emptyTitle={`No ${w.noun} yet`}
            createText={w.empty}
            action={mayAdd ? <Button onClick={onNew}>{w.add}</Button> : undefined}
          />
        )}
        {rows.length > 0 && (
          <DataTable
            caption={w.title}
            rows={rows}
            rowKey={(r) => r._id}
            onRowClick={(r) => onOpen(r._id)}
            columns={[
              {
                key: "no", header: "Order", card: "primary",
                cell: (r) => (
                  <>
                    <span className="font-mono text-xs font-semibold">{r.orderNo}</span>
                    {r.reference && <span className="block text-xs font-normal text-muted-foreground">Ref {r.reference}</span>}
                  </>
                ),
              },
              { key: "party", header: w.party, card: "title", className: "font-medium", cell: (r) => r.party?.name || "-" },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap text-muted-foreground", cell: (r) => formatDate(r.date) },
              { key: "expected", header: kind === "sales" ? "Delivery" : "Expected", card: "meta", className: "whitespace-nowrap text-muted-foreground", cell: (r) => (r.expectedDate ? formatDate(r.expectedDate) : "-") },
              { key: "amount", header: "Amount", align: "end", card: "amount", className: "whitespace-nowrap font-medium tabular-nums", cell: (r) => formatNumber(r.totalAmount, 2) },
              {
                key: "status", header: "Status", card: "badge",
                cell: (r) => (
                  <span className="flex flex-col items-start gap-1">
                    <Pill tone={statusTone(r.status)}>{orderStatusLabel(r.status)}</Pill>
                    {["CONFIRMED", "CLOSED"].includes(r.status) && <Pill tone={progressTone(r.progress.label)}>{r.progress.label}</Pill>}
                  </span>
                ),
              },
              {
                key: "actions", header: "", align: "end", card: "actions", className: "whitespace-nowrap",
                cell: (r) => (
                  <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => onOpen(r._id)}><Eye className="h-3.5 w-3.5" aria-hidden="true" />View</Button>
                    {acts(r).edit && <Button size="sm" variant="ghost" onClick={() => onEdit(r._id)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</Button>}
                    {acts(r).delete && <Button size="sm" variant="ghost" onClick={() => setRemoving(r)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete</Button>}
                  </span>
                ),
              },
            ]}
          />
        )}
        {data && rows.length > 0 && (
          <ListPager
            figures={pageFigures({ page, size: pageSize, total: data.pagination.total })}
            onPage={setPage}
            onPageSize={setPageSize}
            noun={w.noun}
            one={w.one}
            className="rounded-none border-0 border-t shadow-none"
          />
        )}
      </Panel>

      {removing && (
        <ConfirmDialog
          danger busy={busy} title={`Delete ${removing.orderNo}?`} confirmLabel="Delete draft" onClose={() => setRemoving(null)} onConfirm={remove}
          text="This draft has not been confirmed. It is removed for good."
        />
      )}
    </div>
  );
}
