import React, { useEffect, useState } from "react";
import { Ban, CheckCircle2, History, Landmark, Pause, Play, RotateCcw, Search } from "lucide-react";
import { Button } from "../ui/button";
import Can from "../shell/Can";
import StatCard from "../ui/stat-card";
import { ConfirmDialog, DataTable, DateInput, EmptyState, errorMessage, ErrorNote, Field, inputClass, Modal, PageHeader, Panel, Pill, Spinner, Textarea, TextInput, useAsync, useToasts } from "../accounting/kit";
import { banking } from "../../lib/bankingApi";
import { formatForeign, formatRate } from "../../lib/currencyForms";
import { cn } from "../../lib/utils";
import { CURRENCY, formatDateGB, formatNumber } from "../../utils/format";
import { VoucherAuditTrail } from "../audit/AuditTrail";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { useClampPage, useServerPage } from "../lists/useServerPage";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import ListPager from "../lists/ListPager";
import ListEmpty from "../lists/ListEmpty";
import { pageFigures } from "../../lib/pagination";
import { canDo, isLive, isWorklist, LABEL, TABS, TONE } from "../../lib/chequeRules";
import { useOrganisation } from "../shell/OrganisationContext";
import { useAction } from "./useAction";
import { ChequeBulkBar, DepositDialog, HoldDialog, ResumeDialog } from "./ChequeActions";

// Every cheque received from a customer or issued to a vendor. A cheque waits here until it
// clears; a bounced one reverses the receipt or payment it was taken for.

// What each worklist tab is. A worklist shows every date: a cheque post-dated a year ahead is still to be presented.
const WORKLIST_NOTE = {
  pending: "every cheque still to be presented or paid, whatever its date",
  deposited: "taken to the bank and waiting to clear, whatever its date",
  hold: "kept in hand on purpose, whatever its date",
};
const day = (d) => new Date(d).toISOString().slice(0, 10);
const todayInput = () => day(new Date());

