// Pure helpers for the printed order and invoice. No React here, so the rules that decide what
// appears on the paper (VAT rates, the breakdown, empty fields) are tested without rendering.

import { amountInWords, decimalAdd, decimalRound } from "../../../utils/format";
import { orgCurrency } from "../../../utils/orgLocale";

const num = (v) => parseFloat(v) || 0;

// The brand accent as hex. The printed sheet and the PDF renderer need plain hex, so the CSS
// variable is read at print time. Anything that is not hex falls back to a neutral ink.
export const readAccent = () => {
  if (typeof document === "undefined") return "#1f2937";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#1f2937";
};

// A light tint of the accent for table headers. `share` is how much accent is kept (0-1).
export const tint = (hex, share = 0.12) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c * share + 255 * (1 - share));
  const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0"));
  return `#${parts.join("")}`;
};

// One printed row per saved line. `rate` holds the line value (quantity x unit price, before VAT)
// and `vatAmount` the VAT on it: the same contract the server prices with (utils/pricing.js).
export const invoiceLines = (items = []) =>
  items.map((it, i) => {
    const qty = num(it.qty);
    const value = num(it.rate);
    const vat = num(it.vatAmount);
    return {
      no: i + 1,
      code: it.itemCode || "",
      description: it.description || "",
      qty,
      unitPrice: qty ? value / qty : 0,
      value,
      // A line with no rate stored is standard-rated (5%) on the old documents; a stored 0 stays 0.
      vatPercent: num(it.vatPercent ?? 5),
      vat,
      total: decimalAdd(value, vat),
    };
  });

// The VAT return breakdown: taxable value and VAT for each rate used on the document, highest first.
export const vatBreakdown = (lines) => {
  const byRate = new Map();
  for (const line of lines) {
    const row = byRate.get(line.vatPercent) || { rate: line.vatPercent, taxable: 0, vat: 0 };
    row.taxable = decimalAdd(row.taxable, line.value);
    row.vat = decimalAdd(row.vat, line.vat);
    byRate.set(line.vatPercent, row);
  }
  return [...byRate.values()].sort((a, b) => b.rate - a.rate);
};

// Charges carry VAT of their own, which the lines do not include. Adding the difference as a row
// keeps the breakdown equal to the document's VAT total, so the printed figures always add up.
export const withChargesVat = (rows, totalVat) => {
  const lineVat = rows.reduce((sum, r) => decimalAdd(sum, r.vat), 0);
  const diff = decimalRound(num(totalVat) - lineVat);
  return Math.abs(diff) > 0.004 ? [...rows, { rate: null, label: "Charges", taxable: 0, vat: diff }] : rows;
};

// Only the rows that have a value. An empty label-value pair is noise on a printed page.
export const rowsWithValue = (rows) =>
  rows.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

// The company block from the Settings profile. Nothing is filled in as a placeholder.
export const companyBlock = (p = {}) => ({
  nameEn: p.companyName || "",
  nameAr: p.companyNameArabic || "",
  address: [p.addressLine1, p.addressLine2].filter(Boolean),
  contact: [
    p.phoneNumber && `Tel: ${p.phoneNumber}`,
    p.email && `Email: ${p.email}`,
    p.website && `Web: ${p.website}`,
  ].filter(Boolean),
  trn: p.vatNumber || "",
  logo: p.logo || null,
});

// Bank rows for the invoice footer. Empty rows are dropped, so an unset account is not printed.
export const bankRows = (p = {}) =>
  rowsWithValue([
    ["Bank", p.bankName],
    ["Account name", p.accountName],
    ["Account no.", p.accountNumber],
    ["IBAN", p.ibanNumber],
    ["SWIFT", p.swiftCode],
    ["Branch", p.branch],
  ]);

// Main and fractional units for the amount in words, looked up by currency code. A currency with no
// entry keeps its code as the main unit (and "Cents" as the fraction), so nothing crashes or goes blank.
const SUBUNITS = {
  AED: ["Dirhams", "Fils"],
  USD: ["Dollars", "Cents"],
  EUR: ["Euros", "Cents"],
  GBP: ["Pounds", "Pence"],
  INR: ["Rupees", "Paise"],
  SAR: ["Riyals", "Halalas"],
  QAR: ["Riyals", "Dirhams"],
};
// The default currency is the organisation's own, read when the function is called (not at import).
export const totalInWords = (total, currency = orgCurrency()) => {
  const [main, sub] = SUBUNITS[currency] || [currency, "Cents"];
  return amountInWords(total, main, sub);
};
