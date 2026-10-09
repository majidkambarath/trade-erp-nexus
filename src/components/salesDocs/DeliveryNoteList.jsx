import React, { useState } from "react";
import { Eye, FileText, Pencil, Search, Trash2, Truck } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { ConfirmDialog, DataTable, EmptyState, ErrorNote, PageHeader, Panel, Pill, Spinner, TextInput, useAsync } from "../accounting/kit";
import { deliveryNotes } from "../../lib/salesDocumentsApi";
import { CLOCK_TONE, DELIVERY_TABS, clockText, invoiceBlocker, invoiceText, statusLabel } from "../../lib/salesDocuments";
import { statusTone } from "../../lib/status";
import { formatDate, formatNumber, CURRENCY } from "../../utils/format";
import { InvoiceDialog } from "./DeliveryDialogs";
import { Note, PillTabs } from "./parts";
import { useDebounced, useDocumentAction } from "./hooks";
import { useOrganisation } from "../shell/OrganisationContext";
import { allowActions } from "../../lib/salesDocuments";

// Delivery notes: what is being sent, what has arrived, and above all what has arrived and not been invoiced,
// because a tax invoice is due within 14 days of delivery. The "Not invoiced" tab is where that is chased, and
// where several notes of one customer are picked together for a single invoice.
export default function DeliveryNoteList({ onOpen, onNew, onEdit, onInvoiced, notify, reloadKey, initialStatus = "" }) {
  const { me, can } = useOrganisation();
  const mayAdd = can("sales.create");
  const acts = (r) => allowActions(r.actions, me);
  const [status, setStatus] = useState(initialStatus);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState({}); // id -> the note, on the Not invoiced tab
  const [dialog, setDialog] = useState(null); // "invoice" | { remove: note }
  const search = useDebounced(q);
  const summary = useAsync(() => deliveryNotes.summary(), [reloadKey]);
  const { data, loading, error, reload } = useAsync(
    () => deliveryNotes.list({ status: status || undefined, search: search || undefined, page, limit: 20 }),
    [status, search, page, reloadKey]
  );
  const rows = data?.rows || [];
  const pages = data?.pagination?.pages || 1;
  const s = summary.data;
  const counts = s ? { ...s.byStatus, UNINVOICED: s.uninvoiced.count, "": Object.values(s.byStatus).reduce((t, n) => t + n, 0) } : undefined;
  const chosen = Object.values(picked);
  const selecting = status === "UNINVOICED";
  const action = useDocumentAction({ notify, reload: async () => { await Promise.all([reload(), summary.reload()]); } });

  const pick = (note, on) => setPicked((p) => { const n = { ...p }; if (on) n[note._id] = note; else delete n[note._id]; return n; });
  const changeTab = (v) => { setStatus(v); setPage(1); setPicked({}); };
  const overdue = (s?.clock?.pastStandard || 0) + (s?.clock?.overdue || 0);

  const createInvoice = async (body) => {
    const out = await action.run(() => deliveryNotes.invoice(body), (r) => `${r.salesOrder.transactionNo} created from ${r.deliveryNotes.length} delivery note${r.deliveryNotes.length === 1 ? "" : "s"}`);
    if (out && out !== true) { setDialog(null); setPicked({}); onInvoiced?.(out.salesOrder); }
  };
  const remove = async () => {
    const out = await action.run(() => deliveryNotes.remove(dialog.remove._id), `${dialog.remove.deliveryNoteNo} deleted`);
    if (out) setDialog(null);
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Delivery notes"
        description="The paper that goes with the goods, signed by whoever takes them. Stock and ledger move when the invoice is approved."
        actions={mayAdd && <Button onClick={onNew}><Truck className="h-4 w-4" aria-hidden="true" />New delivery note</Button>}
      />

      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Delivered, not invoiced" count={formatNumber(s.uninvoiced.value, 2)} subText={`${s.uninvoiced.count} note${s.uninvoiced.count === 1 ? "" : "s"} waiting for an invoice`} tone="teal" onClick={() => changeTab("UNINVOICED")} />
          <StatCard title="Past the 14-day window" count={String(overdue)} subText={overdue ? "invoice these first" : "nothing late"} tone={overdue ? "danger" : "neutral"} onClick={() => changeTab("UNINVOICED")} />
          <StatCard title="Invoice due within 3 days" count={String(s.clock?.dueSoon || 0)} subText={s.clock?.dueSoon ? "tax invoice due soon" : "nothing about to fall due"} tone={s.clock?.dueSoon ? "warning" : "neutral"} onClick={() => changeTab("UNINVOICED")} />
          <StatCard title="On the road" count={String(s.byStatus.DISPATCHED || 0)} subText="dispatched, not yet signed for" tone="plum" onClick={() => changeTab("DISPATCHED")} />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 print:hidden sm:flex-row sm:flex-wrap sm:items-center">
        <PillTabs tabs={DELIVERY_TABS} value={status} counts={counts} label="Delivery note status" onChange={changeTab} />
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextInput aria-label="Search delivery notes" className="ps-9" placeholder="Number, customer, vehicle or item…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {selecting && (
        <div className="mb-3">
          {chosen.length === 0 ? (
            <Note>Tick the notes to put on one invoice. Notes against a sales order are invoiced by approving that order.</Note>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <span className="text-sm">
                <span className="font-semibold">{chosen.length} selected</span>
                <span className="text-muted-foreground"> · {formatNumber(chosen.reduce((t, n) => t + n.totalAmount, 0), 2)} {CURRENCY}</span>
                {invoiceBlocker(chosen) && <span className="ms-2 font-medium text-status-danger">{invoiceBlocker(chosen)}</span>}
              </span>
              <span className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPicked({})}>Clear</Button>
                <Button size="sm" disabled={Boolean(invoiceBlocker(chosen))} onClick={() => setDialog("invoice")}><FileText className="h-3.5 w-3.5" aria-hidden="true" />Create invoice</Button>
              </span>
            </div>
          )}
        </div>
      )}

      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading delivery notes" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && rows.length === 0 && (
          <EmptyState
            title={status || search ? "No delivery notes here" : "No delivery notes yet"}
            text={status === "UNINVOICED" ? "Every delivered note has been invoiced." : status || search ? "Try another status or clear the search." : "Make one against a sales order, or for goods that go out before they are invoiced."}
            action={!status && !search && mayAdd ? <Button onClick={onNew}>New delivery note</Button> : undefined}
          />
        )}
        {rows.length > 0 && (
          <DataTable
            caption="Delivery notes"
            rows={rows}
            rowKey={(r) => r._id}
            onRowClick={(r) => onOpen(r._id)}
            columns={[
              selecting && {
                key: "pick", header: <span className="sr-only">Select</span>, card: "hidden", className: "w-10",
                cell: (r) => (
                  <span onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox" className="h-4 w-4 accent-[var(--primary)]" aria-label={`Select ${r.deliveryNoteNo}`}
                      checked={Boolean(picked[r._id])} disabled={!acts(r).invoice} title={acts(r).invoice ? undefined : "This note is against a sales order"}
                      onChange={(e) => pick(r, e.target.checked)}
                    />
                  </span>
                ),
              },
              {
                key: "no", header: "Delivery note", card: "primary",
                cell: (r) => (
                  <>
                    <span className="font-mono text-xs font-semibold">{r.deliveryNoteNo}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {r.source?.kind === "sales_order" ? `Against ${r.source.no}` : r.source?.kind === "quotation" ? `From ${r.source.no}` : r.reference ? `LPO ${r.reference}` : "On its own"}
                    </span>
                  </>
                ),
              },
              { key: "party", header: "Customer", card: "title", className: "font-medium", cell: (r) => r.party?.customerName || "-" },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap text-muted-foreground", cell: (r) => formatDate(r.deliveredAt || r.date) },
              {
                key: "invoice", header: "Invoice", card: "meta", className: "text-muted-foreground",
                cell: (r) => (
                  <>
                    {invoiceText(r) || "-"}
                    {r.clock && <Pill tone={CLOCK_TONE[r.clock.clock]} className="ms-2 max-w-64 whitespace-normal text-start">{clockText(r.clock)}</Pill>}
                  </>
                ),
              },
              { key: "amount", header: "Value", align: "end", card: "amount", className: "whitespace-nowrap font-medium tabular-nums", cell: (r) => formatNumber(r.totalAmount, 2) },
              { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={statusTone(r.status)}>{statusLabel(r.status)}</Pill> },
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
        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </span>
          </nav>
        )}
      </Panel>

      {dialog === "invoice" && <InvoiceDialog notes={chosen} busy={action.busy} problem={action.problem} onClose={() => { setDialog(null); action.clear(); }} onConfirm={createInvoice} />}
      {dialog?.remove && (
        <ConfirmDialog danger busy={action.busy} title={`Delete ${dialog.remove.deliveryNoteNo}?`} confirmLabel="Delete draft" onClose={() => setDialog(null)} onConfirm={remove}
          text={dialog.remove.source?.kind === "quotation" ? `The quotation ${dialog.remove.source.no} comes back as accepted.` : "This draft has not left the warehouse. It is removed for good."} />
      )}
    </div>
  );
}