export default function ChequeRegister() {
  const [status, setStatus] = useState("pending");
  // the cheque whose voucher's audit trail is open, or null
  const [audit, setAudit] = useState(null);
  const [direction, setDirection] = useState("");
  const [q, setQ] = useState("");
  const { notify, toastNode } = useToasts();
  const [action, setAction] = useState(null); // { kind: "clear"|"bounce"|"cancel", cheque }
  // Pending cheques are a worklist - one post-dated a year ahead is still to be presented - so that tab is every date. The
  // other tabs (cleared, bounced, cancelled, all) open on this calendar month, by the date on the cheque.
  const periodFilter = usePeriodFilter();
  const { period } = periodFilter;
  const dated = !isWorklist(status);
  const { page, pageSize, setPage, setPageSize } = useServerPage(`${status}|${direction}|${q}|${dated ? period.key : "any"}`);
  const { data, loading, error, reload } = useAsync(
    () => banking.cheques({
      status: status || undefined, direction: direction || undefined, q: q || undefined,
      from: (dated && period.from) || undefined, to: dated && period.to ? `${period.to}T23:59:59.999Z` : undefined, page, limit: pageSize,
    }),
    [status, direction, q, dated, period.key, page, pageSize]
  );
  const rows = data?.rows || [];
  useClampPage({ pagination: data && { pages: Math.max(1, Math.ceil((data.total || 0) / pageSize)), total: data.total }, loaded: Boolean(data) && !loading, page, setPage });
  // Ticked rows are for ONE view of the list: a new filter, page or tab starts with nothing ticked, so a bulk act can
  // never reach a row the person can no longer see.
  const [selection, setSelection] = useState([]);
  useEffect(() => { setSelection([]); }, [status, direction, q, page, pageSize, period.key]);
  const { can } = useOrganisation();
  const canAct = can("finance.approve");
  const done = (msg) => { setAction(null); setSelection([]); notify(msg); reload(); };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Cheques" description="Cheques you have received and issued. They move to the bank account when they clear." />
      {data && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="To collect" count={formatNumber(data.summary.receivable.amount, 2)} subText={`${data.summary.receivable.count} cheque${data.summary.receivable.count === 1 ? "" : "s"} received, not cleared`} tone="teal" />
          <StatCard title="To be paid" count={formatNumber(data.summary.payable.amount, 2)} subText={`${data.summary.payable.count} cheque${data.summary.payable.count === 1 ? "" : "s"} issued, not cleared`} tone="plum" />
        </div>
      )}
      <div className="mb-4 flex flex-col gap-3 print:hidden sm:flex-row sm:flex-wrap sm:items-end">
        {/* Four pills are 420px side by side, which is wider than a phone. The row scrolls
            rather than wrapping, so the control keeps its one-line segmented shape. */}
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <div role="tablist" aria-label="Cheque status" className="inline-flex rounded-full border border-border bg-card p-1">
            {TABS.map(([v, label]) => (
              <button key={label} role="tab" type="button" aria-selected={status === v} onClick={() => setStatus(v)} className={cn("shrink-0 whitespace-nowrap min-h-10 rounded-full px-4 py-1.5 text-sm font-medium lg:min-h-0", status === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
          </div>
        </div>
        <Field label="Direction" className="w-full sm:w-40">
          <select className={inputClass} value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">Both</option><option value="receipt">Received</option><option value="payment">Issued</option>
          </select>
        </Field>
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextInput aria-label="Search cheques" className="ps-9" placeholder="Cheque no., party, voucher or bank…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {dated && <PeriodSelect filter={periodFilter} labelled />}
      </div>
      {dated ? (
        <PeriodNote filter={periodFilter} count={data ? data.total : null} noun="cheques" one="cheque" className="-mt-1 mb-4" />
      ) : (
        <p className="-mt-1 mb-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{LABEL[status]}</span>
          {` · ${WORKLIST_NOTE[status]}`}
          {data ? ` · ${data.total} ${data.total === 1 ? "cheque" : "cheques"}` : ""}
        </p>
      )}
      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading cheques" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && rows.length === 0 && (dated && !period.all ? (
          <ListEmpty filter={periodFilter} noun="cheques" inPeriod={null} filtered={Boolean(q || direction)} onClearFilters={() => { setQ(""); setDirection(""); }} emptyTitle="No cheques here" createText="Cheques appear when a receipt or payment is taken by cheque." />
        ) : (
          <EmptyState title="No cheques here" text="Cheques appear when a receipt or payment is taken by cheque." />
        ))}
        {rows.length > 0 && (
          <DataTable
            caption="Cheques"
            rows={rows}
            rowKey={(c) => c._id}
            selection={canAct ? selection : undefined}
            onSelection={canAct ? setSelection : undefined}
            selectName={(c) => `Select cheque ${c.chequeNo}`}
            bulkBar={canAct ? <ChequeBulkBar rows={rows.filter((c) => selection.includes(c._id))} onClear={() => setSelection([])} onDone={done} /> : undefined}
            columns={[
              { key: "cheque", header: "Cheque", card: "primary", cell: (c) => <><span className="font-mono text-xs font-semibold">{c.chequeNo}</span><span className="block text-xs font-normal text-muted-foreground">{c.direction === "receipt" ? "Received" : "Issued"} · {c.voucherNo}</span></> },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap", cell: (c) => <>{formatDateGB(c.chequeDate)}{isLive(c.status) && !c.matured && <Pill tone="info" className="ms-2">Post-dated</Pill>}</> },
              { key: "party", header: "Party", card: "title", className: "font-medium", cell: (c) => c.partyName },
              { key: "bank", header: "Bank", card: "meta", className: "text-muted-foreground", cell: (c) => <>{c.direction === "receipt" ? c.drawnOnBankName : c.bankAccountName}{c.direction === "receipt" && c.bankAccountName && <span className="block text-xs md:inline md:ms-1">into {c.bankAccountName}</span>}</> },
              { key: "amount", header: "Amount", money: true, align: "end", card: "amount", className: "font-medium tabular-nums", cell: (c) => <>{formatNumber(c.amount, 2)}{c.foreignAmount > 0 && <span className="block text-xs font-normal text-muted-foreground">{formatForeign(c.foreignAmount, c.currency)} @ {formatRate(c.exchangeRate)}</span>}</> },
              { key: "status", header: "Status", card: "badge", cell: (c) => <><Pill tone={TONE[c.status]}>{LABEL[c.status] || c.status}</Pill>{c.status === "bounced" && c.reason && <span className="mt-0.5 block max-w-48 truncate text-xs font-normal text-muted-foreground" title={c.reason}>{c.reason}</span>}{c.status === "hold" && c.holdReason && <span className="mt-0.5 block max-w-48 truncate text-xs font-normal text-muted-foreground" title={c.holdReason}>{c.holdReason}{c.holdUntil ? ` · until ${formatDateGB(c.holdUntil)}` : ""}</span>}{c.status === "deposited" && c.presentedOn && <span className="mt-0.5 block max-w-48 truncate text-xs font-normal text-muted-foreground">{formatDateGB(c.presentedOn)}{c.depositSlipNo ? ` · slip ${c.depositSlipNo}` : ""}</span>}</> },
              {
                key: "actions", header: "Actions", align: "end", card: "actions", className: "whitespace-nowrap",
                cell: (c) => (
                  <>
                    {/* clearing, bouncing and cancelling a cheque post to the books: finance.approve, as on the server */}
                    <Can permission="finance.approve">
                      {/* What is offered is what the rules allow (lib/chequeRules.js canDo, the twin of the server's table). */}
                      {canDo("deposit", c) && <Button size="sm" variant="outline" disabled={!c.matured} title={c.matured ? undefined : `Cannot deposit before ${formatDateGB(c.chequeDate)}`} onClick={() => setAction({ kind: "deposit", cheque: c })}><Landmark className="h-3.5 w-3.5" aria-hidden="true" />Deposit</Button>}
                      {canDo("clear", c) && <Button size="sm" variant="outline" disabled={!c.matured} title={c.matured ? undefined : `Cannot clear before ${formatDateGB(c.chequeDate)}`} onClick={() => setAction({ kind: "clear", cheque: c })}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Clear</Button>}
                      {canDo("resume", c) && <Button size="sm" variant="outline" onClick={() => setAction({ kind: "resume", cheque: c })}><Play className="h-3.5 w-3.5" aria-hidden="true" />Resume</Button>}
                      {canDo("hold", c) && <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "hold", cheque: c })}><Pause className="h-3.5 w-3.5" aria-hidden="true" />Hold</Button>}
                      {canDo("bounce", c) && <Button size="sm" variant={c.status === "cleared" ? "ghost" : "outline"} onClick={() => setAction({ kind: "bounce", cheque: c })}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{c.status === "cleared" ? "Returned" : "Bounced"}</Button>}
                      {canDo("cancel", c) && <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "cancel", cheque: c })}><Ban className="h-3.5 w-3.5" aria-hidden="true" />Cancel</Button>}
                    </Can>
                    <Button size="sm" variant="ghost" onClick={() => setAudit(c)}><History className="h-3.5 w-3.5" aria-hidden="true" />Audit trail</Button>
                  </>
                ),
              },
            ]}
          />
        )}
        {data && rows.length > 0 && (
          <ListPager
            figures={pageFigures({ page, size: pageSize, total: data.total })}
            onPage={setPage}
            onPageSize={setPageSize}
            noun="cheques"
            one="cheque"
            className="rounded-none border-0 border-t shadow-none"
          />
        )}
      </Panel>
      {action?.kind === "deposit" && <DepositDialog cheque={action.cheque} onClose={() => setAction(null)} onDone={done} />}
      {action?.kind === "hold" && <HoldDialog cheque={action.cheque} onClose={() => setAction(null)} onDone={done} />}
      {action?.kind === "resume" && <ResumeDialog cheque={action.cheque} onClose={() => setAction(null)} onDone={done} />}
      {action?.kind === "clear" && <ClearDialog cheque={action.cheque} onClose={() => setAction(null)} onDone={done} />}
      {action?.kind === "bounce" && <BounceDialog cheque={action.cheque} onClose={() => setAction(null)} onDone={done} />}
      {action?.kind === "cancel" && <CancelDialog cheque={action.cheque} onClose={() => setAction(null)} onDone={done} />}
      {audit && <VoucherAuditTrail id={audit.voucherId} voucherNo={audit.voucherNo} onClose={() => setAudit(null)} />}
      {toastNode}
    </div>
  );
}



function ClearDialog({ cheque, onClose, onDone }) {
  const [on, setOn] = useState(todayInput());
  const { busy, problem, go } = useAction(() => banking.clearCheque(cheque._id, { clearedOn: on }), onDone, `Cheque ${cheque.chequeNo} cleared`);
  return (
    <Modal
      size="sm" onClose={onClose} title={`Clear cheque ${cheque.chequeNo}`}
      description={`${formatNumber(cheque.amount, 2)} ${CURRENCY} moves ${cheque.direction === "receipt" ? "into" : "out of"} ${cheque.bankAccountName || "the bank account"}.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={busy}>{busy ? "Clearing…" : "Clear cheque"}</Button></>}
    >
      <ErrorNote error={problem} />
      <Field label="Cleared on"><DateInput value={on} min={day(cheque.chequeDate)} onChange={(e) => setOn(e.target.value)} data-autofocus /></Field>
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
