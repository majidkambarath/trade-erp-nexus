import React, { useState } from "react";
import { DateInput, Field, TextInput } from "../accounting/kit";
import { ActionModal, Note } from "../salesDocs/parts";
import { tradeOrders } from "../../lib/orderDocumentsApi";
import { createThenApprove, invoiceConfirmLabel, invoiceNote } from "../../lib/invoiceFlow";
import { todayInput } from "../../utils/format";
import { useDocumentAction } from "./hooks";
import ApproveNow from "./ApproveNow";

// "Create the invoice" for an order, from its own screen or from a row in the list.
//
// `whole` is a sales order in an organisation WITHOUT delivery notes: nothing is ever delivered against it, so the
// whole order becomes one DRAFT invoice (the server decides which path it is; this only words it). The tick to
// approve straight away is OFF there - the person asked for a draft to look over on the Invoices page - and ON
// where the invoice is made from what was delivered or received, as it always was.
export default function OrderInvoiceDialog({ order, kind, whole = false, notify, onClose, onDone }) {
  const sales = kind === "sales";
  const [form, setForm] = useState({ date: todayInput(), vendorInvoiceNo: "", approveNow: !whole });
  const action = useDocumentAction({ notify });

  const submit = async () => {
    const out = await action.run(
      () =>
        createThenApprove(
          (body) => tradeOrders.invoice(order._id, body),
          { date: form.date, approveNow: form.approveNow, ...(sales ? {} : { vendorInvoiceNo: form.vendorInvoiceNo }) },
          (r) => r.invoice
        ),
      (r) => invoiceNote(r.invoice.transactionNo, order.orderNo, r.approval),
      { refresh: false }
    );
    if (out) onDone?.(out);
  };

  return (
    <ActionModal
      title={whole ? `Convert ${order.orderNo} to an invoice?` : `Create the invoice for ${order.orderNo}?`}
      confirmLabel={whole && !form.approveNow ? "Create draft invoice" : invoiceConfirmLabel(form.approveNow)}
      busy={action.busy}
      problem={action.problem}
      onClose={onClose}
      description={
        whole
          ? `${order.orderNo} becomes a draft sales invoice with the same lines, prices and discounts. The invoice carries the order number.`
          : `One invoice for everything ${sales ? "delivered" : "received"} on this order and not yet invoiced.`
      }
      onConfirm={submit}
    >
      <Field label="Invoice date"><DateInput value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
      {!sales && (
        <Field label="Vendor's invoice number" hint="As printed on the vendor's invoice. It is kept on the purchase invoice as the vendor reference.">
          <TextInput value={form.vendorInvoiceNo} onChange={(e) => setForm((f) => ({ ...f, vendorInvoiceNo: e.target.value }))} />
        </Field>
      )}
      <ApproveNow value={form.approveNow} onChange={(approveNow) => setForm((f) => ({ ...f, approveNow }))} />
      {whole && <Note>Approving the invoice is what moves stock and posts to the books. It stays a draft until then.</Note>}
    </ActionModal>
  );
}
