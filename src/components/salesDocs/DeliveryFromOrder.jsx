import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import axiosInstance from "../../axios/axios";
import { Button } from "../ui/button";
import { DateInput, ErrorNote, Field, PageHeader, Panel, SearchSelect, Spinner, Textarea, TextInput, useAsync } from "../accounting/kit";
import { deliveryNotes } from "../../lib/salesDocumentsApi";
import { orderPayload, orderRows, validateOrderRows } from "../../lib/salesDocuments";
import { formatDate, formatNumber, formatQty, todayInput, toInputDate } from "../../utils/format";
import { Note } from "./parts";

const numInput = "h-11 w-full rounded-lg border border-input bg-background px-3 text-end text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-[invalid=true]:border-status-danger disabled:opacity-50 lg:h-9";

// Orders a note can be made against: still a draft, or already approved (the goods go out after the invoice).
const loadOrders = async (customerId) => {
  const r = await axiosInstance.get("/transactions/transactions", { params: { type: "sales_order", partyId: customerId, limit: 200 } });
  return (r.data?.data || []).filter((t) => ["DRAFT", "APPROVED"].includes(t.status) && !t.isOpening);
};

const headerFrom = (dn) => ({
  date: dn ? toInputDate(dn.date) : todayInput(),
  reference: dn?.reference ?? "", deliveryAddress: dn?.deliveryAddress ?? "", contactPerson: dn?.contactPerson ?? "", contactPhone: dn?.contactPhone ?? "",
  vehicleNo: dn?.vehicleNo ?? "", driverName: dn?.driverName ?? "", driverPhone: dn?.driverPhone ?? "", notes: dn?.notes ?? "",
});

