import React, { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { formatDateGB, formatNumber } from "../../utils/format";
import { Button } from "../ui/button";
import { EmptyState, ErrorNote, Field, Modal, Panel, Pill, Select, Spinner, TextInput, Textarea, errorMessage, useAsync, DateInput } from "../accounting/kit";

const TONE = { RECEIVED: "warning", ACCEPTED: "success", REJECTED: "danger" };
const LABEL = { RECEIVED: "To review", ACCEPTED: "Accepted", REJECTED: "Rejected" };

// Invoices from suppliers. Each is matched to a vendor (by TRN or participant id) and, where it
// can be, to the purchase order it bills. Accepting records the decision and the link; it does not
// create a purchase document by itself.
export default function Inbound({ notify }) {
  const [status, setStatus] = useState("");
  const list = useAsync(() => einvoice.inbound({ status: status || undefined }), [status]);
  const [adding, setAdding] = useState(false);
  const [deciding, setDeciding] = useState(null); // { invoice, decision }

  return (
    <Panel
      bodyClassName="p-0" title="Invoices received"
      description="Review each supplier invoice against what you ordered before accepting it."
      actions={
        <>
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-36 rounded-full">
            <option value="">All</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
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
                  <span className="text-sm text-muted-foreground">{i.sellerName || "Unknown supplier"}{i.sellerVatTrn ? ` · TRN ${i.sellerVatTrn}` : ""}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">
                  {i.issueDate && <>{formatDateGB(i.issueDate)} · </>}<span className="font-semibold tabular-nums">{formatNumber(i.totals?.payable, 2)}</span> {i.currency} <span className="text-muted-foreground">(VAT {formatNumber(i.totals?.tax, 2)})</span>
                </p>
                <p className={`mt-1 text-xs ${i.matchedVendorId ? "text-muted-foreground" : "text-status-warning"}`}>{i.matchNote}</p>
                {i.status === "REJECTED" && i.decision?.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {i.decision.reason}</p>}
              </div>
              {i.status === "RECEIVED" && (
                <div className="flex items-start gap-2">
                  <Button size="sm" onClick={() => setDeciding({ invoice: i, decision: "accept" })}><Check className="h-3.5 w-3.5" aria-hidden="true" />Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => setDeciding({ invoice: i, decision: "reject" })}><X className="h-3.5 w-3.5" aria-hidden="true" />Reject</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
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
        <Field label="Net (AED)"><TextInput type="number" min="0" step="0.01" value={f.net} onChange={set("net")} /></Field>
        <Field label="VAT (AED)"><TextInput type="number" min="0" step="0.01" value={f.tax} onChange={set("tax")} /></Field>
        <Field label="Total payable (AED)" required error={errors.payable}><TextInput type="number" min="0" step="0.01" value={f.payable} onChange={set("payable")} /></Field>
        <Field label="Your purchase order number" hint="Optional. Helps match it."><TextInput value={f.invoiceRef} onChange={set("invoiceRef")} /></Field>
      </form>
    </Modal>
  );
}

export { errorMessage };
