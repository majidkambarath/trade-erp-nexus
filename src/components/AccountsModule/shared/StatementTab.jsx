import React, { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { cn } from "../../../lib/utils";
import { downloadCSV, formatDate, formatNumber } from "../../../utils/format";
import { Button } from "../../ui/button";
import { Balance, EmptyState, ErrorNote, Field, Panel, Select, Spinner, TextInput, DateInput } from "../../accounting/kit";
import { Skeleton } from "./partyAccountParts";
import { PRESETS, activePreset, netOf, presetRange, sideText, slug, sumRows, typeOptions, voucherLabel } from "./partyAccountUtils";

const COLUMNS = 7;

/**
 * The ledger statement for one party: opening balance, every entry with its running balance,
 * closing balance. The period is asked of the server; the voucher type is filtered here, so the
 * running balance on each row stays the true balance after that entry.
 */
export default function StatementTab({ k, name, statement, range, onRange }) {
  const [chosen, setChosen] = useState("all");
  const { data, loading, error, reload } = statement;

  const options = useMemo(() => typeOptions(data?.rows), [data]);
  // a type that the new period no longer has falls back to all of them
  const type = options.some((o) => o.value === chosen) ? chosen : "all";
  const shown = useMemo(() => (data?.rows || []).filter((r) => type === "all" || r.voucherType === type), [data, type]);
  const filtered = type !== "all";
  const shownTotals = useMemo(() => sumRows(shown), [shown]);
  const totals = filtered ? shownTotals : data?.totals || shownTotals;
  const preset = activePreset(range);
  const net = (n) => netOf(k.kind, n);

  const period = range.from || range.to ? `${range.from ? formatDate(range.from) : "the start"} to ${range.to ? formatDate(range.to) : "today"}` : "All dates";
  const count = `${shown.length} ${shown.length === 1 ? "entry" : "entries"}`;

  function exportCsv() {
    const rows = [
      [range.from ? formatDate(range.from) : "", "Opening balance", "", "", "", "", sideText(net(data.opening))],
      ...shown.map((r) => [formatDate(r.date), r.voucherNo, voucherLabel(r.voucherType), r.narration || "", r.debit || "", r.credit || "", sideText(net(r.balance))]),
      [range.to ? formatDate(range.to) : "", "Closing balance", "", "", totals.debit, totals.credit, sideText(net(data.closing))],
    ];
    downloadCSV(`statement-${slug(name)}-${range.from || "start"}-${range.to || "latest"}.csv`, ["Date", "Voucher no", "Type", "Narration", "Debit", "Credit", "Balance"], rows);
  }

  const hasActivity = data && (data.rows.length > 0 || data.opening !== 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Field label="From">
          <DateInput value={range.from} max={range.to || undefined} onChange={(e) => onRange({ ...range, from: e.target.value })} className="w-44" />
        </Field>
        <Field label="To">
          <DateInput value={range.to} min={range.from || undefined} onChange={(e) => onRange({ ...range, to: e.target.value })} className="w-44" />
        </Field>
        <div role="group" aria-label="Period" className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button key={p.id} type="button" variant="outline" aria-pressed={preset === p.id} className={cn(preset === p.id && "border-ring bg-accent")} onClick={() => onRange(presetRange(p.id))}>
              {p.label}
            </Button>
          ))}
        </div>
        <Field label="Type" className="w-full sm:w-52">
          <Select value={type} onChange={(e) => setChosen(e.target.value)} disabled={!options.length}>
            <option value="all">All types</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>

      {data?.source === "documents" && (
        <p role="note" className="rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground">
          Ledger posting is switched off, so this statement is built from the approved invoices, returns, receipts and payments. Switch posting on under Accounts, Setup, for it to match the Trial Balance.
        </p>
      )}

      <Panel
        bodyClassName="p-0"
        title={data ? `Statement, ${count}` : "Statement"}
        description={data ? period : undefined}
        actions={
          data && (
            <div className="flex items-center gap-2 print:hidden">
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />Export CSV</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" aria-hidden="true" />Print</Button>
            </div>
          )
        }
      >
        {loading && !data && (
          <div className="space-y-2 p-5" aria-busy="true">
            <Spinner label="Loading the statement" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}

        {data && !hasActivity && <EmptyState title="No transactions in this period" text={`No approved invoice, return, receipt or payment for this ${k.noun} in the period. Try a wider date range.`} />}

        {data && hasActivity && shown.length === 0 && filtered && (
          <EmptyState title={`No ${voucherLabel(type).toLowerCase()} entries in this period`} text="Choose All types to see every entry again." />
        )}

        {data && hasActivity && !(shown.length === 0 && filtered) && (
          <div className={cn("erp-scroll table-pin-first overflow-x-auto", loading && "opacity-60")} aria-busy={loading || undefined}>
            <table className="w-full text-sm">
              <caption className="sr-only">Statement of account for {name}</caption>
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2 text-start font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Voucher no</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Type</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Narration</th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">Debit</th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">Credit</th>
                  <th scope="col" className="px-5 py-2 text-end font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border bg-secondary/30 font-medium">
                  <td className="px-5 py-2" colSpan={COLUMNS - 1}>Opening balance</td>
                  <td className="px-5 py-2 text-end"><Balance net={net(data.opening)} /></td>
                </tr>
                {data.rows.length === 0 && (
                  <tr className="border-t border-border"><td className="px-5 py-4 text-center text-muted-foreground" colSpan={COLUMNS}>No transactions in this period</td></tr>
                )}
                {shown.map((r, i) => (
                  <tr key={r._id || `${r.voucherNo}-${i}`} className="border-t border-border hover:bg-accent/40">
                    <td className="whitespace-nowrap px-5 py-2">{formatDate(r.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.voucherNo}</td>
                    <td className="whitespace-nowrap px-3 py-2">{voucherLabel(r.voucherType)}</td>
                    <td className="min-w-[12rem] px-3 py-2 text-muted-foreground">{r.narration}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{r.debit ? formatNumber(r.debit, 2) : ""}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{r.credit ? formatNumber(r.credit, 2) : ""}</td>
                    <td className="px-5 py-2 text-end font-medium"><Balance net={net(r.balance)} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {filtered && (
                  <tr className="border-t-2 border-border bg-secondary/30">
                    <th scope="row" colSpan={COLUMNS - 3} className="px-5 py-2 text-start font-medium">Total of the {count} shown</th>
                    <td className="px-3 py-2 text-end tabular-nums">{formatNumber(totals.debit, 2)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatNumber(totals.credit, 2)}</td>
                    <td />
                  </tr>
                )}
                <tr className={cn("bg-secondary/60 font-semibold", !filtered && "border-t-2 border-border")}>
                  <th scope="row" colSpan={COLUMNS - 3} className="px-5 py-2.5 text-start font-semibold">Closing balance</th>
                  <td className="px-3 py-2.5 text-end tabular-nums">{filtered ? "" : formatNumber(totals.debit, 2)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{filtered ? "" : formatNumber(totals.credit, 2)}</td>
                  <td className="px-5 py-2.5 text-end"><Balance net={net(data.closing)} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
