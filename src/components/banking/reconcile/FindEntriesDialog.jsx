import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ErrorNote, Spinner, TextInput, useAsync } from "../../accounting/kit";
import { ActionModal, Note } from "../../salesDocs/parts";
import { reconcile } from "../../../lib/bankReconcileApi";
import { formatNumber } from "../../../utils/format";
import { Amount, Day, EntryRow } from "./parts";
import { useAction } from "./helpers";

// Picks the book entries a statement line belongs to. One entry usually; several when the bank
// credited a deposit made of many receipts, or paid a run of payments at once. The total must equal
// the line to the fils: a difference is posted as an entry of its own, never hidden in a match.

const cents = (n) => Math.round((Number(n) || 0) * 100);

export default function FindEntriesDialog({ accountId, line, onClose, onDone }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState(new Map()); // id -> entry
  useEffect(() => { const t = setTimeout(() => setTerm(q), 300); return () => clearTimeout(t); }, [q]);
  const list = useAsync(() => reconcile.entries({ accountId, lineId: line._id, q: term || undefined }), [accountId, line._id, term]);

  const total = [...picked.values()].reduce((t, e) => t + cents(e.amount), 0);
  const gap = cents(line.amount) - total;
  const toggle = (e) => setPicked((m) => { const n = new Map(m); n.has(e.id) ? n.delete(e.id) : n.set(e.id, e); return n; });
  const { busy, problem, go } = useAction(
    () => reconcile.match({ accountId, lineIds: [line._id], entries: [...picked.values()].map((e) => (e.type === "cheque" ? { type: "cheque", chequeId: e.chequeId } : { type: "ledger", ledgerEntryId: e.ledgerEntryId })) }),
    onDone,
    "Matched"
  );

  return (
    <ActionModal
      size="xl" title="Find it in the books" confirmLabel={picked.size > 1 ? `Match ${picked.size} entries` : "Match"} busy={busy} disabled={picked.size === 0 || gap !== 0} problem={problem} onClose={onClose} onConfirm={go}
      description="Tick the entries this statement line belongs to. Tick several if the bank paid or credited them together."
    >
      <div className="rounded-lg border border-border bg-secondary/50 p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs text-muted-foreground"><Day value={line.day} /></p><p className="break-words font-medium">{line.description}</p></div>
          <Amount value={line.amount} className="text-base" />
        </div>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <TextInput aria-label="Search the books" className="ps-9" placeholder="Search by voucher number, name, reference, cheque number or amount" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.loading && !list.data && <Spinner label="Looking" />}
      <ErrorNote error={list.error} onRetry={list.reload} />
      {list.data && list.data.rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing unmatched in the books {term ? "fits that search" : "in this direction"}. If the bank charged or paid something the books do not know, close this and use "Post an entry".</p>}
      <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {(list.data?.rows || []).map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-3 py-2">
            <input type="checkbox" className="mt-1 h-4 w-4" aria-label={`${e.voucherNo} ${formatNumber(Math.abs(e.amount), 2)}`} checked={picked.has(e.id)} onChange={() => toggle(e)} />
            <EntryRow entry={e} className="flex-1" />
          </li>
        ))}
      </ul>
      {list.data && list.data.total > list.data.rows.length && <p className="text-xs text-muted-foreground">Showing the nearest {list.data.rows.length} of {list.data.total}. Search to narrow them.</p>}
      <div aria-live="polite" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
        <span className="text-muted-foreground">Ticked {picked.size} · total {formatNumber(total / 100, 2)}</span>
        {picked.size > 0 && (gap === 0 ? <span className="font-medium text-status-success">Adds up to the line</span> : <span className="font-medium text-status-warning">{formatNumber(Math.abs(gap) / 100, 2)} {gap > 0 ? "short" : "too much"}</span>)}
      </div>
      {picked.size > 0 && gap !== 0 && <Note tone="warning">The entries must add up to the line exactly. If the difference is a fee, interest or a commission, close this and post it with "Post an entry", then match the rest.</Note>}
    </ActionModal>
  );
}
