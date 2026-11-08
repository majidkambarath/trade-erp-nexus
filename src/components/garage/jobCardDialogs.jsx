import React, { useState } from "react";
import { Button } from "../ui/button";
import { Plus, X } from "lucide-react";
import Can from "../shell/Can.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";
import { jobCards, claims } from "../../lib/garageApi";
import { garageErrorText } from "../../lib/garage";
import { formatCurrencyAED } from "../../utils/format";
import { AmountInput, DateInput, ErrorNote, Field, Modal, SearchSelect, Select, TextInput } from "../accounting/kit";

// The six dialogs JobCardView.jsx opens, lifted out verbatim (D14 of the garage UI gaps plan: the job card
// detail was 773 lines with seven components defined inside it). This is a MOVE, not a rewrite - every
// line of behaviour is unchanged, which is the whole point: the existing tests in
// __tests__/GarageScreens.test.jsx still pass against this split exactly as they did against the original
// single file, proving nothing here was altered along the way.

const APPROVAL_METHODS = [["whatsapp", "WhatsApp"], ["email", "Email"], ["signed", "Signed"], ["call", "A call"], ["counter", "At the counter"], ["lpo", "Insurer's LPO"], ["portal", "Online portal"]];

function money(n) {
  return formatCurrencyAED(Number(n) || 0);
}

