import React, { useState } from "react";
import { Button } from "../ui/button";
import { ConfirmDialog, DateInput, ErrorNote, errorMessage, Field, Modal, Textarea, TextInput } from "../accounting/kit";
import { banking } from "../../lib/bankingApi";
import { useAction } from "./useAction";
import { BULK_ACTIONS, bulkMessage, eligible } from "../../lib/chequeRules";
import { CURRENCY, formatDateGB, formatNumber } from "../../utils/format";

// The acts on a cheque that POST NOTHING (deposit, hold, resume) and the bulk versions of every act that can be done in
// bulk. The acts that post (clear, bounce, cancel) keep their dialogs in ChequeRegister.jsx. The server decides what is
// allowed and says why in its own words; these dialogs only collect what the act needs and show that refusal.

const day = (d) => new Date(d).toISOString().slice(0, 10);
const todayInput = () => day(new Date());

export function DepositDialog({ cheque, onClose, onDone }) {
  const [on, setOn] = useState(todayInput());
  const [slip, setSlip] = useState("");
  const { busy, problem, go } = useAction(() => banking.depositCheque(cheque._id, { depositedOn: on, slipNo: slip.trim() }), onDone, `Cheque ${cheque.chequeNo} deposited`);
  return (
    <Modal
      size="sm" onClose={onClose} title={`Deposit cheque ${cheque.chequeNo}`}
      description="Records that the cheque has gone to the bank. Nothing is posted: the amount stays in cheques in hand until it clears."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={busy}>{busy ? "Saving…" : "Mark deposited"}</Button></>}
    >
      <ErrorNote error={problem} />
      <div className="space-y-4">
        <Field label="Deposited on" hint={`Not before ${formatDateGB(cheque.chequeDate)}, the date on the cheque.`}><DateInput value={on} min={day(cheque.chequeDate)} onChange={(e) => setOn(e.target.value)} data-autofocus /></Field>
        <Field label="Paying-in slip no." hint="Optional. One slip can cover several cheques."><TextInput value={slip} maxLength={40} onChange={(e) => setSlip(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function HoldDialog({ cheque, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [err, setErr] = useState("");
  const { busy, problem, go } = useAction(() => banking.holdCheque(cheque._id, { reason: reason.trim(), until: until || undefined }), onDone, `Cheque ${cheque.chequeNo} put on hold`);
  const submit = () => (reason.trim() ? go() : setErr("Say why the cheque is being held"));
  return (
    <Modal
      size="sm" onClose={onClose} title={`Hold cheque ${cheque.chequeNo}`}
      description={`Keeps the cheque in hand on purpose. It cannot be deposited or cleared until you resume it. ${formatNumber(cheque.amount, 2)} ${CURRENCY} stays in cheques in hand.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Put on hold"}</Button></>}
    >
      <ErrorNote error={problem} />
      <div className="space-y-4">
        <Field label="Reason" required error={err}><Textarea rows={2} value={reason} maxLength={250} onChange={(e) => { setReason(e.target.value); setErr(""); }} placeholder="e.g. Customer asked us to wait for a transfer" data-autofocus /></Field>
        <Field label="Hold until" hint="Optional. A reminder, not a lock."><DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function ResumeDialog({ cheque, onClose, onDone }) {
  const { busy, problem, go } = useAction(() => banking.resumeCheque(cheque._id, {}), onDone, `Cheque ${cheque.chequeNo} taken off hold`);
  return (
    <ConfirmDialog
      title={`Take cheque ${cheque.chequeNo} off hold?`} busy={busy} confirmLabel="Resume"
      text={`It goes back to pending and can be deposited when its date comes.${problem ? ` ${errorMessage(problem)}` : ""}`}
      onConfirm={go} onClose={onClose}
    />
  );
}

// ---- several cheques at once ----
const BULK = {
  deposit: { label: "Deposit", title: "Deposit", cta: "Mark deposited", note: "Nothing is posted: the amounts stay in cheques in hand until they clear." },
  clear: { label: "Clear", title: "Clear", cta: "Clear cheques", note: "Each cheque moves from cheques in hand into its bank account. A cheque dated in the future is left alone." },
  hold: { label: "Hold", title: "Hold", cta: "Put on hold", note: "They stay in hand, on purpose, until you resume them." },
  resume: { label: "Resume", title: "Take off hold", cta: "Resume", note: "They go back to pending." },
};

export function BulkDialog({ action, rows, onClose, onDone }) {
  const picked = eligible(action, rows);
  const total = picked.reduce((t, c) => t + (Number(c.amount) || 0), 0);
  const [on, setOn] = useState(todayInput());
  const [slip, setSlip] = useState("");
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [err, setErr] = useState("");
  const { busy, problem, go } = useAction(
    () => banking.bulkCheques({ action, ids: picked.map((c) => c._id), on, slipNo: slip.trim(), reason: reason.trim(), until: until || undefined }),
    onDone, (result) => bulkMessage(action, result)
  );
  const submit = () => (action === "hold" && !reason.trim() ? setErr("Say why they are being held") : go());
  const left = rows.length - picked.length;
  return (
    <Modal
      size="sm" onClose={onClose} title={`${BULK[action].title} ${picked.length} cheque${picked.length === 1 ? "" : "s"}`}
      description={`${formatNumber(total, 2)} ${CURRENCY}. ${BULK[action].note}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !picked.length}>{busy ? "Working…" : BULK[action].cta}</Button></>}
    >
      <ErrorNote error={problem} />
      {left > 0 && <p className="mb-3 text-sm text-muted-foreground">{left} of the {rows.length} you ticked cannot be done this way and are left out.</p>}
      <div className="space-y-4">
        {(action === "deposit" || action === "clear") && (
          <Field label={action === "deposit" ? "Deposited on" : "Cleared on"}><DateInput value={on} onChange={(e) => setOn(e.target.value)} data-autofocus /></Field>
        )}
        {action === "deposit" && <Field label="Paying-in slip no." hint="Optional. The same slip goes on every cheque."><TextInput value={slip} maxLength={40} onChange={(e) => setSlip(e.target.value)} /></Field>}
        {action === "hold" && (
          <>
            <Field label="Reason" required error={err}><Textarea rows={2} value={reason} maxLength={250} onChange={(e) => { setReason(e.target.value); setErr(""); }} data-autofocus /></Field>
            <Field label="Hold until" hint="Optional."><DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
          </>
        )}
      </div>
    </Modal>
  );
}

// Appears above the table while something is ticked. Same look as the list platform's BulkBar; its own component
// because a bulk deposit needs a date and a slip number, which BulkBar's text-only confirm cannot ask for.
export function ChequeBulkBar({ rows, onClear, onDone }) {
  const [action, setAction] = useState(null);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2" role="toolbar" aria-label="Selected cheques">
      <span className="text-sm font-medium tabular-nums">{rows.length} selected</span>
      <span className="flex flex-wrap items-center gap-1.5">
        {BULK_ACTIONS.map((a) => {
          const n = eligible(a, rows).length;
          return <Button key={a} size="sm" variant="outline" disabled={n === 0} onClick={() => setAction(a)}>{BULK[a].label}{n > 0 && <span className="ms-1 tabular-nums text-muted-foreground">({n})</span>}</Button>;
        })}
      </span>
      <Button size="sm" variant="ghost" className="ms-auto" onClick={onClear} aria-label="Clear selection">Clear</Button>
      {action && <BulkDialog action={action} rows={rows} onClose={() => setAction(null)} onDone={(m) => { setAction(null); onDone(m); }} />}
    </div>
  );
}
