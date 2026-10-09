import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "../ui/button";
import { DataTable, DateInput, EmptyState, ErrorNote, Field, Panel, Pill, Spinner, useAsync } from "./kit";
import { currencies } from "../../lib/currencyApi";
import { REGISTER_TYPES, formatForeign, formatRate, registerCsvHeaders, registerCsvRows, typeLabel } from "../../lib/currencyForms";
import { describePayment, modeLabel } from "../../lib/voucherForms";
import { CURRENCY, downloadCSV, formatDate, formatNumber, todayInput } from "../../utils/format";

// Receipts from customers and payments to vendors made in a foreign currency, with the rate each
// was made at and what it came to in the base currency. Totals are per currency and
// direction: money received and money paid are never added together.

const STATUS = { approved: ["success", "Posted"], cancelled: ["neutral", "Cancelled"], bounced: ["danger", "Bounced"] };
const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

export default function CurrencyRegister() {
  const [filters, setFilters] = useState(() => ({ from: `${todayInput().slice(0, 4)}-01-01`, to: todayInput(), currency: "", type: "" }));
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const list = useAsync(() => currencies.list().catch(() => []), []);
  const reg = useAsync(
    () => currencies.register({ from: filters.from || undefined, to: filters.to || undefined, currency: filters.currency || undefined, type: filters.type || undefined }),
    [filters.from, filters.to, filters.currency, filters.type]
  );
  const foreign = useMemo(() => (list.data || []).filter((c) => c.code && !c.isBase), [list.data]);
  const rows = reg.data?.rows || [];
  const totals = reg.data?.totals || [];
  const base = (list.data || []).find((c) => c.isBase)?.code || CURRENCY;

  function exportCsv() {
    downloadCSV(`currency-register-${filters.from || "start"}-${filters.to || "latest"}.csv`, registerCsvHeaders(base), registerCsvRows(rows, describePayment));
  }

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Currency register</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Receipts and payments made in a foreign currency, with the rate each was made at and its value in {base}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" asChild><Link to="/currencies">Currencies and rates</Link></Button>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}><Download className="h-4 w-4" aria-hidden="true" />Export CSV</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <Field label="From" className="w-40"><DateInput value={filters.from} onChange={(e) => set({ from: e.target.value })} /></Field>
        <Field label="To" className="w-40"><DateInput value={filters.to} onChange={(e) => set({ to: e.target.value })} /></Field>
        <Field label="Currency" className="w-40">
          <select className={selectClass} value={filters.currency} onChange={(e) => set({ currency: e.target.value })}>
            <option value="">All currencies</option>
            {foreign.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </Field>
        <Field label="Type" className="w-52">
          <select className={selectClass} value={filters.type} onChange={(e) => set({ type: e.target.value })}>
            {REGISTER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>

      {reg.loading && !reg.data && <Spinner label="Loading the register" />}
      {reg.error && <ErrorNote error={reg.error} onRetry={reg.reload} />}

      {reg.data && (
        <div className="space-y-5">
          {totals.length > 0 && (
            <Panel bodyClassName="p-0" title="Totals" description={`Posted vouchers only. The average rate is the ${base} value divided by the foreign amount.`}>
              <div className="erp-scroll table-pin-first relative overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Totals by currency and direction</caption>
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-5 py-2 text-start">Currency</th>
                      <th scope="col" className="px-3 py-2 text-start">Direction</th>
                      <th scope="col" className="px-3 py-2 text-end">Vouchers</th>
                      <th scope="col" className="px-3 py-2 text-end">Foreign amount</th>
                      <th scope="col" className="px-3 py-2 text-end">{base} amount</th>
                      <th scope="col" className="px-5 py-2 text-end">Average rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((t) => (
                      <tr key={`${t.currency}-${t.type}`} className="border-t border-border">
                        <td className="px-5 py-2.5 font-mono text-xs font-semibold">{t.currency}</td>
                        <td className="px-3 py-2.5">{t.type === "receipt" ? "Received" : "Paid"}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{t.count}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{formatForeign(t.foreign, t.currency)}</td>
                        <td className="px-3 py-2.5 text-end font-medium tabular-nums">{formatNumber(t.aed, 2)}</td>
                        <td className="px-5 py-2.5 text-end tabular-nums">{t.averageRate == null ? "" : formatRate(t.averageRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <Panel bodyClassName="p-0" title="Vouchers">
            {rows.length === 0 && <EmptyState title="No foreign-currency vouchers" text="Nothing was received or paid in a foreign currency in this period." />}
            {rows.length > 0 && (
              <div className="erp-scroll table-pin-first relative overflow-x-auto">
                <DataTable
                  caption="Foreign-currency receipts and payments"
                  rows={rows}
                  rowKey={(r) => r._id}
                  columns={[
                    { key: "voucher", header: "Voucher", card: "primary", cell: (r) => <><span className="font-mono text-xs font-semibold">{r.voucherNo}</span><span className="block text-xs font-normal text-muted-foreground">{typeLabel(r.voucherType)}</span></> },
                    { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap", cell: (r) => formatDate(r.date) },
                    { key: "party", header: "Party", card: "title", className: "font-medium", cell: (r) => r.partyName },
                    { key: "foreign", header: "Foreign amount", align: "end", card: "amount", className: "whitespace-nowrap tabular-nums", cell: (r) => formatForeign(r.foreignAmount, r.currency) },
                    { key: "rate", header: "Rate", align: "end", cell: (r) => <span className="tabular-nums">{formatRate(r.exchangeRate)}{r.rateOverridden && <abbr title={r.rateOverrideReason || "Rate overridden"} className="ms-1 text-[11px] font-semibold uppercase text-status-warning no-underline">Override</abbr>}</span> },
                    { key: "base", header: `${base} amount`, align: "end", card: "amount", className: "font-medium tabular-nums", cell: (r) => formatNumber(r.totalAmount, 2) },
                    { key: "mode", header: "Paid by", card: "meta", className: "max-w-xs", cell: (r) => <><span className="font-medium">{modeLabel(r.paymentMode)}</span><span className="block truncate text-xs text-muted-foreground md:inline md:ms-1">{describePayment(r)}</span></> },
                    { key: "status", header: "Status", card: "badge", cell: (r) => { const [tone, label] = STATUS[r.status] || ["neutral", r.status || ""]; return <Pill tone={tone}>{label}</Pill>; } },
                  ]}
                />
              </div>
            )}
            {reg.data.truncated && <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">Only the first {formatNumber(rows.length, 0)} vouchers are shown. Narrow the dates to see the rest.</p>}
          </Panel>
        </div>
      )}
    </div>
  );
}
