import React, { useState } from "react";
import { DateInput, Field, Textarea, TextInput } from "../accounting/kit";
import { ActionModal, Note } from "../salesDocs/parts";
import { formatDate, formatNumber, formatQty, todayInput, CURRENCY } from "../../utils/format";
import { receiptInvoiceBlocker, receivePayload, receiveRows, validateReceive } from "../../lib/orderDocuments";
import { invoiceConfirmLabel } from "../../lib/invoiceFlow";
import ApproveNow from "./ApproveNow";
import { taxWord } from "../../lib/taxTerms";

const numInput = "h-11 w-full rounded-lg border border-input bg-background px-3 text-end text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-[invalid=true]:border-status-danger lg:h-9";

// The goods turned up: who took them in, and what actually arrived against what was expected. A line that came short
// says why; the receipt's value follows what arrived, so the invoice made from it matches the goods.
export function ReceiveDialog({ receipt, busy, problem, onClose, onConfirm }) {
  const [rows, setRows] = useState(() => receiveRows(receipt));
  const [header, setHeader] = useState({ receivedBy: "", receivedAt: todayInput(), vendorDeliveryNo: receipt.vendorDeliveryNo || "", proofNote: "" });
  const [errors, setErrors] = useState(null);
  const setRow = (i, patch) => { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))); setErrors(null); };

  const confirm = () => {
    const found = validateReceive(rows, header);
    setErrors(found);
    if (!found) onConfirm(receivePayload(rows, header));
  };

  return (
    <ActionModal
      size="lg" title={`Receive ${receipt.receiptNo}`} confirmLabel="Confirm goods received" busy={busy} problem={problem} onClose={onClose} onConfirm={confirm}
      description="Record who took the goods in and what actually arrived. Nothing is posted: the purchase invoice made from this does that."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Received by" required error={errors?.receivedBy}>
          <TextInput value={header.receivedBy} onChange={(e) => setHeader((h) => ({ ...h, receivedBy: e.target.value }))} data-autofocus placeholder="Name of the person who took the goods in" />
        </Field>
        <Field label="Date received" required><DateInput value={header.receivedAt} max={todayInput()} onChange={(e) => setHeader((h) => ({ ...h, receivedAt: e.target.value }))} /></Field>
        <Field label="Vendor delivery note / invoice no." className="sm:col-span-2">
          <TextInput value={header.vendorDeliveryNo} onChange={(e) => setHeader((h) => ({ ...h, vendorDeliveryNo: e.target.value }))} />
        </Field>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="table-stack w-full text-sm">
          <caption className="sr-only">What arrived</caption>
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Item</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">Expected</th>
              <th scope="col" className="w-28 px-3 py-2 text-end font-semibold">Received</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">If short, why</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Batch</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Expiry</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.lineId} className="border-t border-border align-top">
                <td data-label="Item" className="px-3 py-2"><span className="font-medium">{r.description}</span>{r.itemCode && <span className="block text-xs text-muted-foreground">{r.itemCode}</span>}</td>
                <td data-label="Expected" className="px-3 py-2 text-end tabular-nums">{formatQty(r.expected, 3)}</td>
                <td data-label="Received" className="px-3 py-2">
                  <input
                    type="number" inputMode="decimal" min="0" step="any" value={r.received}
                    aria-label={`Quantity of ${r.description} received`} aria-invalid={errors?.[i] ? true : undefined}
                    onChange={(e) => setRow(i, { received: e.target.value })} className={numInput}
                  />
                  {errors?.[i] && <p className="mt-1 text-xs font-medium text-status-danger">{errors[i]}</p>}
                </td>
                <td data-label="If short, why" className="px-3 py-2">
                  <TextInput value={r.shortReason} onChange={(e) => setRow(i, { shortReason: e.target.value })} aria-label={`Why ${r.description} came short`} placeholder="Damaged, not sent…" />
                </td>
                <td data-label="Batch" className="px-3 py-2"><TextInput value={r.batchNumber} onChange={(e) => setRow(i, { batchNumber: e.target.value })} aria-label={`Batch of ${r.description}`} /></td>
                <td data-label="Expiry" className="px-3 py-2"><DateInput value={r.expiryDate} onChange={(e) => setRow(i, { expiryDate: e.target.value })} aria-label={`Expiry of ${r.description}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {errors?.none && <p role="alert" className="text-sm font-medium text-status-danger">{errors.none}</p>}

      <Field label="Note (optional)"><Textarea rows={2} value={header.proofNote} onChange={(e) => setHeader((h) => ({ ...h, proofNote: e.target.value }))} placeholder="Condition of the goods, who signed the vendor's paper…" /></Field>
    </ActionModal>
  );
}

export function CancelReceiptDialog({ receipt, busy, problem, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <ActionModal
      title={`Cancel ${receipt.receiptNo}?`} confirmLabel="Cancel receipt" danger busy={busy} problem={problem} onClose={onClose}
      description="The goods are not counted as received on the order again. This cannot be undone."
      onConfirm={() => onConfirm({ reason })}
    >
      <Field label="Reason (optional)"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </ActionModal>
  );
}

// One purchase invoice for received goods of the same vendor, at the quantity received and the price agreed.
export function ReceiptInvoiceDialog({ receipts, busy, problem, onClose, onConfirm }) {
  const [date, setDate] = useState(todayInput());
  const [approveNow, setApproveNow] = useState(true);
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState([...new Set(receipts.map((r) => r.vendorDeliveryNo).filter(Boolean))].join(", "));
  const blocker = receiptInvoiceBlocker(receipts);
  const total = receipts.reduce((t, r) => t + (Number(r.totalAmount) || 0), 0);
  return (
    <ActionModal
      size="md" title="Create the purchase invoice" confirmLabel={invoiceConfirmLabel(approveNow)} busy={busy} disabled={Boolean(blocker)} problem={problem} onClose={onClose}
      description="One purchase invoice for the goods below. It cannot bill more than was received."
      onConfirm={() => onConfirm({ receiptIds: receipts.map((r) => r._id), date, vendorInvoiceNo, approveNow })}
    >
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {receipts.map((r) => (
          <li key={r._id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
            <span><span className="font-mono text-xs font-semibold">{r.receiptNo}</span> <span className="text-muted-foreground">· {r.party?.name || "-"} · received {formatDate(r.receivedAt || r.date)}</span></span>
            <span className="tabular-nums">{formatNumber(r.totalAmount, 2)}</span>
          </li>
        ))}
        <li className="flex justify-between px-3 py-2 font-semibold"><span>Total, {taxWord()} included</span><span className="tabular-nums">{CURRENCY} {formatNumber(total, 2)}</span></li>
      </ul>
      {blocker && <Note tone="danger">{blocker}</Note>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice date"><DateInput value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Vendor's invoice number" hint="As printed on the vendor's invoice; kept as the vendor reference.">
          <TextInput value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} />
        </Field>
      </div>
      <ApproveNow value={approveNow} onChange={setApproveNow} />
    </ActionModal>
  );
}
