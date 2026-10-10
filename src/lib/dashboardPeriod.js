import { addMonths, isDay, lastDayOf, monthName, monthOf, quarterEnd, quarterOf, quarterStart, weekStart } from "./calendarDays.js";

// The period the home dashboard is showing, worked out in the organisation's calendar.
//
// The server (services/reports/dashboardService.js, resolvePeriod) takes ?period=week|month|quarter, or ?month=YYYY-MM, or
// ?from=&to=. It has no notion of "a year" or "Q2 of 2025", so the screen sends those as from / to. A period always runs to
// today at the latest (a later end is pulled back to today by the server, a start after today is refused), and is compared
// with the stretch of the same length immediately before it.
//
// This module is the screen's half of that, pure so every boundary is tested without a clock: what a person picked
// (`selection`) -> what to ask the server for (`query`) and what to call it in words (`label`, `at`, `noun`, `before`).
// `today` is always the organisation's day as "YYYY-MM-DD" (utils/orgLocale.js), never read from here.

/** What the Period control offers, in the order it lists them. */
export const PERIOD_KINDS = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year (to date)" },
  { value: "quarterOf", label: "A specific quarter" },
  { value: "monthOf", label: "A specific month" },
  { value: "yearOf", label: "A previous year" },
  { value: "custom", label: "Custom range" },
];

export const QUARTERS = [1, 2, 3, 4];
export const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const pad = (n) => String(n).padStart(2, "0");
const yearOfDay = (ymd) => Number(String(ymd).slice(0, 4));

export const defaultSelection = () => ({ kind: "month" });

// ---------------------------------------------------------------- what the pickers may offer

/** Years to choose from, newest first. `includeCurrent` is for the quarter and month pickers; a "previous year" has none. */
export function yearChoices(today, { includeCurrent = true, back = 6 } = {}) {
  const now = yearOfDay(today);
  const out = [];
  for (let y = includeCurrent ? now : now - 1; y >= now - back; y -= 1) out.push(y);
  return out;
}

/** The quarters of a year that have started (never a future one). */
export function quarterChoices(year, today) {
  const now = yearOfDay(today);
  if (year > now) return [];
  return year < now ? [...QUARTERS] : QUARTERS.filter((q) => q <= quarterOf(today));
}

/** The months (1-12) of a year that have started. */
export function monthChoices(year, today) {
  const now = yearOfDay(today);
  if (year > now) return [];
  return year < now ? [...MONTH_NUMBERS] : MONTH_NUMBERS.filter((m) => m <= Number(today.slice(5, 7)));
}

/** A selection of `kind` with sensible values filled in: the last COMPLETE quarter / month / year, a custom range of this month. */
export function selectionFor(kind, today) {
  const year = yearOfDay(today);
  if (kind === "quarterOf") {
    const q = quarterOf(today);
    return q === 1 ? { kind, year: year - 1, quarter: 4 } : { kind, year, quarter: q - 1 };
  }
  if (kind === "monthOf") {
    const previous = addMonths(monthOf(today), -1);
    return { kind, year: Number(previous.slice(0, 4)), month: Number(previous.slice(5, 7)) };
  }
  if (kind === "yearOf") return { kind, year: year - 1 };
  if (kind === "custom") return { kind, from: `${monthOf(today)}-01`, to: today };
  return { kind };
}

/** Pull a quarter or month that has not started (after the year changed to this one) back to the latest that has. */
export function tidySelection(selection, today) {
  const s = { ...selection };
  if (s.kind === "quarterOf") {
    const ok = quarterChoices(s.year, today);
    if (ok.length && !ok.includes(s.quarter)) s.quarter = ok[ok.length - 1];
  }
  if (s.kind === "monthOf") {
    const ok = monthChoices(s.year, today);
    if (ok.length && !ok.includes(s.month)) s.month = ok[ok.length - 1];
  }
  return s;
}

// ---------------------------------------------------------------- the period itself

const refuse = (selection, code, error) => ({ ok: false, code, error, kind: selection.kind || "month", key: `invalid:${code}:${JSON.stringify(selection)}` });

/**
 * What a selection means on `today`.
 *
 * ok        false (with `code` and `error`) when the choice cannot be asked for: a period that has not started, an end before
 *           the start, a missing date. The screen keeps showing the last good period and says why.
 * query     the params for every /dashboard-summary call: { period } | { month } | { from, to }
 * from, to  the days the figures cover (the end is never after today)
 * current   the period runs to today, so a "last 8 months" series ends this month
 * capped    the end that was asked for is still to come; the figures stop today
 * label     "This month", "March 2026", "Q2 2026", "2025", "Custom range" ("(so far)" while it is still running)
 * noun      what to call it inside a sentence: "this month", "Q2 2026"        -> "Sales invoices of Q2 2026"
 * at        the same with its preposition: "this month", "in Q2 2026"          -> "Orders in Q2 2026"
 * before    what it is compared with: "month before" (calendar months) or "period before" (the same number of days)
 * key       stable string for effect dependencies
 */
