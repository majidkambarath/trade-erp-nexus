import React, { useState } from "react";
import { Button } from "../ui/button";
import Can from "../shell/Can.jsx";
import { claims } from "../../lib/garageApi";
import { CLAIM_STATUS, garageErrorText } from "../../lib/garage";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { AmountInput, ConfirmDialog, DateInput, ErrorNote, Field, Modal, Pill, Select, Spinner, TextInput, useAsync } from "../accounting/kit";

const DECISIONS = [["APPROVED", "Approved in full"], ["PARTLY_APPROVED", "Partly approved"], ["REJECTED", "Rejected"]];

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
const money = (n) => formatCurrencyAED(Number(n) || 0);

function SurveyDialog({ claim, onClose, onDone }) {
  const [surveyorName, setSurveyorName] = useState("");
  const [company, setCompany] = useState("");
  const [visitedAt, setVisitedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    if (!surveyorName.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const r = await claims.recordSurvey(claim._id, { surveyorName, company, visitedAt: visitedAt || undefined, notes });
      onDone(r, "Survey recorded.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Record the survey"
      description="The surveyor's own visit, before the insurer decides."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !surveyorName.trim()}>{busy ? "Saving…" : "Save survey"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <Field label="Surveyor" required error={!surveyorName.trim() ? "Enter the surveyor's name" : undefined}>
          <TextInput value={surveyorName} onChange={(e) => setSurveyorName(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Crawford, Cunningham Lindsey…" /></Field>
          <Field label="Visited"><DateInput value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function DecisionDialog({ claim, jobTotal, onClose, onDone }) {
  const [status, setStatus] = useState("APPROVED");
  const [lpoNo, setLpoNo] = useState("");
  const [approvedAmount, setApprovedAmount] = useState(jobTotal != null ? String(jobTotal) : "");
  const [excess, setExcess] = useState("");
  const [depPct, setDepPct] = useState("");
  const [depAmount, setDepAmount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const rejecting = status === "REJECTED";

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const body = rejecting
        ? { status, reason }
        : { status, lpoNo, approvedAmount: Number(approvedAmount) || 0, note, deductions: { excess: Number(excess) || 0, partsDepreciationPct: Number(depPct) || 0, depreciablePartsAmount: Number(depAmount) || 0 } };
      const r = await claims.recordApproval(claim._id, body);
      onDone(r, rejecting ? "Claim rejected." : "The insurer's decision was recorded.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="The insurer's decision"
      description="An approval needs the LPO number - the evidence the work was authorised."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save decision"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <Field label="Decision">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>{DECISIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        </Field>
        {rejecting ? (
          <Field label="Why"><TextInput value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="LPO / approval number" required error={!lpoNo.trim() ? "Required" : undefined}><TextInput value={lpoNo} onChange={(e) => setLpoNo(e.target.value)} placeholder="LPO-2026-5521" autoFocus /></Field>
              <Field label="Amount approved"><AmountInput value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} min="0" /></Field>
            </div>
            <p className="text-xs text-muted-foreground">What the customer pays instead of the insurer - the excess, and any depreciation on new parts replaced.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Excess"><AmountInput value={excess} onChange={(e) => setExcess(e.target.value)} min="0" /></Field>
              <Field label="Depreciation %"><AmountInput value={depPct} onChange={(e) => setDepPct(e.target.value)} min="0" /></Field>
              <Field label="On parts worth"><AmountInput value={depAmount} onChange={(e) => setDepAmount(e.target.value)} min="0" /></Field>
            </div>
            <Field label="Note"><TextInput value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function ClaimView({ id, onClose, onChanged, onRemoved }) {
  const one = useAsync(() => claims.get(id), [id]);
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "delete" | "submit" | "raiseInvoices"
  const [surveying, setSurveying] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const c = one.data;

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
      return null;
    } finally {
      setBusy(false);
    }
  }
  const changed = async (_r, message) => {
    setSurveying(false);
    setDeciding(false);
    onChanged(message);
    await one.reload();
  };

  return (
    <Modal
      size="md"
      onClose={onClose}
      title={c ? `Claim ${c.claimNo || "(draft)"}` : "Insurance claim"}
      description={c ? `${c.insurer?.name || ""} · Policy ${c.policyNo}` : undefined}
      footer={
        c && (
          <div className="flex flex-wrap justify-end gap-2">
            {c.actions?.delete && <Can permission="garage.delete"><Button variant="outline" onClick={() => setConfirm("delete")}>Delete</Button></Can>}
            {c.actions?.submit && <Can permission="garage.edit"><Button variant="outline" onClick={() => setConfirm("submit")}>Submit</Button></Can>}
            {c.actions?.recordSurvey && <Can permission="garage.edit"><Button variant="outline" onClick={() => setSurveying(true)}>Record survey</Button></Can>}
            {c.actions?.recordApproval && <Can permission="garage.approve"><Button onClick={() => setDeciding(true)}>Record decision</Button></Can>}
            {c.actions?.raiseInvoices && <Can permission="garage.invoice"><Button onClick={() => setConfirm("raiseInvoices")}>Raise invoices</Button></Can>}
          </div>
        )
      }
    >
      {one.loading && !c && <Spinner label="Loading the claim" />}
      {one.error && <ErrorNote error={one.error} onRetry={one.reload} />}
      {failure && <div className="mb-4"><ErrorNote error={new Error(garageErrorText(failure))} /></div>}
      {c && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Pill tone={CLAIM_STATUS[c.status]?.tone || "neutral"}>{CLAIM_STATUS[c.status]?.label || c.status}</Pill>
            {c.insurerClaimNo && <span className="text-xs text-muted-foreground">Insurer ref {c.insurerClaimNo}</span>}
            {c.accidentDate && <span className="text-xs text-muted-foreground">Accident {formatDate(c.accidentDate)}</span>}
          </div>

          <Section title="Survey">
            {c.survey?.surveyorName ? (
              <p className="text-sm">
                {c.survey.surveyorName}{c.survey.company ? ` (${c.survey.company})` : ""}
                {c.survey.visitedAt ? ` · visited ${formatDate(c.survey.visitedAt)}` : ""}
                {c.survey.notes && <span className="block text-muted-foreground">{c.survey.notes}</span>}
              </p>
            ) : <p className="text-sm text-muted-foreground">Not yet surveyed.</p>}
          </Section>

          <Section title="The insurer's decision">
            {c.approval?.lpoNo ? (
              <p className="text-sm">
                LPO {c.approval.lpoNo} · approved {money(c.approval.approvedAmount)}
                {c.approval.note && <span className="block text-muted-foreground">{c.approval.note}</span>}
              </p>
            ) : c.status === "REJECTED" ? (
              <p className="text-sm text-status-danger">Rejected{c.rejectReason ? `: ${c.rejectReason}` : ""}</p>
            ) : <p className="text-sm text-muted-foreground">Waiting for the insurer's decision.</p>}
            {(c.deductions?.excess > 0 || c.deductions?.partsDepreciationPct > 0) && (
              <p className="mt-1 text-xs text-muted-foreground">
                Excess {money(c.deductions.excess)}
                {c.deductions.partsDepreciationPct > 0 ? ` · ${c.deductions.partsDepreciationPct}% depreciation on ${money(c.deductions.depreciablePartsAmount)} of parts` : ""}
              </p>
            )}
          </Section>

          {c.split?.insurerAmount != null && (
            <Section title="The split">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Insurer pays</p><p className="text-lg font-semibold">{money(c.split.insurerAmount)}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Customer pays</p><p className="text-lg font-semibold">{money(c.split.customerAmount)}</p></div>
              </div>
            </Section>
          )}

          {c.invoices?.length > 0 && (
            <Section title="Invoices">
              <ul className="divide-y rounded-lg border text-sm">
                {c.invoices.map((inv, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{inv.no} <span className="text-muted-foreground">({inv.billTo})</span></span>
                    <span className="tabular-nums">{money(inv.amount)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
        </div>
      )}

      {confirm === "delete" && (
        <ConfirmDialog title="Delete this draft claim?" text="Nothing has been submitted. It is deleted for good." confirmLabel="Delete" danger busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => claims.remove(c._id), "Claim deleted.").then(() => onRemoved("Claim deleted."))} />
      )}
      {confirm === "submit" && (
        <ConfirmDialog title="Submit this claim?" text="It moves to waiting for a survey." confirmLabel="Submit" busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => claims.submit(c._id), "Claim submitted.")} />
      )}
      {confirm === "raiseInvoices" && (
        <ConfirmDialog title="Raise the invoices?" text="One to the insurer for the approved repair, and (if anything is owed) one to the customer for the excess and any depreciation." confirmLabel="Raise invoices" busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => claims.raiseInvoices(c._id), "Invoices raised.")} />
      )}
      {surveying && <SurveyDialog claim={c} onClose={() => setSurveying(false)} onDone={changed} />}
      {deciding && <DecisionDialog claim={c} jobTotal={c?.approval?.approvedAmount} onClose={() => setDeciding(false)} onDone={changed} />}
    </Modal>
  );
}
