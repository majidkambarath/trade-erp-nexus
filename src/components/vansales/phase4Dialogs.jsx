import React, { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { AmountInput, DateInput, ErrorNote, Field, Modal, SearchSelect, Select, TextInput, useAsync } from "../accounting/kit.jsx";
import { api } from "../../lib/accountingApi";
import { choices, promotions, routes, trips } from "../../lib/vanSalesApi";
import { PROMOTION_KINDS, promotionBody, vanErrorText } from "../../lib/vanSales";

// The dialogs phase 4 added: an order taken on the road for the next visit, and a promotion.

const Footer = ({ onClose, busy, onSubmit, label, disabled }) => (
  <>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button onClick={onSubmit} disabled={busy || disabled}>{busy ? "Working…" : label}</Button>
  </>
);

const goods = () => api.get("/stock/stock", { itemType: "goods" }).then((d) => (d?.stocks || []).filter((s) => s.itemType !== "service"));

// ---- an order for the next visit --------------------------------------------------------------------------------
export function PreorderDialog({ trip, customerId, customerName, onClose, onDone }) {
  const items = useAsync(goods, []);
  const [rows, setRows] = useState([{ itemId: "", qty: "" }]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const options = useMemo(() => (items.data || []).map((s) => ({ value: String(s._id), label: s.itemName, searchText: `${s.itemId || ""} ${s.sku || ""}` })), [items.data]);
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const lines = rows.filter((r) => r.itemId && Number(r.qty) > 0).map((r) => ({ itemId: r.itemId, qty: Number(r.qty) }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onDone(await trips.preorder(trip.id, { customerId, items: lines, notes }));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Modal size="lg" title={`Order for next visit: ${customerName || "customer"}`} description="Saved as a confirmed sales order for the route's next day. Nothing leaves the van now; it is counted in the next suggested load and delivered by selling against it." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={!lines.length} label="Save order" onSubmit={save} />}>
      <div className="grid grid-cols-1 gap-3">
        {error && <ErrorNote error={new Error(vanErrorText(error))} />}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
            <Field label={i === 0 ? "Item" : undefined}><SearchSelect value={r.itemId} onChange={(v) => set(i, { itemId: v })} options={options} loading={items.loading} placeholder="Choose an item" /></Field>
            <Field label={i === 0 ? "Qty" : undefined}><AmountInput value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} inputMode="decimal" aria-label="Quantity" /></Field>
            <button type="button" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setRows((r) => [...r, { itemId: "", qty: "" }])} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><Plus className="h-4 w-4" aria-hidden="true" /> Add item</button>
        <Field label="Note"><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Optional" /></Field>
      </div>
    </Modal>
  );
}

// ---- a promotion ------------------------------------------------------------------------------------------------
function Picker({ label, hint, ids, onChange, options, loading, placeholder }) {
  const names = new Map(options.map((o) => [o.value, o.label]));
  const taken = new Set(ids);
  return (
    <Field label={label} hint={hint}>
      <div className="grid grid-cols-1 gap-2">
        {ids.map((id) => (
          <div key={id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{names.get(id) || "…"}</span>
            <button type="button" aria-label={`Remove ${names.get(id) || "it"}`} onClick={() => onChange(ids.filter((x) => x !== id))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <SearchSelect value="" onChange={(v) => v && onChange([...ids, v])} options={options.filter((o) => !taken.has(o.value))} loading={loading} placeholder={placeholder} />
      </div>
    </Field>
  );
}

export function PromotionDialog({ promotion: p, onClose, onSaved }) {
  const editing = Boolean(p?.id);
  const items = useAsync(goods, []);
  const customers = useAsync(() => choices.customers(), []);
  const routeList = useAsync(() => routes.list(), []);
  const str = (v) => (v === undefined || v === null ? "" : String(v));
  const [f, setF] = useState({
    name: p?.name || "", kind: p?.kind || "slab", validFrom: p?.validFrom || "", validTo: p?.validTo || "",
    priority: str(p?.priority ?? 0), stackable: Boolean(p?.stackable), active: p?.active !== false,
    stockIds: (p?.stockIds || []).map(String), customerIds: (p?.customerIds || []).map(String), routeIds: (p?.routeIds || []).map(String),
    percent: str(p?.percent), minQty: str(p?.minQty ?? 1), minValue: str(p?.minValue), buyQty: str(p?.buyQty), freeQty: str(p?.freeQty), freeStockId: str(p?.freeStockId),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const itemOptions = (items.data || []).map((s) => ({ value: String(s._id), label: s.itemName }));
  const customerOptions = (customers.data || []).map((c) => ({ value: c.id, label: c.name, hint: c.code }));
  const routeOptions = (routeList.data || []).map((r) => ({ value: r.id, label: r.name }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = promotionBody({ ...f, active: editing ? f.active : undefined });
      onSaved(editing ? await promotions.update(p.id, body) : await promotions.create(body), `${f.name} saved.`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Modal size="lg" title={editing ? `Edit ${p.name}` : "New promotion"} description="Applied by the server on every van sale it fits. Goods given free leave the van and the books at cost." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={!f.name.trim()} label="Save" onSubmit={save} />}>
      <div className="grid grid-cols-1 gap-3">
        {error && <ErrorNote error={new Error(vanErrorText(error))} />}
        <Field label="Name" required><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} autoFocus /></Field>
        <Field label="Kind of offer">
          <Select value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
            {PROMOTION_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        {f.kind === "slab" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From quantity"><AmountInput value={f.minQty} onChange={(e) => set({ minQty: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Discount %"><AmountInput value={f.percent} onChange={(e) => set({ percent: e.target.value })} inputMode="decimal" /></Field>
          </div>
        )}
        {f.kind === "bxgy" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="For every (bought)"><AmountInput value={f.buyQty} onChange={(e) => set({ buyQty: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Give free"><AmountInput value={f.freeQty} onChange={(e) => set({ freeQty: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Free item" hint="Blank = the item bought"><SearchSelect value={f.freeStockId} onChange={(v) => set({ freeStockId: v || "" })} options={itemOptions} loading={items.loading} placeholder="Same item" /></Field>
          </div>
        )}
        {f.kind === "basket" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Order value from"><AmountInput value={f.minValue} onChange={(e) => set({ minValue: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Discount %"><AmountInput value={f.percent} onChange={(e) => set({ percent: e.target.value })} inputMode="decimal" /></Field>
          </div>
        )}
        {f.kind !== "basket" && <Picker label="Items" hint="None = every item" ids={f.stockIds} onChange={(v) => set({ stockIds: v })} options={itemOptions} loading={items.loading} placeholder="Add an item…" />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><DateInput value={f.validFrom} onChange={(e) => set({ validFrom: e.target.value })} /></Field>
          <Field label="To"><DateInput value={f.validTo} onChange={(e) => set({ validTo: e.target.value })} /></Field>
        </div>
        <Picker label="Only for these customers" hint="None named here or below = every customer" ids={f.customerIds} onChange={(v) => set({ customerIds: v })} options={customerOptions} loading={customers.loading} placeholder="Add a customer…" />
        <Picker label="Or every customer on these routes" ids={f.routeIds} onChange={(v) => set({ routeIds: v })} options={routeOptions} loading={routeList.loading} placeholder="Add a route…" />
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Priority" hint="Higher is tried first"><AmountInput value={f.priority} onChange={(e) => set({ priority: e.target.value })} inputMode="numeric" /></Field>
          <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" checked={f.stackable} onChange={(e) => set({ stackable: e.target.checked })} /> Combines with other offers</label>
        </div>
        {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Active</label>}
      </div>
    </Modal>
  );
}
