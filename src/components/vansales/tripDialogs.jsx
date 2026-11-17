import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import { SellInsight } from "./SellInsight";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { printMarkup } from "../PurchaseOrder/shared/documentPdf.jsx";
import { depositSlipMarkup } from "../../lib/vanReceipt";
import { orgCurrency } from "../../utils/orgLocale";
import { Button } from "../ui/button";
import { AmountInput, DateInput, ErrorNote, Field, Modal, Select, SearchSelect, Spinner, TextInput, useAsync } from "../accounting/kit.jsx";
import { api } from "../../lib/accountingApi";
import { choices, promotions, trips, vans } from "../../lib/vanSalesApi";
import { apply as applyPromotions } from "../../lib/promotions";
import { addSuggestedRow, cashPlan, countDifference, cutText, countRows, isCreditWarning, loadBody, loadProblem, odometerBody, offerPreview, priceSourceLabel, round2, repeatRows, saleLines, stepQty, suggestedRows, suggestionWhy, saleProblem, saleSubtotal, unloadBody, vanErrorText, vanItems } from "../../lib/vanSales";
import { formatCurrencyAED } from "../../utils/format";
import { isNetworkError, packPrice } from "../../lib/vanOffline";
import { useOrganisation } from "../shell/OrganisationContext";
import { currentLocation } from "../../lib/geo";

// The dialogs that drive a van trip. Each one runs a single act and hands the answer back; the page decides what to
// show next. The server is the judge of every rule (stock on the van, credit, the period lock): a dialog only keeps a
// person from sending what can never work, and shows the server's own words when it refuses.

const Footer = ({ onClose, busy, onSubmit, label, disabled }) => (
  <>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button onClick={onSubmit} disabled={busy || disabled}>{busy ? "Working…" : label}</Button>
  </>
);

/** Runs `act`, keeps the dialog open with the server's words when it fails. */
function useAct() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err);
      setBusy(false);
      return undefined;
    }
  };
  return { busy, error, run, setError };
}

const ErrorLine = ({ error }) => (error ? <ErrorNote error={new Error(vanErrorText(error))} /> : null);

