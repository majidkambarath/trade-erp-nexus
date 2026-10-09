import React from "react";
import { Button } from "../ui/button";
import { ErrorNote, Field, Spinner, TextInput, DateInput } from "../accounting/kit";
import { todayInput } from "../../utils/format";

// Small pieces the report screens share: the date range with its presets, and the loading / error frame.

const pad = (n) => String(n).padStart(2, "0");
export const monthStart = (today = todayInput()) => `${today.slice(0, 7)}-01`;
export const yearStart = (today = todayInput()) => `${today.slice(0, 4)}-01-01`;
export function lastMonth(today = todayInput()) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const days = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(days)}` };
}

export const quarterStart = (today = todayInput()) => {
  const y = today.slice(0, 4);
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
  return `${y}-${pad(q * 3 + 1)}-01`;
};
// The calendar quarter before the one `today` falls in (VAT is filed quarterly or monthly).
export function lastQuarter(today = todayInput()) {
  const y = Number(today.slice(0, 4));
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
  const py = q === 0 ? y - 1 : y;
  const pq = q === 0 ? 3 : q - 1;
  const lastMonthOfQuarter = pq * 3 + 3;
  const days = new Date(Date.UTC(py, lastMonthOfQuarter, 0)).getUTCDate();
  return { from: `${py}-${pad(pq * 3 + 1)}-01`, to: `${py}-${pad(lastMonthOfQuarter)}-${pad(days)}` };
}

export const PRESETS = [
  { id: "month", label: "This month", range: (t) => ({ from: monthStart(t), to: t }) },
  { id: "last", label: "Last month", range: (t) => lastMonth(t) },
  { id: "year", label: "This year", range: (t) => ({ from: yearStart(t), to: t }) },
];

// From / To (or a single "As at" date) with one-click presets. `value` is { from, to }.
export function DateRange({ value, onChange, asAt = false, presets = PRESETS }) {
  const set = (key) => (e) => e.target.value && onChange({ ...value, [key]: e.target.value });
  return (
    // The dates share one row on a phone and the presets scroll under them, rather than
    // each 176px field claiming its own line.
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex gap-3">
        {!asAt && <Field label="From" className="min-w-0 flex-1 sm:flex-none"><DateInput value={value.from} max={value.to} onChange={set("from")} className="sm:w-44" /></Field>}
        <Field label={asAt ? "As at" : "To"} className="min-w-0 flex-1 sm:flex-none"><DateInput value={value.to} min={asAt ? undefined : value.from} onChange={set("to")} className="sm:w-44" /></Field>
      </div>
      {!asAt && (
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Quick ranges">
          {presets.map((p) => <Button key={p.id} type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onChange(p.range(todayInput()))}>{p.label}</Button>)}
        </div>
      )}
    </div>
  );
}

// A closed year's closing entry moves its income and expense to Retained Earnings. A report of that year leaves it out,
// so the year still shows the profit it earned; this shows the books as they stand after it.
export function ClosingEntriesToggle({ checked, onChange }) {
  return (
    <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
      Include year-end closing entries
    </label>
  );
}

// Loading, error and data states for a useAsync result.
export function Frame({ state, label = "Working out the figures", children }) {
  if (state.loading && !state.data) return <Spinner label={label} />;
  if (state.error) return <ErrorNote error={state.error} onRetry={state.reload} />;
  return state.data ? children(state.data) : null;
}
