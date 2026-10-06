import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { ConfirmDialog, EmptyState, ErrorNote, Field, Modal, Pill, Spinner, TextInput, errorMessage, inputClass, useAsync, DateInput } from "../accounting/kit";
import { accounting } from "../../lib/accountingApi";
import { banking, vouchers } from "../../lib/bankingApi";
import { accountOption, describePayment, money, toCents } from "../../lib/voucherForms";
import { fxLine, fxProvenance, isForeign } from "../../lib/currencyForms";
import { VoucherAuditTrail } from "../audit/AuditTrail";
import { formatDateGB } from "../../utils/format";

// Pieces every finance voucher screen shares: the list with search, dates and paging; the
// read-only view; and the account / bank lists the entry forms pick from.

// Today as a Dubai calendar day (a UTC read gave yesterday between 00:00 and 04:00, which would
// also have picked yesterday's exchange rate for a foreign-currency voucher).
export { todayInput } from "../../utils/format";

const STATUS = {
  approved: ["success", "Posted"],
  pending: ["warning", "Pending"],
  draft: ["warning", "Draft"],
  rejected: ["danger", "Rejected"],
  bounced: ["danger", "Bounced"],
  cancelled: ["neutral", "Cancelled"],
};
export function StatusPill({ status }) {
  const [tone, label] = STATUS[status] || ["neutral", status || ""];
  return <Pill tone={tone}>{label}</Pill>;
}

// --- loaders ---------------------------------------------------------------------------------

// Every postable account in the chart, flat and ready for a SearchSelect. `filter.categories`
// narrows it (an expense form wants only EXPENSE accounts).
export function useChartAccounts(filter) {
  const list = useAsync(() => accounting.postableAccounts(), []);
  const accounts = useMemo(() => (list.data || []).filter((a) => !filter?.categories || filter.categories.includes(a.category)), [list.data, filter]);
  const options = useMemo(() => accounts.map(accountOption), [accounts]);
  return { ...list, accounts, options };
}

export function useBankingOptions() {
  return useAsync(() => banking.options(), []);
}

// --- list ------------------------------------------------------------------------------------

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useVoucherList(voucherType, { limit = 15 } = {}) {
  const [filters, setFilters] = useState({ search: "", dateFrom: "", dateTo: "", status: "", paymentMode: "", page: 1 });
  const search = useDebounced(filters.search);
  const list = useAsync(
    () => vouchers.list({ voucherType, search: search || undefined, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined, status: filters.status || undefined, paymentMode: filters.paymentMode || undefined, page: filters.page, limit }),
    [voucherType, search, filters.dateFrom, filters.dateTo, filters.status, filters.paymentMode, filters.page, limit]
  );
  const set = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  return { filters, set, setPage: (page) => setFilters((f) => ({ ...f, page })), ...list, rows: list.data?.rows || [], pagination: list.data?.pagination };
}

export function ListToolbar({ filters, set, statuses = true, children }) {
  // On a phone: search across the full width, then the two dates side by side, then status.
  // Fixed widths (w-40, w-36) only apply once there is room for them to sit in one row.
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end print:hidden">
      <div className="relative w-full sm:min-w-56 sm:max-w-sm sm:flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <TextInput aria-label="Search vouchers" className="ps-9" placeholder="Search number, party or narration…" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
      </div>
      <div className="flex gap-3">
        <Field label="From" className="min-w-0 flex-1 sm:w-40 sm:flex-none"><DateInput value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} /></Field>
        <Field label="To" className="min-w-0 flex-1 sm:w-40 sm:flex-none"><DateInput value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} /></Field>
      </div>
      {statuses && (
        <Field label="Status" className="w-full sm:w-36">
          <select className={inputClass} value={filters.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">All</option>
            <option value="approved">Posted</option>
            <option value="cancelled">Cancelled</option>
            <option value="bounced">Bounced</option>
          </select>
        </Field>
      )}
      {children}
    </div>
  );
}

