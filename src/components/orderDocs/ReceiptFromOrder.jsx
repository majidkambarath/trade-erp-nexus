import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "../ui/button";
import { DateInput, ErrorNote, Field, PageHeader, Panel, SearchSelect, Spinner, Textarea, TextInput, useAsync } from "../accounting/kit";
import { goodsReceipts, tradeOrders } from "../../lib/orderDocumentsApi";
import { orderRows, validateOrderRows } from "../../lib/salesDocuments";
import { formatDate, formatNumber, formatQty, todayInput, toInputDate } from "../../utils/format";
import { Note } from "../salesDocs/parts";

const numInput = "h-11 w-full rounded-lg border border-input bg-background px-3 text-end text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-[invalid=true]:border-status-danger disabled:opacity-50 lg:h-9";

const headerFrom = (gr) => ({
  date: gr ? toInputDate(gr.date) : todayInput(),
  vendorDeliveryNo: gr?.vendorDeliveryNo ?? "", reference: gr?.reference ?? "", vehicleNo: gr?.vehicleNo ?? "", driverName: gr?.driverName ?? "", notes: gr?.notes ?? "",
});

// A goods receipt against a purchase order. The lines are the order's: the form shows what has been ordered, received and
// is on other receipts, and takes only how much arrived THIS time. Price, discount and tax stay the order's, so the receipt can
// never disagree with the invoice it becomes.
export default function ReceiptFromOrder({ orderId, editing, vendors, onBack, onSaved, notify }) {
  const [vendorId, setVendorId] = useState(editing?.partyId || "");
  const [chosen, setChosen] = useState(orderId || editing?.source?.id || "");
  const [header, setHeader] = useState(() => headerFrom(editing));
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);

  const fixed = Boolean(orderId || editing); // the order is already decided
  const orders = useAsync(
    () => (vendorId && !fixed ? tradeOrders.list({ kind: "purchase", status: "CONFIRMED", partyId: vendorId, limit: 200 }).then((r) => r.rows) : Promise.resolve([])),
    [vendorId, fixed]
  );
  const prefill = useAsync(() => (chosen ? goodsReceipts.fromOrder(chosen) : Promise.resolve(null)), [chosen]);

  // What this receipt already holds on each line, when it is being edited.
  const own = useMemo(() => (editing ? Object.fromEntries(editing.items.map((l) => [String(l.sourceLineId), l.qty])) : null), [editing]);

  useEffect(() => {
    const p = prefill.data;
    if (!p) { setRows([]); return; }
    // the server names the progress of each line; the quantity table speaks of ordered / received / on other receipts / left
    const shaped = { lines: p.lines.map((l) => ({ ...l, delivered: l.received, pending: l.onTheWay, remaining: l.toReceive })) };
    setRows(orderRows(shaped, own));
    if (!editing) setHeader((h) => ({ ...h, reference: p.order.reference || "" }));
  }, [prefill.data, own, editing]);

  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.vendorName, hint: v.vendorId })), [vendors]);
  const orderOptions = (orders.data || []).map((o) => ({ value: o._id, label: o.orderNo, hint: `${formatDate(o.date)} · ${o.progress.label} · ${formatNumber(o.totalAmount, 2)}` }));
  const setField = (k) => (e) => setHeader((h) => ({ ...h, [k]: e.target.value }));
  const setQty = (i, qty) => { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, qty } : r))); setErrors(null); };

  const save = async () => {
    const found = validateOrderRows(rows);
    setErrors(found);
    if (found) return;
    setSaving(true);
    setProblem(null);
    try {
      const body = {
        sourceOrderId: chosen, ...header,
        items: rows.filter((r) => Number(r.qty) > 0).map((r) => ({ sourceLineId: r.sourceLineId, qty: Number(r.qty) })),
      };
      const saved = editing ? await goodsReceipts.update(editing._id, body) : await goodsReceipts.create(body);
      notify(`${saved.receiptNo} ${editing ? "updated" : "created"}`);
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
        title={editing ? `Edit ${editing.receiptNo}` : "Goods received against a purchase order"}
        description="Record all or part of an order as it arrives. The order's prices, discounts and tax stay as they are."
        actions={<Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</Button>}
      />

      <Panel title="Purchase order">
        {fixed && p ? (
          <p className="text-sm">
            <span className="font-mono font-semibold">{p.order.no}</span>
            <span className="text-muted-foreground"> · {p.party.vendorName} · confirmed · {formatDate(p.order.date)}</span>
          </p>
        ) : fixed ? (
          <Spinner label="Loading the order" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vendor" required>
              <SearchSelect options={vendorOptions} value={vendorId} onChange={(v) => { setVendorId(v); setChosen(""); }} placeholder="Choose a vendor" />
            </Field>
            <Field label="Purchase order" required hint={vendorId && !orders.loading && !orderOptions.length ? "This vendor has no confirmed purchase order. Confirm one first." : undefined}>
              <SearchSelect options={orderOptions} value={chosen} onChange={setChosen} loading={orders.loading} disabled={!vendorId} placeholder={vendorId ? "Choose an order" : "Choose a vendor first"} />
            </Field>
          </div>
        )}
        {p && <Note className="mt-3">A goods receipt posts nothing and moves no stock. The purchase invoice made from it brings the stock in when it is approved.</Note>}
        {prefill.error && <div className="mt-3"><ErrorNote error={prefill.error} onRetry={prefill.reload} /></div>}
      </Panel>

      {p && (
        <>
          <Panel title="What goes on this receipt" description="Start from what is left on the order, and lower a quantity for a part delivery. You confirm what actually arrived when the goods are in.">
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="table-stack w-full text-sm">
                <caption className="sr-only">Quantities for this goods receipt</caption>
                <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-start font-semibold">Item</th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">Ordered</th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">Received</th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">On other receipts</th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">Left</th>
                    <th scope="col" className="w-32 px-3 py-2 text-end font-semibold">This receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.sourceLineId} className="border-t border-border align-top">
                      <td data-label="Item" className="px-3 py-2"><span className="font-medium">{r.description}</span>{r.itemCode && <span className="block text-xs text-muted-foreground">{r.itemCode}</span>}</td>
                      <td data-label="Ordered" className="px-3 py-2 text-end tabular-nums">{formatQty(r.ordered, 3)}</td>
                      <td data-label="Received" className="px-3 py-2 text-end tabular-nums">{formatQty(r.delivered, 3)}</td>
                      <td data-label="On other receipts" className="px-3 py-2 text-end tabular-nums">{formatQty(r.pending, 3)}</td>
                      <td data-label="Left" className="px-3 py-2 text-end tabular-nums">{formatQty(r.remaining, 3)}</td>
                      <td data-label="This receipt" className="px-3 py-2">
                        <input
                          type="number" inputMode="decimal" min="0" step="any" value={r.qty} disabled={r.remaining <= 0}
                          aria-label={`Quantity of ${r.description} on this receipt`} aria-invalid={errors?.[i] ? true : undefined}
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
              <Field label="Vendor delivery note / invoice no."><TextInput value={header.vendorDeliveryNo} onChange={setField("vendorDeliveryNo")} /></Field>
              <Field label="Our reference"><TextInput value={header.reference} onChange={setField("reference")} /></Field>
              <Field label="Vehicle"><TextInput value={header.vehicleNo} onChange={setField("vehicleNo")} /></Field>
              <Field label="Driver"><TextInput value={header.driverName} onChange={setField("driverName")} /></Field>
              <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={header.notes} onChange={setField("notes")} placeholder="Anything the store should know" /></Field>
            </div>
          </Panel>

          <ErrorNote error={problem} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4" aria-hidden="true" />{saving ? "Saving…" : editing ? "Update goods receipt" : "Save goods receipt"}</Button>
          </div>
        </>
      )}
    </div>
  );
}