// ---- open a trip ----------------------------------------------------------------------------------------------
export function OpenTripDialog({ onClose, onDone }) {
  const list = useAsync(() => Promise.all([vans.list(), choices.assignees()]), []);
  const [vanId, setVanId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const { busy, error, run } = useAct();
  const [allVans, people] = list.data || [[], []];
  const free = allVans.filter((v) => !v.openTrip);
  const van = allVans.find((v) => v.id === vanId);
  useEffect(() => { if (van) setSalesmanId(van.salesmanId || ""); }, [vanId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal size="sm" title="New van trip" onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={!vanId || !salesmanId} label="Open trip" onSubmit={() => run(async () => onDone(await trips.open({ vanId, salesmanId })))} />}>
      {list.loading && <Spinner label="Reading the vans" />}
      {list.data && (
        <div className="grid grid-cols-1 gap-3">
          <ErrorLine error={error} />
          <Field label="Van" required>
            <SearchSelect value={vanId} onChange={setVanId} options={free.map((v) => ({ value: v.id, label: `${v.code} - ${v.name}` }))} placeholder="Choose a van" noOptionsText="Every van already has an open trip" />
          </Field>
          <Field label="Salesman" required hint="Who takes the van out today. Only they can sell from it, unless a supervisor does.">
            <SearchSelect value={salesmanId} onChange={setSalesmanId} options={people.map((p) => ({ value: p.id, label: p.name }))} placeholder="Choose the salesman" />
          </Field>
        </div>
      )}
    </Modal>
  );
}

// ---- load / top up --------------------------------------------------------------------------------------------
export function LoadDialog({ trip, onClose, onDone }) {
  const items = useAsync(() => api.get("/stock/stock", { itemType: "goods" }), []);
  const [rows, setRows] = useState([{ stockId: "", qty: "" }]);
  const { busy, error, run } = useAct();
  const options = useMemo(() => {
    const list = (items.data?.stocks || []).filter((s) => s.itemType !== "service");
    return list.map((s) => ({ value: String(s._id), label: s.itemName, hint: s.currentStock != null ? `${s.currentStock} on hand` : undefined, searchText: `${s.itemId || ""} ${s.sku || ""}` }));
  }, [items.data]);
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch, ...(patch.qty !== undefined || patch.stockId !== undefined ? { why: undefined } : {}) } : x)));
  const problem = loadProblem(rows);
  const [suggest, setSuggest] = useState(null); // { runs, lines } once asked for
  const [expiry, setExpiry] = useState(null); // the warnings, once checked
  const [suggesting, setSuggesting] = useState(false);

  async function fillSuggested() {
    setSuggesting(true);
    try {
      const s = await trips.suggestedLoad(trip.id);
      setSuggest(s);
      if (s.lines?.length) setRows(suggestedRows(s.lines));
    } catch {
      setSuggest({ runs: 0, lines: [], failed: true });
    } finally {
      setSuggesting(false);
    }
  }

  // stock that would expire before the route's customers take it is a warning: said once, then the person decides
  async function save() {
    await run(async () => {
      const body = loadBody(rows);
      if (!expiry) {
        const check = await trips.loadCheck(trip.id, body).catch(() => ({ warnings: [] }));
        if (check.warnings?.length) { setExpiry(check.warnings); throw Object.assign(new Error("Some of this stock expires soon. Check it, then load anyway or change the lines."), { code: "EXPIRY_SOON" }); }
      }
      onDone(await trips.load(trip.id, body));
    });
  }

  return (
    <Modal size="lg" title={trip.loads?.length ? "Top up the van" : "Load the van"} description="Loading moves no stock and posts nothing. The goods leave the books only when they are sold." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={Boolean(problem)} label={expiry ? "Load anyway" : "Save load"} onSubmit={save} />}>
      <div className="grid grid-cols-1 gap-3">
        <ErrorLine error={error} />
        {trip.routeId && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={fillSuggested} disabled={suggesting} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 font-medium hover:bg-muted disabled:opacity-50"><Sparkles className="h-4 w-4" aria-hidden="true" /> {suggesting ? "Working it out…" : "Fill suggested load"}</button>
            {suggest && <span className="text-muted-foreground">{suggest.failed ? "The suggestion could not be read." : suggest.lines?.length ? `From the orders for this route and the last ${suggest.runs || 0} run${suggest.runs === 1 ? "" : "s"}. Change anything before saving.` : "Nothing to suggest yet: no orders and no runs of this route to learn from."}</span>}
          </div>
        )}
        {expiry && (
          <div role="alert" className="rounded-lg border border-status-warning bg-status-warning/10 p-3 text-sm">
            <p className="font-medium">Expires before the customers will take it</p>
            <ul className="mt-1 list-disc ps-5">{expiry.map((w) => <li key={w.stockId}>{w.message}{w.batches?.length ? ` (batch ${w.batches.map((b) => `${b.batchNo}, ${b.expiryDate}`).join("; ")})` : ""}</li>)}</ul>
          </div>
        )}
        {items.loading && <Spinner label="Reading the items" />}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
            <Field label={i === 0 ? "Item" : undefined}><SearchSelect value={r.stockId} onChange={(v) => set(i, { stockId: v })} options={options} placeholder="Choose an item" /></Field>
            <Field label={i === 0 ? "Quantity" : undefined}><AmountInput value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} inputMode="decimal" aria-label="Quantity" /></Field>
            <button type="button" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
            {r.why && <p className="col-span-3 -mt-1 text-xs text-muted-foreground">Suggested: {suggestionWhy(r.why)}</p>}
          </div>
        ))}
        <button type="button" onClick={() => setRows((r) => [...r, { stockId: "", qty: "" }])} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><Plus className="h-4 w-4" aria-hidden="true" /> Add item</button>
        {problem && rows.some((r) => r.stockId || r.qty) && <p className="text-xs text-muted-foreground">{problem}</p>}
      </div>
    </Modal>
  );
}

