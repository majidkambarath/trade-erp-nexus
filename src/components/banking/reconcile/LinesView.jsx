import React, { useEffect, useState } from "react";
import { Search, Wand2 } from "lucide-react";
import { Button } from "../../ui/button";
import { EmptyState, ErrorNote, Field, Spinner, TextInput, useAsync } from "../../accounting/kit";
import { ActionModal, Note, PillTabs } from "../../salesDocs/parts";
import { reconcile } from "../../../lib/bankReconcileApi";
import { LINE_TABS } from "../../../lib/bankReconcile";
import { errorMessage } from "../../accounting/kit";
import LineCard from "./LineCard";
import FindEntriesDialog from "./FindEntriesDialog";
import CreateEntryDialog from "./CreateEntryDialog";
import CardSettleDialog from "./CardSettleDialog";
import FinishPanel from "./FinishPanel";
import { useAction } from "./helpers";

// The worklist: every line of the statement, what the engine suggests, and what a person can do. The
// proof panel sits beside it so the difference can be watched as the lines are dealt with.

const entryRefs = (entries) => entries.map((e) => (e.type === "cheque" ? { type: "cheque", chequeId: e.chequeId } : { type: "ledger", ledgerEntryId: e.ledgerEntryId }));
const REASONS = ["Duplicate in the bank's own file", "Bank error, being corrected", "Not our transaction"];

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function LinesView({ account, version, onChanged, notify, onImport, onSetup, onStatement }) {
  // null until the first answer says which tab to open on: the quick wins first. When the engine has
  // suggestions the first view is those (one click each), and the lines it has nothing for are the next
  // tab. Nothing is drawn until that is decided, so lines never flash up under the wrong tab.
  const [tab, setTab] = useState(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // { kind, line }
  const [busy, setBusy] = useState(false);
  const term = useDebounced(q);
  const shownTab = tab ?? "todo";
  // The answer carries the tab it was fetched for, so a list is never shown under another tab's name
  // while the new one is on its way (the counts above it are the same either way, so they stay).
  const list = useAsync(
    () => (account.setUp ? reconcile.lines({ accountId: account._id, tab: shownTab, search: term || undefined, page, limit: 20 }).then((r) => ({ ...r, forTab: shownTab })) : Promise.resolve(null)),
    [account._id, account.setUp, shownTab, term, page, version]
  );
  const data = list.data;
  const waiting = Boolean(data) && (tab === null || data.forTab !== shownTab);

  useEffect(() => {
    if (tab === null && data) setTab(data.counts.suggested > 0 ? "suggested" : "todo");
  }, [tab, data]);

  const done = (message) => { setDialog(null); notify(message); onChanged(); };
  const attempt = async (run, message) => {
    setBusy(true);
    try { await run(); done(message); } catch (e) { notify(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  const match = (line, s) => attempt(() => reconcile.match({ accountId: account._id, lineIds: [line._id], entries: entryRefs(s.entries) }), "Matched");
  const acceptAll = () => attempt(async () => {
    const r = await reconcile.accept({ accountId: account._id });
    if (r.skipped?.length) notify(`${r.accepted} matched, ${r.skipped.length} could not be: ${r.skipped[0].reason}`, "error");
  }, "Strong matches accepted");

  if (!account.setUp) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <EmptyState
          title="Start with a bank statement"
          text="Import the statement from your bank. You will say where it starts and the bank's balance the day before; after that each month is one file."
          action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={onImport}>Import a statement</Button><Button variant="outline" onClick={onSetup}>Set up first</Button></div>}
        />
      </div>
    );
  }

  const counts = data?.counts || {};
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <PillTabs tabs={LINE_TABS} value={shownTab} onChange={(t) => { setTab(t); setPage(1); }} counts={counts} label="Statement lines" />
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <TextInput aria-label="Search statement lines" className="ps-9" placeholder="Description, reference, amount…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
        </div>

        {counts.suggested > 0 && shownTab !== "matched" && shownTab !== "ignored" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-sm"><strong className="font-semibold">{counts.suggested}</strong> line{counts.suggested === 1 ? " has" : "s have"} a suggested match. Strong matches have the same amount, a close date and a reference in common.</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={acceptAll}><Wand2 className="h-3.5 w-3.5" aria-hidden="true" />Accept all strong matches</Button>
          </div>
        )}

        {list.loading && (!data || waiting) && <Spinner label="Loading statement lines" />}
        <ErrorNote error={list.error} onRetry={list.reload} />
        {data?.truncated && <Note tone="warning">There are more open lines than can be shown at once. Deal with these, and the next ones appear.</Note>}
        {data && !waiting && data.rows.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <EmptyState
              title={shownTab === "todo" ? (counts.all ? "Nothing left to do" : "No lines yet") : "Nothing here"}
              text={shownTab === "todo" ? (counts.all ? "Every line is matched, ignored or has a suggestion waiting." : "Import a statement to begin.") : "No lines fit this view."}
              action={counts.all ? undefined : <Button onClick={onImport}>Import a statement</Button>}
            />
          </div>
        )}
        <div className="space-y-3">
          {(waiting ? [] : data?.rows || []).map((line) => (
            <LineCard
              key={line._id} line={line}
              onMatch={match} onFind={(l) => setDialog({ kind: "find", line: l })} onPost={(l) => setDialog({ kind: "post", line: l })}
              onCard={(l) => setDialog({ kind: "card", line: l })} onIgnore={(l) => setDialog({ kind: "ignore", line: l })}
              onUnmatch={(l) => setDialog({ kind: "unmatch", line: l })} onUnignore={(l) => attempt(() => reconcile.unignore(l._id), "Put back")}
            />
          ))}
        </div>
        {data && !waiting && data.pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page} of {data.pages}</span>
            <span className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</Button></span>
          </nav>
        )}
      </div>

      <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <FinishPanel account={account} version={version} onFinished={(m) => { notify(m); onChanged(); }} onViewStatement={onStatement} />
      </aside>

      {dialog?.kind === "find" && <FindEntriesDialog accountId={account._id} line={dialog.line} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "post" && <CreateEntryDialog accountId={account._id} line={dialog.line} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "card" && <CardSettleDialog accountId={account._id} line={dialog.line} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "ignore" && <IgnoreDialog line={dialog.line} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "unmatch" && <UnmatchDialog line={dialog.line} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  );
}

