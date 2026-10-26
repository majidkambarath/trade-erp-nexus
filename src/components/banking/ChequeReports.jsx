import React, { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { DataTable, DateInput, EmptyState, ErrorNote, Field, inputClass, Panel, Pill, Spinner, useAsync } from "../accounting/kit";
import { Note } from "../salesDocs/parts.jsx";
import { banking } from "../../lib/bankingApi";
import { DIRECTIONS, dueText, forecastCsv, forecastNotes, forecastRows, GROUPINGS, maturityCsv, PERIOD_CHOICES, periodLabel, STATUS_WORDS } from "../../lib/chequeReports";
import { CURRENCY, downloadCSV, formatDateGB, formatNumber, todayInput } from "../../utils/format";

// What falls due and when, and what it does to the bank. Both read the cheques still in the air (pending, on hold, at the
// bank). Money is kept in three places that are never added together: coming in, going out, and ON HOLD - which is shown
// beside the figures and not in them, because a held cheque will not be banked on its date.

const money = (n) => formatNumber(n, 2);
const Amount = ({ slot }) => (slot.count ? <>{money(slot.amount)}<span className="block text-xs font-normal text-muted-foreground">{slot.count} cheque{slot.count === 1 ? "" : "s"}</span></> : <span className="text-muted-foreground">-</span>);

export function DueDates() {
  const [asOn, setAsOn] = useState(todayInput());
  const [direction, setDirection] = useState("");
  const [groupBy, setGroupBy] = useState("bucket");
  const { data, loading, error, reload } = useAsync(() => banking.chequeMaturity({ asOn, direction: direction || undefined, groupBy }), [asOn, direction, groupBy]);
  const t = data?.totals;
  const exportCsv = () => { const { headers, rows } = maturityCsv(data); downloadCSV(`cheques-due-${asOn}.csv`, headers, rows); };
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Field label="As on" className="w-full sm:w-44"><DateInput value={asOn} onChange={(e) => e.target.value && setAsOn(e.target.value)} /></Field>
        <Field label="Cheques" className="w-full sm:w-52"><select className={inputClass} value={direction} onChange={(e) => setDirection(e.target.value)}>{DIRECTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Group by" className="w-full sm:w-44"><select className={inputClass} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>{GROUPINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Button variant="outline" className="sm:ms-auto" onClick={exportCsv} disabled={!data?.rows?.length}><Download className="h-4 w-4" aria-hidden="true" />Export CSV</Button>
      </div>
      {loading && !data && <Spinner label="Loading the cheques due" />}
      {error && <ErrorNote error={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Coming in" count={money(t.receivable.amount)} subText={`${t.receivable.count} cheque${t.receivable.count === 1 ? "" : "s"} we hold`} tone="teal" />
            <StatCard title="Going out" count={money(t.payable.amount)} subText={`${t.payable.count} cheque${t.payable.count === 1 ? "" : "s"} we issued`} tone="plum" />
            <StatCard title="On hold" count={money(t.onHold.amount)} subText="kept back, not counted on" tone="neutral" />
            <StatCard title="At the bank" count={money(data.atBank.amount)} subText={`${data.atBank.count} cheque${data.atBank.count === 1 ? "" : "s"}, not yet cleared`} tone="teal" />
          </div>
          {data.capped && <Note tone="warning">There are more cheques than this report reads at once, so the figures are partial.</Note>}
          {data.rows.length === 0 ? (
            <EmptyState title="No cheques in the air" text="Cheques appear here from the moment they are received or issued until they clear." />
          ) : (
            <>
              <Panel title={`By ${GROUPINGS.find(([v]) => v === groupBy)[1].toLowerCase()}`} bodyClassName="p-0">
                <DataTable
                  caption="Cheques due, grouped"
                  rows={data.groups}
                  rowKey={(g) => g.key}
                  columns={[
                    { key: "label", header: GROUPINGS.find(([v]) => v === groupBy)[1], card: "primary", className: "font-medium", cell: (g) => g.label },
                    { key: "in", header: "Coming in", money: true, align: "end", card: "meta", cell: (g) => <Amount slot={g.receivable} /> },
                    { key: "out", header: "Going out", money: true, align: "end", card: "meta", cell: (g) => <Amount slot={g.payable} /> },
                    { key: "hold", header: "On hold", money: true, align: "end", card: "meta", className: "text-muted-foreground", cell: (g) => <Amount slot={g.onHold} /> },
                    { key: "net", header: "Net", money: true, align: "end", card: "amount", className: "font-semibold tabular-nums", cell: (g) => money(g.net) },
                  ]}
                />
              </Panel>
              <Panel title="Every cheque, nearest first" bodyClassName="p-0">
                <DataTable
                  caption="Cheques in the air"
                  rows={data.rows}
                  rowKey={(r) => r._id}
                  columns={[
                    { key: "no", header: "Cheque", card: "primary", cell: (r) => <><span className="font-mono text-xs font-semibold">{r.chequeNo}</span><span className="block text-xs font-normal text-muted-foreground">{r.voucherNo}</span></> },
                    { key: "party", header: "Party", card: "title", className: "font-medium", cell: (r) => <>{r.partyName || "-"}<span className="block text-xs font-normal text-muted-foreground">{r.direction === "receipt" ? "We hold it" : "We issued it"}</span></> },
                    { key: "due", header: "Due", card: "meta", className: "whitespace-nowrap", cell: (r) => <>{formatDateGB(r.chequeDay)}<span className={`block text-xs font-normal ${r.days < 0 ? "text-status-danger" : "text-muted-foreground"}`}>{dueText(r.days)}</span></> },
                    { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={r.status === "hold" ? "neutral" : r.status === "deposited" ? "info" : "warning"}>{STATUS_WORDS[r.status] || r.status}</Pill> },
                    { key: "amount", header: "Amount", money: true, align: "end", card: "amount", className: "font-medium tabular-nums", cell: (r) => money(r.amount) },
                  ]}
                />
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function CashForecast() {
  const [asOn, setAsOn] = useState(todayInput());
  const [span, setSpan] = useState("week:12");
  const [unit, count] = span.split(":");
  const { data, loading, error, reload } = useAsync(() => banking.chequeForward({ asOn, unit, count: Number(count) }), [asOn, unit, count]);
  const rows = forecastRows(data);
  const exportCsv = () => { const { headers, rows: out } = forecastCsv(data); downloadCSV(`cheque-forecast-${asOn}.csv`, headers, out); };
  const quiet = data && rows.every((r) => !r.receipts && !r.payments && !r.onHold);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Field label="From" className="w-full sm:w-44"><DateInput value={asOn} onChange={(e) => e.target.value && setAsOn(e.target.value)} /></Field>
        <Field label="Look ahead" className="w-full sm:w-44">
          <select className={inputClass} value={span} onChange={(e) => setSpan(e.target.value)}>
            {PERIOD_CHOICES.map((c) => <option key={c.join(":")} value={c.join(":")}>{periodLabel(c)}</option>)}
          </select>
        </Field>
        <Button variant="outline" className="sm:ms-auto" onClick={exportCsv} disabled={!data}><Download className="h-4 w-4" aria-hidden="true" />Export CSV</Button>
      </div>
      {loading && !data && <Spinner label="Working out the forecast" />}
      {error && <ErrorNote error={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="In the bank now" count={data.openingKnown ? money(data.opening) : "-"} subText={data.openingKnown ? "all bank accounts" : "shown for the whole organisation only"} tone="teal" />
            <StatCard title="After cheques already due" count={data.openingKnown ? money(data.afterDue) : "-"} subText={`${money(data.due.net)} ${CURRENCY} net`} tone="plum" />
            <StatCard title="Money in" count={money(data.totals.receipts)} subText="cheques we hold" tone="neutral" />
            <StatCard title="Money out" count={money(data.totals.payments)} subText="cheques we issued" tone="neutral" />
          </div>
          <div className="space-y-2">{forecastNotes(data).map((n) => <Note key={n}>{n}</Note>)}</div>
          {quiet ? (
            <EmptyState title="No cheques fall due in this window" text="Nothing is waiting to clear, so the bank balance stays as it is." />
          ) : (
            <Panel title={`${unit === "week" ? "Week by week" : "Month by month"}, from ${formatDateGB(asOn)}`} bodyClassName="p-0">
              <DataTable
                caption="Cheque forecast"
                rows={rows}
                rowKey={(r) => r.key}
                columns={[
                  { key: "label", header: "Period", card: "primary", className: "font-medium whitespace-nowrap", cell: (r) => r.label },
                  { key: "in", header: "Money in", money: true, align: "end", card: "meta", cell: (r) => (r.receipts ? money(r.receipts) : "-") },
                  { key: "out", header: "Money out", money: true, align: "end", card: "meta", cell: (r) => (r.payments ? money(r.payments) : "-") },
                  { key: "hold", header: "On hold", money: true, align: "end", card: "meta", className: "text-muted-foreground", cell: (r) => (r.onHold ? money(r.onHold) : "-") },
                  { key: "net", header: "Net", money: true, align: "end", card: "meta", className: "tabular-nums", cell: (r) => money(r.net) },
                  { key: "closing", header: data.openingKnown ? "Bank balance after" : "Running net", money: true, align: "end", card: "amount", className: "font-semibold tabular-nums", cell: (r) => money(r.closing) },
                ]}
              />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
