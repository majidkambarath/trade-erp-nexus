// Calendar-day arithmetic on "YYYY-MM-DD" strings, with no clock and no time zone in it.
//
// Every screen that filters by period works in the ORGANISATION's calendar days (utils/orgLocale.js says which day it is
// today); these helpers only add, compare and name days, so a test can pin every boundary without freezing time. They are
// plain functions of their arguments and import nothing, so any module (and Node itself) can load them.

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;
const pad = (n) => String(n).padStart(2, "0");

const toUtc = (ymd) => {
  const m = DAY.exec(String(ymd ?? ""));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
};
const fromUtc = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** Is this a real calendar day written YYYY-MM-DD? ("2026-02-30" is not.) */
export function isDay(value) {
  const ms = toUtc(value);
  return Number.isFinite(ms) && fromUtc(ms) === value;
}

/** Add whole days (negative to go back). */
export const addDays = (ymd, n) => fromUtc(toUtc(ymd) + n * 86400000);

/** Whole days from `a` to `b` (b - a). */
export const daysBetween = (a, b) => Math.round((toUtc(b) - toUtc(a)) / 86400000);

/** "YYYY-MM" of a day. */
export const monthOf = (ymd) => String(ymd).slice(0, 7);

/** Shift a "YYYY-MM" by whole months. */
export function addMonths(month, delta) {
  const m = MONTH.exec(String(month));
  const t = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

/** First day of a "YYYY-MM". */
export const firstDayOf = (month) => `${month}-01`;

/** Last day of a "YYYY-MM". */
export function lastDayOf(month) {
  const m = MONTH.exec(String(month));
  return `${month}-${pad(new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate())}`;
}

/** Quarter (1-4) of a day or of a "YYYY-MM". */
export const quarterOf = (ymdOrMonth) => Math.floor((Number(String(ymdOrMonth).slice(5, 7)) - 1) / 3) + 1;

/** First and last day of a quarter of a year. */
export const quarterStart = (year, q) => `${year}-${pad((q - 1) * 3 + 1)}-01`;
export const quarterEnd = (year, q) => lastDayOf(`${year}-${pad(q * 3)}`);

/** Monday of the week a day falls in. */
export const weekStart = (ymd) => addDays(ymd, -((new Date(toUtc(ymd)).getUTCDay() + 6) % 7));

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "October 2026" for a "YYYY-MM" (or a day). */
export function monthName(month, { year = true, short = false } = {}) {
  const m = MONTH.exec(String(month).slice(0, 7));
  if (!m) return "";
  const name = MONTH_NAMES[Number(m[2]) - 1];
  const text = short ? name.slice(0, 3) : name;
  return year ? `${text} ${m[1]}` : text;
}
