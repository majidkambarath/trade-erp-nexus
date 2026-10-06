import React, { useEffect, useMemo, useRef, useState } from "react";
import { DateInput, ErrorNote, Field, Spinner, TextInput, useAsync } from "../../accounting/kit";
import { ActionModal, Note } from "../../salesDocs/parts";
import { reconcile } from "../../../lib/bankReconcileApi";
import { todayInput, formatNumber } from "../../../utils/format";
import { EntryRow } from "./parts";
import { useAction } from "./helpers";

// Where reconciliation of this bank account starts. The books before the start day are taken as
// already reconciled, except the entries ticked as still outstanding then (cheques not yet cleared,
// deposits not yet credited). The bank's balance the day before is what the old statement says.
// The difference must be nothing for the later proof to add up.

const cents = (n) => Math.round((Number(n) || 0) * 100);

export default function SetupDialog({ account, initial, onClose, onDone }) {
  const [startDay, setStartDay] = useState(initial?.startDay || "");
  const [opening, setOpening] = useState(initial?.statementOpening === undefined || initial?.statementOpening === null ? "" : String(initial.statementOpening));
  const [picked, setPicked] = useState(null); // Set of ledgerEntryId strings; null until the saved choice has loaded
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(startDay) && startDay <= todayInput();
  const preview = useAsync(() => (valid ? reconcile.setupPreview(account._id, startDay) : Promise.resolve(null)), [account._id, startDay]);
  const data = preview.data;

  const seeded = useRef(false);
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    setPicked(new Set((data.existing?.outstandingEntryIds || []).map(String)));
    if (!initial?.startDay && data.existing?.startDay === startDay && opening === "") setOpening(String(data.existing.statementOpening));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = picked || new Set();
  const outstanding = useMemo(() => (data?.candidates || []).filter((c) => chosen.has(String(c.ledgerEntryId))).reduce((t, c) => t + cents(c.amount), 0) / 100, [data, picked]); // eslint-disable-line react-hooks/exhaustive-deps
  const have = opening !== "" && Number.isFinite(Number(opening));
  const difference = data && have ? (cents(data.bookBalanceBefore) - cents(outstanding) - cents(opening)) / 100 : null;

  const { busy, problem, go } = useAction(
    () => reconcile.saveSetup({ accountId: account._id, startDay, statementOpening: Number(opening), outstandingEntryIds: [...chosen] }),
    onDone,
    "Saved where reconciliation starts"
  );
  const toggle = (id) => setPicked((s) => { const n = new Set(s || []); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <ActionModal
      size="xl" title={`Where does ${account.accountName} start?`} confirmLabel="Save" busy={busy} disabled={!valid || !have} problem={problem} onClose={onClose} onConfirm={go}
      description="Pick the day the bank statement you are about to import begins, and the balance the bank showed the day before."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Statement starts on" required><DateInput value={startDay} max={todayInput()} onChange={(e) => { setStartDay(e.target.value); seeded.current = false; }} data-autofocus /></Field>
        <Field label="Bank's balance the day before" required hint="From the old statement: what the bank said the account held, before the first line you are importing.">
          <TextInput inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^0-9.-]/g, ""))} placeholder="0.00" />
        </Field>
      </div>
      {preview.loading && valid && !data && <Spinner label="Reading the books" />}
      <ErrorNote error={preview.error} onRetry={preview.reload} />
      {data && (
        <>
          <div className="rounded-lg border border-border p-3 text-sm">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">Balance in the books the day before</dt><dd className="tabular-nums">{formatNumber(data.bookBalanceBefore, 2)}</dd>
              <dt className="text-muted-foreground">Less: ticked below, still outstanding then</dt><dd className="tabular-nums">{formatNumber(outstanding, 2)}</dd>
              <dt className="text-muted-foreground">Bank's balance the day before</dt><dd className="tabular-nums">{have ? formatNumber(Number(opening), 2) : "-"}</dd>
              <dt className="border-t border-border pt-1.5 font-semibold">Difference</dt>
              <dd className="border-t border-border pt-1.5 font-semibold tabular-nums">{difference === null ? "-" : difference === 0 ? <span className="text-status-success">0.00</span> : formatNumber(difference, 2)}</dd>
            </dl>
          </div>
          {difference !== null && difference !== 0 && (
            <Note tone="warning">The books and the bank do not agree on the day before. Tick any entry the bank had not yet recorded (a cheque not yet cleared, a deposit not yet credited). If the difference stays, something before this day is wrong in the books or on the statement; it will show again when you try to finish.</Note>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Still outstanding that day? <span className="font-normal text-muted-foreground">(tick the entries the bank had not recorded yet)</span></h3>
            {data.candidates.length === 0 && <p className="text-sm text-muted-foreground">There are no entries in this account before that day.</p>}
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {data.candidates.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-3 py-2">
                  <input type="checkbox" className="mt-1 h-4 w-4" aria-label={`${c.voucherNo} ${c.amount}`} checked={chosen.has(String(c.ledgerEntryId))} onChange={() => toggle(String(c.ledgerEntryId))} />
                  <EntryRow entry={c} className="flex-1" />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Ticked entries are matched against the statement lines that arrive later. The rest are taken as already reconciled.</p>
          </div>
        </>
      )}
      {!valid && startDay && <p className="text-sm text-status-danger">Choose a day that is not in the future.</p>}
    </ActionModal>
  );
}

