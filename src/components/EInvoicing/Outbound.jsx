import React, { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, FileMinus2, History, Loader2, RefreshCw, RotateCcw, Search, Send, Wrench } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { formatDateGB, formatNumber, moneyHeading } from "../../utils/format";
import { Button } from "../ui/button";
import { ConfirmDialog, DataTable, EmptyState, errorMessage, ErrorNote, formatDateTime, Modal, Panel, Pill, Select, Spinner, useAsync } from "../accounting/kit";
import { PillTabs } from "../salesDocs/parts";
import SendProgress from "./SendProgress";
import { DOC_TYPE, NEXT_STEP, STATUS, StatusPill, deliveryText, ftaText } from "./shared";

// The server returns the newest documents a page at a time (25 unless asked, 100 at most) as a plain list with no total, so
// the screen asks for 50 and offers older ones while a page comes back full. (It used to ask for none and show only the
// newest 25, with no sign that more existed.)
const PAGE = 50;

export default function Outbound({ notify, enabled }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const overdue = params.get("overdue") === "1";
  const kind = params.get("kind") || "";
  const query = params.get("search") || "";
  const [search, setSearch] = useState(query);
  const [page, setPage] = useState(1);
  // the filter is kept in the address (so the dashboard can link to it) and decided by the server, not by the page loaded
  const setFilter = (patch) => { const next = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); } setParams(next, { replace: true }); setPage(1); };
  const setStatus = (v) => setFilter({ status: v, overdue: "" });
  const setQuery = (v) => setFilter({ search: v });
  const [preview, setPreview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const docs = useAsync(() => einvoice.documents({ search: query || undefined, status: status || undefined, overdue: overdue ? 1 : undefined, kind: kind || undefined, page, limit: PAGE }), [query, status, overdue, kind, page]);

  const loaded = docs.data || [];
  const rows = loaded;
  const first = (page - 1) * PAGE + 1;
  const hasOlder = loaded.length >= PAGE;

  // A send is shown in its own dialog (SendProgress) that follows ONE request. The result also reaches the list and a toast
  // here, so hiding the dialog never loses it.
  const [sending, setSending] = useState(null);
  const hidden = useRef(false);
  function startSend(doc, kind, fn, okMessage) {
    const promise = fn();
    hidden.current = false;
    setSending({ doc, kind, promise, fn, okMessage });
    promise.then((r) => {
      const sub = r?.submission || r;
      if (sub?.status === "FAILED") notify(`${doc.transactionNo} not sent yet${sub.lastError ? `: ${sub.lastError}` : ""}`, "error");
      else if (hidden.current) notify(okMessage);
      else notify(okMessage);
      docs.reload();
    }, (e) => {
      if (e?.code === "EINVOICE_VALIDATION") { setSending(null); setPreview({ doc, issues: e.details?.issues || [], payload: null, ready: false }); }
      else if (hidden.current) notify(errorMessage(e), "error");
    });
  }
  const closeSending = () => { hidden.current = true; setSending(null); };

  async function act(fn, doc, okMessage) {
    setBusyId(doc._id);
    try {
      await fn();
      if (okMessage) { notify(okMessage); docs.reload(); }
    } catch (e) {
      if (e.code === "EINVOICE_VALIDATION") setPreview({ doc, issues: e.details?.issues || [], payload: null, ready: false });
      else notify(errorMessage(e), "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel
      bodyClassName="p-0" title={kind === "380" ? "Sales invoices" : kind === "381" ? "Credit notes" : "Sales invoices and credit notes"}
      description={enabled ? "Approved sales documents. Send each one once its customer details are complete." : "E-invoicing is switched off. You can preview documents, but sending needs it switched on in Settings."}
      actions={
        <>
          <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }} className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Document number" aria-label="Search by document number"
              className="h-9 w-44 rounded-full border border-input bg-background ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
          </form>
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-40 rounded-full">
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </>
      }
    >
      <div className="border-b border-border px-5 py-3">
        <PillTabs label="Document type" value={kind} onChange={(v) => setFilter({ kind: v })} tabs={[["", "All"], ["380", "Invoices"], ["381", "Credit notes"]]} />
      </div>
      {docs.loading && !docs.data && <Spinner label="Loading documents" />}
      {docs.error && <div className="p-5"><ErrorNote error={docs.error} onRetry={docs.reload} /></div>}
      {docs.data && rows.length === 0 && (
        <EmptyState
          title="No documents"
          text={status || query || kind || overdue ? "Nothing matches that filter." : page > 1 ? "There are no older documents." : "Approved sales invoices and sales returns appear here."}
          action={page > 1 ? <Button variant="outline" onClick={() => setPage(page - 1)}>Newer documents</Button> : undefined}
        />
      )}
      {rows.length > 0 && (
        <div className="erp-scroll table-pin-first overflow-x-auto">
          <DataTable
            caption="Documents to send"
            rows={rows}
            rowKey={(d) => d._id}
            columns={[
              { key: "document", header: "Document", card: "primary", cell: (d) => <><Link to={`${d.type === "sales_return" ? "/sales-return" : "/sales-order"}?search=${encodeURIComponent(d.transactionNo)}`} className="font-mono text-xs font-semibold text-primary hover:underline">{d.transactionNo}</Link><span className="block text-xs font-normal text-muted-foreground">{DOC_TYPE[d.invoiceTypeCode]}</span></> },
              { key: "reference", header: "Reference", card: "meta", cell: (d) => (d.creditOf || d.creditedBy?.length ? <>{d.creditOf && <span className="block text-xs">Credit note for <Link to={`/sales-order?search=${encodeURIComponent(d.creditOf)}`} className="font-mono font-semibold text-primary hover:underline">{d.creditOf}</Link></span>}{d.creditedBy?.length > 0 && <span className="block text-xs">Credited by {d.creditedBy.map((n, i) => <React.Fragment key={n}>{i > 0 && ", "}<Link to={`/sales-return?search=${encodeURIComponent(n)}`} className="font-mono font-semibold text-primary hover:underline">{n}</Link></React.Fragment>)}</span>}</> : <span className="text-muted-foreground">—</span>) },
              { key: "customer", header: "Customer", card: "title", cell: (d) => <>{d.customer || "—"}{!d.partyReady && <span className="block text-xs text-status-warning">Missing: {d.partyMissing.join(", ")}</span>}</> },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap", cell: (d) => <>{formatDateGB(d.date)}{d.overdue && <span className="block text-xs text-status-danger">Past due date to send</span>}</> },
              { key: "total", header: "Total", money: true, align: "end", card: "amount", className: "tabular-nums", cell: (d) => formatNumber(d.total, 2) },
              { key: "status", header: "Status", card: "badge", cell: (d) => <><StatusPill status={d.status} />{d.deliveryStatus && <span className="mt-1 block max-w-60 text-xs font-normal text-muted-foreground">{deliveryText(d.deliveryStatus)}{d.taxStatus ? ` · ${ftaText(d.taxStatus)}` : ""}</span>}{d.lastError && ["FAILED", "REJECTED"].includes(d.status) && <span className="mt-1 block max-w-60 text-xs font-normal text-muted-foreground">{d.lastError}</span>}</> },
              {
      key: "actions", header: "Actions", align: "end", card: "actions",
      cell: (d) => {
        const busy = busyId === d._id || sending?.doc?._id === d._id;
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {d.status === "NOT_SENT" && (
              <>
                <Button size="sm" variant="outline" onClick={() => act(async () => setPreview({ doc: d, ...(await einvoice.preview(d._id)) }), d, "")} disabled={busy}>{busy && busyId === d._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}{busy && busyId === d._id ? "Checking…" : "Review"}</Button>
                <Button size="sm" onClick={() => setPreview({ doc: d, confirmSend: true })} disabled={busy || !enabled}><Send className="h-3.5 w-3.5" aria-hidden="true" />Send</Button>
              </>
            )}
            {d.status === "REJECTED" && d.rejectedBy === "buyer" && ["BV", "SV"].includes(d.deliveryReasonCode) && <Button size="sm" onClick={() => setPreview({ doc: d, confirmCorrect: true })} disabled={busy || !enabled}><Wrench className="h-3.5 w-3.5" aria-hidden="true" />Resend correction</Button>}
            {["SUBMITTED", "ACKNOWLEDGED", "REPORTED"].includes(d.status) && d.type === "sales_order" && <Button size="sm" variant="outline" onClick={() => setPreview({ doc: d, confirmCredit: true })} disabled={busy}><FileMinus2 className="h-3.5 w-3.5" aria-hidden="true" />Credit in full</Button>}
            {d.status === "FAILED" && <Button size="sm" onClick={() => startSend(d, "retry", () => einvoice.retry(d.submissionId), `${d.transactionNo} sent again`)} disabled={busy}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Retry</Button>}
            {["SUBMITTED", "ACKNOWLEDGED"].includes(d.status) && <Button size="sm" variant="outline" onClick={() => act(() => einvoice.refresh(d.submissionId), d, "Status updated")} disabled={busy}><RefreshCw className={`h-3.5 w-3.5 ${busyId === d._id ? "animate-spin" : ""}`} aria-hidden="true" />{busyId === d._id ? "Checking…" : "Check status"}</Button>}
            {d.submissionId && <Button size="sm" variant="ghost" onClick={() => setDetail(d.submissionId)} aria-label={`History of ${d.transactionNo}`}><History className="h-3.5 w-3.5" aria-hidden="true" />History</Button>}
          </div>
        );
      },
    },
            ]}
          />
        </div>
      )}

      {docs.data && (page > 1 || hasOlder) && (
        <nav aria-label="Pages" className="flex flex-col gap-2 border-t border-border px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            {loaded.length ? `Documents ${first} to ${first + loaded.length - 1}, newest first` : "No older documents"}
          </span>
          <span className="flex gap-2 [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:min-h-0 sm:[&>button]:flex-none">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Button>
            <Button size="sm" variant="outline" disabled={!hasOlder} onClick={() => setPage(page + 1)}>Older</Button>
          </span>
        </nav>
      )}

      {preview && !preview.confirmSend && !preview.confirmCorrect && !preview.confirmCredit && (
        <PreviewModal {...preview} enabled={enabled} onClose={() => setPreview(null)}
          onSend={() => { const d = preview.doc; setPreview(null); startSend(d, "send", () => einvoice.submit(d._id), `${d.transactionNo} sent`); }} />
      )}
      {preview?.confirmCorrect && (
        <ConfirmDialog title={`Resend ${preview.doc.transactionNo} as a correction?`} confirmLabel="Resend correction"
          text={`The buyer rejected it${preview.doc.deliveryReasonText ? `: ${preview.doc.deliveryReasonText}` : ""}. Fix the customer's details first (Readiness, or the customer itself): the invoice is rebuilt from what is saved now. The number stays the same and Wafeq links it to the rejected one.`}
          onClose={() => setPreview(null)} onConfirm={() => { const d = preview.doc; setPreview(null); startSend(d, "correct", () => einvoice.correct(d.submissionId), `${d.transactionNo} corrected and sent again`); }} />
      )}
      {preview?.confirmCredit && (
        <ConfirmDialog title={`Credit ${preview.doc.transactionNo} in full?`} confirmLabel="Make the credit note"
          text="This makes a draft credit note (sales return) for everything on the invoice not yet credited. Review and approve it on Sales > Returns, then send it from here. The invoice itself stays as it was issued."
          onClose={() => setPreview(null)} onConfirm={() => { const d = preview.doc; setPreview(null); act(async () => { const r = await einvoice.creditInFull(d._id); navigate(`/sales-return?search=${encodeURIComponent(r.transactionNo)}`); }, d, ""); }} />
      )}
      {preview?.confirmSend && (
        <ConfirmDialog title={`Send ${preview.doc.transactionNo}?`} confirmLabel="Send e-invoice"
          text="An invoice that has been sent cannot be edited. If it is wrong, you issue a credit note and a corrected invoice. The invoice is checked before it goes, and any problem is shown."
          onClose={() => setPreview(null)} onConfirm={() => { const d = preview.doc; setPreview(null); startSend(d, "send", () => einvoice.submit(d._id), `${d.transactionNo} sent`); }} />
      )}
      {sending && (
        <SendProgress doc={sending.doc} kind={sending.kind} promise={sending.promise} onClose={closeSending}
          onValidation={() => {}} onHistory={(id) => { setSending(null); setDetail(id); }}
          onRetry={() => startSend(sending.doc, sending.kind, sending.fn, sending.okMessage)} />
      )}
      {detail && <SubmissionModal id={detail} onClose={() => setDetail(null)} />}
    </Panel>
  );
}

