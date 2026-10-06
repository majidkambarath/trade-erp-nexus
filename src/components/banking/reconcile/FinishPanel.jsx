import React, { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "../../ui/button";
import { DateInput, ErrorNote, Field, Panel, Spinner, TextInput, Textarea, useAsync } from "../../accounting/kit";
import { ActionModal } from "../../salesDocs/parts";
import { reconcile } from "../../../lib/bankReconcileApi";
import { readiness } from "../../../lib/bankReconcile";
import { formatNumber, todayInput } from "../../../utils/format";
import { ProofTable } from "./parts";
import { useAction } from "./helpers";

// The proof. Enter the date and closing balance printed on the statement; the two sides are worked
// out as of that date, and the difference must be nothing. What is not on the other side yet (a
// deposit in transit, a cheque not presented) is listed, because that is what a reconciliation
// statement is. Finishing locks the matched lines: nothing they depend on can be changed quietly.

function useDebounced(value, ms = 450) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function FinishPanel({ account, version, onFinished, onViewStatement }) {
  const imports = useAsync(() => reconcile.imports(account._id), [account._id, version]);
  const [asOf, setAsOf] = useState("");
  const [balance, setBalance] = useState("");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const touched = React.useRef({ asOf: false, balance: false });

  // start from the latest import: its last day and its closing balance
  useEffect(() => {
    const latest = (imports.data || []).filter((i) => i.status === "active").sort((a, b) => (a.periodTo < b.periodTo ? 1 : -1))[0];
    if (!latest) return;
    if (!touched.current.asOf) setAsOf(latest.periodTo);
    if (!touched.current.balance && latest.closingBalance !== null && latest.closingBalance !== undefined) setBalance(String(latest.closingBalance));
  }, [imports.data]);

  const day = useDebounced(asOf);
  const bal = useDebounced(balance);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && bal !== "" && Number.isFinite(Number(bal));
  const proof = useAsync(() => (valid ? reconcile.proof({ accountId: account._id, asOf: day, statementBalance: Number(bal) }) : Promise.resolve(null)), [account._id, day, bal, valid, version]);
  const p = proof.data;
  const status = readiness(p);

  const { busy, problem, go } = useAction(
    () => reconcile.finish({ accountId: account._id, asOf: day, statementBalance: Number(bal), note }),
    (message, rec) => { setOpen(false); setNote(""); onFinished(`${rec.number} completed`, rec); },
    ""
  );

  return (
    <Panel title="Finish and prove" description="The date and closing balance printed on the bank statement.">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Field label="Statement date"><DateInput value={asOf} max={todayInput()} onChange={(e) => { touched.current.asOf = true; setAsOf(e.target.value); }} /></Field>
          <Field label="Closing balance on the statement">
            <TextInput inputMode="decimal" value={balance} placeholder="0.00" aria-label="Closing balance on the statement" onChange={(e) => { touched.current.balance = true; setBalance(e.target.value.replace(/[^0-9.-]/g, "")); }} />
          </Field>
        </div>

        {proof.loading && valid && <Spinner label="Working it out" />}
        <ErrorNote error={proof.error} onRetry={proof.reload} />
        {p && (
          <>
            <p aria-live="polite" className={status.ready ? "flex items-start gap-2 text-sm text-status-success" : "flex items-start gap-2 text-sm text-status-warning"}>
              {status.ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
              <span>{status.text}</span>
            </p>
            {p.blockers.length > 1 && (
              <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">{p.blockers.slice(1).map((b) => <li key={b.code}>{b.message}</li>)}</ul>
            )}
            {p.openingDifference !== 0 && p.openingDifference !== undefined && (
              <p className="rounded-lg border border-status-warning/40 bg-status-warning-soft px-3 py-2 text-xs">The account's starting balance was out by {formatNumber(Math.abs(p.openingDifference), 2)}. Fix it in "Set up" or this will not add up.</p>
            )}
            <ProofTable proof={p} showItems={false} />
            <div className="flex flex-wrap gap-2">
              <Button disabled={!p.canFinish} onClick={() => setOpen(true)}>Finish reconciliation</Button>
              <Button variant="outline" onClick={() => onViewStatement(p)}>See the full statement</Button>
            </div>
          </>
        )}
        {!p && !proof.loading && <p className="text-sm text-muted-foreground">Enter the statement's date and closing balance to see whether the books agree.</p>}
      </div>

      {open && (
        <ActionModal
          title="Finish this reconciliation?" confirmLabel="Finish and lock" busy={busy} problem={problem} onClose={() => setOpen(false)} onConfirm={go}
          description={`${account.accountName} as of ${day}, statement balance ${formatNumber(Number(bal), 2)}. The lines matched up to this date are locked: their vouchers cannot be edited, deleted or bounced unless you reopen this reconciliation.`}
        >
          <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={250} placeholder="e.g. October, signed off by the accountant" /></Field>
        </ActionModal>
      )}
    </Panel>
  );
}
