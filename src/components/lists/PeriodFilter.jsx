import React from "react";
import { DateInput, Field, inputClass } from "../accounting/kit";
import { cn } from "@/lib/utils";
import { LIST_PERIODS, widerChoices } from "@/lib/listPeriod";
import { formatDate } from "@/utils/format";

// The period control every list of documents shares, and the line that says what it is showing.
//
//   <PeriodSelect filter={...} />   the choice (and, for a custom range, the two dates). Renders as plain children of the
//                                   toolbar it is put in (`contents`), so it takes part in that toolbar's own grid or row.
//   <PeriodNote filter={...} />     "This month · 01/10/2026 – 31/10/2026 · 34 orders", the way to widen it, and why a range
//                                   was not applied.
//
// `filter` is what usePeriodFilter returns.

const SELECT_BARE =
  "px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent";

/**
 * @param labelled  draw a visible label above each control (the finance and quotation toolbars do); the order pages' toolbars
 *                  have none, so their controls carry an aria-label instead
 */
export function PeriodSelect({ filter, labelled = false, className, selectClassName }) {
  const options = LIST_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>);
  const custom = filter.preset === "custom";
  return (
    <div className="contents">
      {labelled ? (
        <Field label="Period" className={cn("w-full sm:w-44", className)}>
          <select className={inputClass} value={filter.preset} onChange={(e) => filter.choose(e.target.value)}>{options}</select>
        </Field>
      ) : (
        <select aria-label="Period" value={filter.preset} onChange={(e) => filter.choose(e.target.value)} className={cn(SELECT_BARE, selectClassName)}>
          {options}
        </select>
      )}
      {custom && (
        <>
          {labelled ? (
            <>
              <Field label="From" className="min-w-0 flex-1 sm:w-40 sm:flex-none"><DateInput value={filter.from} onChange={(e) => filter.setFrom(e.target.value)} /></Field>
              <Field label="To" className="min-w-0 flex-1 sm:w-40 sm:flex-none"><DateInput value={filter.to} onChange={(e) => filter.setTo(e.target.value)} /></Field>
            </>
          ) : (
            <>
              <DateInput aria-label="From" value={filter.from} onChange={(e) => filter.setFrom(e.target.value)} className="min-w-0" />
              <DateInput aria-label="To" value={filter.to} onChange={(e) => filter.setTo(e.target.value)} className="min-w-0" />
            </>
          )}
        </>
      )}
    </div>
  );
}

const rangeText = (period) => {
  if (period.all) return "all dates";
  if (period.from && period.to) return period.from === period.to ? formatDate(period.from) : `${formatDate(period.from)} – ${formatDate(period.to)}`;
  return period.from ? `from ${formatDate(period.from)}` : `up to ${formatDate(period.to)}`;
};

/**
 * @param count    how many documents the period holds (before status / customer / search), or null while unknown
 * @param noun     "orders", "vouchers" ...
 * @param extra    more words for the line, e.g. "Not invoiced: all dates"
 * @param limited  true while the list holds only the newest documents of a longer one (the safety cap was hit)
 */
export function PeriodNote({ filter, count = null, noun = "documents", one, extra, limited = false, className }) {
  const { period } = filter;
  const singular = one || (noun.endsWith("s") ? noun.slice(0, -1) : noun);
  const widen = widerChoices(period);
  const label = (v) => LIST_PERIODS.find((p) => p.value === v)?.label || v;
  return (
    <div className={cn("text-sm text-muted-foreground", className)}>
      <p>
        <span className="font-semibold text-foreground">{period.label}</span>
        {" · "}
        {rangeText(period)}
        {count !== null && <>{" · "}{count} {count === 1 ? singular : noun}</>}
        {extra && <>{" · "}{extra}</>}
      </p>
      {limited && <p className="mt-0.5 text-status-warning">Only the newest documents of this period are loaded. Narrow the period to see the rest.</p>}
      {filter.problem && <p role="alert" className="mt-0.5 font-medium text-status-danger">{filter.problem} Still showing {period.label}.</p>}
      {!period.all && (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 print:hidden">
          <span>Widen to</span>
          {widen.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => filter.choose(v)}
              className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-2 hover:opacity-80 lg:min-h-0"
            >
              {label(v).toLowerCase()}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