function IgnoreDialog({ line, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const { busy, problem, go } = useAction(() => reconcile.ignore(line._id, reason), onDone, "Line ignored");
  return (
    <ActionModal
      title="Ignore this line?" confirmLabel="Ignore" busy={busy} disabled={reason.trim().length < 3} problem={problem} onClose={onClose} onConfirm={go}
      description="It stays on the reconciliation statement as a bank item the books will never have. Say why."
    >
      <Field label="Reason" required>
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} maxLength={250} placeholder="e.g. The bank charged this twice and has refunded it" data-autofocus />
      </Field>
      <div className="flex flex-wrap gap-2">{REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary">{r}</button>)}</div>
    </ActionModal>
  );
}

function UnmatchDialog({ line, onClose, onDone }) {
  const posted = line.match?.createdVouchers?.length > 0;
  const [remove, setRemove] = useState(false);
  const { busy, problem, go } = useAction(() => reconcile.unmatch(line.match._id, remove), onDone, "Unmatched");
  return (
    <ActionModal
      title="Unmatch this line?" confirmLabel="Unmatch" danger busy={busy} problem={problem} onClose={onClose} onConfirm={go}
      description={`${line.match?.lineCount > 1 ? `The ${line.match.lineCount} lines matched together all` : "The line"} go back to the to-do list.`}
    >
      {posted && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={remove} onChange={(e) => setRemove(e.target.checked)} />
          <span>Also delete the {line.match.createdVouchers.map((v) => v.voucherNo).join(", ")} posted for this match. Leave it unticked to keep the entry in the books and match it again.</span>
        </label>
      )}
      {line.match?.entries?.some((e) => e.voucherType === "cheque_clearance") && <Note>A cheque that was cleared by this match stays cleared. Use the cheque register to return it.</Note>}
    </ActionModal>
  );
}