export function Pager({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 print:hidden">
      <span className="text-muted-foreground">{pagination.total} vouchers · page {pagination.current} of {pagination.pages}</span>
      {/* Page steps are the one control on a long list people hit repeatedly, so on touch
          they take the full width and a 44px height instead of a 28px corner button. */}
      <span className="flex gap-2 [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:min-h-0 sm:[&>button]:flex-none">
        <Button variant="outline" size="sm" disabled={pagination.current <= 1} onClick={() => onPage(pagination.current - 1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />Previous</Button>
        <Button variant="outline" size="sm" disabled={pagination.current >= pagination.pages} onClick={() => onPage(pagination.current + 1)}>Next<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
      </span>
    </nav>
  );
}

// The loading / error / empty states every list shows, then the table the page supplies.
export function ListBody({ list, emptyTitle, emptyText, children }) {
  if (list.loading && !list.data) return <Spinner label="Loading" />;
  if (list.error) return <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>;
  if (!list.rows.length) return <EmptyState title={emptyTitle} text={emptyText} />;
  return (
    <>
      <div className="erp-scroll table-pin-first relative overflow-x-auto">{children}</div>
      <Pager pagination={list.pagination} onPage={list.setPage} />
    </>
  );
}

// --- view ------------------------------------------------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// A plain printable page in its own window (so none of the app around it is printed).
export function printVoucher(v, title, companyName = "") {
  const rows = (v.entries || [])
    .map((e) => `<tr><td>${esc(e.accountName)}<br><small>${esc(e.description)}</small></td><td class="n">${e.debitAmount ? money(toCents(e.debitAmount)) : ""}</td><td class="n">${e.creditAmount ? money(toCents(e.creditAmount)) : ""}</td></tr>`)
    .join("");
  const debit = (v.entries || []).reduce((t, e) => t + toCents(e.debitAmount), 0);
  const credit = (v.entries || []).reduce((t, e) => t + toCents(e.creditAmount), 0);
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(v.voucherNo)}</title><style>
    body{font:13px system-ui,sans-serif;margin:32px;color:#111} h1{font-size:18px;margin:0} h2{font-size:14px;margin:0 0 16px;color:#555;font-weight:500}
    table{width:100%;border-collapse:collapse;margin-top:16px} th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top} th{background:#f5f5f5}
    .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap} small{color:#666} .meta td{border:0;padding:2px 8px 2px 0} tfoot td{font-weight:700;border-top:2px solid #111}
    .sign{display:flex;justify-content:space-between;margin-top:64px} .sign div{border-top:1px solid #111;padding-top:6px;width:30%;text-align:center}
  </style></head><body>
    <h1>${esc(companyName)}</h1><h2>${esc(title)}</h2>
    <table class="meta"><tr><td><b>Voucher</b></td><td>${esc(v.voucherNo)}</td><td><b>Date</b></td><td>${esc(formatDateGB(v.date))}</td></tr>
    ${v.partyName ? `<tr><td><b>Party</b></td><td colspan="3">${esc(v.partyName)}</td></tr>` : ""}
    ${isForeign(v) ? `<tr><td><b>Foreign currency</b></td><td colspan="3">${esc(fxLine(v))}<br><small>${esc(fxProvenance(v))}</small></td></tr>` : ""}
    ${v.paymentMode ? `<tr><td><b>Paid by</b></td><td colspan="3">${esc(describePayment(v))}</td></tr>` : ""}
    ${v.narration ? `<tr><td><b>Narration</b></td><td colspan="3">${esc(v.narration)}</td></tr>` : ""}</table>
    <table><thead><tr><th>Account</th><th class="n">Debit</th><th class="n">Credit</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td>Total</td><td class="n">${money(debit)}</td><td class="n">${money(credit)}</td></tr></tfoot></table>
    <div class="sign"><div>Prepared by</div><div>Checked by</div><div>Approved by</div></div>
    <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
}

// Read-only view of any voucher: header, who and how, the ledger entries it posted, and what
// can be done to it.
export function VoucherView({ id, title, onClose, onDeleted, canDelete = true, extra }) {
  const { data: v, loading, error } = useAsync(() => vouchers.get(id), [id]);
  const [audit, setAudit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  async function remove() {
    setBusy(true);
    try {
      await vouchers.remove(id);
      onDeleted?.();
    } catch (e) {
      setProblem(e);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  const entries = v?.entries || [];
  const totals = entries.reduce((t, e) => ({ d: t.d + toCents(e.debitAmount), c: t.c + toCents(e.creditAmount) }), { d: 0, c: 0 });
  return (
    <>
      <Modal
        size="lg" onClose={onClose} title={v ? `${title} ${v.voucherNo}` : title}
        description={v ? `${formatDateGB(v.date)}${v.partyName ? ` · ${v.partyName}` : ""}` : undefined}
        footer={v && (
          <>
            <Button variant="outline" onClick={() => setAudit(true)}><History className="h-4 w-4" aria-hidden="true" />Audit trail</Button>
            <Button variant="outline" onClick={() => printVoucher(v, title)}><Printer className="h-4 w-4" aria-hidden="true" />Print</Button>
            {canDelete && v.status === "approved" && <Button variant="outline" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete (reverse)</Button>}
            <Button onClick={onClose} data-autofocus>Close</Button>
          </>
        )}
      >
        {loading && <Spinner label="Loading" />}
        <ErrorNote error={error || problem} />
        {v && (
          <div className="space-y-4">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Status</dt><dd><StatusPill status={v.status} /></dd></div>
              <div><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums">{money(toCents(v.totalAmount))} AED</dd></div>
              {isForeign(v) && <div className="sm:col-span-2"><dt className="text-muted-foreground">Foreign currency</dt><dd className="tabular-nums"><span className="font-medium">{fxLine(v)}</span><span className="block text-xs text-muted-foreground">{fxProvenance(v)}</span></dd></div>}
              {v.paymentMode && <div className="sm:col-span-2"><dt className="text-muted-foreground">Paid by</dt><dd>{describePayment(v)}</dd></div>}
              {v.referenceInvoiceNo && <div><dt className="text-muted-foreground">Against invoice</dt><dd className="font-mono text-xs">{v.referenceInvoiceNo}</dd></div>}
              {v.narration && <div className="sm:col-span-2"><dt className="text-muted-foreground">Narration</dt><dd>{v.narration}</dd></div>}
            </dl>
            {extra}
            <div className="erp-scroll table-pin-first overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-2 text-start">Account</th><th className="px-3 py-2 text-end">Debit</th><th className="px-4 py-2 text-end">Credit</th></tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2"><span className="font-medium">{e.accountName}</span>{e.description && <span className="block text-xs text-muted-foreground">{e.description}</span>}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{e.debitAmount ? money(toCents(e.debitAmount)) : ""}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{e.creditAmount ? money(toCents(e.creditAmount)) : ""}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-3 py-2 text-end tabular-nums">{money(totals.d)}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{money(totals.c)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {v.ledgerBased === false && ["journal", "contra", "expense"].includes(v.voucherType) && (
              <p className="text-xs text-muted-foreground">This voucher was posted in the older format, to the cash &amp; bank accounts list, so it is view-only here.</p>
            )}
          </div>
        )}
      </Modal>
      {audit && <VoucherAuditTrail id={id} voucherNo={v?.voucherNo} onClose={() => setAudit(false)} />}
      {confirm && (
        <ConfirmDialog
          title={`Delete ${v.voucherNo}?`} danger busy={busy} confirmLabel="Delete and reverse" typeToConfirm="delete"
          text="Its ledger entries are reversed, any invoices it settled are reopened, and the voucher is marked cancelled. The deletion is written to the activity log. This cannot be undone."
          onConfirm={remove} onClose={() => setConfirm(false)}
        />
      )}
    </>
  );
}

export { errorMessage };