function PreviewModal({ doc, issues = [], payload, ready, wafeq, enabled, onClose, onSend }) {
  return (
    <Modal size="lg" onClose={onClose} title={`${doc.transactionNo} · ${DOC_TYPE[doc.invoiceTypeCode]}`}
      description={ready ? "Checked and ready to send." : `${issues.length} problem${issues.length === 1 ? "" : "s"} to fix before this can be sent.`}
      footer={<><Button variant="outline" onClick={onClose}>Close</Button>{ready && <Button onClick={onSend} disabled={!enabled}>{enabled ? "Send e-invoice" : "Switched off in Settings"}</Button>}</>}>
      {issues.length > 0 && (
        <ul className="mb-4 space-y-2" aria-label="Problems">
          {issues.map((i, k) => (
            <li key={k} className="flex gap-2 rounded-lg border border-status-danger/25 bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
              <span className="font-mono text-xs opacity-80">{i.field}</span><span>{i.message}</span>
            </li>
          ))}
        </ul>
      )}
      {wafeq && !wafeq.checked && <p className="mb-4 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">{wafeq.note}</p>}
      {wafeq?.checked && (
        <div className="mb-4 space-y-2" aria-label="Wafeq check">
          <p className="text-sm"><span className="font-medium">Checked with Wafeq:</span> {wafeq.valid ? "passes the PINT-AE rules" : "does not pass the PINT-AE rules"}{wafeq.route === "reporting_only" ? ". It will be reported to the tax authority only: the buyer is not on Peppol." : ""}</p>
          {[...wafeq.errors, ...wafeq.warnings].map((i, k) => (
            <p key={k} className={`rounded-lg px-3 py-2 text-sm ${wafeq.errors.includes(i) ? "border border-status-danger/25 bg-status-danger-soft text-status-danger" : "bg-secondary text-muted-foreground"}`}><span className="font-mono text-xs opacity-80">{i.code}</span> {i.message}</p>
          ))}
        </div>
      )}
      {payload && (
        <div className="space-y-4 text-sm">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Seller</dt><dd className="font-medium">{payload.sellerName} · TRN {payload.sellerVatTrn}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Buyer</dt><dd className="font-medium">{payload.buyerName}{payload.buyerVatTrn ? ` · TRN ${payload.buyerVatTrn}` : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Issue date</dt><dd className="font-medium">{payload.issueDate}</dd></div>
            {payload.invoiceRef && <div><dt className="text-xs text-muted-foreground">Credits invoice</dt><dd className="font-mono font-medium">{payload.invoiceRef}</dd></div>}
          </dl>
          <div className="erp-scroll table-pin-first overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-secondary/60 text-muted-foreground"><tr><th className="px-3 py-2 text-start">#</th><th className="px-3 py-2 text-start">Item</th><th className="px-3 py-2 text-end">Qty</th><th className="px-3 py-2 text-end">{moneyHeading("Net")}</th><th className="px-3 py-2 text-start">Tax</th><th className="px-3 py-2 text-end">{moneyHeading("VAT")}</th></tr></thead>
              <tbody>{payload.lines.map((l) => (
                <tr key={l.lineNumber} className="border-t border-border"><td className="px-3 py-1.5">{l.lineNumber}</td><td className="px-3 py-1.5">{l.itemName}</td><td className="px-3 py-1.5 text-end tabular-nums">{l.quantity}</td><td className="px-3 py-1.5 text-end tabular-nums">{formatNumber(l.lineNetAmount, 2)}</td><td className="px-3 py-1.5">{l.taxCategory || <span className="text-status-danger">unresolved</span>} {l.taxRatePercent}%</td><td className="px-3 py-1.5 text-end tabular-nums">{formatNumber(l.lineTaxAmount, 2)}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <dl className="ms-auto grid max-w-xs grid-cols-2 gap-y-1">
            <dt className="text-muted-foreground">Net</dt><dd className="text-end tabular-nums">{formatNumber(payload.lineExtensionTotal, 2)}</dd>
            <dt className="text-muted-foreground">VAT</dt><dd className="text-end tabular-nums">{formatNumber(payload.taxAmount, 2)}</dd>
            {payload.roundingAmount !== 0 && <><dt className="text-muted-foreground">Rounding</dt><dd className="text-end tabular-nums">{formatNumber(payload.roundingAmount, 2)}</dd></>}
            <dt className="font-semibold">Payable</dt><dd className="text-end font-semibold tabular-nums">{formatNumber(payload.payableAmount, 2)}</dd>
          </dl>
        </div>
      )}
    </Modal>
  );
}

function SubmissionModal({ id, onClose }) {
  const { data, loading, error } = useAsync(() => einvoice.submission(id), [id]);
  const [showPayload, setShowPayload] = useState(false);
  return (
    <Modal size="lg" onClose={onClose} title={data ? `${data.documentNo} · history` : "History"} description={data ? NEXT_STEP[data.status] : undefined}>
      {loading && !data && <Spinner />}
      <ErrorNote error={error} />
      {data && (
        <div className="space-y-4">
          <ol className="relative space-y-3 border-s border-border ps-5">
            {data.history.map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -start-[1.65rem] top-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2"><StatusPill status={h.status} /><span className="text-xs text-muted-foreground">{formatDateTime(h.at)}</span></div>
                {h.note && <p className="mt-0.5 text-sm text-muted-foreground">{h.note}</p>}
              </li>
            ))}
          </ol>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">Attempts</dt><dd className="font-medium">{data.attempts}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Reference</dt><dd className="font-mono text-xs font-medium">{data.providerEntryId || "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Tax authority</dt><dd className="font-medium">{ftaText(data.taxStatus) || "—"}</dd></div>
            {data.deliveryStatus && <div><dt className="text-xs text-muted-foreground">Delivery</dt><dd className="font-medium">{deliveryText(data.deliveryStatus)}</dd></div>}
            {data.route === "reporting_only" && <div><dt className="text-xs text-muted-foreground">Route</dt><dd className="font-medium">Tax authority only</dd></div>}
          </dl>
          {data.providerIssues?.length > 0 && (
            <ul className="space-y-2" aria-label="Refused by Wafeq">{data.providerIssues.map((i, k) => <li key={k} className="rounded-lg border border-status-danger/25 bg-status-danger-soft px-3 py-2 text-sm text-status-danger"><span className="font-mono text-xs opacity-80">{i.code}</span> {i.message}</li>)}</ul>
          )}
          {data.lastError && <p className="rounded-lg bg-status-danger-soft px-3 py-2 text-sm text-status-danger">{data.lastError}</p>}
          {data.nextRetryAt && data.status === "FAILED" && <Pill tone="warning">Automatic retry at {formatDateTime(data.nextRetryAt)}</Pill>}
          <div>
            <button type="button" className="text-sm font-semibold underline underline-offset-2" onClick={() => setShowPayload((v) => !v)} aria-expanded={showPayload}>{showPayload ? "Hide" : "Show"} exactly what was sent</button>
            {showPayload && (
              <>
                <p className="mt-1 break-all text-xs text-muted-foreground">Fingerprint (SHA-256): <span className="font-mono">{data.payloadHash}</span></p>
                <pre className="erp-scroll mt-2 max-h-72 overflow-auto rounded-lg bg-secondary/60 p-3 text-xs">{JSON.stringify(data.payload, null, 2)}</pre>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
