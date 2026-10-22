import React, { useState } from "react";
import { Eye, FileText, PackagePlus, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { ConfirmDialog, DataTable, ErrorNote, PageHeader, Panel, Pill, Spinner, TextInput, useAsync } from "../accounting/kit";
import { goodsReceipts } from "../../lib/orderDocumentsApi";
import { RECEIPT_TABS, allowReceiptActions, receiptInvoiceBlocker, receiptStatusLabel } from "../../lib/orderDocuments";
import { statusTone } from "../../lib/status";
import { formatDate, formatNumber, CURRENCY } from "../../utils/format";
import { Note, PillTabs } from "../salesDocs/parts";
import { ReceiptInvoiceDialog } from "./ReceiptDialogs";
import { createThenApprove, invoiceNote } from "../../lib/invoiceFlow";
import { useDebounced, useDocumentAction } from "./hooks";
import { useOrganisation } from "../shell/OrganisationContext";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { useClampPage, useServerPage } from "../lists/useServerPage";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import ListPager from "../lists/ListPager";
import ListEmpty from "../lists/ListEmpty";
import { pageFigures } from "../../lib/pagination";

const INVOICE_TEXT = { NONE: "Not invoiced", DRAFT: "On a draft invoice", INVOICED: "Invoiced" };

// Goods received: what has arrived, and above all what has arrived and not been invoiced, because the vendor's invoice is
// what posts to the books. The "Not invoiced" tab is where received goods are picked and put on one purchase invoice.
export default function GoodsReceivedList({ onOpen, onNew, onEdit, onInvoiced, notify, reloadKey, initialStatus = "" }) {
  const { me, can } = useOrganisation();
  const mayAdd = can("purchase.create");
  const acts = (r) => allowReceiptActions(r.actions, me);
  const [status, setStatus] = useState(initialStatus);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState({}); // id -> the receipt, on the Not invoiced tab
  const [dialog, setDialog] = useState(null); // "invoice" | { remove: receipt }
  const search = useDebounced(q);
  // "Not invoiced" is a worklist: received goods are chased until they are invoiced, whenever they came, so it ignores the period.
  const periodFilter = usePeriodFilter();
  const { period } = periodFilter;
  const dated = status !== "UNINVOICED";
  const { page, pageSize, setPage, setPageSize } = useServerPage(`${status}|${search}|${dated ? period.key : "any"}`);
  const summary = useAsync(() => goodsReceipts.summary(), [reloadKey]);
  const { data, loading, error, reload } = useAsync(
    () => goodsReceipts.list({
      status: status || undefined, search: search || undefined,
      dateFrom: (dated && period.from) || undefined, dateTo: (dated && period.to) || undefined, page, limit: pageSize,
    }),
    [status, search, dated, period.key, page, pageSize, reloadKey]
  );
  const rows = data?.rows || [];
  useClampPage({ pagination: data?.pagination, loaded: Boolean(data) && !loading, page, setPage });
  const s = summary.data;
  const counts = s
    ? period.all
      ? { ...s.byStatus, UNINVOICED: s.uninvoiced.count, "": Object.values(s.byStatus).reduce((t, n) => t + n, 0) }
      : { UNINVOICED: s.uninvoiced.count }
    : undefined;
  const chosen = Object.values(picked);
  const selecting = status === "UNINVOICED";
  const action = useDocumentAction({ notify, reload: async () => { await Promise.all([reload(), summary.reload()]); } });

  const pick = (receipt, on) => setPicked((p) => { const n = { ...p }; if (on) n[receipt._id] = receipt; else delete n[receipt._id]; return n; });
  const changeTab = (v) => { setStatus(v); setPicked({}); };

  const createInvoice = async (body) => {
    const out = await action.run(
      () => createThenApprove((payload) => goodsReceipts.invoice(payload), body, (r) => r.purchaseInvoice),
      (r) => invoiceNote(r.purchaseInvoice.transactionNo, `${r.goodsReceipts.length} goods receipt${r.goodsReceipts.length === 1 ? "" : "s"}`, r.approval)
    );
    if (out && out !== true) { setDialog(null); setPicked({}); onInvoiced?.(out.purchaseInvoice); }
  };
  const remove = async () => {
    const out = await action.run(() => goodsReceipts.remove(dialog.remove._id), `${dialog.remove.receiptNo} deleted`);
    if (out) setDialog(null);
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Goods received"
        description="The paper that says what a vendor's goods turned out to be on arrival. It posts nothing: the purchase invoice made from it brings the stock in and posts the ledger."
        actions={mayAdd && <Button onClick={onNew}><PackagePlus className="h-4 w-4" aria-hidden="true" />New goods receipt</Button>}
      />

      {s && (
        <div className="mb-5">
          <p className="mb-2 text-xs text-muted-foreground">All goods received, whatever the period below</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Received, not invoiced" count={formatNumber(s.uninvoiced.value, 2)} subText={`${s.uninvoiced.count} receipt${s.uninvoiced.count === 1 ? "" : "s"} waiting for an invoice`} tone="teal" onClick={() => changeTab("UNINVOICED")} />
            <StatCard title="Drafts" count={String(s.byStatus.DRAFT || 0)} subText="not yet confirmed as received" tone="plum" onClick={() => { changeTab("DRAFT"); periodFilter.choose("all"); }} />
            <StatCard title="Received" count={String(s.byStatus.RECEIVED || 0)} subText="signed for" tone="olive" onClick={() => { changeTab("RECEIVED"); periodFilter.choose("all"); }} />
            <StatCard title="Cancelled" count={String(s.byStatus.CANCELLED || 0)} subText="withdrawn" tone="neutral" />
          </div>
        </div>
      )}

      <div className="mb-4 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <PillTabs tabs={RECEIPT_TABS} value={status} counts={counts} label="Goods received status" onChange={changeTab} />
          <div className="relative min-w-56 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <TextInput aria-label="Search goods received" className="ps-9" placeholder="Number, vendor, delivery note or item…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {dated && <PeriodSelect filter={periodFilter} labelled />}
        </div>
        {dated ? (
          <PeriodNote filter={periodFilter} count={data ? data.pagination.total : null} noun="goods receipts" one="goods receipt" extra={status ? `status: ${RECEIPT_TABS.find(([v]) => v === status)?.[1] || status}` : undefined} className="mt-3" />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Not invoiced</span>
            {" · every receipt of goods still waiting for a purchase invoice, whatever its date"}
            {data ? ` · ${data.pagination.total}` : ""}
          </p>
        )}
      </div>

      {selecting && (
        <div className="mb-3">
          {chosen.length === 0 ? (
            <Note>Tick the receipts to put on one purchase invoice (the same vendor's). The invoice bills what was received, at the order's prices.</Note>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <span className="text-sm">
                <span className="font-semibold">{chosen.length} selected</span>
                <span className="text-muted-foreground"> · {formatNumber(chosen.reduce((t, n) => t + n.totalAmount, 0), 2)} {CURRENCY}</span>
                {receiptInvoiceBlocker(chosen) && <span className="ms-2 font-medium text-status-danger">{receiptInvoiceBlocker(chosen)}</span>}
              </span>
              <span className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPicked({})}>Clear</Button>
                <Button size="sm" disabled={Boolean(receiptInvoiceBlocker(chosen))} onClick={() => setDialog("invoice")}><FileText className="h-3.5 w-3.5" aria-hidden="true" />Create purchase invoice</Button>
              </span>
            </div>
          )}
        </div>
      )}

      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading goods received" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && rows.length === 0 && !dated && !search && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">Everything received has been invoiced.</p>
        )}
        {data && rows.length === 0 && (dated || search) && (
          <ListEmpty
            filter={periodFilter}
            noun="goods receipts"
            inPeriod={null}
            filtered={Boolean(status || search)}
            onClearFilters={() => { setStatus(""); setQ(""); }}
            emptyTitle="No goods received yet"
            createText="Record goods as they arrive, against a purchase order or on their own."
            action={mayAdd ? <Button onClick={onNew}>New goods receipt</Button> : undefined}
          />
        )}
        {rows.length > 0 && (
          <DataTable
            caption="Goods received"
            rows={rows}
            rowKey={(r) => r._id}
            onRowClick={(r) => onOpen(r._id)}
            columns={[
              selecting && {
                key: "pick", header: <span className="sr-only">Select</span>, card: "hidden", className: "w-10",
                cell: (r) => (
                  <span onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox" className="h-4 w-4 accent-[var(--primary)]" aria-label={`Select ${r.receiptNo}`}
                      checked={Boolean(picked[r._id])} disabled={!acts(r).invoice} onChange={(e) => pick(r, e.target.checked)}
                    />
                  </span>
                ),
              },
              {
                key: "no", header: "Goods received", card: "primary",
                cell: (r) => (
                  <>
                    <span className="font-mono text-xs font-semibold">{r.receiptNo}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {r.source?.kind === "purchase_order" ? `Against ${r.source.no}` : "No purchase order"}
                      {r.vendorDeliveryNo ? ` · vendor ${r.vendorDeliveryNo}` : ""}
                    </span>
                  </>
                ),
              },
              { key: "party", header: "Vendor", card: "title", className: "font-medium", cell: (r) => r.party?.name || "-" },
              { key: "date", header: "Received", card: "meta", className: "whitespace-nowrap text-muted-foreground", cell: (r) => formatDate(r.receivedAt || r.date) },
              { key: "invoice", header: "Invoice", card: "meta", className: "text-muted-foreground", cell: (r) => (r.status === "RECEIVED" ? `${INVOICE_TEXT[r.invoiceStatus] || r.invoiceStatus}${r.invoice?.no ? ` · ${r.invoice.no}` : ""}` : "-") },
              { key: "amount", header: "Value", money: true, align: "end", card: "amount", className: "whitespace-nowrap font-medium tabular-nums", cell: (r) => formatNumber(r.totalAmount, 2) },
              { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={statusTone(r.status)}>{receiptStatusLabel(r.status)}</Pill> },
              {
                key: "actions", header: "", align: "end", card: "actions", className: "whitespace-nowrap",
                cell: (r) => (
                  <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => onOpen(r._id)}><Eye className="h-3.5 w-3.5" aria-hidden="true" />View</Button>
                    {acts(r).edit && <Button size="sm" variant="ghost" onClick={() => onEdit(r)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</Button>}
                    {acts(r).delete && <Button size="sm" variant="ghost" onClick={() => setDialog({ remove: r })}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete</Button>}
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
            noun="goods receipts"
            one="goods receipt"
            className="rounded-none border-0 border-t shadow-none"
          />
        )}
      </Panel>

      {dialog === "invoice" && <ReceiptInvoiceDialog receipts={chosen} busy={action.busy} problem={action.problem} onClose={() => { setDialog(null); action.clear(); }} onConfirm={createInvoice} />}
      {dialog?.remove && (
        <ConfirmDialog
          danger busy={action.busy} title={`Delete ${dialog.remove.receiptNo}?`} confirmLabel="Delete draft" onClose={() => { setDialog(null); action.clear(); }} onConfirm={remove}
          text="This draft was never confirmed as received. It is removed for good."
        />
      )}
    </div>
  );
}
