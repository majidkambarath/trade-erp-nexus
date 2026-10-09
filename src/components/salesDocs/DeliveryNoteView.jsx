import React, { useMemo, useState } from "react";
import { ClipboardList, FileText, Pencil, PackageCheck, Trash2, Truck, X, FileCheck2 } from "lucide-react";
import InvoiceScreen from "../PurchaseOrder/shared/InvoiceScreen";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { ConfirmDialog, ErrorNote, Panel, Spinner, useAsync } from "../accounting/kit";
import { deliveryNotes } from "../../lib/salesDocumentsApi";
import { CLOCK_TONE, clockText, statusLabel } from "../../lib/salesDocuments";
import { formatDate, formatQty } from "../../utils/format";
import { buildDeliveryNoteDocument, buildPickListDocument } from "./documents";
import { CancelDialog, DeliverDialog, DispatchDialog, InvoiceDialog } from "./DeliveryDialogs";
import { ActivityList, DocLink, Note } from "./parts";
import { useDocumentAction } from "./hooks";
import { useOrganisation } from "../shell/OrganisationContext";
import { allowActions } from "../../lib/salesDocuments";
import { orgCurrency } from "../../utils/orgLocale";

const TB = "inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 lg:h-10";
const PRIMARY = "erp-btn-primary";

