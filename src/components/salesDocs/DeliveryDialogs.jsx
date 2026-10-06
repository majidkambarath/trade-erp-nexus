import React, { useState } from "react";
import { DateInput, Field, Textarea, TextInput } from "../accounting/kit";
import { deliverForm, deliverPayload, invoiceBlocker, shortBy, validateDeliver } from "../../lib/salesDocuments";
import { formatDate, formatNumber, todayInput, toInputDate } from "../../utils/format";
import { cn } from "../../lib/utils";
import { ActionModal, Note } from "./parts";

// The four things done to a delivery note that need a few answers first.

const numInput = "h-11 w-full rounded-lg border border-input bg-background px-3 text-end text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-[invalid=true]:border-status-danger lg:h-9";

// Who is taking it, in what. Nothing is required: the note can be dispatched with the vehicle still to be decided.
export function DispatchDialog({ note, busy, problem, onClose, onConfirm }) {
  const [f, setF] = useState({ vehicleNo: note.vehicleNo || "", driverName: note.driverName || "", driverPhone: note.driverPhone || "" });
  return (
    <ActionModal
      title={`Dispatch ${note.deliveryNoteNo}`} confirmLabel="Dispatch" busy={busy} problem={problem} onClose={onClose}
      description="The goods leave the warehouse. The note can no longer be edited."
      onConfirm={() => onConfirm(f)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vehicle"><TextInput value={f.vehicleNo} onChange={(e) => setF({ ...f, vehicleNo: e.target.value })} placeholder="e.g. DXB A 12345" /></Field>
        <Field label="Driver"><TextInput value={f.driverName} onChange={(e) => setF({ ...f, driverName: e.target.value })} /></Field>
        <Field label="Driver phone" className="sm:col-span-2"><TextInput value={f.driverPhone} onChange={(e) => setF({ ...f, driverPhone: e.target.value })} inputMode="tel" /></Field>
      </div>
      <Note>Dispatching moves no stock. Stock leaves when the invoice for these goods is approved.</Note>
    </ActionModal>
  );
}

// The customer signed. What they actually took is entered line by line, and starts as "all of it", so only
// the exceptions are typed. The note is then worth what was accepted, and that is what gets invoiced.
export function DeliverDialog({ note, busy, problem, onClose, onConfirm }) {
  const [form, setForm] = useState(() => deliverForm(note));
  const [errors, setErrors] = useState(null);
  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const submit = () => {
    const found = validateDeliver(form, { noteDate: toInputDate(note.date) });
    setErrors(found);
    if (!found) onConfirm(deliverPayload(form));
  };

  return (
    <ActionModal
      size="lg" title={`Confirm delivery of ${note.deliveryNoteNo}`} confirmLabel="Mark delivered" busy={busy} problem={problem} onClose={onClose} onConfirm={submit}
      description="Record who signed for the goods and what they accepted. Change a quantity only where it differs."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Received by" required error={errors?.receivedBy} hint="Name of the person who signed.">
          <TextInput value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} data-autofocus />
        </Field>
        <Field label="Delivered on" required error={errors?.deliveredAt}>
          <DateInput value={form.deliveredAt} onChange={(e) => setForm({ ...form, deliveredAt: e.target.value })} />
        </Field>
        <Field label="Proof note" hint="Optional: stamp, gate pass, photo reference.">
          <TextInput value={form.proofNote} onChange={(e) => setForm({ ...form, proofNote: e.target.value })} />
        </Field>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="table-stack w-full text-sm">
          <caption className="sr-only">Quantities delivered</caption>
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Item</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">Sent</th>
              <th scope="col" className="w-32 px-3 py-2 text-end font-semibold">Delivered</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">If short, why</th>
            </tr>
          </thead>
          <tbody>
            {form.lines.map((l, i) => {
              const short = shortBy(l) > 0;
              const bad = errors?.lines?.[i];
              return (
                <tr key={l.lineId} className="border-t border-border align-top">
                  <td data-label="Item" className="px-3 py-2 font-medium">{l.description}</td>
                  <td data-label="Sent" className="px-3 py-2 text-end tabular-nums">{l.qty}</td>
                  <td data-label="Delivered" className="px-3 py-2">
                    <input
                      type="number" inputMode="decimal" min="0" step="any" aria-label={`Delivered quantity of ${l.description}`} aria-invalid={bad ? true : undefined}
                      value={l.deliveredQty} onChange={(e) => setLine(i, { deliveredQty: e.target.value })} className={numInput}
                    />
                  </td>
                  <td data-label="If short, why" className="px-3 py-2">
                    <TextInput
                      aria-label={`Reason for the shortage of ${l.description}`} disabled={!short} value={short ? l.shortReason : ""} placeholder={short ? "e.g. 2 cartons damaged" : "-"}
                      onChange={(e) => setLine(i, { shortReason: e.target.value })} aria-invalid={bad && short ? true : undefined}
                    />
                    {bad && <p className="mt-1 text-xs font-medium text-status-danger">{bad}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {errors?.nothing && <Note tone="danger">{errors.nothing}</Note>}
    </ActionModal>
  );
}

export function CancelDialog({ note, busy, problem, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <ActionModal
      title={`Cancel ${note.deliveryNoteNo}?`} confirmLabel="Cancel delivery note" danger busy={busy} problem={problem} onClose={onClose}
      description="The goods are not going. The quantities go back to the order they were taken from."
      onConfirm={() => onConfirm({ reason })}
    >
      <Field label="Reason" hint="Optional."><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </ActionModal>
  );
}

// One draft invoice for one or several delivered notes of a customer. Each line is invoiced at the quantity
// accepted, at the tax rates of the invoice date. It is approved like any other sales order.
export function InvoiceDialog({ notes, busy, problem, onClose, onConfirm }) {
  const [date, setDate] = useState(todayInput());
  const blocker = invoiceBlocker(notes);
  const total = notes.reduce((t, n) => t + (n.totalAmount || 0), 0);
  const oldest = [...notes].sort((a, b) => new Date(a.deliveredAt) - new Date(b.deliveredAt))[0];
  return (
    <ActionModal
      size="md" title={notes.length === 1 ? `Invoice ${notes[0].deliveryNoteNo}` : `Invoice ${notes.length} delivery notes`} confirmLabel="Create sales order"
      busy={busy} disabled={Boolean(blocker)} problem={problem} onClose={onClose} onConfirm={() => onConfirm({ deliveryNoteIds: notes.map((n) => n._id), date })}
      description="A draft sales order is made with the goods that were delivered. Stock and ledger move when you approve it."
    >
      {blocker ? (
        <Note tone="danger">{blocker}</Note>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {notes.map((n) => (
              <li key={n._id} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span className="min-w-0"><span className="font-mono text-xs font-semibold">{n.deliveryNoteNo}</span><span className="ms-2 text-muted-foreground">{n.party?.customerName} · delivered {formatDate(n.deliveredAt)}</span></span>
                <span className={cn("shrink-0 tabular-nums")}>{formatNumber(n.totalAmount, 2)}</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between px-3 py-2 font-semibold"><span>Total, before the invoice date's tax rates apply</span><span className="tabular-nums">{formatNumber(total, 2)}</span></li>
          </ul>
          <Field label="Invoice date" hint={oldest ? `The oldest delivery here was on ${formatDate(oldest.deliveredAt)}.` : undefined}>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {notes.length > 1 && <Note>One summary invoice for several deliveries is allowed within 14 days of the end of the month in which they were made.</Note>}
        </>
      )}
    </ActionModal>
  );
}
