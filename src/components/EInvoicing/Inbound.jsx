import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, FilePlus2, Plus, RefreshCw, X } from "lucide-react";
import { api, einvoice } from "../../lib/accountingApi";
import { pickerLabel } from "../../lib/itemTypes";
import { CURRENCY, formatDateGB, formatNumber } from "../../utils/format";
import { Button } from "../ui/button";
import { EmptyState, ErrorNote, Field, Modal, Panel, Pill, Select, Spinner, TextInput, Textarea, errorMessage, useAsync, DateInput, AmountInput, SearchSelect } from "../accounting/kit";

const TONE = { RECEIVED: "warning", ACCEPTED: "success", REJECTED: "danger" };
const LABEL = { RECEIVED: "To review", ACCEPTED: "Accepted", REJECTED: "Rejected" };

// Invoices from suppliers. Each is matched to a vendor (by TRN or participant id) and, where it
// can be, to the purchase order it bills. Accepting records the decision and the link; it does not
// create a purchase document by itself.
export default function Inbound({ notify }) {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const notRecorded = params.get("recorded") === "0";
  const setStatus = (v) => { const next = new URLSearchParams(params); if (v) next.set("status", v); else next.delete("status"); next.delete("recorded"); setParams(next, { replace: true }); };
  const list = useAsync(() => einvoice.inbound({ status: status || undefined, recorded: notRecorded ? "0" : undefined }), [status, notRecorded]);
  const [adding, setAdding] = useState(false);
  const [deciding, setDeciding] = useState(null); // { invoice, decision }
  const [recording, setRecording] = useState(null); // the received invoice being recorded as a purchase invoice
  const [checking, setChecking] = useState(false);

  // Ask Wafeq for what has arrived (it also happens by itself every ten minutes).
  async function checkForNew() {
    setChecking(true);
    try {
      const r = await einvoice.inboundPull();
      if (r.skipped) notify(r.reason === "Wafeq is not connected" ? "Connect Wafeq in Settings to receive supplier invoices" : "Checked a moment ago");
      else if (r.errors?.length) notify(`${r.added} new. ${r.errors[0]}`, "error");
      else notify(r.added ? `${r.added} new invoice${r.added === 1 ? "" : "s"} received` : "Nothing new");
      list.reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Panel
      bodyClassName="p-0" title="Invoices received"
      description="Review each supplier invoice against what you ordered before accepting it."
      actions={
        <>
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-36 rounded-full">
            <option value="">All</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Button size="sm" variant="outline" onClick={checkForNew} disabled={checking}><RefreshCw className="h-4 w-4" aria-hidden="true" />{checking ? "Checking…" : "Check for new"}</Button>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" />Add received invoice</Button>
        </>
      }
    >
      {list.loading && !list.data && <Spinner />}
      {list.error && <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>}
      {list.data?.rows?.length === 0 && <EmptyState title="Nothing received" text="Supplier invoices delivered to you appear here. You can also add one by hand." />}
      {list.data?.rows?.length > 0 && (
        <ul className="divide-y divide-border">
          {list.data.rows.map((i) => (
            <li key={i._id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{i.documentId}</span>
                  <Pill tone={TONE[i.status]}>{LABEL[i.status]}</Pill>
                  {i.kind === "credit_note" && <Pill tone="info">Credit note</Pill>}
                  {i.source === "wafeq" && <Pill>From Wafeq</Pill>}
                  <span className="text-sm text-muted-foreground">{i.sellerName || "Unknown supplier"}{i.sellerVatTrn ? ` · TRN ${i.sellerVatTrn}` : ""}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">
                  {i.issueDate && <>{formatDateGB(i.issueDate)} · </>}<span className="font-semibold tabular-nums">{formatNumber(i.totals?.payable, 2)}</span> {i.currency} <span className="text-muted-foreground">(VAT {formatNumber(i.totals?.tax, 2)})</span>
                </p>
                <p className={`mt-1 text-xs ${i.matchedVendorId ? "text-muted-foreground" : "text-status-warning"}`}>{i.matchNote}</p>
                {i.status === "REJECTED" && i.decision?.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {i.decision.reason}</p>}
              </div>
              {i.status === "RECEIVED" && (
                <div className="flex flex-wrap items-start gap-2">
                  {i.matchedVendorId && i.kind !== "credit_note" && <Button size="sm" onClick={() => setRecording(i)}><FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />Record as purchase invoice</Button>}
                  <Button size="sm" variant="outline" onClick={() => setDeciding({ invoice: i, decision: "accept" })}><Check className="h-3.5 w-3.5" aria-hidden="true" />Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => setDeciding({ invoice: i, decision: "reject" })}><X className="h-3.5 w-3.5" aria-hidden="true" />Reject</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {recording && <RecordModal invoice={recording} onClose={() => setRecording(null)} onDone={(m) => { setRecording(null); notify(m); list.reload(); }} />}
      {adding && <AddModal onClose={() => setAdding(false)} onSaved={(m) => { setAdding(false); notify(m); list.reload(); }} />}
      {deciding && <DecisionModal {...deciding} onClose={() => setDeciding(null)} onDone={(m) => { setDeciding(null); notify(m); list.reload(); }} />}
    </Panel>
  );
}

function DecisionModal({ invoice, decision, onClose, onDone }) {
  const accept = decision === "accept";
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(ev) {
    ev.preventDefault();
    if (!accept && !reason.trim()) return setError(new Error("Give a reason so the supplier can correct it"));
    setBusy(true);
    try {
      await (accept ? einvoice.accept(invoice._id, {}) : einvoice.reject(invoice._id, { reason: reason.trim() }));
      onDone(`${invoice.documentId} ${accept ? "accepted" : "rejected"}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  return (
    <Modal size="sm" onClose={onClose} title={`${accept ? "Accept" : "Reject"} ${invoice.documentId}?`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="decide-form" variant={accept ? "default" : "destructive"} disabled={busy}>{busy ? "Saving…" : accept ? "Accept invoice" : "Reject invoice"}</Button></>}>
      <form id="decide-form" onSubmit={submit} noValidate className="grid gap-4">
        <ErrorNote error={error} />
        {accept
          ? <p className="text-sm text-muted-foreground">{invoice.suggestedPurchaseOrderId ? `It will be linked to purchase order ${invoice.suggestedPurchaseOrderId.transactionNo}.` : "No purchase order matches, so it will be accepted without a link."} The decision is recorded and cannot be changed.</p>
          : <Field label="Reason" required hint="Sent back to the supplier."><Textarea value={reason} onChange={(e) => setReason(e.target.value)} data-autofocus maxLength={300} /></Field>}
      </form>
    </Modal>
  );
}

function AddModal({ onClose, onSaved }) {
  const [f, setF] = useState({ documentId: "", sellerName: "", sellerVatTrn: "", sellerParticipantId: "", issueDate: "", net: "", tax: "", payable: "", invoiceRef: "" });
  const [errors, setErrors] = useState({});
  const [topError, setTopError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function submit(ev) {
    ev.preventDefault();
    const e = {};
    if (!f.documentId.trim()) e.documentId = "Enter the supplier's invoice number";
    if (!f.sellerName.trim()) e.sellerName = "Enter the supplier's name";
    if (f.sellerVatTrn && !/^\d{15}$/.test(f.sellerVatTrn)) e.sellerVatTrn = "A TRN is 15 digits";
    if (f.sellerParticipantId && !/^\d+:\d+$/.test(f.sellerParticipantId)) e.sellerParticipantId = "Looks like 0235:100123456700003";
    if (f.payable === "" || !(Number(f.payable) > 0)) e.payable = "Enter the total payable";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await einvoice.addInbound({
        documentId: f.documentId.trim(), sellerName: f.sellerName.trim(), sellerVatTrn: f.sellerVatTrn || undefined,
        sellerParticipantId: f.sellerParticipantId || undefined, issueDate: f.issueDate || undefined, invoiceRef: f.invoiceRef || undefined,
        lineExtensionTotal: f.net === "" ? undefined : Number(f.net), taxAmount: f.tax === "" ? undefined : Number(f.tax), payableAmount: Number(f.payable),
        providerId: `manual:${f.sellerVatTrn || f.sellerName}:${f.documentId}`,
      });
      onSaved(r.duplicate ? "That invoice was already recorded" : r.matchNote || "Invoice recorded");
    } catch (err) {
      setTopError(err);
      setBusy(false);
    }
  }
  return (
    <Modal size="lg" onClose={onClose} title="Add a received invoice" description="Enter an invoice a supplier sent you. It is matched to the vendor and purchase order automatically."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="inbound-form" disabled={busy}>{busy ? "Saving…" : "Record invoice"}</Button></>}>
      <form id="inbound-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {topError && <div className="sm:col-span-2"><ErrorNote error={topError} /></div>}
        <Field label="Supplier's invoice number" required error={errors.documentId}><TextInput value={f.documentId} onChange={set("documentId")} data-autofocus /></Field>
        <Field label="Invoice date"><DateInput value={f.issueDate} onChange={set("issueDate")} /></Field>
        <Field label="Supplier name" required error={errors.sellerName} className="sm:col-span-2"><TextInput value={f.sellerName} onChange={set("sellerName")} /></Field>
        <Field label="Supplier TRN" error={errors.sellerVatTrn} hint="Used to find the vendor."><TextInput inputMode="numeric" value={f.sellerVatTrn} onChange={set("sellerVatTrn")} maxLength={15} /></Field>
        <Field label="Participant ID" error={errors.sellerParticipantId}><TextInput value={f.sellerParticipantId} onChange={set("sellerParticipantId")} placeholder="0235:…" /></Field>
        <Field label={`Net (${CURRENCY})`}><AmountInput min="0" value={f.net} onChange={set("net")} /></Field>
        <Field label={`VAT (${CURRENCY})`}><AmountInput min="0" value={f.tax} onChange={set("tax")} /></Field>
        <Field label={`Total payable (${CURRENCY})`} required error={errors.payable}><AmountInput min="0" value={f.payable} onChange={set("payable")} /></Field>
        <Field label="Your purchase order number" hint="Optional. Helps match it."><TextInput value={f.invoiceRef} onChange={set("invoiceRef")} /></Field>
      </form>
    </Modal>
  );
}

export { errorMessage };

// One item for each line the supplier billed; the tax comes from the supplier's own category and rate. It makes a DRAFT purchase invoice
// (approving it is the ordinary purchase approval) and says plainly if its total differs from what the supplier billed.
function RecordModal({ invoice, onClose, onDone }) {
  const navigate = useNavigate();
  const stocks = useAsync(() => api.get("/stock/stock"), []);
  const options = useMemo(() => (stocks.data?.stocks || []).map((s) => ({ value: s._id, label: pickerLabel(s), hint: s.itemId, sku: String(s.sku || s.itemId || "").toLowerCase(), name: String(s.itemName || "").toLowerCase() })), [stocks.data]);
  const [chosen, setChosen] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  // an item already chosen by hand wins; else the supplier's own item code or name, matched to our SKU or name
  const pick = (l, i) => chosen[i] ?? options.find((o) => (l.sellerItemId && o.sku === String(l.sellerItemId).toLowerCase()) || (l.itemName && o.name === String(l.itemName).toLowerCase()))?.value ?? "";
  const lines = invoice.lines || [];
  const ready = lines.length > 0 && lines.every((l, i) => pick(l, i));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      setResult(await einvoice.inboundToPurchase(invoice._id, { lines: lines.map((l, i) => ({ itemId: pick(l, i) })) }));
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  if (result) {
    return (
      <Modal size="md" onClose={() => onDone(`${invoice.documentId} recorded as ${result.transactionNo}`)} title="Recorded as a draft purchase invoice"
        footer={<><Button variant="outline" onClick={() => onDone(`${invoice.documentId} recorded as ${result.transactionNo}`)}>Close</Button><Button onClick={() => navigate(`/purchase-order?search=${encodeURIComponent(result.transactionNo)}`)}>Open {result.transactionNo}</Button></>}>
        <p className="text-sm">Draft <span className="font-mono font-semibold">{result.transactionNo}</span> was made from {invoice.documentId}. Review it and approve it like any purchase invoice.</p>
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${Math.abs(result.difference) < 0.005 ? "bg-status-success-soft text-status-success" : "bg-status-warning-soft text-status-warning"}`}>
          {Math.abs(result.difference) < 0.005 ? `Its total, ${formatNumber(result.total, 2)}, equals what the supplier billed.` : `Its total is ${formatNumber(result.total, 2)} but the supplier billed ${formatNumber(result.receivedTotal, 2)}: a difference of ${formatNumber(result.difference, 2)}. Check the lines before approving.`}
        </p>
      </Modal>
    );
  }
  return (
    <Modal size="lg" onClose={onClose} title={`Record ${invoice.documentId} as a purchase invoice`} description="Choose the item for each line. The supplier's quantity, price and tax are used as billed."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !ready}>{busy ? "Saving…" : "Make draft purchase invoice"}</Button></>}>
      <div className="space-y-3">
        {error && <ErrorNote error={error} />}
        {stocks.loading && !stocks.data && <Spinner />}
        {lines.map((l, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{l.itemName || "(no name)"}</p>
              <p className="text-xs text-muted-foreground">{formatNumber(l.quantity, 2)} × {formatNumber(l.unitPrice, 2)} · {l.taxCategory || "no tax"} {l.taxRatePercent}% · net {formatNumber(l.lineNetAmount, 2)}</p>
            </div>
            <SearchSelect aria-label={`Item for line ${i + 1}`} value={pick(l, i)} options={options} placeholder="Choose our item" onChange={(v) => setChosen((c) => ({ ...c, [i]: v || "" }))} />
          </div>
        ))}
        <p className="text-sm text-muted-foreground">Supplier total: <span className="font-semibold tabular-nums">{formatNumber(invoice.totals?.payable, 2)}</span> {invoice.currency}</p>
      </div>
    </Modal>
  );
}
