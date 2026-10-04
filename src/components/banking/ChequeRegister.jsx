import React, { useState } from "react";
import { Ban, CheckCircle2, RotateCcw, Search } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { ConfirmDialog, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, Spinner, TextInput, Textarea, errorMessage, useAsync, useToasts } from "../accounting/kit";
import { banking } from "../../lib/bankingApi";
import { cn } from "../../lib/utils";
import { formatDateGB, formatNumber } from "../../utils/format";

// Every cheque received from a customer or issued to a vendor. A cheque waits here until it
// clears; a bounced one reverses the receipt or payment it was taken for.

const TABS = [["pending", "Pending"], ["cleared", "Cleared"], ["bounced", "Bounced"], ["cancelled", "Cancelled"], ["", "All"]];
const TONE = { pending: "warning", cleared: "success", bounced: "danger", cancelled: "neutral" };
const day = (d) => new Date(d).toISOString().slice(0, 10);
const todayInput = () => day(new Date());

export default function ChequeRegister() {
  const [status, setStatus] = useState("pending");
  const [direction, setDirection] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { notify, toastNode } = useToasts();
  const [action, setAction] = useState(null); // { kind: "clear"|"bounce"|"cancel", cheque }
  const { data, loading, error, reload } = useAsync(() => banking.cheques({ status: status || undefined, direction: direction || undefined, q: q || undefined, page, limit: 25 }), [status, direction, q, page]);
  const rows = data?.rows || [];
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 25));
  const done = (msg) => { setAction(null); notify(msg); reload(); };

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader title="Cheques" description="Cheques you have received and issued. They move to the bank account when they clear." />
      {data && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="To collect" count={formatNumber(data.summary.receivable.amount, 2)} subText={`${data.summary.receivable.count} cheque${data.summary.receivable.count === 1 ? "" : "s"} received, not cleared`} tone="teal" />
          <StatCard title="To be paid" count={formatNumber(data.summary.payable.amount, 2)} subText={`${data.summary.payable.count} cheque${data.summary.payable.count === 1 ? "" : "s"} issued, not cleared`} tone="plum" />
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div role="tablist" aria-label="Cheque status" className="inline-flex rounded-full border border-border bg-card p-1">
          {TABS.map(([v, label]) => (
            <button key={label} role="tab" type="button" aria-selected={status === v} onClick={() => { setStatus(v); setPage(1); }} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", status === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>
          ))}
        </div>
        <Field label="Direction" className="w-40">
          <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }}>
            <option value="">Both</option><option value="receipt">Received</option><option value="payment">Issued</option>
          </select>
        </Field>
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextInput aria-label="Search cheques" className="ps-9" placeholder="Cheque no., party, voucher or bank…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>
      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading cheques" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && rows.length === 0 && <EmptyState title="No cheques here" text="Cheques appear when a receipt or payment is taken by cheque." />}
        {rows.length > 0 && (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-2 text-start">Cheque</th><th className="px-3 py-2 text-start">Date</th><th className="px-3 py-2 text-start">Party</th><th className="px-3 py-2 text-start">Bank</th><th className="px-3 py-2 text-end">Amount</th><th className="px-3 py-2 text-start">Status</th><th className="px-5 py-2 text-end">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c._id} className="border-t border-border hover:bg-accent/40">
                    <td className="px-5 py-2.5"><span className="font-mono text-xs font-semibold">{c.chequeNo}</span><span className="block text-xs text-muted-foreground">{c.direction === "receipt" ? "Received" : "Issued"} · {c.voucherNo}</span></td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatDateGB(c.chequeDate)}{c.status === "pending" && !c.matured && <Pill tone="info" className="ms-2">Post-dated</Pill>}</td>
                    <td className="px-3 py-2.5 font-medium">{c.partyName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.direction === "receipt" ? c.drawnOnBankName : c.bankAccountName}{c.direction === "receipt" && c.bankAccountName && <span className="block text-xs">into {c.bankAccountName}</span>}</td>
                    <td className="px-3 py-2.5 text-end font-medium tabular-nums">{formatNumber(c.amount, 2)}</td>
                    <td className="px-3 py-2.5"><Pill tone={TONE[c.status]}>{c.status[0].toUpperCase() + c.status.slice(1)}</Pill>{c.status === "bounced" && c.reason && <span className="mt-0.5 block max-w-48 truncate text-xs text-muted-foreground" title={c.reason}>{c.reason}</span>}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-end">
                      {c.status === "pending" && (
                        <span className="inline-flex gap-1.5">
                          <Button size="sm" variant="outline" disabled={!c.matured} title={c.matured ? undefined : `Cannot clear before ${formatDateGB(c.chequeDate)}`} onClick={() => setAction({ kind: "clear", cheque: c })}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Clear</Button>
                          <Button size="sm" variant="outline" onClick={() => setAction({ kind: "bounce", cheque: c })}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Bounced</Button>
                          <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "cancel", cheque: c })}><Ban className="h-3.5 w-3.5" aria-hidden="true" />Cancel</Button>
                        </span>
                      )}
                      {c.status === "cleared" && <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "bounce", cheque: c })}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Returned</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            <span className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></span>
          </nav>
        )}
      </Panel>
      {action?.kind === "clear" && <ClearDialog cheque={action.cheque} onClose={() => setAction(null)} onDone={done} />}
      {action?.kind === "bounce" && <BounceDialog cheque={action.cheque} onClose={() => setAction(null)} onDone={done} />}
      {action?.kind === "cancel" && <CancelDialog cheque={action.cheque} onClose={() => setAction(null)} onDone={done} />}
      {toastNode}
    </div>
  );
}

