import React, { useState } from "react";
import { Field, Spinner, Textarea, useAsync } from "../accounting/kit";
import { orderClose } from "../../lib/salesDocumentsApi";
import { formatNumber, formatQty } from "../../utils/format";
import { ActionModal, Note } from "./parts";

// The customer took part of an order and will never take the rest. The server says what closing would do
// (GET .../close-short) and the dialog shows it before anything is changed: which lines fell short, and what
// happens to the order - a draft is cut down to what was delivered, an invoiced order is left as it is and
// put right with a sales return.

const REASONS = ["Customer cancelled the rest", "Customer found another supplier", "We cannot supply the rest"];

export default function CloseShortDialog({ orderId, orderNo, busy, problem, onClose, onConfirm }) {
  const preview = useAsync(() => orderClose.preview(orderId), [orderId]);
  const [reason, setReason] = useState("");
  const p = preview.data;
  const ready = Boolean(p) && reason.trim().length >= 3;

  return (
    <ActionModal
      size="lg" title={`Close ${orderNo} short`} confirmLabel="Close order short" busy={busy}
      disabled={!ready} problem={preview.error || problem} onClose={onClose} onConfirm={() => onConfirm({ reason: reason.trim() })}
      description="The customer will not take the rest of this order."
    >
      {preview.loading && !p && <Spinner label="Checking the order" />}
      {p && (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="table-stack w-full text-sm">
              <caption className="sr-only">Quantities not delivered</caption>
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">Item</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">Ordered</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">Delivered</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">Not delivered</th>
                </tr>
              </thead>
              <tbody>
                {p.lines.map((l) => (
                  <tr key={l.lineId} className="border-t border-border">
                    <td data-label="Item" className="px-3 py-2 font-medium">{l.description}</td>
                    <td data-label="Ordered" className="px-3 py-2 text-end tabular-nums">{formatQty(l.ordered)}</td>
                    <td data-label="Delivered" className="px-3 py-2 text-end tabular-nums">{formatQty(l.delivered)}</td>
                    <td data-label="Not delivered" className="px-3 py-2 text-end font-semibold tabular-nums">{formatQty(l.short)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {p.mode === "trim" ? (
            <Note>
              {orderNo} is not invoiced yet. It will be cut down to what was delivered, so the invoice charges only for those goods:
              {" "}the total goes from AED {formatNumber(p.order.totalAmount, 2)} to AED {formatNumber(p.newTotal, 2)}.
              {" "}You can put the order back with Reopen until it is approved.
            </Note>
          ) : (
            <Note tone="warning">
              {orderNo} is already invoiced in full, and its stock and accounts are booked. Closing it changes none of that; it records that the
              {" "}rest will not be delivered. Then raise a sales return for the items above (about AED {formatNumber(p.valueShort, 2)} with VAT), which
              {" "}puts them back in stock and credits the customer.
            </Note>
          )}

          <Field label="Why will the rest not be delivered?" required hint="This is kept in the audit trail.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} data-autofocus />
          </Field>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Common reasons">
            {REASONS.map((r) => (
              <button
                key={r} type="button" onClick={() => setReason(r)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
    </ActionModal>
  );
}
