// Pure helpers for the printed order and invoice. No React here, so the rules that decide what
// appears on the paper (VAT rates, the breakdown, empty fields) are tested without rendering.

import { amountInWords, decimalAdd, decimalRound, lineValueOf } from "../../../utils/format";
import { orgCurrency } from "../../../utils/orgLocale";
import { isReverseCharge } from "../../../lib/reverseCharge";

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
// A line saved without an item code was given the item's database id as its code (24 hex characters): nobody can read that
// off a sheet, so the item's own code or SKU is shown instead when the line knows it.
const looksLikeId = (v) => /^[a-f0-9]{24}$/i.test(String(v || ""));
export const readableCode = (it) => {
  const own = it.itemCode;
  if (own && !looksLikeId(own)) return own;
  const alt = [it.stockDetails?.itemId, it.stockDetails?.sku, it.sku].find((v) => v && !looksLikeId(v));
  return alt || (looksLikeId(own) ? "" : own || "");
};

export const invoiceLines = (items = []) =>
  items.map((it, i) => {
    const qty = num(it.qty);
    const value = lineValueOf(it);
    const vat = num(it.vatAmount);
    return {
      no: i + 1,
      code: readableCode(it),
      description: it.description || "",
      qty,
      unitPrice: qty ? value / qty : 0,
      value,
      // A line with no rate stored is standard-rated (5%) on the old documents; a stored 0 stays 0.
      vatPercent: num(it.vatPercent ?? 5),
      vat,
      total: decimalAdd(value, vat),
      // Reverse charge: no VAT is charged on the line, so the sheet marks it "RC" instead of a rate. A line saved before the VAT stopped
      // being charged did charge it (its VAT is not 0) and prints as an ordinary line. Read from the line's kind and VAT, which the
      // customer's online copy also carries (the amount assessed is not part of what the customer is sent).
      // (the two keys exist only on such a line, so every other printed row is exactly what it was)
      ...(isReverseCharge(it) && vat === 0 ? { reverseCharge: true, rcmVat: num(it.rcmVat) } : {}),
    };
  });

// The VAT return breakdown: taxable value and VAT for each rate used on the document, highest first.
export const vatBreakdown = (lines) => {
  const byRate = new Map();
  let reverse = null; // reverse-charge lines are not at a rate: they are one row of their own, with no VAT
  for (const line of lines) {
    if (line.reverseCharge) {
      reverse = reverse || { rate: null, label: "Reverse charge", taxable: 0, vat: 0 };
      reverse.taxable = decimalAdd(reverse.taxable, line.value);
      continue;
    }
    const row = byRate.get(line.vatPercent) || { rate: line.vatPercent, taxable: 0, vat: 0 };
    row.taxable = decimalAdd(row.taxable, line.value);
    row.vat = decimalAdd(row.vat, line.vat);
    byRate.set(line.vatPercent, row);
  }
  const rows = [...byRate.values()].sort((a, b) => b.rate - a.rate);
  return reverse ? [...rows, reverse] : rows;
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

// The whole of an address, in the order it is read aloud, with the blanks dropped - and a repeat
// dropped with them. A Dubai company has city "Dubai" and emirate "Dubai", and a letterhead that
// says "Dubai, Dubai, United Arab Emirates" reads like a fault; the comparison ignores case and
// surrounding space, so "dubai " and "Dubai" are the one place.
//
// This is what puts the seller's city and country on the paper. They were stored
// (CompanySettings.profile) and served (GET /company/profile) all along, and simply dropped in
// transit - while `utils/eInvoice.js` REQUIRED_INVOICE has always demanded both of an e-invoice.
export const addressLines = (p = {}) => {
  const seen = new Set();
  return [p.addressLine1, p.addressLine2, p.city, p.state, p.country].filter((part) => {
    const text = String(part ?? "").trim();
    if (!text) return false;
    const key = text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Where a party is, for the line under their address. Only a customer has this: it is
// `Customer.eInvoice.city` / `.countryCode` (customerModel.js), the very two fields the e-invoice
// validator reads. A vendor record has no structured locality at all, so a purchase document prints
// the free-text address it always did and this stays empty.
//
// The CITY is what makes the line worth printing. `countryCode` carries a schema default of "AE", so
// every customer has one whether anybody filled it in or not - printing the country on its own would
// put a bare "AE" under every customer on every invoice, which is noise dressed as information.
export const localityOf = (party = {}) => {
  const city = String(party?.eInvoice?.city ?? "").trim();
  if (!city) return "";
  const country = String(party?.eInvoice?.countryCode ?? "").trim();
  return country ? `${city}, ${country}` : city;
};

// The company block from the Settings profile. Nothing is filled in as a placeholder.
export const companyBlock = (p = {}) => ({
  nameEn: p.companyName || "",
  nameAr: p.companyNameArabic || "",
  address: addressLines(p),
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
