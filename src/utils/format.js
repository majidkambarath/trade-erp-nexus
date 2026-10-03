// Shared formatting and decimal-safe helpers for PO/Invoice modules

import { getBrand } from '../config/brands';

// Number grouping, currency and timezone come from the active brand pack
// (src/config/brands.js), NEVER from the browser. nhfoods-ae uses en-GB, giving
// 1,234,567.50 in groups of three. A bare `value.toLocaleString()` with no locale
// argument uses the browser's locale, so a user whose machine is set to en-IN would
// see Indian lakh grouping (12,34,567.50) for the same invoice. Always format
// through this module. The brand is read once at load: it is a per-deployment
// setting, not a per-render one.
const brand = getBrand();
export const LOCALE = brand.locale;
export const CURRENCY_LOCALE = brand.currencyLocale;
export const CURRENCY = brand.currency;

// Format a number with fixed decimals using Intl for consistent grouping
export const formatNumber = (value, decimals = 2, locale = LOCALE) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};

// Currency formatter for AED; returns "AED 1,234,567.50"
export const formatCurrencyAED = (value, locale = CURRENCY_LOCALE) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

// Compact money for dashboard tiles: "AED 2.46M", "AED 195.0K".
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

// Simple date formatting to dd/mm/yyyy (GB)
export const formatDateGB = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
};

// The business operates in the UAE; every date the user sees or picks is Dubai-local.
export const TIMEZONE = brand.timezone;

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// YYYY-MM-DD in Asia/Dubai, for <input type="date"> values.
//
// Do NOT use `new Date().toISOString().split("T")[0]` for this: toISOString is UTC, so
// between 00:00 and 04:00 Dubai time it yields *yesterday* and silently backdates
// vouchers.
export const toInputDate = (dateInput = new Date()) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return ymdFormatter.format(d);
};

export const todayInput = () => toInputDate(new Date());

// YYYYMMDD, for document-number stamps.
export const stampYMD = (dateInput = new Date()) =>
  toInputDate(dateInput).replace(/-/g, '');

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

// Quote a cell when it contains a delimiter, quote or newline; double inner quotes.
// Without this, a vendor name containing a comma shifts every later column.
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /["',\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (headers, rows) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

// The BOM makes Excel read the file as UTF-8 — without it, non-ASCII party names
// (common here) are mangled on open.
export const downloadCSV = (filename, headers, rows) => {
  const blob = new Blob([`﻿${toCSV(headers, rows)}`], {
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
