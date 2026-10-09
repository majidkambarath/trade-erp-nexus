import React, { useState } from "react";
import { Download, FileText, RotateCcw } from "lucide-react";
import { Button } from "../../ui/button";
import { DataTable, EmptyState, ErrorNote, Field, Modal, Panel, Pill, Spinner, Textarea, useAsync } from "../../accounting/kit";
import { ActionModal } from "../../salesDocs/parts";
import { useOrganisation } from "../../shell/OrganisationContext";
import { reconcile } from "../../../lib/bankReconcileApi";
import { proofRows } from "../../../lib/bankReconcile";
import { downloadCSV, formatDate, formatDateTime, formatNumber } from "../../../utils/format";
import { ProofTable } from "./parts";
import { useAction } from "./helpers";

// Every completed reconciliation of the account, each with the statement it was proved against.
// Only the latest can be reopened, so the balances an earlier one rests on never move.

export function StatementDialog({ id, proof, title, onClose }) {
  const rec = useAsync(() => (id ? reconcile.reconciliation(id) : Promise.resolve(null)), [id]);
  const p = proof || rec.data?.proof;
  const csv = () => {
    const rows = proofRows(p).flatMap((r) => [[r.label, r.amount], ...(r.items || []).map((i) => [`   ${i.day || ""} ${i.voucherNo || i.description || ""}`.trimEnd(), i.amount])]);
    downloadCSV(`bank-reconciliation-${rec.data?.number || p.asOf}.csv`, ["Item", "Amount"], rows);
  };
  return (
    <Modal
      size="lg" onClose={onClose} title={title || (rec.data ? `${rec.data.number}: ${rec.data.account?.accountName}` : "Bank reconciliation statement")}
      description={p ? `As of ${formatDate(p.asOf)}` : undefined}
      footer={<>{p && <Button variant="outline" onClick={csv}><Download className="h-4 w-4" aria-hidden="true" />Download CSV</Button>}<Button onClick={onClose}>Close</Button></>}
    >
      {rec.loading && id && <Spinner label="Loading" />}
      <ErrorNote error={rec.error} onRetry={rec.reload} />
      {p && <ProofTable proof={p} />}
      {rec.data?.note && <p className="mt-3 text-sm text-muted-foreground">Note: {rec.data.note}</p>}
      {rec.data && <p className="mt-3 text-xs text-muted-foreground">Completed {formatDateTime(rec.data.createdAt)}{rec.data.status === "reopened" ? ` · reopened ${formatDateTime(rec.data.reopenedAt)}${rec.data.reopenReason ? `: ${rec.data.reopenReason}` : ""}` : ""}</p>}
    </Modal>
  );
}

function ReopenDialog({ rec, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const { busy, problem, go } = useAction(() => reconcile.reopen(rec._id, { reason }), onDone, `${rec.number} reopened`);
  return (
    <ActionModal
      title={`Reopen ${rec.number}?`} confirmLabel="Reopen" danger busy={busy} problem={problem} onClose={onClose} onConfirm={go}
      description="Its lines are unlocked, so the vouchers they rest on can be edited again. Finish it again when you are done."
    >
      <Field label="Why? (optional)"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={250} placeholder="e.g. A bank charge was missed" /></Field>
    </ActionModal>
  );
}

export default function HistoryTab({ account, version, notify, onChanged }) {
  const list = useAsync(() => reconcile.reconciliations(account._id), [account._id, version]);
  const [view, setView] = useState(null);
  const [reopen, setReopen] = useState(null);
  const rows = list.data || [];
  const latest = rows.find((r) => r.status === "completed");
  // Reopening unlocks the lines a reconciliation holds: banking.reconcile. Reading the history and its statements is banking.view.
  const { canAny } = useOrganisation();
  const canReconcile = canAny("banking.reconcile");

  return (
    <Panel bodyClassName="p-0" title="Completed reconciliations" description="The statement each one was proved against is kept as it stood.">
      {list.loading && !list.data && <Spinner label="Loading" />}
      <ErrorNote error={list.error} onRetry={list.reload} />
      {list.data && rows.length === 0 && <EmptyState title="Nothing completed yet" text={canReconcile ? "When a statement agrees with the books, finish it from the Statement lines tab and it is kept here." : "A reconciliation appears here once a statement has been proved against the books."} />}
      {rows.length > 0 && (
        <DataTable
          caption="Reconciliations"
          rows={rows}
          rowKey={(r) => r._id}
          columns={[
            { key: "no", header: "Number", card: "primary", cell: (r) => <span className="font-mono text-xs font-semibold">{r.number}</span> },
            { key: "asOf", header: "As of", card: "title", className: "whitespace-nowrap", cell: (r) => formatDate(r.asOf) },
            { key: "statement", header: "Statement balance", align: "end", card: "amount", className: "tabular-nums", cell: (r) => formatNumber(r.statementBalance, 2) },
            { key: "lines", header: "Lines", align: "end", card: "meta", className: "tabular-nums", cell: (r) => r.lineCount },
            { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={r.status === "completed" ? "success" : "neutral"}>{r.status === "completed" ? "Completed" : "Reopened"}</Pill> },
            {
              key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", className: "whitespace-nowrap",
              cell: (r) => (
                <>
                  <Button size="sm" variant="outline" onClick={() => setView(r)}><FileText className="h-3.5 w-3.5" aria-hidden="true" />Statement</Button>
                  {canReconcile && latest && r._id === latest._id && <Button size="sm" variant="ghost" onClick={() => setReopen(r)}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Reopen</Button>}
                </>
              ),
            },
          ]}
        />
      )}
      {view && <StatementDialog id={view._id} onClose={() => setView(null)} />}
      {reopen && <ReopenDialog rec={reopen} onClose={() => setReopen(null)} onDone={(m) => { setReopen(null); notify(m); onChanged(); }} />}
    </Panel>
  );
}
