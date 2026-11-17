import React, { useState } from "react";
import { Button } from "../ui/button";
import { AmountInput, ErrorNote, Field, Modal, Select, TextInput } from "../accounting/kit.jsx";
import { trips } from "../../lib/vanSalesApi";
import { EXPENSE_KINDS, odometerBody, vanErrorText } from "../../lib/vanSales";
import { formatCurrencyAED } from "../../utils/format";

// The dialogs phase 5 added: sending the van out with its odometer, and money spent on the road from the van's cash.

const Footer = ({ onClose, busy, onSubmit, label, disabled }) => (
  <>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button onClick={onSubmit} disabled={busy || disabled}>{busy ? "Working…" : label}</Button>
  </>
);

function useRun() {
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
  return { busy, error, run };
}

export function DepartDialog({ trip, onClose, onDone }) {
  const [odometer, setOdometer] = useState("");
  const { busy, error, run } = useRun();
  return (
    <Modal size="sm" title="Send the van out?" description="From now the salesman can sell from it." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Send out" onSubmit={() => run(async () => onDone(await trips.depart(trip.id, odometerBody(odometer))))} />}>
      <div className="grid grid-cols-1 gap-3">
        {error && <ErrorNote error={new Error(vanErrorText(error))} />}
        <Field label="Odometer going out (km)" hint="Optional. With the reading back, the route report shows what each km earned.">
          <AmountInput value={odometer} onChange={(e) => setOdometer(e.target.value)} inputMode="decimal" aria-label="Odometer going out" autoFocus />
        </Field>
      </div>
    </Modal>
  );
}

export function ExpenseDialog({ trip, onClose, onDone }) {
  const [kind, setKind] = useState("fuel");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { busy, error, run } = useRun();
  const inHand = trip.totals?.cashInHand ?? trip.totals?.cash;
  return (
    <Modal size="sm" title="Money spent on the road" description="Paid from the van's cash: it is an expense in the books, and the cash the van must hand in is less by it." onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} disabled={!(Number(amount) > 0)} label="Save" onSubmit={() => run(async () => onDone(await trips.expense(trip.id, { kind, amount: Number(amount), note })))} />}>
      <div className="grid grid-cols-1 gap-3">
        {error && <ErrorNote error={new Error(vanErrorText(error))} />}
        <Field label="What for">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {EXPENSE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Amount paid" hint={inHand != null ? `The van holds ${formatCurrencyAED(inHand)} in cash` : undefined}><AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Amount paid" /></Field>
        <Field label="Note"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Where, the receipt number…" /></Field>
      </div>
    </Modal>
  );
}
