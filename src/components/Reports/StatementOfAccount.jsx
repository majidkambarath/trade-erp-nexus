import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import axiosInstance from "../../axios/axios";
import { accounting } from "../../lib/accountingApi";
import { accountOptions, findAccount, groupByMonth, netOf } from "../../lib/statement";
import { downloadCSV, drCr, formatDateGB, formatNumber, toInputDate } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Balance, EmptyState, ErrorNote, Field, PageHeader, Panel, Select, SearchSelect, Spinner, useAsync, DateInput } from "../accounting/kit";
import { useOrganisation } from "../shell/OrganisationContext";

const TYPES = {
  Customer: { noun: "customer", path: "/customers/customers", name: "customerName", code: "customerId", owes: "owes you" },
  Vendor: { noun: "vendor", path: "/vendors/vendors", name: "vendorName", code: "vendorId", owes: "you owe" },
  Account: { noun: "account" },
};
const LABEL = {
  sales_order: "Sales invoice", sales_return: "Sales return", purchase_order: "Purchase invoice", purchase_return: "Purchase return",
  receipt: "Receipt", payment: "Payment", journal: "Journal", contra: "Contra", expense: "Expense", opening: "Opening balance",
  opening_stock: "Opening stock", closing: "Year-end closing", production: "Production", adjustment: "Stock adjustment",
};