// ---- sell ------------------------------------------------------------------------------------------------------
export function SellDialog({ trip, customerId: startCustomer, preorder, onClose, onDone, offline }) {
  const org = useOrganisation();
  const off = offline?.active ? offline : null;
  const customers = useAsync(() => (off ? Promise.resolve(off.pack?.customers || []) : choices.customers()), [Boolean(off)]);
  const payment = useAsync(() => (off ? Promise.resolve({ cheque: false, bankAccounts: [] }) : choices.payment()), [Boolean(off)]);
  const [customerId, setCustomerId] = useState(startCustomer || "");
  // selling against an order taken last visit: its lines, at its prices
  const [rows, setRows] = useState(() => (preorder?.items?.length ? preorder.items.map((l) => ({ itemId: l.itemId, qty: String(l.qty), price: String(l.price ?? "") })) : [{ itemId: "", qty: "", price: "" }]));
  const [mode, setMode] = useState("none"); // none | cash | cheque
  const [chq, setChq] = useState({ chequeNo: "", chequeDate: "", accountId: "" });
  const [acknowledged, setAcknowledged] = useState(false);
  const [warning, setWarning] = useState(null);
  const [here, setHere] = useState(null);
  useEffect(() => { let live = true; currentLocation().then((l) => live && setHere(l)).catch(() => {}); return () => { live = false; }; }, []);
  const { busy, error, run } = useAct();
  const onVan = useMemo(() => (off ? off.view.sellable : trip.sellable || []), [off, trip.sellable]);
  const listed = useAsync(
    () => (!customerId ? Promise.resolve([]) : off ? Promise.resolve(onVan.map((l) => ({ stockId: l.stockId, price: packPrice(off.pack, customerId, l.stockId), source: "pack" }))) : trips.prices(trip.id, customerId)),
    [trip.id, customerId, Boolean(off)]
  );
  const priceOf = useMemo(() => new Map((listed.data || []).map((p) => [p.stockId, p])), [listed.data]);
  // what this customer owes, bought last time and usually buys: read from their own invoices (online only; a customer with no history shows nothing)
  const insight = useAsync(() => (!customerId ? Promise.resolve(null) : off ? Promise.resolve(off.pack?.insight?.[customerId] || null) : Promise.resolve().then(() => trips.insight(trip.id, customerId)).catch(() => null)), [trip.id, customerId, Boolean(off)]);
  const [cut, setCut] = useState("");
  const pricedVan = useMemo(() => onVan.map((l) => (priceOf.has(l.stockId) ? { ...l, salesPrice: priceOf.get(l.stockId).price } : l)), [onVan, priceOf]);
  const options = vanItems({ sellable: onVan });
  const problem = saleProblem({ customerId, rows }, onVan);
  const lines = saleLines(rows, pricedVan);
  const canOverride = org.canAny?.(["sales.creditOverride", "vansales.manage"]);
  // the offers, worked out here so the salesman sees them before pressing Sell; the server applies them again
  const promos = useAsync(() => (off ? Promise.resolve(off.pack?.promotions || []) : promotions.list().catch(() => offline?.pack?.promotions || [])), [Boolean(off)]);
  const cats = useMemo(() => offline?.pack?.categories || {}, [offline?.pack]);
  const names = useMemo(() => new Map(onVan.map((l) => [l.stockId, l.itemName])), [onVan]);
  const offer = useMemo(() => offerPreview(
    applyPromotions(lines.map((l) => ({ ...l, categoryId: cats[l.itemId] || "" })), promos.data || [], { customerId, routeId: trip.routeId, date: new Date().toISOString().slice(0, 10) }),
    names
  ), [lines, promos.data, cats, customerId, trip.routeId, names]);
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const priced = (row) => ({ ...row, price: priceOf.has(row.itemId) ? String(priceOf.get(row.itemId).price ?? "") : row.price });
  function repeat() {
    const r = repeatRows(insight.data?.lastOrder, onVan);
    setRows(r.rows.length ? r.rows.map(priced) : [{ itemId: "", qty: "", price: "" }]);
    setCut(cutText(r.cut));
  }
  const addUsual = (item) => { setCut(""); setRows((r) => addSuggestedRow(r, item, onVan).map((x) => (x.itemId === item.stockId && !x.price ? priced(x) : x))); };
  const bump = (i, d) => setRows((r) => r.map((x, j) => (j === i ? stepQty(x, d, onVan) : x)));

  function pick(i, id) {
    const l = pricedVan.find((x) => x.stockId === id);
    set(i, { itemId: id, price: l ? String(l.salesPrice || "") : "" });
  }

  async function submit() {
    const body = { customerId, items: lines, acknowledged, ...(preorder?.id ? { preorderId: preorder.id } : {}), ...(here ? { location: here } : {}) };
    if (mode === "cash") body.payNow = { mode: "cash", full: true };
    if (mode === "cheque") body.payNow = { mode: "cheque", full: true, details: { chequeNo: chq.chequeNo, chequeDate: chq.chequeDate, accountId: chq.accountId || undefined } };
    const c = (customers.data || []).find((x) => x.id === customerId);
    // no signal: keep it on the phone with the next reserved number, and say so; the server applies it when it is back
    const queue = async () => {
      const number = offline?.number ? offline.number() : null;
      const op = await (off || offline).enqueue("sell", { ...body, ...(number ? { number } : {}), ...(offer.free.length ? { previewFree: offer.free.map((f) => ({ stockId: f.stockId, qty: f.qty })) } : {}) });
      return { queued: true, clientId: op.clientId, number, items: lines.map((l) => ({ ...l, name: onVan.find((x) => x.stockId === l.itemId)?.itemName || "" })), paidNow: mode !== "none", customerName: c?.name, customerTrn: c?.trn || "" };
    };
    const r = await run(async () => {
      if (off) return queue();
      try {
        return await trips.sell(trip.id, body);
      } catch (err) {
        if (offline?.enqueue && isNetworkError(err)) return queue();
        throw err;
      }
    });
    if (r) onDone(r.queued ? r : { ...r, customerName: c?.name, customerTrn: c?.trn || "" });
  }

  useEffect(() => {
    if (error && isCreditWarning(error)) setWarning(error.message);
  }, [error]);

  return (
    <Modal size="lg" title="Sell from the van" onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={Boolean(problem) || (mode === "cheque" && !chq.chequeNo)} label={warning && acknowledged ? "Sell anyway" : "Sell"} onSubmit={submit} />}>
      <div className="grid grid-cols-1 gap-3">
        {warning ? (
          <div className="rounded-lg border border-status-warning bg-status-warning/10 p-3 text-sm">
            <p className="font-medium">Credit warning</p>
            <p className="mt-1">{warning}</p>
            {canOverride ? (
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} /> Sell anyway, I accept the risk</label>
            ) : <p className="mt-1 text-xs">Your role cannot sell past a credit limit. Ask a supervisor.</p>}
          </div>
        ) : <ErrorLine error={error} />}
        <Field label="Customer" required>
          <SearchSelect value={customerId} onChange={(v) => { setCustomerId(v); setCut(""); }} loading={customers.loading} placeholder="Search a customer…"
            options={(customers.data || []).map((c) => ({ value: c.id, label: c.name, hint: c.code }))} />
        </Field>
        <SellInsight insight={insight.data} onRepeat={repeat} onAdd={addUsual} cut={cut} asOf={off?.pack?.at} />
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_auto]">
            <div className="col-span-3 min-w-0 sm:col-span-1"><Field label={i === 0 ? "Item" : undefined}><SearchSelect value={r.itemId} onChange={(v) => pick(i, v)} options={options} placeholder="On the van…" /></Field></div>
            <Field label={i === 0 ? "Qty" : undefined}>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="One less" onClick={() => bump(i, -1)} disabled={!r.itemId} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40 sm:hidden"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                <div className="min-w-0 flex-1"><AmountInput value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} inputMode="decimal" aria-label="Quantity" /></div>
                <button type="button" aria-label="One more" onClick={() => bump(i, 1)} disabled={!r.itemId} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40 sm:hidden"><Plus className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </Field>
            <Field label={i === 0 ? "Price" : undefined} hint={r.itemId && priceOf.get(r.itemId) ? priceSourceLabel(priceOf.get(r.itemId)) : undefined}><AmountInput value={r.price} onChange={(e) => set(i, { price: e.target.value })} inputMode="decimal" aria-label="Price" /></Field>
            <button type="button" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setRows((r) => [...r, { itemId: "", qty: "", price: "" }])} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><Plus className="h-4 w-4" aria-hidden="true" /> Add item</button>
        {(offer.applied.length > 0) && (
          <div role="status" className="rounded-lg border border-status-success/40 bg-status-success/5 p-3 text-sm">
            <p className="font-medium">Offer applied</p>
            <ul className="mt-1 grid gap-0.5">
              {offer.applied.map((a) => <li key={a.id}>{a.name}: {a.text}</li>)}
              {offer.free.map((f) => <li key={f.stockId} className="text-muted-foreground">Free: {f.qty} x {f.name}</li>)}
            </ul>
          </div>
        )}
        {preorder && <p className="text-sm text-muted-foreground">Delivering order {preorder.orderNo}. It is closed when this sale is made.</p>}
        <p className="text-sm text-muted-foreground">Before VAT: <span className="font-medium text-foreground">{formatCurrencyAED(offer.discounted ? offer.subtotal : saleSubtotal(lines))}</span>{offer.discounted ? " after the offer" : ""}. VAT is added when the invoice is made.</p>
        <Field label="Money received now">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="none">Nothing yet (on credit)</option>
            <option value="cash">Cash, the full amount</option>
            {payment.data?.cheque && <option value="cheque">Cheque, the full amount</option>}
          </Select>
        </Field>
        {mode === "cheque" && <ChequeFields value={chq} onChange={setChq} accounts={payment.data?.bankAccounts || []} />}
        {problem && (customerId || rows.some((r) => r.itemId)) && <p className="text-xs text-muted-foreground">{problem}</p>}
      </div>
    </Modal>
  );
}

