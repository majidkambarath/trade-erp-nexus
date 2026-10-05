// Pure logic behind the currency screens and the foreign-currency part of the receipt / payment
// forms, kept out of the components so it can be tested without rendering.
//
// A rate is "base units per 1 foreign unit" (USD 1 = AED 3.6725), at most six decimals. The AED
// equivalent of a foreign amount is the exact product rounded half-up to the cent. It is computed
// on integers (BigInt), the same way the server does, so the figure on the form is the figure
// that gets posted.

import { CURRENCY, formatDate, formatNumber } from "../utils/format";

export const RATE_DECIMALS = 6;
export const RATE_SOURCES = [
  { value: "manual", label: "Entered by hand" },
  { value: "cbuae", label: "Central Bank of the UAE" },
  { value: "import", label: "Imported" },
];
export const sourceLabel = (source) => (source === "voucher" ? "Typed on the voucher" : RATE_SOURCES.find((s) => s.value === source)?.label || source || "");

// How many decimal places a number is written with (3.6725 -> 4).
export function decimalPlaces(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  const m = /^-?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(n));
  if (!m) return NaN;
  return Math.max(0, (m[2] || "").length - Number(m[3] || 0));
}

const scaled = (value, dp) => BigInt(Math.round(Number(value) * 10 ** dp));

// The AED value of a foreign amount, in whole cents. `decimals` are the foreign currency's own.
export function convertToBaseCents(foreignAmount, rate, decimals = 2) {
  const f = Number(foreignAmount);
  const r = Number(rate);
  if (!(f > 0) || !(r > 0)) return 0;
  const num = scaled(f, decimals) * scaled(r, RATE_DECIMALS) * 100n;
  const den = BigInt(10 ** decimals) * 10n ** BigInt(RATE_DECIMALS);
  return Number((2n * num + den) / (2n * den));
}

// The smallest foreign amount (in the currency's own decimals) whose AED value is at least
// `baseCents`: what to raise the amount to when invoices are allocated more than it covers.
export function foreignForBase(baseCents, rate, decimals = 2) {
  const r = Number(rate);
  if (!(r > 0) || !(baseCents > 0)) return 0;
  const minor = 10 ** decimals;
  let f = Math.ceil((baseCents / 100 / r) * minor);
  while (convertToBaseCents(f / minor, r, decimals) < baseCents) f += 1;
  while (f > 1 && convertToBaseCents((f - 1) / minor, r, decimals) >= baseCents) f -= 1;
  return f / minor;
}

// What may be typed into an amount box of a currency with `decimals` places: digits and at most
// that many decimals. Returns the cleaned text, or null when the keystroke should be ignored.
export function typedAmount(raw, decimals = 2) {
  const v = String(raw ?? "").replace(/,/g, "");
  const ok = decimals > 0 ? new RegExp(`^\\d*(\\.\\d{0,${decimals}})?$`).test(v) : /^\d*$/.test(v);
  return ok ? v : null;
}
export const typedRate = (raw) => typedAmount(raw, RATE_DECIMALS);

export const deviationPercent = (rate, masterRate) => (Number(masterRate) > 0 ? (Math.abs(Number(rate) - Number(masterRate)) / Number(masterRate)) * 100 : 0);
const round = (n, dp) => Math.round((n + Number.EPSILON) * 10 ** dp) / 10 ** dp;

// A typed rate against the rate on file: how far away it is and whether that needs a reason.
export function rateCheck({ rate, masterRate, tolerancePercent = 5, reason = "" }) {
  const r = Number(rate);
  if (!(r > 0) || !(Number(masterRate) > 0)) return { deviation: 0, differs: false, outside: false, reasonMissing: false };
  const deviation = deviationPercent(r, masterRate);
  const outside = deviation > Number(tolerancePercent) + 1e-9;
  return {
    deviation: round(deviation, 2),
    differs: r !== Number(masterRate),
    outside,
    reasonMissing: outside && String(reason).trim().length < 3,
  };
}

// ----------------------------------------------------------------------------- voucher forms

// Form state for the foreign-currency part of a voucher. currency "" is the base currency (AED).
export const emptyFx = () => ({ currency: "", foreignAmount: "", rate: "", reason: "" });

// The currencies a voucher can be made in: the base currency first, then every active one that has
// a rate. `list` is GET /currencies.
export function currencyOptions(list) {
  const rows = (Array.isArray(list) ? list : []).filter((c) => c && c.code && (c.isBase || (c.isActive && c.latestRate != null)));
  rows.sort((a, b) => Number(Boolean(b.isBase)) - Number(Boolean(a.isBase)) || a.code.localeCompare(b.code));
  return rows.map((c) => ({ value: c.code, label: c.code, hint: c.name, searchText: `${c.name || ""} ${c.symbol || ""}` }));
}
export const hasForeignOptions = (list) => (Array.isArray(list) ? list : []).some((c) => c && c.code && !c.isBase && c.isActive && c.latestRate != null);

// What is wrong with the foreign part of a voucher form. `master` is GET /currencies/rate for the
// voucher's currency and date, or null while it is loading or when there is none (`masterError` is why).
export function validateForeign({ fx, master, masterError, tolerancePercent = 5 }) {
  const e = {};
  if (!fx.currency) return e;
  if (!(Number(fx.foreignAmount) > 0)) e.foreignAmount = `Enter the amount in ${fx.currency}`;
  if (!master) e.exchangeRate = masterError || "The rate on file is still loading";
  else if (!(Number(fx.rate) > 0)) e.exchangeRate = "Enter the exchange rate";
  else {
    const c = rateCheck({ rate: fx.rate, masterRate: master?.rate, tolerancePercent: master?.tolerancePercent ?? tolerancePercent, reason: fx.reason });
    if (c.reasonMissing) e.rateOverrideReason = `This rate is ${c.deviation}% away from the rate on file. Say why it is used`;
  }
  return e;
}

