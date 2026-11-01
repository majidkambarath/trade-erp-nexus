import React, { useEffect, useMemo, useState } from "react";
import { History, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { ConfirmDialog, EmptyState, ErrorNote, Field, Modal, Pill, Spinner, TextInput, Textarea, errorMessage, inputClass, useAsync, DateInput } from "../accounting/kit";
import { accounting } from "../../lib/accountingApi";
import { banking, vouchers } from "../../lib/bankingApi";
import { accountOption, describePayment, money, toCents } from "../../lib/voucherForms";
import { fxLine, fxProvenance, isForeign } from "../../lib/currencyForms";
import { VoucherAuditTrail } from "../audit/AuditTrail";
import { CURRENCY, formatDateGB, moneyHeading } from "../../utils/format";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { totalInWords } from "../PurchaseOrder/shared/invoiceModel";
import { taxIdWord } from "../../lib/taxTerms";
import { useOrganisation } from "../shell/OrganisationContext";
import { ApprovalBanner, useApproval } from "../shell/Approval";
import { awaitingLabel, firstApproverName, FIRST_APPROVAL_MESSAGE, wasFirstApproval } from "../../lib/approvals";
import { deleteKey } from "../../lib/permissions";
import { DEFAULT_PAGE_SIZE, pageFigures } from "../../lib/pagination";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { pageSession } from "../../lib/pageSession";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import ListPager from "../lists/ListPager";
import ListEmpty from "../lists/ListEmpty";

// Pieces every finance voucher screen shares: the list with search, dates and paging; the
// read-only view; and the account / bank lists the entry forms pick from.

// Today as a calendar day in the organisation's time zone (a UTC read gave yesterday for part of the day, which would
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
// `doc` (the voucher) is optional: given it, a voucher that has had its first approval and waits for a second person says so
// instead of "Pending".
export function StatusPill({ status, doc }) {
  const { stateOf } = useApproval();
  const [tone, label] = STATUS[status] || ["neutral", status || ""];
  if (doc && stateOf(doc).awaitingSecond) {
    const by = firstApproverName(doc);
    return <span title={by ? `First approval by ${by}` : undefined}><Pill tone="warning">{awaitingLabel({ awaitingSecond: true })}</Pill></span>;
  }
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

// A voucher list: server-paged, filtered by search, status, payment mode and a PERIOD that opens on this calendar month
// (lib/listPeriod.js). `filters` is what the toolbar draws; `set` changes a filter and goes back to page 1, and so does a new
// period. A page that no longer exists (the last row of the last page was deleted) is replaced by the last page there is.
export function useVoucherList(voucherType, { limit = DEFAULT_PAGE_SIZE } = {}) {
  // What this list remembers while the person visits another page and comes back (F12, finance QA
  // review 1 Nov 2026) - its own period and filters, kept per voucher type so Receipts and Journal
  // do not share one memory. Never localStorage/sessionStorage: see src/lib/pageSession.js.
  const session = pageSession(`vouchers-${voucherType}`);
  const periodFilter = usePeriodFilter({ restore: session.get("period") });
  const { period } = periodFilter;
  useEffect(() => session.set("period", { preset: period.preset, from: period.from, to: period.to }), [session, period.preset, period.from, period.to]);
  const [state, setState] = useState(() => ({
    search: session.get("search", ""), status: session.get("status", ""), paymentMode: session.get("paymentMode", ""),
    page: 1, pageSize: limit, forPeriod: period.key,
  }));
  useEffect(() => {
    session.set("search", state.search || undefined);
    session.set("status", state.status || undefined);
    session.set("paymentMode", state.paymentMode || undefined);
  }, [session, state.search, state.status, state.paymentMode]);
  // the page belongs to the period it was chosen in: a new period starts at page 1 without a second request
  const page = state.forPeriod === period.key ? state.page : 1;
  const search = useDebounced(state.search);
  const list = useAsync(
    () => vouchers.list({
      voucherType, search: search || undefined, dateFrom: period.from || undefined, dateTo: period.to || undefined,
      status: state.status || undefined, paymentMode: state.paymentMode || undefined, page, limit: state.pageSize,
    }),
    [voucherType, search, period.key, state.status, state.paymentMode, page, state.pageSize]
  );
  const set = (patch) => setState((f) => ({ ...f, page: 1, forPeriod: period.key, ...patch }));
  const setPage = (p) => setState((f) => ({ ...f, page: p, forPeriod: period.key }));
  const setPageSize = (n) => set({ pageSize: n });
  const pagination = list.data?.pagination;
  const lastPage = pagination?.pages || 1;
  useEffect(() => {
    if (list.data && !list.data.rows?.length && pagination?.total > 0 && page > lastPage) setPage(lastPage);
  }, [list.data, pagination?.total, page, lastPage]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    // F12/F16b (finance QA review, 1 Nov 2026): while a new period or search is loading, the OLD
    // count must not sit under the NEW period's label as if it were the answer - null reads as
    // "not known yet", which ListBody and PeriodNote already handle.
    filters: { ...state, search: state.search, page, periodFilter, count: list.loading ? null : pagination?.total ?? null },
    set, setPage, setPageSize,
    clearFilters: () => set({ search: "", status: "", paymentMode: "" }),
    ...list, rows: list.data?.rows || [], pagination,
  };
}

export function ListToolbar({ filters, set, statuses = true, children }) {
  // On a phone: search across the full width, then the period, then status. Fixed widths (w-44, w-36) only apply once there
  // is room for them to sit in one row. The line under it says which days are showing and how to widen them.
  const { periodFilter } = filters;
  return (
    <div className="mb-4 print:hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative w-full sm:min-w-56 sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextInput aria-label="Search vouchers" className="ps-9" placeholder="Search number, party or narration…" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
        </div>
        {periodFilter && <PeriodSelect filter={periodFilter} labelled />}
        {statuses && (
          <Field label="Status" className="w-full sm:w-36">
            <select className={inputClass} value={filters.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">All</option>
              <option value="approved">Posted</option>
              <option value="pending">Waiting for approval</option>
              <option value="cancelled">Cancelled</option>
              <option value="bounced">Bounced</option>
            </select>
          </Field>
        )}
        {children}
      </div>
      {periodFilter && <PeriodNote filter={periodFilter} count={filters.count} noun="vouchers" one="voucher" className="mt-3" />}
    </div>
  );
}

// `pagination` is the server's { current, pages, total, limit }.
export function Pager({ pagination, onPage, onPageSize, noun = "vouchers", one = "voucher" }) {
  if (!pagination || !pagination.total) return null;
  const figures = pageFigures({ page: pagination.current, size: pagination.limit, total: pagination.total });
  return <ListPager figures={figures} onPage={onPage} onPageSize={onPageSize || (() => {})} noun={noun} one={one} className="rounded-none border-0 border-t shadow-none" />;
}

// The loading / error / empty states every list shows, then the table the page supplies.
//
// F12/F16b (finance QA review, 1 Nov 2026): a slow request (posting takes 10-25s on the free
// hosting plan) used to leave the PREVIOUS period's rows, or its "none this month" message, on
// screen while a new one loaded - a search for "A" briefly read as "every voucher matches". With
// rows already on screen the old ones stay, dimmed and marked busy, rather than being replaced by
// a spinner or (worse) by "none" before the real answer arrives; with nothing to show yet, the
// spinner is the honest answer, loading or not.
export function ListBody({ list, emptyTitle, emptyText, children }) {
  if (!list.rows.length && (list.loading || !list.data)) return <Spinner label="Loading" />;
  if (list.error) return <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>;
  if (!list.rows.length) {
    // "none this month" is not "none": say which, and offer the way out (the period is the usual reason a list is empty)
    const { periodFilter, search, status, paymentMode } = list.filters;
    const noun = String(emptyTitle || "No vouchers").replace(/^No /i, "").toLowerCase();
    return (
      <ListEmpty
        filter={periodFilter} noun={noun} inPeriod={null} filtered={Boolean(search || status || paymentMode)} onClearFilters={list.clearFilters}
        emptyTitle={emptyTitle} createText={emptyText}
      />
    );
  }
  return (
    <>
      <div
        className={`erp-scroll table-pin-first relative overflow-x-auto${list.loading ? " opacity-60 transition-opacity" : ""}`}
        aria-busy={list.loading || undefined}
      >
        {children}
      </div>
      <Pager pagination={list.pagination} onPage={list.setPage} onPageSize={list.setPageSize} />
    </>
  );
}

// --- view ------------------------------------------------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// "Received from" for money coming in, "Paid to" for money going out; anything else (journal,
// contra, expense, a note) keeps the plain "Party" it always had - none of them is one side of a
// cash movement in the same way.
export const partyLabelFor = (voucherType) => (voucherType === "receipt" ? "Received from" : voucherType === "payment" ? "Paid to" : "Party");

// The invoices a receipt or payment settled, in the shape both the printout and the screen read:
// number, date, what this voucher put against it, and the balance left after. `invoiceId` is
// POPULATED by the server (financialService.getVoucherById); a deleted invoice still shows its id.
export function settledInvoiceRows(v) {
  return (v?.linkedInvoices || []).map((li) => {
    const inv = li.invoiceId && typeof li.invoiceId === "object" ? li.invoiceId : null;
    return { no: inv?.transactionNo || (li.invoiceId ? String(li.invoiceId) : "—"), date: inv?.date || null, amount: li.amount ?? li.allocatedAmount, balance: li.balance ?? li.newBalance };
  });
}

// A plain printable page in its own window (so none of the app around it is printed). `profile`
// is the organisation's one letterhead (useCompanyProfile): logo, English and Arabic name,
// address and TRN, exactly as a tax invoice carries them - a voucher used to print with no
// company identity on it at all (F06, finance QA review 1 Nov 2026). Returns "blocked" when the
// browser's pop-up blocker stopped it, so the caller can say why nothing happened.
export function printVoucher(v, title, profile = {}) {
  const rows = (v.entries || [])
    .map((e) => `<tr><td>${esc(e.accountName)}<br><small>${esc(e.description)}</small></td><td class="n">${e.debitAmount ? money(toCents(e.debitAmount)) : ""}</td><td class="n">${e.creditAmount ? money(toCents(e.creditAmount)) : ""}</td></tr>`)
    .join("");
  const debit = (v.entries || []).reduce((t, e) => t + toCents(e.debitAmount), 0);
  const credit = (v.entries || []).reduce((t, e) => t + toCents(e.creditAmount), 0);
  const invoices = settledInvoiceRows(v);
  const invoiceRows = invoices
    .map((r) => `<tr><td>${esc(r.no)}</td><td>${r.date ? esc(formatDateGB(r.date)) : ""}</td><td class="n">${money(toCents(r.amount))}</td><td class="n">${money(toCents(r.balance))}</td></tr>`)
    .join("");
  const onAccount = toCents(v.onAccountAmount);
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return "blocked";
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(v.voucherNo)}</title><style>
    body{font:13px system-ui,sans-serif;margin:32px;color:#111} h1{font-size:18px;margin:0} h2{font-size:14px;margin:12px 0 16px;color:#555;font-weight:500}
    .company img{max-height:48px;margin-bottom:6px} .company h1+h1{margin-top:2px} .addr{margin:4px 0 0;font-size:12px;color:#555}
    table{width:100%;border-collapse:collapse;margin-top:16px} th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top} th{background:#f5f5f5}
    .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap} small{color:#666} .meta td{border:0;padding:2px 8px 2px 0} tfoot td{font-weight:700;border-top:2px solid #111}
    .words{margin-top:10px;font-weight:600} .sign{display:flex;justify-content:space-between;margin-top:64px} .sign div{border-top:1px solid #111;padding-top:6px;width:30%;text-align:center}
  </style></head><body>
    <div class="company">
      ${profile.logo ? `<img src="${esc(profile.logo)}" alt="">` : ""}
      <h1>${esc(profile.companyName)}</h1>
      ${profile.companyNameArabic ? `<h1 dir="rtl">${esc(profile.companyNameArabic)}</h1>` : ""}
      ${[profile.addressLine1, profile.addressLine2].filter(Boolean).length ? `<p class="addr">${[profile.addressLine1, profile.addressLine2].filter(Boolean).map(esc).join(", ")}</p>` : ""}
      ${profile.vatNumber ? `<p class="addr">${esc(taxIdWord())}: ${esc(profile.vatNumber)}</p>` : ""}
    </div>
    <h2>${esc(title)}</h2>
    <table class="meta"><tr><td><b>Voucher</b></td><td>${esc(v.voucherNo)}</td><td><b>Date</b></td><td>${esc(formatDateGB(v.date))}</td></tr>
    ${v.partyName ? `<tr><td><b>${esc(partyLabelFor(v.voucherType))}</b></td><td colspan="3">${esc(v.partyName)}</td></tr>` : ""}
    ${isForeign(v) ? `<tr><td><b>Foreign currency</b></td><td colspan="3">${esc(fxLine(v))}<br><small>${esc(fxProvenance(v))}</small></td></tr>` : ""}
    ${v.paymentMode ? `<tr><td><b>Paid by</b></td><td colspan="3">${esc(describePayment(v))}</td></tr>` : ""}
    ${v.narration ? `<tr><td><b>Narration</b></td><td colspan="3">${esc(v.narration)}</td></tr>` : ""}</table>
    <table><thead><tr><th>Account</th><th class="n">${esc(moneyHeading("Debit"))}</th><th class="n">${esc(moneyHeading("Credit"))}</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td>Total</td><td class="n">${money(debit)}</td><td class="n">${money(credit)}</td></tr></tfoot></table>
    <p class="words">Amount in words: ${esc(totalInWords(Number(v.totalAmount) || 0))}</p>
    ${invoiceRows ? `<h2>Against invoice</h2><table><thead><tr><th>Invoice</th><th>Date</th><th class="n">Amount</th><th class="n">Balance after</th></tr></thead><tbody>${invoiceRows}</tbody></table>` : ""}
    ${onAccount ? `<p>On account (not yet set against an invoice): ${money(onAccount)}</p>` : ""}
    <div class="sign"><div>Prepared by</div><div>Checked by</div><div>Approved by</div></div>
    <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return "ok";
}

// Read-only view of any voucher: header, who and how, the ledger entries it posted, and what
// can be done to it.
export function VoucherView({ id, title, onClose, onDeleted, onChanged, canDelete: canDeleteProp, extra }) {
  // Deleting (reversing) an approved voucher posts its ledger entries back: that is finance.deletePosted (which implies plain
  // finance.delete), the same rule the server applies by the stored status. The button is offered only for an approved one, so
  // it is the posted key; unless a caller says otherwise.
  const { can } = useOrganisation();
  const { stateOf } = useApproval();
  const canDelete = canDeleteProp ?? can(deleteKey("finance", true));
  const { data: v, loading, error, reload } = useAsync(() => vouchers.get(id), [id]);
  const profile = useCompanyProfile();
  const [audit, setAudit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [note, setNote] = useState("");
  // A posted voucher is locked (F04, finance QA review 1 Nov 2026): no figure may change here, but
  // its narration and notes still can, with a reason - delete it (which reverses it) for a figure.
  const [editingNarration, setEditingNarration] = useState(false);
  const [draft, setDraft] = useState({ narration: "", notes: "", reason: "" });
  const [savingNarration, setSavingNarration] = useState(false);
  const mayEditNarration = v && v.status === "approved" && can("finance.edit");
  function startEditingNarration() {
    setDraft({ narration: v.narration || "", notes: v.notes || "", reason: "" });
    setEditingNarration(true);
    setProblem(null);
  }
  async function saveNarration() {
    setSavingNarration(true);
    setProblem(null);
    try {
      await vouchers.update(id, { narration: draft.narration, notes: draft.notes, reason: draft.reason });
      setEditingNarration(false);
      await reload();
      onChanged?.();
    } catch (e) {
      setProblem(e);
    } finally {
      setSavingNarration(false);
    }
  }

  // A voucher waiting for approval: Approve and Reject need finance.approve, and Approve is offered only to someone who may
  // approve THIS voucher (not their own work when the organisation says so, nothing over their limit, not a second time). The
  // line above the figures says why not. Above the second-approver amount an approve only records the first approval.
  const waiting = v && ["pending", "draft"].includes(v.status);
  const mayApprove = waiting && can("finance.approve") && stateOf(v).canApprove;
  const mayReject = waiting && can("finance.approve");
  async function decide(action) {
    setBusy(true);
    setProblem(null);
    setNote("");
    try {
      const result = await vouchers.approve(id, action);
      setNote(action === "reject" ? "Rejected." : wasFirstApproval(result) ? FIRST_APPROVAL_MESSAGE : "Approved and posted.");
      await reload();
      onChanged?.();
    } catch (e) {
      setProblem(e);
    } finally {
      setBusy(false);
    }
  }

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
  const settledInvoices = v ? settledInvoiceRows(v) : [];
  function printNow() {
    setProblem(null);
    if (printVoucher(v, title, profile) === "blocked") {
      setProblem(new Error("Allow pop-ups for this site to print, then try again."));
    }
  }
  return (
    <>
      <Modal
        size="lg" onClose={onClose} title={v ? `${title} ${v.voucherNo}` : title}
        description={v ? `${formatDateGB(v.date)}${v.partyName ? ` · ${v.partyName}` : ""}` : undefined}
        footer={v && (
          editingNarration ? (
            <>
              <Button variant="outline" onClick={() => setEditingNarration(false)} disabled={savingNarration}>Cancel</Button>
              <Button onClick={saveNarration} disabled={savingNarration || !draft.reason.trim()} data-autofocus>{savingNarration ? "Saving…" : "Save"}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setAudit(true)}><History className="h-4 w-4" aria-hidden="true" />Audit trail</Button>
              <Button variant="outline" onClick={printNow}><Printer className="h-4 w-4" aria-hidden="true" />Print</Button>
              {mayEditNarration && <Button variant="outline" onClick={startEditingNarration}>Edit narration</Button>}
              {canDelete && v.status === "approved" && <Button variant="outline" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete (reverse)</Button>}
              {mayReject && <Button variant="outline" disabled={busy} onClick={() => decide("reject")}>Reject</Button>}
              {mayApprove && <Button disabled={busy} onClick={() => decide("approve")}>Approve</Button>}
              <Button variant={mayApprove ? "outline" : undefined} onClick={onClose} data-autofocus>Close</Button>
            </>
          )
        )}
      >
        {loading && <Spinner label="Loading" />}
        <ErrorNote error={error || problem} />
        {note && <p role="status" className="mb-3 rounded-lg border border-status-info/30 bg-status-info-soft px-3 py-2 text-sm text-foreground">{note}</p>}
        {v && (
          <div className="space-y-4">
            <ApprovalBanner doc={v} permission="finance.approve" />
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Status</dt><dd><StatusPill status={v.status} doc={v} /></dd></div>
              <div><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums">{money(toCents(v.totalAmount))} {CURRENCY}</dd></div>
              {isForeign(v) && <div className="sm:col-span-2"><dt className="text-muted-foreground">Foreign currency</dt><dd className="tabular-nums"><span className="font-medium">{fxLine(v)}</span><span className="block text-xs text-muted-foreground">{fxProvenance(v)}</span></dd></div>}
              {v.paymentMode && <div className="sm:col-span-2"><dt className="text-muted-foreground">Paid by</dt><dd>{describePayment(v)}</dd></div>}
              {v.referenceInvoiceNo && <div><dt className="text-muted-foreground">Against invoice</dt><dd className="font-mono text-xs">{v.referenceInvoiceNo}</dd></div>}
              {v.onAccountAmount > 0 && <div><dt className="text-muted-foreground">On account</dt><dd className="tabular-nums">{money(toCents(v.onAccountAmount))} {CURRENCY} <span className="text-xs text-muted-foreground">(not yet set against an invoice)</span></dd></div>}
              {!editingNarration && v.narration && <div className="sm:col-span-2"><dt className="text-muted-foreground">Narration</dt><dd>{v.narration}</dd></div>}
              {!editingNarration && v.notes && <div className="sm:col-span-2"><dt className="text-muted-foreground">Notes</dt><dd>{v.notes}</dd></div>}
            </dl>
            {settledInvoices.length > 0 && (
              <div className="erp-scroll table-pin-first overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Against invoice</caption>
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-4 py-2 text-start">Invoice</th><th className="px-3 py-2 text-start">Date</th><th className="px-3 py-2 text-end">Amount</th><th className="px-4 py-2 text-end">Balance after</th></tr>
                  </thead>
                  <tbody>
                    {settledInvoices.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-2 font-mono text-xs">{r.no}</td>
                        <td className="px-3 py-2">{r.date ? formatDateGB(r.date) : ""}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{money(toCents(r.amount))}</td>
                        <td className="px-4 py-2 text-end tabular-nums">{money(toCents(r.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editingNarration && (
              <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">This voucher is posted: its amount, accounts, party and date cannot change here. Only the narration, notes and a reason for the change.</p>
                <Field label="Narration"><TextInput value={draft.narration} onChange={(e) => setDraft((d) => ({ ...d, narration: e.target.value }))} maxLength={200} /></Field>
                <Field label="Notes"><Textarea rows={2} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} maxLength={500} /></Field>
                <Field label="Reason for this change" required>
                  <TextInput value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} maxLength={500} placeholder="e.g. corrected a typo in the narration" />
                </Field>
              </div>
            )}
            {extra}
            <div className="erp-scroll table-pin-first overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-2 text-start">Account</th><th className="px-3 py-2 text-end">{moneyHeading("Debit")}</th><th className="px-4 py-2 text-end">{moneyHeading("Credit")}</th></tr>
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