function ChequeFields({ value, onChange, accounts }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Cheque number" required><TextInput value={value.chequeNo} onChange={(e) => set({ chequeNo: e.target.value })} maxLength={20} inputMode="numeric" /></Field>
      <Field label="Cheque date" required><DateInput value={value.chequeDate} onChange={(e) => set({ chequeDate: e.target.value })} /></Field>
      {accounts.length > 1 && (
        <Field label="Deposit to" className="sm:col-span-2"><SearchSelect value={value.accountId} onChange={(v) => set({ accountId: v })} options={accounts.map((a) => ({ value: a.id, label: a.name }))} placeholder="Choose the bank account" /></Field>
      )}
    </div>
  );
}

// ---- collect ---------------------------------------------------------------------------------------------------
export function CollectDialog({ trip, customerId: startCustomer, onClose, onDone, offline }) {
  const off = offline?.active ? offline : null;
  const customers = useAsync(() => (off ? Promise.resolve(off.pack?.customers || []) : choices.customers()), [Boolean(off)]);
  const payment = useAsync(() => (off ? Promise.resolve({ cheque: false, bankAccounts: [] }) : choices.payment()), [Boolean(off)]);
  const [customerId, setCustomerId] = useState(startCustomer || "");
  const position = useAsync(() => (customerId && !off ? choices.position(customerId) : Promise.resolve(null)), [customerId, Boolean(off)]);
  const [mode, setMode] = useState("cash");
  const [amount, setAmount] = useState("");
  const [chq, setChq] = useState({ chequeNo: "", chequeDate: "", accountId: "" });
  const { busy, error, run } = useAct();
  const owed = position.data?.owed;

  async function submit() {
    const body = { customerId, amount: Number(amount), mode, details: mode === "cheque" ? { chequeNo: chq.chequeNo, chequeDate: chq.chequeDate, accountId: chq.accountId || undefined } : undefined };
    const queue = async () => {
      const op = await (off || offline).enqueue("collect", body);
      return { queued: true, clientId: op.clientId };
    };
    const r = await run(async () => {
      if (off) return queue();
      try {
        return await trips.collect(trip.id, body);
      } catch (err) {
        if (offline?.enqueue && isNetworkError(err)) return queue();
        throw err;
      }
    });
    if (r) onDone(r);
  }

  return (
    <Modal size="md" title="Collect money" description="Cash goes into the van's own account. A cheque waits in cheques in hand until it is deposited." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={!customerId || !(Number(amount) > 0) || (mode === "cheque" && !chq.chequeNo)} label="Take payment" onSubmit={submit} />}>
      <div className="grid grid-cols-1 gap-3">
        <ErrorLine error={error} />
        <Field label="Customer" required>
          <SearchSelect value={customerId} onChange={setCustomerId} loading={customers.loading} placeholder="Search a customer…" options={(customers.data || []).map((c) => ({ value: c.id, label: c.name, hint: c.code }))} />
        </Field>
        {customerId && owed != null && <p className="text-sm text-muted-foreground">Owes <span className="font-medium text-foreground">{formatCurrencyAED(owed)}</span> on {position.data.open.length} open invoice{position.data.open.length === 1 ? "" : "s"}. The oldest is settled first.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by"><Select value={mode} onChange={(e) => setMode(e.target.value)}><option value="cash">Cash</option>{payment.data?.cheque && <option value="cheque">Cheque</option>}</Select></Field>
          <Field label="Amount" required><AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></Field>
        </div>
        {mode === "cheque" && <ChequeFields value={chq} onChange={setChq} accounts={payment.data?.bankAccounts || []} />}
      </div>
    </Modal>
  );
}