// The customer's or the insurer's decision on the estimate: whole, or just the lines actually accepted.
// The first decision releases the first stage of tasks; a later one (after reviseEstimate added more) only
// settles the lines actually named, leaving the rest exactly where an earlier decision left it.
function ApprovalDialog({ card, onClose, onDone }) {
  const [method, setMethod] = useState("whatsapp");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const first = card.status === "AWAITING_APPROVAL";
  const candidates = first ? card.lines : card.lines.filter((l) => l.approved === false);
  const [picked, setPicked] = useState(() => new Set(candidates.map((l) => String(l._id))));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const r = await jobCards.recordApproval(card._id, { method, reference, note, lineIds: [...picked] });
      onDone(r, "Approval recorded.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="Record the decision"
      description={first ? "Whole, or just the lines actually accepted." : "Settles the lines you tick; everything already decided is left alone."}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || picked.size === 0}>{busy ? "Saving…" : "Record approval"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="How it was given">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>{APPROVAL_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          </Field>
          <Field label="Reference" required={method === "lpo"} error={method === "lpo" && !reference.trim() ? "Enter the LPO or approval number" : undefined}>
            <TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === "lpo" ? "LPO-99112" : "Message id, optional…"} />
          </Field>
        </div>
        <Field label="Which lines"><span /></Field>
        <ul className="grid gap-2 rounded-lg border p-2">
          {candidates.map((l) => (
            <li key={l._id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={picked.has(String(l._id))} onChange={() => toggle(String(l._id))} />
              <span className="min-w-0 flex-1 truncate">{l.description}</span>
              <span className="tabular-nums text-muted-foreground">{money(l.lineTotal)}</span>
            </li>
          ))}
          {candidates.length === 0 && <li className="text-sm text-muted-foreground">Nothing is waiting for a decision.</li>}
        </ul>
        <Field label="Note"><TextInput value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
// Teardown found more: new lines on the SAME card, pending until named in a later approval. Work already
// released keeps running - this never touches the card's status or its tasks.
function ReviseEstimateDialog({ card, masters, onClose, onDone }) {
  const [rows, setRows] = useState([{ kind: "part", itemId: "", qty: "1", price: "", discountPercent: "", vendorId: "" }]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const setRow = (i, patch) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const stocked = new Set(["part", "consumable"]);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      // A blank price is undefined, not 0 (D11): the server refuses it ("enter the price") while an explicit 0 still passes.
      const lines = rows.filter((r) => r.itemId).map((r) => ({ kind: r.kind, itemId: r.itemId, qty: Number(r.qty) || 0, price: r.price === "" ? undefined : Number(r.price), discountPercent: r.discountPercent ? Number(r.discountPercent) : undefined, vendorId: r.kind === "sublet" ? r.vendorId : undefined }));
      const r = await jobCards.reviseEstimate(card._id, { lines });
      onDone(r, "Supplementary estimate added.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="A supplementary estimate"
      description="What teardown found. It is added as a new line on this same card, waiting for its own decision."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !rows.some((r) => r.itemId)}>{busy ? "Saving…" : "Add to the estimate"}</Button></>}
    >
      <div className="grid gap-2">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        {rows.map((l, i) => {
          const options = stocked.has(l.kind) ? masters.partOptions : masters.serviceOptions;
          return (
            <div key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)_5rem_6rem_5rem_2.5rem] items-start gap-2 rounded-lg border p-2">
              <Select value={l.kind} onChange={(e) => setRow(i, { kind: e.target.value, itemId: "" })}>
                <option value="part">Part</option>
                <option value="labour">Labour</option>
                <option value="sublet">Sublet</option>
                <option value="consumable">Consumable</option>
              </Select>
              <SearchSelect
                value={l.itemId}
                onChange={(v) => setRow(i, { itemId: v, price: masters.itemsById.get(v)?.salesPrice != null ? String(masters.itemsById.get(v).salesPrice) : l.price })}
                options={options}
                placeholder="Choose the item…"
                compact
              />
              <AmountInput value={l.qty} onChange={(e) => setRow(i, { qty: e.target.value })} min="0" aria-label="Quantity" />
              <AmountInput value={l.price} onChange={(e) => setRow(i, { price: e.target.value })} min="0" aria-label="Price" />
              <AmountInput value={l.discountPercent} onChange={(e) => setRow(i, { discountPercent: e.target.value })} min="0" max="100" aria-label="Discount percent" placeholder="Disc %" />
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} aria-label="Remove"><X className="h-4 w-4" /></Button>
            </div>
          );
        })}
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setRows((r) => [...r, { kind: "part", itemId: "", qty: "1", price: "", discountPercent: "", vendorId: "" }])}><Plus className="me-1 h-4 w-4" /> Add line</Button>
      </div>
    </Modal>
  );
}
// Raising the invoice: who it bills (the customer, or - once a job card carries a claim - the insurer) and
// which approved lines go on it. Defaults to every approved line, for the ordinary one-invoice job.
function CreateInvoiceDialog({ card, onClose, onDone }) {
  const approved = card.lines.filter((l) => l.approved !== false && !l.invoiced);
  const [picked, setPicked] = useState(() => new Set(approved.map((l) => String(l._id))));
  // The workshop's own reference for this bill. It has to be captured HERE: an approved invoice can
  // never be edited (updateTransaction refuses a processed document) and the garage may approve it in
  // the same breath, so this dialog is the only moment it can be typed.
  const [serialNo, setSerialNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const total = approved.filter((l) => picked.has(String(l._id))).reduce((t, l) => t + (Number(l.lineTotal) || 0), 0);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const r = await jobCards.createInvoice(card._id, {
        billTo: "customer",
        lineIds: [...picked],
        ...(serialNo.trim() ? { serialNo: serialNo.trim() } : {}),
      });
      onDone(r.jobCard, `Invoice ${r.invoice.transactionNo} raised.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Raise the invoice"
      description="Bills the lines ticked below, to the customer."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || picked.size === 0}>{busy ? "Raising…" : "Raise invoice"}</Button></>}
    >
      <div className="grid gap-3">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <Field label="Serial no." hint="Optional. Your own reference, printed on the invoice. The invoice number is still given automatically.">
          <TextInput value={serialNo} maxLength={50} onChange={(e) => setSerialNo(e.target.value)} placeholder="e.g. GRG-2026-114" />
        </Field>
        <ul className="grid gap-2 rounded-lg border p-2">
          {approved.map((l) => (
            <li key={l._id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={picked.has(String(l._id))} onChange={() => toggle(String(l._id))} />
              <span className="min-w-0 flex-1 truncate">{l.description}</span>
              <span className="tabular-nums text-muted-foreground">{money(l.lineTotal)}</span>
            </li>
          ))}
          {approved.length === 0 && <li className="text-sm text-muted-foreground">Nothing approved yet.</li>}
        </ul>
        <p className="text-end text-sm font-medium">Total: {money(total)}</p>
      </div>
    </Modal>
  );
}
// Handing the car back. The server is the real check (PAYMENT_DUE, WORK_NOT_FINISHED); this only offers the
// override a manager can make - a fleet account on credit, or a deliberate exception.
function ReleaseDialog({ card, onClose, onDone }) {
  const { can } = useOrganisation();
  const [odometerOut, setOdometerOut] = useState("");
  const [handedTo, setHandedTo] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("");
  const [warrantyKm, setWarrantyKm] = useState("");
  const [onAccount, setOnAccount] = useState(false);
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const r = await jobCards.release(card._id, {
        odometerOut: odometerOut === "" ? undefined : Number(odometerOut),
        handedTo,
        warrantyMonths: warrantyMonths === "" ? undefined : Number(warrantyMonths),
        warrantyKm: warrantyKm === "" ? undefined : Number(warrantyKm),
        onAccount,
        override,
      });
      onDone(r, "Vehicle released.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Release the vehicle"
      description="The gate pass. Refused while work is open or money is owed, unless it is on account."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Releasing…" : "Release"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Odometer out (km)"><AmountInput value={odometerOut} onChange={(e) => setOdometerOut(e.target.value)} min="0" allowNegative /></Field>
          <Field label="Handed to"><TextInput value={handedTo} onChange={(e) => setHandedTo(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Warranty (months)"><AmountInput value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} min="0" /></Field>
          <Field label="Warranty (km)"><AmountInput value={warrantyKm} onChange={(e) => setWarrantyKm(e.target.value)} min="0" /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onAccount} onChange={(e) => setOnAccount(e.target.checked)} />
          Release on account (a fleet customer, or trusted credit)
        </label>
        {can("garage.manage") && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Override - release it regardless
          </label>
        )}
      </div>
    </Modal>
  );
}
// A part this card needs that is not on hand (plan part 1.2 step 8: "if a part is not in stock, a purchase
// order goes to a vendor"). One vendor at a time - the usual case - with its own items ticked by default;
// other vendors' shortages are raised on a second pass. Raising this is informational on the card: the
// storekeeper confirms, receives and invoices it through the ordinary Purchase screens, not here.
function RaisePurchaseOrderDialog({ cardId, shortages, masters, onClose, onDone }) {
  const [vendorId, setVendorId] = useState(shortages[0]?.vendorId || "");
  const [rows, setRows] = useState(() => shortages.map((s) => ({ ...s, picked: s.vendorId === (shortages[0]?.vendorId || s.vendorId), qty: String(s.short), price: String(s.purchasePrice || "") })));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const toggle = (itemId) => setRows((r) => r.map((row) => (row.itemId === itemId ? { ...row, picked: !row.picked } : row)));
  const setRow = (itemId, patch) => setRows((r) => r.map((row) => (row.itemId === itemId ? { ...row, ...patch } : row)));
  const picked = rows.filter((r) => r.picked && Number(r.qty) > 0);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const r = await jobCards.raisePurchaseOrder(cardId, {
        vendorId,
        items: picked.map((p) => ({ itemId: p.itemId, qty: Number(p.qty), price: Number(p.price) || 0 })),
      });
      onDone(r.jobCard, `Purchase order ${r.order.orderNo} raised.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="Raise a purchase order"
      description="For the parts this job is short of. Received and invoiced through the ordinary Purchase screens."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !vendorId || picked.length === 0}>{busy ? "Raising…" : "Raise purchase order"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <Field label="Order from" required error={!vendorId ? "Choose the vendor" : undefined}>
          <SearchSelect value={vendorId} onChange={setVendorId} options={masters.vendorOptions} loading={masters.loading} placeholder="Choose the vendor…" />
        </Field>
        <ul className="grid gap-2 rounded-lg border p-2">
          {rows.map((r) => (
            <li key={r.itemId} className="grid grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem] items-center gap-2 text-sm">
              <input type="checkbox" checked={r.picked} onChange={() => toggle(r.itemId)} />
              <span className="min-w-0 truncate">
                {r.itemName}
                {r.vendorName && <span className="ms-1 text-xs text-muted-foreground">({r.vendorName} usually)</span>}
              </span>
              <AmountInput value={r.qty} onChange={(e) => setRow(r.itemId, { qty: e.target.value })} min="0" aria-label={`Quantity for ${r.itemName}`} />
              <AmountInput value={r.price} onChange={(e) => setRow(r.itemId, { price: e.target.value })} min="0" aria-label={`Price for ${r.itemName}`} />
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
// Opening the insurance side of the job: an insurer, the policy, and - if known yet - the accident itself.
// Everything after this (survey, the insurer's decision, the invoices it raises) happens on the claim's own
// screen (ClaimView.jsx), reached from here once it exists.
function NewClaimDialog({ jobCardId, masters, onClose, onDone }) {
  const [insurerId, setInsurerId] = useState("");
  const [policyNo, setPolicyNo] = useState("");
  const [policyHolder, setPolicyHolder] = useState("");
  const [accidentDate, setAccidentDate] = useState("");
  const [policeReportNo, setPoliceReportNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const canSave = insurerId && policyNo.trim();

  async function submit() {
    if (!canSave) return;
    setBusy(true);
    setFailure(null);
    try {
      const claim = await claims.create({ jobCardId, insurerId, policyNo, policyHolder, accidentDate: accidentDate || undefined, policeReportNo });
      onDone(claim, "Claim opened.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Open an insurance claim"
      description="For the insurer to approve the repair before it goes further."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !canSave}>{busy ? "Saving…" : "Open claim"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <Field label="Insurer" required error={!insurerId ? "Choose the insurer" : undefined}>
          <SearchSelect value={insurerId} onChange={setInsurerId} options={masters.insurerOptions} loading={masters.loading} placeholder="Choose the insurer…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Policy number" required error={!policyNo.trim() ? "Required" : undefined}><TextInput value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} autoFocus /></Field>
          <Field label="Policy holder"><TextInput value={policyHolder} onChange={(e) => setPolicyHolder(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Accident date"><DateInput value={accidentDate} onChange={(e) => setAccidentDate(e.target.value)} /></Field>
          <Field label="Police report no."><TextInput value={policeReportNo} onChange={(e) => setPoliceReportNo(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

export { ApprovalDialog, ReviseEstimateDialog, CreateInvoiceDialog, ReleaseDialog, RaisePurchaseOrderDialog, NewClaimDialog };
