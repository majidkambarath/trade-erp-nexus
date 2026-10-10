import { addDays, addMonths, daysBetween, isDay, lastDayOf, monthName, monthOf, quarterEnd, quarterOf, quarterStart, weekStart } from "./calendarDays.js";

// The period a list of documents is showing, in the organisation's calendar days.
//
// Every list of trade documents and vouchers opens on THIS CALENDAR MONTH (1st to last day, not "the last 30 days"), says in
// words what it is showing, and is widened by the person: last month, the quarter, the year, a range of their own, or all
// time. This module is the pure half of that, so each boundary is tested without a clock: a choice + `today` -> the days it
// covers and what to call it. The server's own filters (transactions: dateFilter=CUSTOM&startDate&endDate, vouchers, quotations
// and delivery notes: dateFrom / dateTo) are fed from `from` / `to`; `inPeriod` is the exact test applied in the browser.
//
// `today` is the organisation's day as "YYYY-MM-DD" (utils/orgLocale.js), never read from the clock here.

/** What the Period control offers, in the order it lists them. */
export const LIST_PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range" },
  { value: "all", label: "All time" },
];

export const DEFAULT_LIST_PERIOD = "month";

const yearOfDay = (ymd) => Number(String(ymd).slice(0, 4));

/**
 * What a choice means on `today`.
 *
 *   ok        false (with `error`) for a custom range that ends before it starts: the list keeps the period it had
 *   from, to  the first and last day, inclusive; "" is open (a custom range with one date, or all time)
 *   all       no date limit at all
 *   label     "This month", "Custom range", "All time"
 *   name      what the days are called: "October 2026", "Q4 2026", "2026", "Today", "" when it has no short name
 *   key       stable string for effect dependencies
 */
export function resolveListPeriod({ preset = DEFAULT_LIST_PERIOD, from = "", to = "" } = {}, today) {
  const made = (o) => ({ ok: true, preset, all: !o.from && !o.to, name: "", ...o, key: `${preset}|${o.from}|${o.to}` });
  switch (preset) {
    case "today":
      return made({ from: today, to: today, label: "Today", name: "Today" });
    case "week": {
      const start = weekStart(today);
      return made({ from: start, to: addDays(start, 6), label: "This week", name: "This week" });
    }
    case "month": {
      const m = monthOf(today);
      return made({ from: `${m}-01`, to: lastDayOf(m), label: "This month", name: monthName(m) });
    }
    case "lastMonth": {
      const m = addMonths(monthOf(today), -1);
      return made({ from: `${m}-01`, to: lastDayOf(m), label: "Last month", name: monthName(m) });
    }
    case "quarter": {
      const y = yearOfDay(today);
      const q = quarterOf(today);
      return made({ from: quarterStart(y, q), to: quarterEnd(y, q), label: "This quarter", name: `Q${q} ${y}` });
    }
    case "year": {
      const y = yearOfDay(today);
      return made({ from: `${y}-01-01`, to: `${y}-12-31`, label: "This year", name: String(y) });
    }
    case "custom": {
      const f = isDay(from) ? from : "";
      const t = isDay(to) ? to : "";
      if (f && t && f > t) return { ok: false, preset, error: "The end date is before the start date.", key: `${preset}|invalid` };
      return made({ from: f, to: t, label: "Custom range" });
    }
    case "all":
    default:
      return made({ preset: "all", from: "", to: "", label: "All time", key: "all||" });
  }
}

/** Is a calendar day inside the period? A row with no date is inside only when the period has no limit. */
export function inPeriod(day, period) {
  if (!period || period.all) return true;
  if (!day) return false;
  if (period.from && day < period.from) return false;
  if (period.to && day > period.to) return false;
  return true;
}

/**
 * The stretch a period is naturally compared with: the month before a month, the quarter before a quarter, the same number of
 * days before a custom range. null for all time or a range with an open end. `name` words it for a sentence.
 */
export function previousPeriod(period, today) {
  if (!period?.ok || period.all) return null;
  const mk = (from, to, name) => ({ from, to, name });
  switch (period.preset) {
    case "today":
      return mk(addDays(today, -1), addDays(today, -1), "yesterday");
    case "week":
      return mk(addDays(period.from, -7), addDays(period.from, -1), "last week");
    case "month":
    case "lastMonth": {
      const m = addMonths(period.from.slice(0, 7), -1);
      return mk(`${m}-01`, lastDayOf(m), monthName(m));
    }
    case "quarter": {
      const y = yearOfDay(period.from);
      const q = quarterOf(period.from);
      const [py, pq] = q === 1 ? [y - 1, 4] : [y, q - 1];
      return mk(quarterStart(py, pq), quarterEnd(py, pq), `Q${pq} ${py}`);
    }
    case "year": {
      const y = yearOfDay(period.from) - 1;
      return mk(`${y}-01-01`, `${y}-12-31`, String(y));
    }
    case "custom": {
      if (!period.from || !period.to) return null;
      const length = daysBetween(period.from, period.to) + 1;
      const to = addDays(period.from, -1);
      return mk(addDays(to, -(length - 1)), to, `the ${length} ${length === 1 ? "day" : "days"} before`);
    }
    default:
      return null;
  }
}

/** The choices worth offering as a one-tap way to widen an empty or narrow list, other than the period it is on. */
export function widerChoices(period) {
  const all = ["lastMonth", "quarter", "year", "all"];
  return all.filter((p) => p !== period?.preset);
}

/**
 * What a "total" card says against the period before: the words and the change. Nothing is invented when there is nothing to
 * compare with (all time, an open range, a count the server could not give), and a previous period of none has no percentage.
 */
export function compareCount(count, previousCount, previousName) {
  if (!previousName || previousCount === null || previousCount === undefined) return { subText: null, trend: null };
  if (!previousCount) return { subText: `None in ${previousName}`, trend: null };
  const pct = ((count - previousCount) / previousCount) * 100;
  return { subText: `Against ${previousName} (${previousCount})`, trend: `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%` };
}
