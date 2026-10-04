import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import axiosInstance from "../../axios/axios";
import { accounting } from "../../lib/accountingApi";
import { downloadCSV, drCr, formatDateGB, formatNumber } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Balance, EmptyState, ErrorNote, Field, PageHeader, Panel, Select, SearchSelect, Spinner, TextInput, useAsync } from "../accounting/kit";

const TYPES = { Customer: { path: "/customers/customers", name: "customerName", owes: "owes you" }, Vendor: { path: "/vendors/vendors", name: "vendorName", owes: "you owe" } };
const LABEL = { sales_order: "Sales invoice", sales_return: "Sales return", purchase_order: "Purchase invoice", purchase_return: "Purchase return", receipt: "Receipt", payment: "Payment", journal: "Journal", contra: "Contra", expense: "Expense", opening: "Opening balance" };

// A customer's or vendor's statement of account. With ledger posting on it is read from the ledger,
// so it agrees with the Trial Balance; with posting off the server builds it from the approved
// invoices, returns, receipts and payments (`source: "documents"`) so it is never empty for a party
// that has activity. The running balance is computed on the server: opening + movement = closing.
export default function StatementOfAccount() {
  const [params, setParams] = useSearchParams();
  const partyType = TYPES[params.get("partyType")] ? params.get("partyType") : "Customer";
  const partyId = params.get("partyId") || "";
  const [range, setRange] = useState({ from: params.get("from") || "", to: params.get("to") || "" });
  const [parties, setParties] = useState({ loading: true, rows: [], error: null });

  const update = (patch) => setParams({ partyType, ...(partyId ? { partyId } : {}), ...patch }, { replace: true });

  useEffect(() => {
    let live = true;
    setParties({ loading: true, rows: [], error: null });
    axiosInstance.get(TYPES[partyType].path)
      .then((res) => live && setParties({ loading: false, rows: res.data?.data || [], error: null }))
      .catch((error) => live && setParties({ loading: false, rows: [], error }));
    return () => { live = false; };
  }, [partyType]);

  const { data, loading, error, reload } = useAsync(
    () => (partyId ? accounting.statement({ partyId, partyType, from: range.from || undefined, to: range.to || undefined }) : Promise.resolve(null)),
    [partyId, partyType, range.from, range.to]
  );
  const options = useMemo(() => [...parties.rows].sort((a, b) => String(a[TYPES[partyType].name]).localeCompare(String(b[TYPES[partyType].name]))), [parties.rows, partyType]);

  // the server's running balance is positive when the party owes us (customer) or we owe them (vendor)
  const asNet = (n) => (partyType === "Vendor" ? -n : n);
  const sideText = (n) => { const { text, side } = drCr(asNet(n)); return side ? `${text} ${side}` : text; };

  function exportCsv() {
    const rows = [["", "Opening balance", "", "", "", sideText(data.opening)], ...data.rows.map((r) => [formatDateGB(r.date), r.voucherNo, LABEL[r.voucherType] || r.voucherType, r.debit || "", r.credit || "", sideText(r.balance)]), ["", "Closing balance", "", data.totals.debit, data.totals.credit, sideText(data.closing)]];
    downloadCSV(`statement-${data.party.name}.csv`, ["Date", "Document", "Type", "Debit", "Credit", "Balance"], rows);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader title="Statement of account" description="Every invoice, return, receipt and payment for one party, with a running balance."
        actions={data && (
          <>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" />Print</Button>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" aria-hidden="true" />Export CSV</Button>
          </>
        )} />

      <div className="mb-5 flex flex-wrap items-end gap-3 print:hidden">
        <Field label="Party type" className="w-40">
          <Select value={partyType} onChange={(e) => setParams({ partyType: e.target.value }, { replace: true })}><option value="Customer">Customer</option><option value="Vendor">Vendor</option></Select>
        </Field>
        <Field label={partyType} className="min-w-64 flex-1 sm:max-w-sm">
          <SearchSelect
            value={partyId} onChange={(v) => update({ partyId: v })} disabled={parties.loading} loading={parties.loading}
            placeholder={parties.loading ? "Loading…" : `Search for a ${partyType.toLowerCase()}…`} noOptionsText={`No ${partyType.toLowerCase()} matches`}
            options={options.map((p) => ({ value: p._id, label: p[TYPES[partyType].name], hint: p[partyType === "Vendor" ? "vendorId" : "customerId"] }))}
          />
        </Field>
        <Field label="From"><TextInput type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></Field>
        <Field label="To"><TextInput type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></Field>
      </div>
      {parties.error && <ErrorNote error={parties.error} />}

      {!partyId && <Panel><EmptyState title={`Choose a ${partyType.toLowerCase()}`} text="Their statement appears here." /></Panel>}
      {partyId && loading && !data && <Spinner label="Loading the statement" />}
      <ErrorNote error={error} onRetry={reload} />

      {data && (
        <>
          {data.source === "documents" && (
            <p role="note" className="mb-4 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground print:hidden">
              Ledger posting is switched off, so this statement is built from the approved invoices, returns, receipts and payments. Switch posting on under Accounts → Setup for it to match the Trial Balance.
            </p>
          )}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Opening balance" count={sideText(data.opening)} subText={range.from ? `before ${formatDateGB(range.from)}` : "start of records"} tone="neutral" />
            <StatCard title="Debits" count={formatNumber(data.totals.debit, 2)} tone="teal" />
            <StatCard title="Credits" count={formatNumber(data.totals.credit, 2)} tone="plum" />
            <StatCard title="Closing balance" count={sideText(data.closing)} subText={data.closing > 0 ? `${TYPES[partyType].owes} this amount` : data.closing < 0 ? "in credit" : "settled"} tone={data.closing > 0 ? "warning" : "olive"} />
          </div>
          <Panel bodyClassName="p-0" title={`${data.party.name} · ${data.rows.length} ${data.rows.length === 1 ? "entry" : "entries"}`}>
            {data.rows.length === 0 && data.opening === 0 && <EmptyState title="No activity" text="No approved invoice, return, receipt or payment for this party in the period." />}
            {(data.rows.length > 0 || data.opening !== 0) && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-2 text-start">Date</th><th className="px-3 py-2 text-start">Document</th><th className="px-3 py-2 text-start">Type</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-5 py-2 text-end">Balance</th></tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border bg-secondary/30 font-medium"><td className="px-5 py-2" colSpan={5}>Opening balance</td><td className="px-5 py-2 text-end"><Balance net={asNet(data.opening)} /></td></tr>
                    {data.rows.map((r) => (
                      <tr key={r._id} className="border-t border-border">
                        <td className="whitespace-nowrap px-5 py-2">{formatDateGB(r.date)}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.voucherNo}</td>
                        <td className="px-3 py-2 text-muted-foreground">{LABEL[r.voucherType] || r.voucherType}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{r.debit ? formatNumber(r.debit, 2) : ""}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{r.credit ? formatNumber(r.credit, 2) : ""}</td>
                        <td className="px-5 py-2 text-end font-medium"><Balance net={asNet(r.balance)} /></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                      <td className="px-5 py-2.5" colSpan={3}>Closing balance</td>
                      <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(data.totals.debit, 2)}</td>
                      <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(data.totals.credit, 2)}</td>
                      <td className="px-5 py-2.5 text-end"><Balance net={asNet(data.closing)} /></td>
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