// ---- return ----------------------------------------------------------------------------------------------------
export function ReturnDialog({ trip, customerId: startCustomer, onClose, onDone }) {
  const customers = useAsync(() => choices.customers(), []);
  const [customerId, setCustomerId] = useState(startCustomer || "");
  const position = useAsync(() => (customerId ? choices.position(customerId) : Promise.resolve(null)), [customerId]);
  const [invoiceId, setInvoiceId] = useState("");
  const lines = useAsync(() => (invoiceId ? choices.returnable(invoiceId) : Promise.resolve(null)), [invoiceId]);
  const [picked, setPicked] = useState({});
  const { busy, error, run } = useAct();
  const open = position.data?.open || [];
  const wanted = Object.entries(picked).filter(([, v]) => Number(v.qty) > 0);

  async function submit() {
    const body = { customerId, returnOfId: invoiceId, lines: wanted.map(([lineId, v]) => ({ lineId, qty: Number(v.qty), condition: v.condition || "good" })) };
    const r = await run(async () => trips.returnGoods(trip.id, body));
    if (r) onDone(r);
  }

  return (
    <Modal size="lg" title="Take goods back" description="Sellable goods go back on the van. Damaged goods are credited to the customer but cannot be sold again." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={!invoiceId || !wanted.length} label="Take back" onSubmit={submit} />}>
      <div className="grid grid-cols-1 gap-3">
        <ErrorLine error={error} />
        <Field label="Customer" required><SearchSelect value={customerId} onChange={(v) => { setCustomerId(v); setInvoiceId(""); setPicked({}); }} placeholder="Search a customer…" options={(customers.data || []).map((c) => ({ value: c.id, label: c.name, hint: c.code }))} /></Field>
        {customerId && (
          <Field label="Against invoice" required hint="Goods come back against one of their invoices.">
            <SearchSelect value={invoiceId} onChange={(v) => { setInvoiceId(v); setPicked({}); }} loading={position.loading} placeholder="Choose the invoice" noOptionsText="This customer has no open invoice. Use their statement for settled ones." options={open.map((i) => ({ value: i.id, label: i.number }))} />
          </Field>
        )}
        {lines.loading && <Spinner label="Reading the invoice" />}
        {lines.data?.lines?.map((l) => (
          <div key={l.lineId} className="grid grid-cols-[1fr_5rem_8rem] items-end gap-2">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{l.description}</p><p className="text-xs text-muted-foreground">{l.remainingQty} can still come back</p></div>
            <Field><AmountInput value={picked[l.lineId]?.qty || ""} onChange={(e) => setPicked((p) => ({ ...p, [l.lineId]: { ...p[l.lineId], qty: e.target.value } }))} inputMode="decimal" aria-label={`Quantity of ${l.description}`} /></Field>
            <Field><Select value={picked[l.lineId]?.condition || "good"} onChange={(e) => setPicked((p) => ({ ...p, [l.lineId]: { ...p[l.lineId], condition: e.target.value } }))} aria-label={`Condition of ${l.description}`}><option value="good">Sellable</option><option value="damaged">Damaged</option></Select></Field>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ---- count the van back in ------------------------------------------------------------------------------------
export function UnloadDialog({ trip, onClose, onDone }) {
  const [rows, setRows] = useState(() => countRows(trip));
  const [odometer, setOdometer] = useState("");
  const { busy, error, run } = useAct();
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const off = rows.filter((r) => countDifference(r) !== 0).length;
  return (
    <Modal size="lg" title="Count the van back in" description="Count what is physically in the van. The figures start at what should be there; change any that differ." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Save the count" onSubmit={() => run(async () => onDone(await trips.unload(trip.id, { ...unloadBody(rows), ...odometerBody(odometer) })))} />}>
      <div className="grid grid-cols-1 gap-3">
        <ErrorLine error={error} />
        <Field label="Odometer back (km)" hint={trip.odometer?.out != null ? `Went out at ${trip.odometer.out} km` : "Optional"}><AmountInput value={odometer} onChange={(e) => setOdometer(e.target.value)} inputMode="decimal" aria-label="Odometer back" /></Field>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing should be left on the van. Save the count to close the trip out.</p>}
        {rows.map((r, i) => {
          const d = countDifference(r);
          return (
            <div key={r.stockId} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-end gap-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{r.itemName}</p><p className="text-xs text-muted-foreground">Should hold {r.expectedGood}{r.expectedDamaged ? ` + ${r.expectedDamaged} damaged` : ""}{d !== 0 && <span className="ml-1 font-medium text-red-600">{d > 0 ? `+${d}` : d} off</span>}</p></div>
              <Field label={i === 0 ? "Sellable" : undefined}><AmountInput value={r.good} onChange={(e) => set(i, { good: e.target.value })} inputMode="decimal" aria-label={`Sellable ${r.itemName}`} /></Field>
              <Field label={i === 0 ? "Damaged" : undefined}><AmountInput value={r.damaged} onChange={(e) => set(i, { damaged: e.target.value })} inputMode="decimal" aria-label={`Damaged ${r.itemName}`} /></Field>
            </div>
          );
        })}
        {off > 0 && <p className="text-xs text-muted-foreground">{off} item{off === 1 ? " is" : "s are"} different from what the van should hold. The difference is booked when the trip is settled.</p>}
      </div>
    </Modal>
  );
}

// ---- settle ----------------------------------------------------------------------------------------------------
export function SettleDialog({ trip, onClose, onDone }) {
  const company = useCompanyProfile();
  const [cashHanded, setCashHanded] = useState("");
  const [ack, setAck] = useState({});
  const [notes, setNotes] = useState("");
  const plan = useAsync(() => trips.settlement(trip.id, { cashHanded: cashHanded === "" ? undefined : cashHanded }), [trip.id, cashHanded]);
  const { busy, error, run } = useAct();
  const p = plan.data;
  const cash = p ? cashPlan(p.cash.expected, cashHanded === "" ? p.cash.expected : cashHanded) : null;
  const warnings = p?.warnings || [];
  const allTicked = warnings.every((w) => ack[w.code]);
  const blocked = Boolean(p?.blockers?.length);

  return (
    <Modal size="lg" title={`Settle ${trip.tripNo}`} description="Hand in the cash, then tick each difference to book it." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={!p || blocked || !allTicked}
        label="Settle trip" onSubmit={async () => { const r = await run(async () => trips.settle(trip.id, { cashHanded: cashHanded === "" ? p.cash.expected : Number(cashHanded), acknowledge: warnings.map((w) => w.code), notes })); if (r) onDone(r); }} />}>
      <div className="grid grid-cols-1 gap-3">
        <ErrorLine error={error} />
        {plan.error && <ErrorNote error={plan.error} onRetry={plan.reload} />}
        {plan.loading && !p && <Spinner label="Working out the settlement" />}
        {p && (
          <>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <Tile label="Cash taken" value={formatCurrencyAED(p.cash.expected)} />
              <Tile label="Cheques" value={`${p.cheques.length}`} />
              <Tile label="Stock difference" value={formatCurrencyAED(p.stockVarianceValue)} />
            </div>
            {p.expenses > 0 && <p className="text-sm text-muted-foreground">The cash taken is net of {formatCurrencyAED(p.expenses)} spent on the road from the van's cash.</p>}
            {p.cheques.length > 0 && (
              <div><button type="button" onClick={() => printMarkup(depositSlipMarkup({ company, trip, cheques: p.cheques, currency: orgCurrency(), day: new Date().toISOString().slice(0, 10) }))} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><Printer className="h-4 w-4" aria-hidden="true" /> Print the cheque deposit slip</button></div>
            )}
            <Field label="Cash handed in" hint={cash?.short ? `${formatCurrencyAED(cash.short)} short, owed by the salesman` : cash?.over ? `${formatCurrencyAED(cash.over)} over` : "Matches what the van took"}>
              <AmountInput value={cashHanded} onChange={(e) => setCashHanded(e.target.value)} placeholder={String(round2(p.cash.expected))} inputMode="decimal" />
            </Field>
            {p.blockers.map((b) => <ErrorNote key={b.code} error={new Error(b.message)} />)}
            {warnings.map((w) => (
              <label key={w.code} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <input type="checkbox" className="mt-0.5" checked={Boolean(ack[w.code])} onChange={(e) => setAck((a) => ({ ...a, [w.code]: e.target.checked }))} />
                <span>{w.message}</span>
              </label>
            ))}
            {p.rows.some((r) => r.difference !== 0 || r.countedDamaged > 0) && (
              <div className="rounded-lg border border-border">
                {p.rows.filter((r) => r.difference !== 0 || r.countedDamaged > 0).map((r) => (
                  <div key={r.stockId} className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0">
                    <span className="min-w-0 truncate">{r.itemName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.difference ? `${r.difference > 0 ? "+" : ""}${r.difference} counted` : ""}{r.countedDamaged ? ` ${r.countedDamaged} damaged` : ""}</span>
                  </div>
                ))}
              </div>
            )}
            <Field label="Note (optional)"><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
          </>
        )}
      </div>
    </Modal>
  );
}

const Tile = ({ label, value }) => (
  <div className="rounded-lg border border-border p-2.5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-0.5 whitespace-nowrap font-medium">{value}</p>
  </div>
);