// Statement of account: every posting against ONE subject, in date order, with a running balance.
//
// The subject is a customer, a vendor, or - since the whole chart is offered here - any ledger account:
// a bank, a cash box, a loan, VAT, an expense. A party's statement is signed for the party (positive =
// they owe us, or we owe them); an account has no party, so `net` (debit minus credit) is the field both
// carry and the one this screen draws as Dr / Cr. The rules are in lib/statement.js, tested without
// rendering: the picker's grouping and the month grouping.
//
// With ledger posting on, a party's statement is read from the ledger so it agrees with the Trial Balance;
// with it off the server rebuilds it from the approved documents (`source: "documents"`). An ACCOUNT has
// no such fallback - nothing is posted to accounts at all while posting is off - so the server says that
// with `postingOff` rather than showing an empty page as if the account had never been used.
export default function StatementOfAccount() {
  const [params, setParams] = useSearchParams();
  // A statement of ANY account is the general ledger by another name, so the server asks for more than
  // reports.view for it (that one is in plans.ALWAYS_ON - every organisation holds it). The screen must
  // not offer a door the server will shut, nor keep a typed ?partyType=Account that would only 403.
  const { canAny } = useOrganisation();
  const mayReadAnyAccount = canAny(["accounts.view", "reports.financial", "finance.view"]);
  const asked = params.get("partyType");
  const partyType = TYPES[asked] && (asked !== "Account" || mayReadAnyAccount) ? asked : "Customer";
  const isAccount = partyType === "Account";
  const partyId = params.get("partyId") || "";
  const accountId = params.get("accountId") || "";
  const subjectId = isAccount ? accountId : partyId;
  const [range, setRange] = useState({ from: params.get("from") || "", to: params.get("to") || "" });
  const [byMonth, setByMonth] = useState(true);
  const [parties, setParties] = useState({ loading: true, rows: [], error: null });

  const choose = (id) => setParams({ partyType, ...(id ? { [isAccount ? "accountId" : "partyId"]: id } : {}) }, { replace: true });

  // The pick list follows the party type: the customer or vendor master, or every account a voucher can
  // post to (/accounts/postable - names and codes, no balances, which is why it answers to lookups.view).
  useEffect(() => {
    let live = true;
    setParties({ loading: true, rows: [], error: null });
    const ask = isAccount ? accounting.postableAccounts() : axiosInstance.get(TYPES[partyType].path).then((res) => res.data?.data || []);
    Promise.resolve(ask)
      .then((rows) => live && setParties({ loading: false, rows: rows || [], error: null }))
      .catch((error) => live && setParties({ loading: false, rows: [], error }));
    return () => { live = false; };
  }, [partyType, isAccount]);

  const { data, loading, error, reload } = useAsync(
    () => {
      if (!subjectId) return Promise.resolve(null);
      const period = { from: range.from || undefined, to: range.to || undefined };
      return accounting.statement(isAccount ? { accountId, ...period } : { partyId, partyType, ...period });
    },
    [subjectId, partyType, isAccount, range.from, range.to]
  );

  const options = useMemo(() => (isAccount
    ? accountOptions(parties.rows)
    : [...parties.rows]
        .sort((a, b) => String(a[TYPES[partyType].name]).localeCompare(String(b[TYPES[partyType].name])))
        .map((p) => ({ value: p._id, label: p[TYPES[partyType].name], hint: p[TYPES[partyType].code] }))),
  [parties.rows, partyType, isAccount]);

  const net = (x) => netOf(x, partyType);
  const openingNet = data ? net({ net: data.openingNet, balance: data.opening }) : 0;
  const closingNet = data ? net({ net: data.closingNet, balance: data.closing }) : 0;
  const sideText = (n) => { const { text, side } = drCr(n); return side ? `${text} ${side}` : text; };
  const months = useMemo(() => (data ? groupByMonth(data.rows, toInputDate, partyType) : []), [data, partyType]);
  const grouped = byMonth && months.length > 0;
  const subject = data?.subject?.name || data?.party?.name || data?.account?.accountName || "";
  const chosen = isAccount ? findAccount(parties.rows, accountId) : null;

  // What is exported is what is on the screen, month subtotals and all - the rule the CRM's list exports
  // follow - so a figure questioned in the spreadsheet can be found again on the page it came from.
  function exportCsv() {
    const row = (r) => [formatDateGB(r.date), r.voucherNo, LABEL[r.voucherType] || r.voucherType, r.narration || "", r.debit || "", r.credit || "", sideText(net(r))];
    const body = grouped
      ? months.flatMap((m) => [[m.label, "", "", "", "", "", ""], ...m.rows.map(row), ["", `${m.label} total`, "", "", m.debit, m.credit, sideText(m.closingNet)]])
      : data.rows.map(row);
    downloadCSV(`statement-${subject || "account"}.csv`,
      ["Date", "Document", "Type", "Details", "Debit", "Credit", "Balance"],
      [["", "Opening balance", "", "", "", "", sideText(openingNet)], ...body, ["", "Closing balance", "", "", data.totals.debit, data.totals.credit, sideText(closingNet)]]);
  }

  // Two different questions, two different figures. Dr / Cr is `net` (debit minus credit), the same for
  // everybody. But "you owe this amount" is the PARTY-SIGNED `closing`, which is positive exactly when a
  // customer owes us or we owe a vendor - a vendor's net is negative in that very case, so wording it off
  // the net tells a supplier we are owed money we in fact owe.
  const owed = Number(data?.closing) || 0;
  const closingNote = isAccount
    ? (closingNet > 0 ? "debit balance" : closingNet < 0 ? "credit balance" : "nil")
    : (owed > 0 ? `${TYPES[partyType].owes} this amount` : owed < 0 ? "in credit" : "settled");

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Statement of account" description="Every posting against one customer, vendor or ledger account, in date order, with a running balance."
        actions={data && (
          <>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" />Print</Button>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" aria-hidden="true" />Export CSV</Button>
          </>
        )} />

      <div className="mb-5 flex flex-wrap items-end gap-3 print:hidden">
        <Field label="Statement of" className="w-44">
          <Select value={partyType} onChange={(e) => setParams({ partyType: e.target.value }, { replace: true })}>
            <option value="Customer">Customer</option>
            <option value="Vendor">Vendor</option>
            {mayReadAnyAccount && <option value="Account">Ledger account</option>}
          </Select>
        </Field>
        <Field label={isAccount ? "Account" : partyType} className="min-w-64 flex-1 sm:max-w-sm">
          <SearchSelect
            value={subjectId} onChange={choose} disabled={parties.loading} loading={parties.loading}
            placeholder={parties.loading ? "Loading…" : isAccount ? "Search by account name or code…" : `Search for a ${TYPES[partyType].noun}…`}
            noOptionsText={`No ${TYPES[partyType].noun} matches`}
            options={options}
          />
        </Field>
        <Field label="From"><DateInput value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></Field>
        <Field label="To"><DateInput value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></Field>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground">
          <input type="checkbox" checked={byMonth} onChange={(e) => setByMonth(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
          Group by month
        </label>
      </div>
      {parties.error && <ErrorNote error={parties.error} />}

      {!subjectId && <Panel><EmptyState title={isAccount ? "Choose an account" : `Choose a ${TYPES[partyType].noun}`} text="Their statement appears here." /></Panel>}
      {subjectId && loading && !data && <Spinner label="Loading the statement" />}
      <ErrorNote error={error} onRetry={reload} />

      {data && (
        <>
          {data.source === "documents" && (
            <p role="note" className="mb-4 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground print:hidden">
              Ledger posting is switched off, so this statement is built from the approved invoices, returns, receipts and payments. Switch posting on under Accounts → Setup for it to match the Trial Balance.
            </p>
          )}
          {data.postingOff && (
            <p role="note" className="mb-4 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground print:hidden">
              Ledger posting is switched off, so nothing is posted to this account. Switch posting on under Accounts → Setup, or take a customer&rsquo;s or vendor&rsquo;s statement, which is built from the documents themselves.
            </p>
          )}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Opening balance" count={sideText(openingNet)} subText={range.from ? `before ${formatDateGB(range.from)}` : "start of records"} tone="neutral" />
            <StatCard title="Debits" count={formatNumber(data.totals.debit, 2)} tone="teal" />
            <StatCard title="Credits" count={formatNumber(data.totals.credit, 2)} tone="plum" />
            <StatCard title="Closing balance" count={sideText(closingNet)} subText={closingNote} tone={owed > 0 && !isAccount ? "warning" : "olive"} />
          </div>
          <Panel bodyClassName="p-0"
            title={`${chosen?.accountCode ? `${chosen.accountCode} · ` : ""}${subject} · ${data.rows.length} ${data.rows.length === 1 ? "entry" : "entries"}`}
            description={isAccount && chosen?.path ? chosen.path : undefined}>
            {data.rows.length === 0 && data.opening === 0 && <EmptyState title="No activity" text={isAccount ? "Nothing has been posted to this account in the period." : "No approved invoice, return, receipt or payment for this party in the period."} />}
            {(data.rows.length > 0 || data.opening !== 0) && (
              <div className="erp-scroll table-pin-first overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{`Statement of ${subject}`}</caption>
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-2 text-start">Date</th><th className="px-3 py-2 text-start">Document</th><th className="px-3 py-2 text-start">Type</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-5 py-2 text-end">Balance</th></tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border bg-secondary/30 font-medium"><td className="px-5 py-2" colSpan={5}>Opening balance</td><td className="px-5 py-2 text-end"><Balance net={openingNet} /></td></tr>
                    {grouped
                      ? months.map((m) => (
                          <React.Fragment key={m.key}>
                            <tr className="border-t border-border bg-secondary/40">
                              <th scope="colgroup" colSpan={6} className="px-5 py-1.5 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</th>
                            </tr>
                            {m.rows.map((r) => <Row key={r._id} row={r} net={net(r)} />)}
                            <tr className="border-t border-border/70 bg-secondary/20 text-xs">
                              <td className="px-5 py-1.5 text-muted-foreground" colSpan={3}>{m.label} total</td>
                              <td className="px-3 py-1.5 text-end tabular-nums text-muted-foreground">{formatNumber(m.debit, 2)}</td>
                              <td className="px-3 py-1.5 text-end tabular-nums text-muted-foreground">{formatNumber(m.credit, 2)}</td>
                              <td className="px-5 py-1.5 text-end font-medium"><Balance net={m.closingNet} /></td>
                            </tr>
                          </React.Fragment>
                        ))
                      : data.rows.map((r) => <Row key={r._id} row={r} net={net(r)} />)}
                    <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                      <td className="px-5 py-2.5" colSpan={3}>Closing balance</td>
                      <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(data.totals.debit, 2)}</td>
                      <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(data.totals.credit, 2)}</td>
                      <td className="px-5 py-2.5 text-end"><Balance net={closingNet} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

// The narration sits under the document number rather than in a column of its own: an account's postings
// are told apart by it ("Bank charges", "VAT on sales"), but a seventh column would push the figures -
// which are the point of a statement - off a phone, and a table that scrolls sideways hides them.
function Row({ row, net }) {
  return (
    <tr className="border-t border-border">
      <td className="whitespace-nowrap px-5 py-2 align-top">{formatDateGB(row.date)}</td>
      <td className="px-3 py-2 align-top">
        <span className="whitespace-nowrap font-mono text-xs">{row.voucherNo}</span>
        {row.narration && <span className="block max-w-[22rem] truncate text-xs text-muted-foreground" title={row.narration}>{row.narration}</span>}
      </td>
      <td className="px-3 py-2 align-top text-muted-foreground">{LABEL[row.voucherType] || row.voucherType}</td>
      <td className="px-3 py-2 text-end align-top tabular-nums">{row.debit ? formatNumber(row.debit, 2) : ""}</td>
      <td className="px-3 py-2 text-end align-top tabular-nums">{row.credit ? formatNumber(row.credit, 2) : ""}</td>
      <td className="px-5 py-2 text-end align-top font-medium"><Balance net={net} /></td>
    </tr>
  );
}