export function describePeriod(selection = {}, today) {
  const kind = selection.kind || "month";
  const base = (o) => {
    const query = o.query;
    return {
      ok: true,
      kind,
      current: o.to === today,
      capped: Boolean(o.capped),
      ...o,
      query,
      key: `${kind}:${o.from}:${o.to}:${JSON.stringify(query)}`,
    };
  };

  switch (kind) {
    case "week":
      return base({ from: weekStart(today), to: today, query: { period: "week" }, label: "This week", noun: "this week", at: "this week", before: "week before" });
    case "month":
      return base({ from: `${monthOf(today)}-01`, to: today, query: { period: "month" }, label: "This month", noun: "this month", at: "this month", before: "month before" });
    case "quarter": {
      const year = yearOfDay(today);
      return base({ from: quarterStart(year, quarterOf(today)), to: today, query: { period: "quarter" }, label: "This quarter", noun: "this quarter", at: "this quarter", before: "quarter before" });
    }
    case "year":
      return base({ from: `${yearOfDay(today)}-01-01`, to: today, query: { from: `${yearOfDay(today)}-01-01`, to: today }, label: "This year (to date)", noun: "this year so far", at: "this year so far", before: "period before" });

    case "monthOf": {
      const year = Number(selection.year);
      const m = Number(selection.month);
      if (!Number.isInteger(year) || !Number.isInteger(m) || m < 1 || m > 12) return refuse(selection, "INVALID_PERIOD", "Choose a year and a month.");
      const month = `${year}-${pad(m)}`;
      if (month > monthOf(today)) return refuse(selection, "FUTURE_MONTH", "That month has not started yet.");
      const running = month === monthOf(today);
      const name = monthName(month);
      return base({
        from: `${month}-01`, to: running ? today : lastDayOf(month), query: { month }, capped: running && today !== lastDayOf(month), month,
        label: running ? `${name} (so far)` : name, noun: running ? `${name} so far` : name, at: running ? `in ${name} so far` : `in ${name}`, before: "month before",
      });
    }
    case "quarterOf": {
      const year = Number(selection.year);
      const q = Number(selection.quarter);
      if (!Number.isInteger(year) || !QUARTERS.includes(q)) return refuse(selection, "INVALID_PERIOD", "Choose a year and a quarter.");
      const from = quarterStart(year, q);
      if (from > today) return refuse(selection, "FUTURE_PERIOD", "That quarter has not started yet.");
      const end = quarterEnd(year, q);
      const running = end >= today;
      const name = `Q${q} ${year}`;
      return base({
        from, to: running ? today : end, query: { from, to: running ? today : end }, capped: running && end > today, quarter: q, year,
        label: running ? `${name} (so far)` : name, noun: running ? `${name} so far` : name, at: running ? `in ${name} so far` : `in ${name}`, before: "period before",
      });
    }
    case "yearOf": {
      const year = Number(selection.year);
      if (!Number.isInteger(year)) return refuse(selection, "INVALID_PERIOD", "Choose a year.");
      const from = `${year}-01-01`;
      if (from > today) return refuse(selection, "FUTURE_PERIOD", "That year has not started yet.");
      const end = `${year}-12-31`;
      const running = end >= today;
      return base({
        from, to: running ? today : end, query: { from, to: running ? today : end }, capped: running && end > today, year,
        label: running ? `${year} (so far)` : String(year), noun: running ? `${year} so far` : String(year), at: running ? `in ${year} so far` : `in ${year}`, before: "period before",
      });
    }
    case "custom": {
      const { from, to } = selection;
      if (!isDay(from) || !isDay(to)) return refuse(selection, "MISSING_DATES", "Choose both dates.");
      if (from > to) return refuse(selection, "INVALID_PERIOD", "The period ends before it starts.");
      if (from > today) return refuse(selection, "FUTURE_PERIOD", "That period has not started yet.");
      const end = to > today ? today : to;
      return base({
        from, to: end, query: { from, to: end }, capped: to > today,
        label: "Custom range", noun: "the selected period", at: "in the selected period", before: "period before",
      });
    }
    default:
      return refuse(selection, "INVALID_PERIOD", "Choose a period.");
  }
}

// ---------------------------------------------------------------- words for series and as-at figures

/**
 * A series that is `n` units long and ends on the period's last day. While the period runs to today it is "the last 8 months";
 * for a past period it is "the 8 months to March 2026", because the server ends every series on the period's end.
 * `formatDay` writes a day the way the person reads dates.
 */
export function trailing(scope, n, unit, formatDay = (d) => d) {
  if (!scope || scope.current) return `last ${n} ${unit}`;
  return unit === "months" ? `${n} months to ${monthName(scope.to)}` : `${n} ${unit} to ${formatDay(scope.to)}`;
}

/** "today" while the period runs to today, else the day it ends: for a position that is read as at the period's end. */
export const asAt = (scope, formatDay = (d) => d) => (!scope || scope.current ? "today" : formatDay(scope.to));