// The fields the voucher API takes for a foreign amount. Nothing is added for the base currency.
export function fxPayload(fx, master, tolerancePercent = 5) {
  if (!fx.currency) return {};
  const body = { currency: fx.currency, foreignAmount: Number(fx.foreignAmount), exchangeRate: Number(fx.rate) };
  const c = rateCheck({ rate: fx.rate, masterRate: master?.rate, tolerancePercent: master?.tolerancePercent ?? tolerancePercent, reason: fx.reason });
  if (c.outside && String(fx.reason).trim()) body.rateOverrideReason = String(fx.reason).trim();
  return body;
}

// ---------------------------------------------------------------------------- showing amounts

export const isForeign = (v) => Boolean(v?.currency) && Number(v?.foreignAmount) > 0;

// Foreign amounts show two decimals, or as many as they carry (up to four): USD 1,000.00, KWD 10.500.
export const formatForeign = (amount, code) => `${code} ${formatNumber(amount, Math.min(Math.max(decimalPlaces(amount), 2), 4))}`;
// Rates show four decimals at least, six at most: 3.6725, 3.7000, 3.123456.
export const formatRate = (rate) => formatNumber(rate, Math.min(Math.max(decimalPlaces(rate), 4), RATE_DECIMALS));

// "USD 1,000.00 @ 3.6725 = AED 3,672.50"
export const fxLine = (v, base = CURRENCY) => (isForeign(v) ? `${formatForeign(v.foreignAmount, v.currency)} @ ${formatRate(v.exchangeRate)} = ${base} ${formatNumber(v.totalAmount, 2)}` : "");

// Where the rate came from, for a voucher's detail view: "Rate of 04/10/2026 (Central Bank of the UAE)",
// plus the reason when it was overridden.
export function fxProvenance(v) {
  if (!isForeign(v)) return "";
  const from = v.rateDate ? `Rate of ${formatDate(v.rateDate)}` : "Rate";
  const source = v.rateSource ? ` (${sourceLabel(v.rateSource)})` : "";
  const why = v.rateOverridden && v.rateOverrideReason ? `. Overrode the rate on file: ${v.rateOverrideReason}` : "";
  return `${from}${source}${why}`;
}

// ------------------------------------------------------------------------ the currencies page

// The state a currency row is in, with the pill that says so.
export function currencyState(c) {
  if (c.isBase) return { key: "base", label: "Base currency", tone: "info" };
  if (!c.isActive) return { key: "off", label: "Off", tone: "neutral" };
  if (c.latestRate == null) return { key: "norate", label: "No rate yet", tone: "warning" };
  return { key: "ready", label: "Ready", tone: "success" };
}

export function validateRateForm({ rate, effectiveDate }) {
  const e = {};
  const n = Number(rate);
  if (!String(rate).trim() || !(n > 0)) e.rate = "Enter a rate greater than zero";
  else if (decimalPlaces(n) > RATE_DECIMALS) e.rate = `At most ${RATE_DECIMALS} decimal places`;
  if (!effectiveDate) e.effectiveDate = "Choose the date the rate starts";
  return e;
}

export function validateCurrencyForm({ code, name, decimals }, existing = []) {
  const e = {};
  const c = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) e.code = "Three letters, for example JOD";
  else if (existing.some((x) => x.code === c)) e.code = `${c} is already in the list`;
  if (!String(name || "").trim()) e.name = "Enter the currency's name";
  const d = Number(decimals);
  if (!Number.isInteger(d) || d < 0 || d > 4) e.decimals = "From 0 to 4";
  return e;
}

export function validateTolerance(value) {
  const n = Number(value);
  if (String(value).trim() === "" || !Number.isFinite(n) || n < 0 || n > 100 || decimalPlaces(n) > 2) return "A percentage from 0 to 100, with at most two decimals";
  return "";
}

// ------------------------------------------------------------------------------ the register

export const REGISTER_TYPES = [
  { value: "", label: "Receipts and payments" },
  { value: "receipt", label: "Receipts" },
  { value: "payment", label: "Payments" },
];
export const typeLabel = (type) => (type === "receipt" ? "Receipt" : type === "payment" ? "Payment" : type || "");
export const statusLabel = (status) => ({ approved: "Posted", cancelled: "Cancelled", bounced: "Bounced" }[status] || status || "");

// The CSV for the register's rows: figures plain (no thousands separators) so a spreadsheet reads them.
export const REGISTER_CSV_HEADERS = ["Date", "Voucher", "Type", "Party", "Currency", "Foreign amount", "Rate", "AED amount", "Paid by", "Status"];
export function registerCsvRows(rows, describePayment = () => "") {
  return rows.map((r) => [
    formatDate(r.date), r.voucherNo, typeLabel(r.voucherType), r.partyName || "", r.currency,
    Number(r.foreignAmount).toFixed(Math.min(Math.max(decimalPlaces(r.foreignAmount), 2), 4)),
    Number(r.exchangeRate).toFixed(Math.min(Math.max(decimalPlaces(r.exchangeRate), 4), RATE_DECIMALS)),
    Number(r.totalAmount).toFixed(2), describePayment(r), statusLabel(r.status),
  ]);
}
