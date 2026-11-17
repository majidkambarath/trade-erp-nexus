import React, { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { AmountInput, DateInput, ErrorNote, Field, Modal, SearchSelect, TextInput, useAsync } from "../accounting/kit.jsx";
import { api } from "../../lib/accountingApi";
import { choices, priceLists, trips } from "../../lib/vanSalesApi";
import { VISIT_REASONS, loadBody, loadProblem, priceListBody, vanErrorText } from "../../lib/vanSales";
import { currentLocation } from "../../lib/geo";

// The dialogs phase 2 added: a stop without a sale, goods handed to another van, and a price list.

const Footer = ({ onClose, busy, onSubmit, label, disabled }) => (
  <>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button onClick={onSubmit} disabled={busy || disabled}>{busy ? "Working…" : label}</Button>
  </>
);

// ---- a stop without a sale ------------------------------------------------------------------------------------
export function VisitDialog({ trip, customerId, customerName, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const location = await currentLocation(); // best effort: never waits more than a few seconds
      onDone(await trips.visit(trip.id, { customerId, reason, note, ...(location ? { location } : {}) }));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }
  return (
    <Modal size="sm" title={`No sale at ${customerName || "this stop"}`} onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={!reason} label="Record visit" onSubmit={submit} />}>
      <div className="grid grid-cols-1 gap-3">
        {error && <ErrorNote error={new Error(vanErrorText(error))} />}
        <Field label="Why" required>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {VISIT_REASONS.map(([k, label]) => (
              <label key={k} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${reason === k ? "border-primary bg-primary/5" : "border-border"}`}>
                <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} /> {label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Note (optional)"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
      </div>
    </Modal>
  );
}

// ---- hand goods to another van ---------------------------------------------------------------------------------
export function TransferDialog({ trip, onClose, onDone }) {
  const others = useAsync(() => trips.list({ status: "LOADING,ON_ROUTE" }), []);
  const [toTripId, setTo] = useState("");
  const [rows, setRows] = useState([{ stockId: "", qty: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const targets = (others.data || []).filter((t) => t.id !== trip.id).map((t) => ({ value: t.id, label: `${t.vanCode} · ${t.tripNo}`, hint: t.salesmanName }));
  const onVan = (trip.sellable || []).map((l) => ({ value: l.stockId, label: `${l.itemName} (${l.qty} on van)` }));
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const problem = loadProblem(rows) || (!toTripId ? "Choose the van that takes the goods." : "");
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onDone(await trips.transfer(trip.id, { toTripId, ...loadBody(rows) }));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }
  return (
    <Modal size="lg" title="Hand goods to another van" description="Nothing moves in the books: the goods simply count on the other van from now." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={Boolean(problem)} label="Hand over" onSubmit={submit} />}>
      <div className="grid grid-cols-1 gap-3">
        {error && <ErrorNote error={new Error(vanErrorText(error))} />}
        <Field label="To van" required><SearchSelect value={toTripId} onChange={setTo} loading={others.loading} options={targets} placeholder="Choose the van" noOptionsText="No other van is out" /></Field>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
            <Field label={i === 0 ? "Item" : undefined}><SearchSelect value={r.stockId} onChange={(v) => set(i, { stockId: v })} options={onVan} placeholder="On this van…" /></Field>
            <Field label={i === 0 ? "Quantity" : undefined}><AmountInput value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} inputMode="decimal" aria-label="Quantity" /></Field>
            <button type="button" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setRows((r) => [...r, { stockId: "", qty: "" }])} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><Plus className="h-4 w-4" aria-hidden="true" /> Add item</button>
      </div>
    </Modal>
  );
}

// ---- a price list ----------------------------------------------------------------------------------------------
export function PriceListDialog({ list, onClose, onSaved }) {
  const editing = Boolean(list?.id);
  const customers = useAsync(() => choices.customers(), []);
  const items = useAsync(() => api.get("/stock/stock", { itemType: "goods" }), []);
  const customerNames = useMemo(() => new Map((customers.data || []).map((c) => [c.id, c.name])), [customers.data]);
  const [f, setF] = useState({
    name: list?.name || "", validFrom: list?.validFrom || "", validTo: list?.validTo || "", active: list?.active !== false,
    customers: (list?.customerIds || []).map((id) => ({ id: String(id) })),
    lines: list?.lines?.length ? list.lines.map((l) => ({ stockId: String(l.stockId), price: String(l.price), minQty: String(l.minQty ?? 1) })) : [{ stockId: "", price: "", minQty: "1" }],
  });
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const setLine = (i, patch) => set({ lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const itemOptions = (items.data?.stocks || []).filter((s) => s.itemType !== "service").map((s) => ({ value: String(s._id), label: s.itemName, hint: s.salesPrice != null ? `list ${s.salesPrice}` : undefined }));
  const taken = new Set(f.customers.map((c) => c.id));
  const customerOptions = (customers.data || []).filter((c) => !taken.has(c.id)).map((c) => ({ value: c.id, label: c.name, hint: c.code }));
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = priceListBody({ ...f, ...(editing ? {} : { active: undefined }) });
      onSaved(editing ? await priceLists.update(list.id, body) : await priceLists.create(body), `${f.name} saved.`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }
  return (
    <Modal size="lg" title={editing ? `Edit ${list.name}` : "New price list"} description="Prices for the customers named here, or for every customer on a route that uses this list. A larger minimum quantity is a quantity break." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={!f.name.trim()} label="Save" onSubmit={save} />}>
      <div className="grid grid-cols-1 gap-3">
        {error && <ErrorNote error={new Error(vanErrorText(error))} />}
        <Field label="Name" required><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><DateInput value={f.validFrom} onChange={(e) => set({ validFrom: e.target.value })} /></Field>
          <Field label="To"><DateInput value={f.validTo} onChange={(e) => set({ validTo: e.target.value })} /></Field>
        </div>
        <Field label="Prices">
          <div className="grid grid-cols-1 gap-2">
            {f.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_5.5rem_5rem_auto] items-end gap-2">
                <SearchSelect value={l.stockId} onChange={(v) => setLine(i, { stockId: v })} options={itemOptions} loading={items.loading} placeholder="Item…" aria-label="Item" />
                <AmountInput value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} inputMode="decimal" aria-label="Price" placeholder="Price" />
                <AmountInput value={l.minQty} onChange={(e) => setLine(i, { minQty: e.target.value })} inputMode="decimal" aria-label="From quantity" placeholder="From qty" />
                <button type="button" aria-label="Remove price" onClick={() => set({ lines: f.lines.filter((_, j) => j !== i) })} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => set({ lines: [...f.lines, { stockId: "", price: "", minQty: "1" }] })} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><Plus className="h-4 w-4" aria-hidden="true" /> Add price</button>
          </div>
        </Field>
        <Field label="Customers on this list" hint="A route can also use the list for every customer on it.">
          <div className="grid grid-cols-1 gap-2">
            {f.customers.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{customerNames.get(c.id) || "Customer"}</span>
                <button type="button" aria-label={`Remove ${customerNames.get(c.id) || "customer"}`} onClick={() => set({ customers: f.customers.filter((x) => x.id !== c.id) })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <SearchSelect value={adding} onChange={(v) => { if (v) set({ customers: [...f.customers, { id: v }] }); setAdding(""); }} options={customerOptions} loading={customers.loading} placeholder="Add a customer…" />
          </div>
        </Field>
        {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Active</label>}
      </div>
    </Modal>
  );
}