// One delivery note: the sheet that travels with the goods (or the warehouse's pick list), the actions that
// move it along, and what the order it serves has had delivered so far.
export default function DeliveryNoteView({ id, onBack, onEdit, onChanged, onInvoiced, notify }) {
  const { me } = useOrganisation();
  const company = useCompanyProfile();
  const currency = orgCurrency();
  const { data: dn, loading, error, reload } = useAsync(() => deliveryNotes.get(id), [id]);
  const activity = useAsync(() => deliveryNotes.activity(id), [id]);
  const [mode, setMode] = useState("note"); // note | pick
  const pick = useAsync(() => (mode === "pick" ? deliveryNotes.pickList(id) : Promise.resolve(null)), [id, mode]);
  const [showPrices, setShowPrices] = useState(false);
  const [dialog, setDialog] = useState(null); // dispatch | deliver | cancel | invoice | delete

  const refresh = async () => {
    await Promise.all([reload(), activity.reload()]);
    onChanged?.();
  };
  const action = useDocumentAction({ notify, reload: refresh });
  const open = (name) => { action.clear(); setDialog(name); };
  const close = () => { setDialog(null); action.clear(); };

  const doc = useMemo(() => {
    if (!dn) return null;
    const customer = dn.party || {};
    if (mode === "pick" && pick.data) return buildPickListDocument(pick.data, dn, customer, company);
    return buildDeliveryNoteDocument(dn, customer, company, currency, { showPrices });
  }, [dn, mode, pick.data, company, currency, showPrices]);

  if (loading && !dn) return <div className="p-8"><Spinner label="Loading delivery note" /></div>;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorNote error={error} onRetry={reload} /></div>;
  if (!dn || !doc) return <div className="p-8"><Spinner label="Preparing the document" /></div>;

  const A = allowActions(dn.actions, me);
  const finish = async (fn, message, after) => {
    const out = await action.run(fn, message, { refresh: !after });
    if (out) { close(); after?.(out); }
  };
  const next = A.dispatch ? "dispatch" : A.deliver ? "deliver" : A.invoice ? "invoice" : null;
  const btn = (name, label, Icon, onClick) => (
    <button key={name} type="button" onClick={onClick} className={next === name ? PRIMARY : TB}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );

  const actions = (
    <>
      {A.edit && btn("edit", "Edit", Pencil, () => onEdit(dn))}
      {A.dispatch && btn("dispatch", "Dispatch", Truck, () => open("dispatch"))}
      {A.deliver && btn("deliver", "Mark delivered", PackageCheck, () => open("deliver"))}
      {A.invoice && btn("invoice", "Create invoice", FileText, () => open("invoice"))}
      {["DRAFT", "DISPATCHED"].includes(dn.status) &&
        btn("pick", mode === "pick" ? "Delivery note" : "Pick list", mode === "pick" ? FileCheck2 : ClipboardList, () => setMode(mode === "pick" ? "note" : "pick"))}
      {A.cancel && btn("cancel", "Cancel", X, () => open("cancel"))}
      {A.delete && btn("delete", "Delete", Trash2, () => open("delete"))}
    </>
  );

  const clock = dn.clock;
  const onSourceOrder = dn.source?.kind === "sales_order" && Boolean(dn.source.no) && dn.invoice?.no === dn.source.no;
  const banner = (
    <div className="space-y-2">
      {clock && (
        <Note tone={CLOCK_TONE[clock.clock] === "success" ? "info" : CLOCK_TONE[clock.clock]}>
          <span className="font-semibold">{clockText(clock)}.</span>{" "}
          Delivered {formatDate(clock.deliveredDay)}; the tax invoice is due by {formatDate(clock.standardDue)}, or, as one summary invoice for the month's deliveries, by {formatDate(clock.summaryDue)}.
        </Note>
      )}
      {dn.status === "DELIVERED" && dn.invoiceStatus === "NONE" && (
        <Note>Until this is invoiced the goods are still on hand in the books. They are counted as promised, so they cannot be sold twice.</Note>
      )}
      {/* a note against an order is invoiced by that same order, so one sentence says both */}
      {onSourceOrder ? (
        <Note>
          Delivered against sales order <DocLink kind="sales_order" no={dn.source.no} /> ({dn.invoiceStatus === "INVOICED" ? "approved and invoiced" : dn.sourceOrder?.status.toLowerCase() || "draft"}).
          {dn.invoiceStatus !== "INVOICED" && " Approve it to book the sale and take the goods out of stock."}
        </Note>
      ) : (
        <>
          {dn.invoiceStatus === "DRAFT" && dn.invoice?.no && (
            <Note>Draft invoice <DocLink kind="sales_order" no={dn.invoice.no} />. Approve it to book the sale and take the goods out of stock.</Note>
          )}
          {dn.invoiceStatus === "INVOICED" && dn.invoice?.no && (
            <Note>Invoiced on <DocLink kind="sales_order" no={dn.invoice.no} />.</Note>
          )}
        </>
      )}
      {dn.source?.kind === "quotation" && <Note>From quotation <DocLink kind="quotation" no={dn.source.no} />.</Note>}
      {dn.status === "CANCELLED" && dn.cancelReason && <Note>Cancelled: {dn.cancelReason}</Note>}
      {mode === "note" && dn.status !== "CANCELLED" && (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
          Show prices on the printed note
        </label>
      )}
      {mode === "pick" && pick.loading && <Spinner label="Working out the batches" />}
      {mode === "pick" && pick.error && <ErrorNote error={pick.error} onRetry={pick.reload} />}
    </div>
  );

  const progress = dn.fulfilment && dn.sourceOrder?.lines ? dn.sourceOrder.lines : null;
  const footer = (
    <>
      {progress && (
        <Panel title={`Order progress: ${dn.sourceOrder.no}`} description="How much of each line has gone out on every delivery note against this order.">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="table-stack w-full text-sm">
              <caption className="sr-only">Order progress</caption>
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">Item</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">Ordered</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">Delivered</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">Being delivered</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">Still to deliver</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((l) => {
                  const f = dn.fulfilment[String(l.lineId)];
                  if (!f) return null;
                  return (
                    <tr key={l.lineId} className="border-t border-border">
                      <td data-label="Item" className="px-3 py-2 font-medium">{l.description}</td>
                      <td data-label="Ordered" className="px-3 py-2 text-end tabular-nums">{formatQty(f.ordered, 3)}</td>
                      <td data-label="Delivered" className="px-3 py-2 text-end tabular-nums">{formatQty(f.delivered, 3)}</td>
                      <td data-label="Being delivered" className="px-3 py-2 text-end tabular-nums">{formatQty(f.pending, 3)}</td>
                      <td data-label="Still to deliver" className="px-3 py-2 text-end tabular-nums">
                        {f.over ? <span className="font-medium text-status-warning">More than ordered</span> : formatQty(f.remaining, 3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Panel title="Activity" description="Everything that has been done to this delivery note, and by whom.">
        {activity.loading && !activity.data ? <Spinner label="Loading activity" /> : <ActivityList rows={activity.data?.rows} />}
      </Panel>
    </>
  );

  return (
    <>
      <InvoiceScreen
        sheet={doc.sheet}
        fileName={doc.fileName}
        status={dn.status}
        statusLabel={statusLabel(dn.status)}
        copies={doc.copies}
        onBack={onBack}
        actions={actions}
        banner={banner}
        footer={<div className="space-y-5">{footer}</div>}
      />

      {dialog === "dispatch" && <DispatchDialog note={dn} busy={action.busy} problem={action.problem} onClose={close} onConfirm={(body) => finish(() => deliveryNotes.dispatch(dn._id, body), `${dn.deliveryNoteNo} dispatched`)} />}
      {dialog === "deliver" && <DeliverDialog note={dn} busy={action.busy} problem={action.problem} onClose={close} onConfirm={(body) => finish(() => deliveryNotes.deliver(dn._id, body), `${dn.deliveryNoteNo} delivered`)} />}
      {dialog === "cancel" && <CancelDialog note={dn} busy={action.busy} problem={action.problem} onClose={close} onConfirm={(body) => finish(() => deliveryNotes.cancel(dn._id, body), `${dn.deliveryNoteNo} cancelled`)} />}
      {dialog === "invoice" && (
        <InvoiceDialog
          notes={[{ ...dn, party: dn.party }]} busy={action.busy} problem={action.problem} onClose={close}
          onConfirm={(body) => finish(() => deliveryNotes.invoice(body), (r) => `${r.salesOrder.transactionNo} created from ${dn.deliveryNoteNo}`, (r) => onInvoiced?.(r.salesOrder))}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          danger busy={action.busy} title={`Delete ${dn.deliveryNoteNo}?`} confirmLabel="Delete draft" onClose={close}
          text={dn.source?.kind === "quotation" ? `The quotation ${dn.source.no} comes back as accepted.` : "This draft has not left the warehouse. It is removed for good."}
          onConfirm={() => finish(() => deliveryNotes.remove(dn._id), `${dn.deliveryNoteNo} deleted`, () => onBack())}
        />
      )}
    </>
  );
}
