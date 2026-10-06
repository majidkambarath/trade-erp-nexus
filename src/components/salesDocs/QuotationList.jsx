import React, { useState } from "react";
import { Eye, FilePlus2, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { ConfirmDialog, DataTable, EmptyState, ErrorNote, PageHeader, Panel, Pill, Spinner, TextInput, useAsync } from "../accounting/kit";
import { quotations } from "../../lib/salesDocumentsApi";
import { QUOTATION_TABS, expiresSoon, statusLabel, validityText } from "../../lib/salesDocuments";
import { statusTone } from "../../lib/status";
import { formatDate, formatNumber } from "../../utils/format";
import { PillTabs } from "./parts";
import { useDebounced } from "./hooks";
import { cn } from "../../lib/utils";

// Offers to customers: what is out, what was said yes to, what ran out. Opening one shows the document and
// every action on it (sending, accepting, converting); the list only finds it, so there is one place for each.
export default function QuotationList({ onOpen, onNew, onEdit, notify, reloadKey }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const search = useDebounced(q);
  const summary = useAsync(() => quotations.summary(), [reloadKey]);
  const { data, loading, error, reload } = useAsync(
    () => quotations.list({ status: status || undefined, search: search || undefined, page, limit: 20 }),
    [status, search, page, reloadKey]
  );
  const rows = data?.rows || [];
  const pages = data?.pagination?.pages || 1;
  const s = summary.data;
  const counts = s ? { "": s.total, ...Object.fromEntries(Object.entries(s.byStatus).map(([k, v]) => [k, v.count])) } : undefined;

  const remove = async () => {
    setBusy(true);
    try {
      await quotations.remove(removing._id);
      notify(`${removing.quotationNo} deleted`);
      setRemoving(null);
      reload();
      summary.reload();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Quotations"
        description="Offers to your customers. When one is accepted it becomes a sales order, or goes out as a delivery note first."
        actions={<Button onClick={onNew}><FilePlus2 className="h-4 w-4" aria-hidden="true" />New quotation</Button>}
      />

      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Out with customers" count={formatNumber(s.byStatus.SENT?.value || 0, 2)} subText={`${s.byStatus.SENT?.count || 0} offer${(s.byStatus.SENT?.count || 0) === 1 ? "" : "s"} still valid`} tone="teal" />
          <StatCard title="Accepted, not ordered" count={formatNumber(s.byStatus.ACCEPTED?.value || 0, 2)} subText={`${s.byStatus.ACCEPTED?.count || 0} waiting to be converted`} tone="plum" onClick={() => { setStatus("ACCEPTED"); setPage(1); }} />
          <StatCard title="Expiring within 7 days" count={String(s.expiringSoon?.count || 0)} subText={s.expiringSoon?.count ? `${formatNumber(s.expiringSoon.value, 2)} AED at stake` : "nothing about to lapse"} tone={s.expiringSoon?.count ? "warning" : "neutral"} />
          <StatCard title="Offers won" count={s.winRate === null || s.winRate === undefined ? "-" : `${s.winRate}%`} subText="of the offers with an answer" tone="olive" />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 print:hidden sm:flex-row sm:flex-wrap sm:items-center">
        <PillTabs tabs={QUOTATION_TABS} value={status} counts={counts} label="Quotation status" onChange={(v) => { setStatus(v); setPage(1); }} />
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextInput aria-label="Search quotations" className="ps-9" placeholder="Number, customer, reference or item…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading quotations" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && rows.length === 0 && (
          <EmptyState
            title={status || search ? "No quotations match" : "No quotations yet"}
            text={status || search ? "Try another status or clear the search." : "Write an offer to a customer. It is priced exactly as the invoice will be."}
            action={!status && !search ? <Button onClick={onNew}>New quotation</Button> : undefined}
          />
        )}
        {rows.length > 0 && (
          <DataTable
            caption="Quotations"
            rows={rows}
            rowKey={(r) => r._id}
            onRowClick={(r) => onOpen(r._id)}
            columns={[
              {
                key: "no", header: "Quotation", card: "primary",
                cell: (r) => (
                  <>
                    <span className="font-mono text-xs font-semibold">{r.quotationNo}</span>
                    {r.reference && <span className="block text-xs font-normal text-muted-foreground">Ref {r.reference}</span>}
                  </>
                ),
              },
              { key: "party", header: "Customer", card: "title", className: "font-medium", cell: (r) => r.party?.customerName || "-" },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap text-muted-foreground", cell: (r) => formatDate(r.date) },
              {
                key: "valid", header: "Valid until", card: "meta", className: "whitespace-nowrap",
                cell: (r) => (
                  <span className={cn(r.expired ? "font-medium text-status-warning" : expiresSoon(r) ? "font-medium text-status-warning" : "text-muted-foreground")}>
                    {["DRAFT", "SENT"].includes(r.status) ? validityText(r).replace(/^Valid until /, "") : formatDate(r.validUntil)}
                  </span>
                ),
              },
              { key: "amount", header: "Amount", align: "end", card: "amount", className: "whitespace-nowrap font-medium tabular-nums", cell: (r) => formatNumber(r.totalAmount, 2) },
              { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={statusTone(r.displayStatus)}>{statusLabel(r.displayStatus)}</Pill> },
              {
                key: "actions", header: "", align: "end", card: "actions", className: "whitespace-nowrap",
                cell: (r) => (
                  <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => onOpen(r._id)}><Eye className="h-3.5 w-3.5" aria-hidden="true" />View</Button>
                    {r.actions.edit && <Button size="sm" variant="ghost" onClick={() => onEdit(r._id)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</Button>}
                    {r.actions.delete && <Button size="sm" variant="ghost" onClick={() => setRemoving(r)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete</Button>}
                  </span>
                ),
              },
            ]}
          />
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </span>
          </nav>
        )}
      </Panel>

      {removing && (
        <ConfirmDialog
          danger busy={busy} title={`Delete ${removing.quotationNo}?`} confirmLabel="Delete draft" onClose={() => setRemoving(null)} onConfirm={remove}
          text={removing.revisionOf ? `This revision is discarded and ${removing.revisionOf.no} comes back as it was.` : "This draft has not gone to the customer. It is removed for good."}
        />
      )}
    </div>
  );
}
