import React from "react";
import { CalendarRange } from "lucide-react";
import { DateInput, Field, Select } from "../accounting/kit";
import { formatDate } from "@/utils/format";
import { monthName } from "@/lib/calendarDays";
import { PERIOD_KINDS, monthChoices, quarterChoices, selectionFor, tidySelection, yearChoices } from "@/lib/dashboardPeriod";

// The period every part of the dashboard follows (src/lib/dashboardPeriod.js says what each choice means). It sits above the
// four tabs, so it is on screen whichever tab is open and on a phone, and one line under it says in words which days the
// figures cover and what they are compared with - the server's own answer, not a guess.
//
//   selection   what the person picked          scope     the period in force (the last choice that could be asked for)
//   problem     why the latest pick was not applied, or null
//   compare     the server's `period` ({ previousFrom, previousTo }) once a part has loaded
export default function PeriodPicker({ selection, onChange, today, scope, problem, compare }) {
  const { kind } = selection;
  const set = (patch) => onChange(tidySelection({ ...selection, ...patch }, today));
  const range = scope.from === scope.to ? formatDate(scope.from) : `${formatDate(scope.from)} – ${formatDate(scope.to)}`;
  const comparison =
    compare?.previousFrom && compare?.previousTo
      ? compare.previousFrom === compare.previousTo
        ? formatDate(compare.previousFrom)
        : `${formatDate(compare.previousFrom)} – ${formatDate(compare.previousTo)}`
      : null;

  return (
    <section aria-label="Dashboard period" data-anim="hero" className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Period" className="w-full sm:w-60">
          <Select value={kind} onChange={(e) => onChange(selectionFor(e.target.value, today))}>
            {PERIOD_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </Select>
        </Field>

        {(kind === "quarterOf" || kind === "monthOf" || kind === "yearOf") && (
          <Field label="Year" className="min-w-0 flex-1 sm:w-32 sm:flex-none">
            <Select value={selection.year} onChange={(e) => set({ year: Number(e.target.value) })}>
              {yearChoices(today, { includeCurrent: kind !== "yearOf" }).map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </Field>
        )}
        {kind === "quarterOf" && (
          <Field label="Quarter" className="min-w-0 flex-1 sm:w-44 sm:flex-none">
            <Select value={selection.quarter} onChange={(e) => set({ quarter: Number(e.target.value) })}>
              {quarterChoices(selection.year, today).map((q) => <option key={q} value={q}>{`Q${q} (${["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"][q - 1]})`}</option>)}
            </Select>
          </Field>
        )}
        {kind === "monthOf" && (
          <Field label="Month" className="min-w-0 flex-1 sm:w-44 sm:flex-none">
            <Select value={selection.month} onChange={(e) => set({ month: Number(e.target.value) })}>
              {monthChoices(selection.year, today).map((m) => <option key={m} value={m}>{monthName(`2000-${String(m).padStart(2, "0")}`, { year: false })}</option>)}
            </Select>
          </Field>
        )}
        {kind === "custom" && (
          <>
            <Field label="From" className="min-w-0 flex-1 sm:w-44 sm:flex-none">
              <DateInput value={selection.from || ""} max={today} onChange={(e) => onChange({ ...selection, from: e.target.value })} />
            </Field>
            <Field label="To" className="min-w-0 flex-1 sm:w-44 sm:flex-none">
              <DateInput value={selection.to || ""} max={today} onChange={(e) => onChange({ ...selection, to: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Showing <span className="font-semibold text-foreground">{scope.label}</span>
          {" · "}
          {range}
        </span>
        {comparison && <span>{"·"} compared with {comparison}</span>}
      </p>
      {scope.capped && (
        <p className="mt-1 text-xs text-muted-foreground">
          The period has not ended yet, so the figures stop today ({formatDate(today)}).
        </p>
      )}
      {problem && (
        <p role="alert" className="mt-2 text-sm font-medium text-status-danger">
          {problem} Still showing {scope.label}.
        </p>
      )}
    </section>
  );
}
