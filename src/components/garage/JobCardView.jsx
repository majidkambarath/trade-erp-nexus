import React, { useState } from "react";
import { Download, Plus, Printer, X } from "lucide-react";
import { Button } from "../ui/button";
import Can from "../shell/Can.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";
import { jobCards, claims } from "../../lib/garageApi";
import { JOB_STATUS, TASK_STATUS, INVOICE_STATUS_LABEL, garageErrorText } from "../../lib/garage";
import { useGarageMasters, CompleteTaskDialog } from "./garageShared";
import JobCardForm from "./JobCardForm";
import ClaimView from "./ClaimView";
import CheckInDialog from "./CheckInDialog";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { AmountInput, ConfirmDialog, DateInput, ErrorNote, Field, Modal, Pill, SearchSelect, Select, Spinner, TextInput, useAsync } from "../accounting/kit";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { downloadSheetsPdf, printMarkup, sheetMarkup } from "../PurchaseOrder/shared/documentPdf";
import { readAccent } from "../PurchaseOrder/shared/invoiceModel";
import { orgCurrency } from "../../utils/orgLocale";
import { buildEstimateDocument, buildGatePassDocument, buildJobCardDocument } from "./garageDocuments";

const APPROVAL_METHODS = [["whatsapp", "WhatsApp"], ["email", "Email"], ["signed", "Signed"], ["call", "A call"], ["counter", "At the counter"], ["lpo", "Insurer's LPO"], ["portal", "Online portal"]];

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

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
  const [rows, setRows] = useState([{ kind: "part", itemId: "", qty: "1", price: "", vendorId: "" }]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const setRow = (i, patch) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const stocked = new Set(["part", "consumable"]);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const lines = rows.filter((r) => r.itemId).map((r) => ({ kind: r.kind, itemId: r.itemId, qty: Number(r.qty) || 0, price: Number(r.price) || 0, vendorId: r.kind === "sublet" ? r.vendorId : undefined }));
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
            <div key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)_5rem_6rem_2.5rem] items-start gap-2 rounded-lg border p-2">
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
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} aria-label="Remove"><X className="h-4 w-4" /></Button>
            </div>
          );
        })}
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setRows((r) => [...r, { kind: "part", itemId: "", qty: "1", price: "", vendorId: "" }])}><Plus className="me-1 h-4 w-4" /> Add line</Button>
      </div>
    </Modal>
  );
}

