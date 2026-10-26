import React, { useState } from "react";
import { Button } from "../ui/button";
import { AmountInput, DateInput, ErrorNote, Field, inputClass, Modal, Textarea, TextInput } from "../accounting/kit";
import { banking } from "../../lib/bankingApi";
import { bounceBody, bounceErrors, chooseReason, emptyBounce, RETURN_REASONS, returnErrors } from "../../lib/chequeRules";
import { useAction } from "./useAction";
import { ChargeBackFields, FeeFields } from "./ChequeCharges";

// A cheque the bank sent back, and a cheque handed back to the party. The server decides what is allowed and says why in
// its own words; these collect what the act needs. Nothing on the memo section posts: it is recorded for the file.

const today = () => new Date().toISOString().slice(0, 10);

function Tick({ checked, onChange, title, children, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-medium text-foreground">{title}</span>
        {children && <span className="block text-muted-foreground">{children}</span>}
      </span>
    </label>
  );
}

export function BounceDialog({ cheque, onClose, onDone }) {
  const [form, setForm] = useState(emptyBounce);
  const [errs, setErrs] = useState({});
  const customer = cheque.direction === "receipt";
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setErrs({}); };
  const { busy, problem, go } = useAction(() => banking.bounceCheque(cheque._id, bounceBody(form)), onDone, `Cheque ${cheque.chequeNo} marked bounced`);
  const submit = () => {
    const e = bounceErrors(form, { amount: Number(cheque.amount) || 0, customer, today: today() });
    if (Object.keys(e).length) return setErrs(e);
    return go();
  };
  return (
    <Modal
      size="md" onClose={onClose} title={`Cheque ${cheque.chequeNo} bounced`}
      description={`${cheque.voucherNo} is reversed${cheque.direction === "receipt" ? ": the customer owes the invoices it settled again." : ": the vendor is owed the invoices it settled again."}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={submit} disabled={busy}>{busy ? "Working…" : "Mark bounced"}</Button></>}
    >
      <ErrorNote error={problem} />
      <div className="space-y-4">
        <Field label="Why it came back" hint="Pick the bank's reason, or write your own below.">
          <select className={inputClass} value={form.reasonCode} onChange={(e) => setForm((f) => chooseReason(f, e.target.value))}>
            <option value="">Choose…</option>
            {RETURN_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Reason" required error={errs.reason}>
          <Textarea rows={2} value={form.reason} maxLength={250} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. Insufficient funds" data-autofocus />
        </Field>

        <details className="rounded-lg border border-border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">The bank&apos;s memo <span className="font-normal text-muted-foreground">(optional, kept for your file)</span></summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Memo date" error={errs.memoDate}><DateInput value={form.memoDate} max={today()} onChange={(e) => set({ memoDate: e.target.value })} /></Field>
            <Field label="Memo reference"><TextInput value={form.memoRef} maxLength={60} onChange={(e) => set({ memoRef: e.target.value })} /></Field>
            <Field label="Bank certificate reference"><TextInput value={form.certificateRef} maxLength={60} onChange={(e) => set({ certificateRef: e.target.value })} /></Field>
            <Field label="Part the bank paid" hint="If it paid some. The cheque is still reversed in full: enter the part paid as a receipt." error={errs.partialAmount}>
              <AmountInput value={form.partialAmount} onChange={(e) => set({ partialAmount: e.target.value })} min={0} />
            </Field>
          </div>
        </details>

        <Tick checked={form.feeOn} onChange={(v) => set({ feeOn: v })} title="The bank charged a fee">Posted as a bank charge out of the account the cheque was drawn on or deposited to.</Tick>
        {form.feeOn && <FeeFields form={form} errs={errs} set={set} />}

        {customer && (
          <>
            <Tick checked={form.backOn} onChange={(v) => set({ backOn: v })} title="Charge it back to the customer">A debit note on the customer, so they owe it.</Tick>
            {form.backOn && <ChargeBackFields form={form} errs={errs} set={set} />}
          </>
        )}
      </div>
    </Modal>
  );
}

export function ReturnDialog({ cheque, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [errs, setErrs] = useState({});
  const { busy, problem, go } = useAction(() => banking.returnCheque(cheque._id, { reason: reason.trim() }), onDone, `Cheque ${cheque.chequeNo} handed back`);
  const submit = () => { const e = returnErrors({ reason }); return Object.keys(e).length ? setErrs(e) : go(); };
  return (
    <Modal
      size="sm" onClose={onClose} title={`Hand back cheque ${cheque.chequeNo}`}
      description={`Gives the cheque back to ${cheque.partyName || "the party"} before it was presented. ${cheque.voucherNo} is reversed, so the invoices it settled are open again.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Working…" : "Hand back"}</Button></>}
    >
      <ErrorNote error={problem} />
      <Field label="Reason" required error={errs.reason}>
        <Textarea rows={2} value={reason} maxLength={250} onChange={(e) => { setReason(e.target.value); setErrs({}); }} placeholder="e.g. Replaced by a bank transfer" data-autofocus />
      </Field>
    </Modal>
  );
}
