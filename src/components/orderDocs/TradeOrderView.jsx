import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, Check, FileText, Lock, Pencil, RotateCcw, Trash2, Truck } from "lucide-react";
import InvoiceScreen from "../PurchaseOrder/shared/InvoiceScreen";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { DateInput, ErrorNote, Field, Panel, Pill, Spinner, Textarea, TextInput, useAsync } from "../accounting/kit";
import { tradeOrders } from "../../lib/orderDocumentsApi";
import { allowOrderActions, orderStatusLabel, progressTone } from "../../lib/orderDocuments";
import { formatQty, todayInput } from "../../utils/format";
import { buildTradeOrderDocument } from "./documents";
import { ActionModal, ActivityList, Note } from "../salesDocs/parts";
import { useDocumentAction } from "./hooks";
import { useOrganisation } from "../shell/OrganisationContext";
import { orgCurrency } from "../../utils/orgLocale";

const TB = "inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 lg:h-10";
const PRIMARY = "erp-btn-primary";

// One order: the page the other side gets, the actions that move it along, how far it has got, and what has happened to it.
// Which actions exist comes from the server (order.actions), so a rule is decided in one place.
export default function TradeOrderView({ kind, id, onBack, onEdit, onChanged, notify }) {
  const sales = kind === "sales";
  const navigate = useNavigate();
  const { me } = useOrganisation();
  const company = useCompanyProfile();
  const currency = orgCurrency();
  const { data: order, loading, error, reload } = useAsync(() => tradeOrders.get(id), [id]);
  const activity = useAsync(() => tradeOrders.activity(id), [id]);
  const [dialog, setDialog] = useState(null); // confirm | cancel | close | reopen | invoice | delete
  const [form, setForm] = useState({ reason: "", date: todayInput(), vendorInvoiceNo: "" });

  const refresh = async () => {
    await Promise.all([reload(), activity.reload()]);
    onChanged?.();
  };
  const action = useDocumentAction({ notify, reload: refresh });
  const open = (name) => { setForm({ reason: "", date: todayInput(), vendorInvoiceNo: "" }); action.clear(); setDialog(name); };
  const close = () => { setDialog(null); action.clear(); };

  const doc = useMemo(() => (order ? buildTradeOrderDocument(order, order.party || {}, company, currency) : null), [order, company, currency]);

  if (loading && !order) return <div className="p-8"><Spinner label="Loading order" /></div>;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorNote error={error} onRetry={reload} /></div>;
  if (!order) return null;

  const A = allowOrderActions(order.actions, me, kind);
  const finish = async (promise, message, after) => {
    const out = await action.run(() => promise(), message, { refresh: !after });
    if (out) { close(); after?.(out); }
  };

  // The one thing most likely to be wanted next gets the strong button.
  const next = A.confirm ? "confirm" : A.receive ? "receive" : A.invoice ? "invoice" : null;
  const btn = (name, label, Icon, onClick) => (
    <button key={name} type="button" onClick={onClick} className={next === name ? PRIMARY : TB}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
  const invoicePage = (no) => navigate(`/${sales ? "sales-order" : "purchase-order"}?search=${encodeURIComponent(no)}`);

  const actions = (
    <>
      {A.edit && btn("edit", "Edit", Pencil, () => onEdit(order._id))}
      {A.confirm && btn("confirm", "Confirm order", Check, () => open("confirm"))}
      {A.receive && sales && btn("receive", "Create delivery note", Truck, () => navigate(`/delivery-notes?tradeOrder=${order._id}`))}
      {A.receive && !sales && btn("receive", "Receive goods", Truck, () => navigate(`/goods-received?order=${order._id}`))}
      {A.invoice && btn("invoice", "Create invoice", FileText, () => open("invoice"))}
      {A.close && btn("close", "Close order", Lock, () => open("close"))}
      {A.reopen && btn("reopen", "Reopen", RotateCcw, () => open("reopen"))}
      {A.cancel && btn("cancel", "Cancel order", Ban, () => open("cancel"))}
      {A.delete && btn("delete", "Delete", Trash2, () => open("delete"))}
    </>
  );

  const p = order.progress;
  const lineRows = (order.items || []).map((l) => ({ line: l, p: p.lines[String(l._id)] || {} }));
  const got = sales ? "Delivered" : "Received";
  const banner = (
    <div className="space-y-2">
      {order.status === "DRAFT" && <Note>A draft order posts nothing and cannot be {sales ? "delivered against" : "received against"} until it is confirmed.</Note>}
      {["CONFIRMED", "CLOSED"].includes(order.status) && (
        <Note>
          <Pill tone={progressTone(p.label)} className="me-2">{p.label}</Pill>
          Nothing is in the accounts yet: stock and the ledger move when the invoice made from what was {sales ? "delivered" : "received"} is approved.
        </Note>
      )}
      {order.status === "CLOSED" && order.closeReason && <Note>Closed: {order.closeReason}</Note>}
      {order.status === "CANCELLED" && order.cancelReason && <Note>Cancelled: {order.cancelReason}</Note>}
    </div>
  );

  const footer = (
    <div className="space-y-5">
      {["CONFIRMED", "CLOSED"].includes(order.status) && (
        <Panel title="Progress" description={`What has been ${got.toLowerCase()} and invoiced against each line.`} bodyClassName="p-0">
          <div className="erp-scroll table-pin-first overflow-x-auto">
            <table className="w-full text-sm" aria-label="Progress by line">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">Item</th>
                  <th className="px-3 py-2 text-end">Ordered</th>
                  <th className="px-3 py-2 text-end">{got}</th>
                  <th className="px-3 py-2 text-end">On draft {sales ? "notes" : "receipts"}</th>
                  <th className="px-3 py-2 text-end">Invoiced</th>
                  <th className="px-3 py-2 text-end">Left to {sales ? "deliver" : "receive"}</th>
                </tr>
              </thead>
              <tbody>
                {lineRows.map(({ line, p: lp }) => (
                  <tr key={line._id} className="border-t border-border">
                    <td className="px-3 py-2"><span className="font-medium">{line.description}</span>{line.itemCode && <span className="block text-xs text-muted-foreground">{line.itemCode}</span>}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatQty(lp.ordered ?? line.qty, 3)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatQty(lp.received ?? 0, 3)}</td>
                    <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{formatQty(lp.onTheWay ?? 0, 3)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatQty(lp.invoiced ?? 0, 3)}</td>
                    <td className="px-3 py-2 text-end font-medium tabular-nums">{formatQty(lp.toReceive ?? 0, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Panel title="Activity" description="Everything that has been done to this order, and by whom.">
        {activity.loading && !activity.data ? <Spinner label="Loading activity" /> : <ActivityList rows={activity.data?.rows} />}
      </Panel>
    </div>
  );

  return (
    <>
      <InvoiceScreen
        sheet={doc.sheet}
        fileName={doc.fileName}
        status={order.status}
        statusLabel={orderStatusLabel(order.status)}
        onBack={onBack}
        actions={actions}
        banner={banner}
        footer={footer}
        auditId={null}
      />

      {dialog === "confirm" && (
        <ActionModal
          title={`Confirm ${order.orderNo}?`} confirmLabel="Confirm order" busy={action.busy} problem={action.problem} onClose={close}
          description="Confirming makes it a commitment. It can no longer be edited, and goods can be received or delivered against it. Nothing is posted."
          onConfirm={() => finish(() => tradeOrders.confirm(order._id), `${order.orderNo} confirmed`)}
        />
      )}
      {dialog === "invoice" && (
        <ActionModal
          title={`Create the invoice for ${order.orderNo}?`} confirmLabel={sales ? "Create sales invoice" : "Create purchase invoice"} busy={action.busy} problem={action.problem} onClose={close}
          description={`One draft invoice for everything ${sales ? "delivered" : "received"} on this order and not yet invoiced. It posts nothing until you approve it.`}
          onConfirm={() =>
            finish(
              () => tradeOrders.invoice(order._id, { date: form.date, ...(sales ? {} : { vendorInvoiceNo: form.vendorInvoiceNo }) }),
              (r) => `${r.invoice.transactionNo} created from ${order.orderNo}`,
              (r) => { onChanged?.(); invoicePage(r.invoice.transactionNo); }
            )
          }
        >
          <Field label="Invoice date"><DateInput value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
          {!sales && (
            <Field label="Vendor's invoice number" hint="As printed on the vendor's invoice. It is kept on the purchase invoice as the vendor reference.">
              <TextInput value={form.vendorInvoiceNo} onChange={(e) => setForm((f) => ({ ...f, vendorInvoiceNo: e.target.value }))} />
            </Field>
          )}
        </ActionModal>
      )}
      {(dialog === "close" || dialog === "cancel") && (
        <ActionModal
          title={dialog === "close" ? `Close ${order.orderNo}?` : `Cancel ${order.orderNo}?`}
          confirmLabel={dialog === "close" ? "Close order" : "Cancel order"} danger={dialog === "cancel"} busy={action.busy} problem={action.problem} onClose={close}
          description={dialog === "close" ? `Nothing more will be ${sales ? "delivered" : "received"} on it. What already arrived can still be invoiced, and it can be reopened.` : "It never went ahead. This cannot be undone."}
          onConfirm={() => finish(() => (dialog === "close" ? tradeOrders.close : tradeOrders.cancel)(order._id, { reason: form.reason }), `${order.orderNo} ${dialog === "close" ? "closed" : "cancelled"}`)}
        >
          <Field label="Reason (optional)"><Textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></Field>
        </ActionModal>
      )}
      {dialog === "reopen" && (
        <ActionModal
          title={`Reopen ${order.orderNo}?`} confirmLabel="Reopen" busy={action.busy} problem={action.problem} onClose={close}
          description={`It becomes a confirmed order again, and what is left can be ${sales ? "delivered" : "received"}.`}
          onConfirm={() => finish(() => tradeOrders.reopen(order._id), `${order.orderNo} reopened`)}
        />
      )}
      {dialog === "delete" && (
        <ActionModal
          title={`Delete ${order.orderNo}?`} confirmLabel="Delete draft" danger busy={action.busy} problem={action.problem} onClose={close}
          description="This draft has not been confirmed. It is removed for good."
          onConfirm={() => finish(() => tradeOrders.remove(order._id), `${order.orderNo} deleted`, () => onBack())}
        />
      )}
    </>
  );
}