// Raising the invoice: who it bills (the customer, or - once a job card carries a claim - the insurer) and
// which approved lines go on it. Defaults to every approved line, for the ordinary one-invoice job.
function CreateInvoiceDialog({ card, onClose, onDone }) {
  const approved = card.lines.filter((l) => l.approved !== false && !l.invoiced);
  const [picked, setPicked] = useState(() => new Set(approved.map((l) => String(l._id))));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const total = approved.filter((l) => picked.has(String(l._id))).reduce((t, l) => t + (Number(l.lineTotal) || 0), 0);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const r = await jobCards.createInvoice(card._id, { billTo: "customer", lineIds: [...picked] });
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
          <Field label="Odometer out (km)"><AmountInput value={odometerOut} onChange={(e) => setOdometerOut(e.target.value)} min="0" /></Field>
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

// Print/download a sheet without leaving the dialog: the same markup InvoiceScreen's own buttons draw
// (documentPdf.js), just invoked directly rather than through that full page-navigation screen.
function PrintRow({ card }) {
  const company = useCompanyProfile();
  const currency = orgCurrency();
  const accent = readAccent();
  const [busy, setBusy] = useState(null);
  const DOCS = [
    ["jobcard", "Job card", buildJobCardDocument],
    ["estimate", "Estimate", buildEstimateDocument],
    ...(card.delivery?.gatePassAt ? [["gatepass", "Gate pass", buildGatePassDocument]] : []),
  ];
  async function download(key, build) {
    setBusy(key);
    try {
      const doc = build(card, company, currency);
      await downloadSheetsPdf([sheetMarkup(doc.sheet, { copy: doc.copies[0], accent })], doc.fileName);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Print</span>
      {DOCS.map(([key, label, build]) => (
        <React.Fragment key={key}>
          <Button type="button" variant="outline" size="sm" onClick={() => { const doc = build(card, company, currency); printMarkup(sheetMarkup(doc.sheet, { copy: doc.copies[0], accent })); }}>
            <Printer className="me-1 h-3.5 w-3.5" /> {label}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy === key} onClick={() => download(key, build)} aria-label={`Download ${label} PDF`}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function JobCardView({ id, onClose, onChanged, onRemoved }) {
  const one = useAsync(() => jobCards.get(id), [id]);
  const masters = useGarageMasters();
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "delete" | "sendEstimate" | "cancel"
  const [cancelReason, setCancelReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [revising, setRevising] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [openingClaim, setOpeningClaim] = useState(false);
  const [viewingClaim, setViewingClaim] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [raisingPO, setRaisingPO] = useState(false);
  const c = one.data;
  const shortages = useAsync(() => (c ? jobCards.shortages(c._id) : Promise.resolve([])), [c?._id]);

  async function run(fn, message) {
    setBusy(true);
    setFailure(null);
    try {
      const r = await fn();
      setConfirm(null);
      onChanged(typeof message === "function" ? message(r) : message);
      await one.reload();
      return r;
    } catch (err) {
      setFailure(err);
      setConfirm(null);
      setBusy(false);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const changed = async (_r, message) => {
    setApproving(false);
    setRevising(false);
    setInvoicing(false);
    setReleasing(false);
    onChanged(message);
    await one.reload();
  };

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={c ? `Job card ${c.jobNo || "(draft)"}` : "Job card"}
      description={c ? `${c.vehicle?.plateNumber || c.vehicle?.chassisNo || ""} · ${[c.vehicle?.make, c.vehicle?.model].filter(Boolean).join(" ")} · ${c.customer?.name || ""}` : undefined}
      footer={
        c && (
          <div className="flex flex-wrap justify-end gap-2">
            {c.actions?.delete && <Can permission="garage.delete"><Button variant="outline" onClick={() => setConfirm("delete")}>Delete</Button></Can>}
            {c.actions?.checkIn && <Can permission="garage.edit"><Button variant="outline" onClick={() => setCheckingIn(true)}>Check-in</Button></Can>}
            {c.actions?.edit && <Can permission="garage.edit"><Button variant="outline" onClick={() => setEditing(true)}>Edit</Button></Can>}
            {c.actions?.cancel && <Can permission="garage.edit"><Button variant="outline" onClick={() => setConfirm("cancel")}>Cancel job</Button></Can>}
            {c.actions?.sendEstimate && <Can permission="garage.edit"><Button variant="outline" onClick={() => setConfirm("sendEstimate")}>Send estimate</Button></Can>}
            {c.actions?.recordApproval && <Can permission="garage.approve"><Button onClick={() => setApproving(true)}>Record decision</Button></Can>}
            {c.actions?.reviseEstimate && <Can permission="garage.edit"><Button variant="outline" onClick={() => setRevising(true)}>Supplementary estimate</Button></Can>}
            {c.actions?.createInvoice && <Can permission="garage.invoice"><Button onClick={() => setInvoicing(true)}>Raise invoice</Button></Can>}
            {c.actions?.release && <Can permission="garage.approve"><Button onClick={() => setReleasing(true)}>Release vehicle</Button></Can>}
          </div>
        )
      }
    >
      {one.loading && !c && <Spinner label="Loading the job card" />}
      {one.error && <ErrorNote error={one.error} onRetry={one.reload} />}
      {failure && <div className="mb-4"><ErrorNote error={new Error(garageErrorText(failure))} /></div>}
      {c && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Pill tone={JOB_STATUS[c.status]?.tone || "neutral"}>{JOB_STATUS[c.status]?.label || c.status}</Pill>
            <Pill tone="neutral">{INVOICE_STATUS_LABEL[c.invoiceStatus] || c.invoiceStatus}</Pill>
            {c.comebackOf && <Pill tone="warning">Comeback</Pill>}
            {c.promisedAt && <span className="text-xs text-muted-foreground">Promised {formatDate(c.promisedAt)}</span>}
            {c.odometerIn != null && <span className="text-xs text-muted-foreground">In at {c.odometerIn} km</span>}
          </div>

          <PrintRow card={c} />

          {c.jobType === "insurance" && (
            <Section title="Insurance claim">
              {c.claimId ? (
                <Button variant="outline" size="sm" onClick={() => setViewingClaim(true)}>View claim</Button>
              ) : (
                <Can permission="garage.create">
                  <Button variant="outline" size="sm" onClick={() => setOpeningClaim(true)}>Open insurance claim</Button>
                </Can>
              )}
            </Section>
          )}

          {(c.checkIn?.damagePoints?.length > 0 || c.checkIn?.itemsPresent?.length > 0 || c.checkIn?.notes) && (
            <Section title="The walk-around">
              {c.checkIn.itemsPresent?.length > 0 && <p className="text-sm text-muted-foreground">With them: {c.checkIn.itemsPresent.join(", ")}</p>}
              {c.checkIn.damagePoints?.length > 0 && (
                <ul className="mt-1 grid gap-1 text-sm">
                  {c.checkIn.damagePoints.map((d, i) => (
                    <li key={i}>
                      <span className="font-medium">{d.panel}</span> - {d.kind}{d.notes ? `: ${d.notes}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {c.checkIn.notes && <p className="mt-1 text-sm text-muted-foreground">{c.checkIn.notes}</p>}
            </Section>
          )}

          <Section title="What the customer reported">
            {c.complaints?.length ? (
              <ul className="grid gap-1.5 text-sm">
                {c.complaints.map((comp) => (
                  <li key={comp._id} className="rounded-lg border px-3 py-2">
                    <span className="font-medium">{comp.concern}</span>
                    {comp.cause && <span className="text-muted-foreground"> · {comp.cause}</span>}
                    {comp.correction && <span className="text-muted-foreground"> · {comp.correction}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Nothing recorded.</p>}
          </Section>

          <Section title="The estimate">
            {c.lines?.length ? (
              <>
                <ul className="divide-y rounded-lg border text-sm">
                  {c.lines.map((l) => (
                    <li key={l._id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="me-2 rounded bg-secondary px-1.5 py-0.5 text-xs uppercase text-muted-foreground">{l.kind}</span>
                        {l.description}
                      </span>
                      <span className="shrink-0 tabular-nums">{money(l.lineTotal)}</span>
                      <Pill tone={l.invoiced ? "info" : l.approved === false ? "neutral" : "success"}>
                        {l.invoiced ? "Invoiced" : l.approved === false ? "Pending" : "Approved"}
                      </Pill>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-end text-sm font-medium">Total (approved): {money(c.totals?.total)}</p>
              </>
            ) : <p className="text-sm text-muted-foreground">No lines yet. Edit the card to add parts and labour.</p>}
          </Section>

          {shortages.data?.length > 0 && (
            <Section title="Short of stock">
              <ul className="grid gap-1.5 text-sm">
                {shortages.data.map((s) => (
                  <li key={s.itemId} className="flex items-center justify-between gap-2 rounded-lg border border-status-warning/40 bg-status-warning-soft px-3 py-2">
                    <span>
                      {s.itemName} <span className="text-muted-foreground">- short {s.short} ({s.onHand} on hand)</span>
                      {s.vendorName && <span className="ms-1 text-xs text-muted-foreground">usually from {s.vendorName}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Can permission="garage.edit">
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setRaisingPO(true)}>Raise purchase order</Button>
              </Can>
            </Section>
          )}

          {c.purchaseOrders?.length > 0 && (
            <Section title="Purchase orders raised">
              <ul className="divide-y rounded-lg border text-sm">
                {c.purchaseOrders.map((po, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{po.no} <span className="text-muted-foreground">({po.vendorName})</span></span>
                    <span className="tabular-nums">{money(po.amount)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Tasks">
            {c.tasks?.length ? (
              <ul className="grid gap-2">
                {c.tasks.map((t) => {
                  const label = TASK_STATUS[t.status] || { label: t.status, tone: "neutral" };
                  return (
                    <li key={t._id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="font-medium">{t.stage}. {t.name}</span>
                          <span className="ms-2 text-xs text-muted-foreground">{t.mode === "sublet" ? t.vendorName : t.staffName || "Unassigned"}</span>
                        </span>
                        <Pill tone={label.tone}>{label.label}</Pill>
                      </div>
                      {(t.actions?.start || t.actions?.complete) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {t.actions.start && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => jobCards.startTask(c._id, t._id), `${t.name} started.`)}>Start</Button>}
                          {t.actions.complete && <Button size="sm" onClick={() => setCompleting(t)}>Done</Button>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No tasks yet.</p>}
          </Section>

          {c.invoices?.length > 0 && (
            <Section title="Invoices">
              <ul className="divide-y rounded-lg border text-sm">
                {c.invoices.map((inv, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{inv.no} <span className="text-muted-foreground">({inv.billTo})</span></span>
                    <span className="tabular-nums">{money(inv.amount)}</span>
                    <Pill tone={inv.status === "APPROVED" ? "success" : "warning"}>{inv.status}</Pill>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {c.delivery?.gatePassAt && (
            <Section title="Delivery">
              <p className="text-sm text-muted-foreground">
                Released {formatDate(c.delivery.gatePassAt)}{c.delivery.handedTo ? ` to ${c.delivery.handedTo}` : ""}
                {c.warranty?.until ? ` · warranty until ${formatDate(c.warranty.until)}` : ""}
              </p>
            </Section>
          )}

          {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
        </div>
      )}

      {confirm === "delete" && (
        <ConfirmDialog title="Delete this draft?" text="Nothing has moved. It is deleted for good." confirmLabel="Delete" danger busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => jobCards.remove(c._id), "Job card deleted.").then(() => onRemoved("Job card deleted."))} />
      )}
      {confirm === "sendEstimate" && (
        <ConfirmDialog title="Send the estimate?" text="The card moves to waiting for approval." confirmLabel="Send" busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => jobCards.sendEstimate(c._id), "Estimate sent.")} />
      )}
      {confirm === "cancel" && (
        <Modal size="sm" onClose={() => setConfirm(null)} title={`Cancel ${c?.jobNo || "this job"}?`}
          footer={<><Button variant="outline" onClick={() => setConfirm(null)}>Back</Button><Button variant="destructive" disabled={busy || !cancelReason.trim()} onClick={() => run(() => jobCards.cancel(c._id, { reason: cancelReason }), "Job card cancelled.")}>{busy ? "Cancelling…" : "Cancel job"}</Button></>}
        >
          <Field label="Why" required><TextInput value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus /></Field>
        </Modal>
      )}
      {editing && <JobCardForm jobCard={c} onClose={() => setEditing(false)} onSaved={(r, m) => { setEditing(false); changed(r, m); }} />}
      {checkingIn && <CheckInDialog jobCardId={c._id} checkIn={c.checkIn} onClose={() => setCheckingIn(false)} onDone={(r, m) => { setCheckingIn(false); changed(r, m); }} />}
      {approving && <ApprovalDialog card={c} onClose={() => setApproving(false)} onDone={changed} />}
      {revising && <ReviseEstimateDialog card={c} masters={masters} onClose={() => setRevising(false)} onDone={changed} />}
      {invoicing && <CreateInvoiceDialog card={c} onClose={() => setInvoicing(false)} onDone={changed} />}
      {releasing && <ReleaseDialog card={c} onClose={() => setReleasing(false)} onDone={changed} />}
      {raisingPO && (
        <RaisePurchaseOrderDialog
          cardId={c._id}
          shortages={shortages.data || []}
          masters={masters}
          onClose={() => setRaisingPO(false)}
          onDone={async (_r, m) => { setRaisingPO(false); onChanged(m); await one.reload(); await shortages.reload(); }}
        />
      )}
      {completing && (
        <CompleteTaskDialog
          jobCardId={c._id}
          task={completing}
          onClose={() => setCompleting(null)}
          onDone={async (m) => { setCompleting(null); onChanged(m); await one.reload(); }}
        />
      )}
      {openingClaim && (
        <NewClaimDialog
          jobCardId={c._id}
          masters={masters}
          onClose={() => setOpeningClaim(false)}
          onDone={async (_claim, m) => { setOpeningClaim(false); onChanged(m); await one.reload(); }}
        />
      )}
      {viewingClaim && (
        <ClaimView
          id={c.claimId}
          onClose={() => setViewingClaim(false)}
          onChanged={onChanged}
          onRemoved={async (m) => { setViewingClaim(false); onChanged(m); await one.reload(); }}
        />
      )}
    </Modal>
  );
}