// A delivery note against a sales order. The lines are the order's: the form shows what has been ordered,
// delivered and promised on other notes, and takes only how much goes on THIS one. Price, discount and tax
// stay the order's, so the note can never disagree with the invoice it belongs to.
export default function DeliveryFromOrder({ orderId, editing, customers, onBack, onSaved, notify }) {
  const [customerId, setCustomerId] = useState(editing?.partyId || "");
  const [chosen, setChosen] = useState(orderId || editing?.source?.id || "");
  const [header, setHeader] = useState(() => headerFrom(editing));
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);

  const fixed = Boolean(orderId || editing); // the order is already decided
  const orders = useAsync(() => (customerId && !fixed ? loadOrders(customerId) : Promise.resolve([])), [customerId, fixed]);
  const prefill = useAsync(() => (chosen ? deliveryNotes.fromOrder(chosen) : Promise.resolve(null)), [chosen]);

  // What this note already holds on each line, when it is being edited.
  const own = useMemo(() => (editing ? Object.fromEntries(editing.items.map((l) => [String(l.sourceLineId), l.qty])) : null), [editing]);

  useEffect(() => {
    const p = prefill.data;
    if (!p) { setRows([]); return; }
    setRows(orderRows(p, own));
    // a new note starts from the customer's details; an edited one keeps what it had
    if (!editing) {
      setHeader((h) => ({ ...h, reference: p.order.reference || "", deliveryAddress: p.deliveryAddress || "", contactPerson: p.party?.contactPerson || "", contactPhone: p.party?.phone || "" }));
    }
  }, [prefill.data, own, editing]);

  const customerOptions = useMemo(() => customers.map((c) => ({ value: c._id, label: c.customerName, hint: c.customerId })), [customers]);
  const orderOptions = (orders.data || []).map((o) => ({
    value: o._id, label: o.transactionNo, hint: `${formatDate(o.date)} · ${o.status === "APPROVED" ? "approved" : "draft"} · ${formatNumber(o.totalAmount, 2)}`,
  }));
  const setField = (k) => (e) => setHeader((h) => ({ ...h, [k]: e.target.value }));
  const setQty = (i, qty) => { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, qty } : r))); setErrors(null); };

  const save = async () => {
    const found = validateOrderRows(rows);
    setErrors(found);
    if (found) return;
    setSaving(true);
    setProblem(null);
    try {
      const body = orderPayload(chosen, rows, header);
      const saved = editing ? await deliveryNotes.update(editing._id, body) : await deliveryNotes.create(body);
      notify(`${saved.deliveryNoteNo} ${editing ? "updated" : "created"}`);
      onSaved(saved._id);
    } catch (e) {
      setProblem(e);
    } finally {
      setSaving(false);
    }
  };

  const p = prefill.data;
  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={editing ? `Edit ${editing.deliveryNoteNo}` : "Delivery note against a sales order"}
        description="Deliver all or part of an order. The order's prices, discounts and tax stay as they are."
        actions={<Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</Button>}
      />

      <Panel title="Sales order">
        {fixed && p ? (
          <p className="text-sm">
            <span className="font-mono font-semibold">{p.order.no}</span>
            <span className="text-muted-foreground"> · {p.party.customerName} · {p.order.status === "APPROVED" ? "approved" : "draft"} · {formatDate(p.order.date)}</span>
          </p>
        ) : fixed ? (
          <Spinner label="Loading the order" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" required>
              <SearchSelect options={customerOptions} value={customerId} onChange={(v) => { setCustomerId(v); setChosen(""); }} placeholder="Choose a customer" />
            </Field>
            <Field label="Sales order" required hint={customerId && !orders.loading && !orderOptions.length ? "This customer has no draft or approved sales order." : undefined}>
              <SearchSelect options={orderOptions} value={chosen} onChange={setChosen} loading={orders.loading} disabled={!customerId} placeholder={customerId ? "Choose an order" : "Choose a customer first"} />
            </Field>
          </div>
        )}
        {p?.order.status === "APPROVED" && <Note className="mt-3">This order is already invoiced and its stock has moved. The note is the paper that goes with the goods.</Note>}
        {p?.order.status === "DRAFT" && <Note className="mt-3">This order is not approved yet. Stock leaves when it is approved; until then these goods count as promised.</Note>}
        {prefill.error && <div className="mt-3"><ErrorNote error={prefill.error} onRetry={prefill.reload} /></div>}
      </Panel>

      {p && (
        <>
          <Panel title="What goes on this note" description="Start from what is left on the order, and lower a quantity for a part delivery.">
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="table-stack w-full text-sm">
                <caption className="sr-only">Quantities for this delivery note</caption>
                <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-start font-semibold">Item</th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">Ordered</th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">Delivered</th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">On other notes</th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">Left</th>
                    <th scope="col" className="w-32 px-3 py-2 text-end font-semibold">This note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.sourceLineId} className="border-t border-border align-top">
                      <td data-label="Item" className="px-3 py-2"><span className="font-medium">{r.description}</span>{r.itemCode && <span className="block text-xs text-muted-foreground">{r.itemCode}</span>}</td>
                      <td data-label="Ordered" className="px-3 py-2 text-end tabular-nums">{formatQty(r.ordered, 3)}</td>
                      <td data-label="Delivered" className="px-3 py-2 text-end tabular-nums">{formatQty(r.delivered, 3)}</td>
                      <td data-label="On other notes" className="px-3 py-2 text-end tabular-nums">{formatQty(r.pending, 3)}</td>
                      <td data-label="Left" className="px-3 py-2 text-end tabular-nums">{formatQty(r.remaining, 3)}</td>
                      <td data-label="This note" className="px-3 py-2">
                        <input
                          type="number" inputMode="decimal" min="0" step="any" value={r.qty} disabled={r.remaining <= 0}
                          aria-label={`Quantity of ${r.description} on this note`} aria-invalid={errors?.[i] ? true : undefined}
                          onChange={(e) => setQty(i, e.target.value)} className={numInput}
                        />
                        {errors?.[i] && <p className="mt-1 text-xs font-medium text-status-danger">{errors[i]}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errors?.none && <p role="alert" className="mt-2 text-sm font-medium text-status-danger">{errors.none}</p>}
          </Panel>

          <Panel title="Delivery details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" required><DateInput value={header.date} onChange={setField("date")} /></Field>
              <Field label="Customer LPO"><TextInput value={header.reference} onChange={setField("reference")} /></Field>
              <Field label="Deliver to" className="sm:col-span-2"><Textarea rows={2} value={header.deliveryAddress} onChange={setField("deliveryAddress")} /></Field>
              <Field label="Contact person"><TextInput value={header.contactPerson} onChange={setField("contactPerson")} /></Field>
              <Field label="Contact phone"><TextInput value={header.contactPhone} onChange={setField("contactPhone")} inputMode="tel" /></Field>
              <Field label="Vehicle"><TextInput value={header.vehicleNo} onChange={setField("vehicleNo")} /></Field>
              <Field label="Driver"><TextInput value={header.driverName} onChange={setField("driverName")} /></Field>
              <Field label="Driver phone"><TextInput value={header.driverPhone} onChange={setField("driverPhone")} inputMode="tel" /></Field>
              <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={header.notes} onChange={setField("notes")} placeholder="Anything the driver or the customer should know" /></Field>
            </div>
          </Panel>

          <ErrorNote error={problem} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4" aria-hidden="true" />{saving ? "Saving…" : editing ? "Update delivery note" : "Save delivery note"}</Button>
          </div>
        </>
      )}
    </div>
  );
}
