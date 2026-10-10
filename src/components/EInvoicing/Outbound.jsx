import React, { useState } from "react";
import { Eye, History, RefreshCw, RotateCcw, Search, Send } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { formatDateGB, formatNumber } from "../../utils/format";
import { Button } from "../ui/button";
import { ConfirmDialog, DataTable, EmptyState, errorMessage, ErrorNote, formatDateTime, Modal, Panel, Pill, Select, Spinner, useAsync } from "../accounting/kit";
import { DOC_TYPE, NEXT_STEP, STATUS, StatusPill } from "./shared";

// The server returns the newest documents a page at a time (25 unless asked, 100 at most) as a plain list with no total, so
// the screen asks for 50 and offers older ones while a page comes back full. (It used to ask for none and show only the
// newest 25, with no sign that more existed.)
const PAGE = 50;

export default function Outbound({ notify, enabled }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const docs = useAsync(() => einvoice.documents({ search: query || undefined, page, limit: PAGE }), [query, page]);

  const loaded = docs.data || [];
  const rows = loaded.filter((d) => !status || d.status === status);
  const first = (page - 1) * PAGE + 1;
  const hasOlder = loaded.length >= PAGE;

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
      bodyClassName="p-0" title="Sales invoices and credit notes"
      description={enabled ? "Approved sales documents. Send each one once its customer details are complete." : "E-invoicing is switched off. You can preview documents, but sending needs it switched on in Settings."}
      actions={
        <>
          <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }} className="relative">
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
      {docs.loading && !docs.data && <Spinner label="Loading documents" />}
      {docs.error && <div className="p-5"><ErrorNote error={docs.error} onRetry={docs.reload} /></div>}
      {docs.data && rows.length === 0 && (
        <EmptyState
          title="No documents"
          text={status || query ? "Nothing matches that filter." : page > 1 ? "There are no older documents." : "Approved sales invoices and sales returns appear here."}
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
              { key: "document", header: "Document", card: "primary", cell: (d) => <><span className="font-mono text-xs font-semibold">{d.transactionNo}</span><span className="block text-xs font-normal text-muted-foreground">{DOC_TYPE[d.invoiceTypeCode]}</span></> },
              { key: "customer", header: "Customer", card: "title", cell: (d) => <>{d.customer || "—"}{!d.partyReady && <span className="block text-xs text-status-warning">Missing: {d.partyMissing.join(", ")}</span>}</> },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap", cell: (d) => <>{formatDateGB(d.date)}{d.overdue && <span className="block text-xs text-status-danger">Past due date to send</span>}</> },
              { key: "total", header: "Total", align: "end", card: "amount", className: "tabular-nums", cell: (d) => formatNumber(d.total, 2) },
              { key: "status", header: "Status", card: "badge", cell: (d) => <><StatusPill status={d.status} />{d.lastError && ["FAILED", "REJECTED"].includes(d.status) && <span className="mt-1 block max-w-60 text-xs font-normal text-muted-foreground">{d.lastError}</span>}</> },
              {
      key: "actions", header: "Actions", align: "end", card: "actions",
      cell: (d) => {
        const busy = busyId === d._id;
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {d.status === "NOT_SENT" && (
              <>
                <Button size="sm" variant="outline" onClick={() => act(async () => setPreview({ doc: d, ...(await einvoice.preview(d._id)) }), d, "")} disabled={busy}><Eye className="h-3.5 w-3.5" aria-hidden="true" />Review</Button>
                <Button size="sm" onClick={() => setPreview({ doc: d, confirmSend: true })} disabled={busy || !enabled}><Send className="h-3.5 w-3.5" aria-hidden="true" />Send</Button>
              </>
            )}
            {d.status === "FAILED" && <Button size="sm" onClick={() => act(() => einvoice.retry(d.submissionId), d, `${d.transactionNo} sent again`)} disabled={busy}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Retry</Button>}
            {["SUBMITTED", "ACKNOWLEDGED"].includes(d.status) && <Button size="sm" variant="outline" onClick={() => act(() => einvoice.refresh(d.submissionId), d, "Status updated")} disabled={busy}><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Check status</Button>}
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
            {loaded.length ? `Documents ${first} to ${first + loaded.length - 1}, newest first${status ? ". The status filter applies to this page only" : ""}` : "No older documents"}
          </span>
          <span className="flex gap-2 [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:min-h-0 sm:[&>button]:flex-none">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Button>
            <Button size="sm" variant="outline" disabled={!hasOlder} onClick={() => setPage(page + 1)}>Older</Button>
          </span>
        </nav>
      )}

      {preview && !preview.confirmSend && (
        <PreviewModal {...preview} enabled={enabled} onClose={() => setPreview(null)}
          onSend={() => { const d = preview.doc; setPreview(null); act(() => einvoice.submit(d._id), d, `${d.transactionNo} sent`); }} />
      )}
      {preview?.confirmSend && (
        <ConfirmDialog title={`Send ${preview.doc.transactionNo}?`} confirmLabel="Send e-invoice"
          text="An invoice that has been sent cannot be edited. If it is wrong, you issue a credit note and a corrected invoice. The invoice is checked before it goes, and any problem is shown."
          onClose={() => setPreview(null)} onConfirm={() => { const d = preview.doc; setPreview(null); act(() => einvoice.submit(d._id), d, `${d.transactionNo} sent`); }} />
      )}
      {detail && <SubmissionModal id={detail} onClose={() => setDetail(null)} />}
    </Panel>
  );
}

function PreviewModal({ doc, issues = [], payload, ready, enabled, onClose, onSend }) {
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
              <thead className="bg-secondary/60 text-muted-foreground"><tr><th className="px-3 py-2 text-start">#</th><th className="px-3 py-2 text-start">Item</th><th className="px-3 py-2 text-end">Qty</th><th className="px-3 py-2 text-end">Net</th><th className="px-3 py-2 text-start">Tax</th><th className="px-3 py-2 text-end">VAT</th></tr></thead>
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
            <div><dt className="text-xs text-muted-foreground">Tax authority</dt><dd className="font-medium">{data.taxStatus || "—"}</dd></div>
          </dl>
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