function useAction(run, onDone, message) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const go = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await run();
      onDone(message);
    } catch (e) {
      setProblem(e);
      setBusy(false);
    }
  };
  return { busy, problem, go };
}

function ClearDialog({ cheque, onClose, onDone }) {
  const [on, setOn] = useState(todayInput());
  const { busy, problem, go } = useAction(() => banking.clearCheque(cheque._id, { clearedOn: on }), onDone, `Cheque ${cheque.chequeNo} cleared`);
  return (
    <Modal
      size="sm" onClose={onClose} title={`Clear cheque ${cheque.chequeNo}`}
      description={`${formatNumber(cheque.amount, 2)} AED moves ${cheque.direction === "receipt" ? "into" : "out of"} ${cheque.bankAccountName || "the bank account"}.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={busy}>{busy ? "Clearing…" : "Clear cheque"}</Button></>}
    >
      <ErrorNote error={problem} />
      <Field label="Cleared on"><TextInput type="date" value={on} min={day(cheque.chequeDate)} onChange={(e) => setOn(e.target.value)} data-autofocus /></Field>
    </Modal>
  );
}

function BounceDialog({ cheque, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const { busy, problem, go } = useAction(() => banking.bounceCheque(cheque._id, { reason }), onDone, `Cheque ${cheque.chequeNo} marked bounced`);
  const submit = () => (reason.trim() ? go() : setErr("Say why the cheque was returned"));
  return (
    <Modal
      size="sm" onClose={onClose} title={`Cheque ${cheque.chequeNo} bounced`}
      description={`${cheque.voucherNo} is reversed${cheque.direction === "receipt" ? ": the customer owes the invoices it settled again." : ": the vendor is owed the invoices it settled again."}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={submit} disabled={busy}>{busy ? "Working…" : "Mark bounced"}</Button></>}
    >
      <ErrorNote error={problem} />
      <Field label="Reason" required error={err}><Textarea rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }} maxLength={250} placeholder="e.g. Insufficient funds" data-autofocus /></Field>
    </Modal>
  );
}

function CancelDialog({ cheque, onClose, onDone }) {
  const { busy, problem, go } = useAction(() => banking.cancelCheque(cheque._id, {}), onDone, `Cheque ${cheque.chequeNo} cancelled`);
  return (
    <>
      <ConfirmDialog
        title={`Cancel cheque ${cheque.chequeNo}?`} danger busy={busy} confirmLabel="Cancel cheque"
        text={`The cheque is withdrawn and ${cheque.voucherNo} is reversed. Use this when a cheque is replaced or never presented.${problem ? ` ${errorMessage(problem)}` : ""}`}
        onConfirm={go} onClose={onClose}
      />
    </>
  );
}
