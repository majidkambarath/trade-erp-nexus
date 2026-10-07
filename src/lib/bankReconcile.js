// The rules of the bank reconciliation screens that are not drawing: which tabs and posting kinds there
// are, how a person's choice of columns becomes the mapping the server reads, how a card settlement's
// difference is split, and how a statement's gross amount splits into net and VAT. No React, so they are
// tested without rendering.

import { formatNumber } from "../utils/format";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const cents = (n) => Math.round((Number(n) || 0) * 100);

export const LINE_TABS = [["todo", "To do"], ["suggested", "Suggested"], ["matched", "Matched"], ["ignored", "Ignored"], ["all", "All"]];

// Plain words for how sure the engine is; never colour alone.
export const CONFIDENCE = {
  high: { label: "Strong match", tone: "success" },
  medium: { label: "Possible match", tone: "info" },
};

export const MATCH_KIND = { match: "Matched to the books", created: "Entry posted for this line", card: "Card settlement", offset: "Cancel each other out" };

export const isIn = (amount) => Number(amount) > 0;

// +1,050.00 / -21.00: the sign is the direction, from the bank account's side.
export const signedAmount = (amount) => `${amount > 0 ? "+" : amount < 0 ? "-" : ""}${formatNumber(Math.abs(amount), 2)}`;

// What a person can do about a statement line the books do not know: depends on which way the money went.
export function postingKinds(amount) {
  if (isIn(amount)) {
    return [
      { value: "receipt", label: "Customer receipt", help: "A customer paid by transfer and it was not booked" },
      { value: "interest", label: "Interest received", help: "Credit interest from the bank (no VAT)" },
      { value: "transfer", label: "From another account", help: "Money moved in from one of your own accounts" },
      { value: "journal", label: "Something else", help: "Post it to an account you choose" },
    ];
  }
  return [
    { value: "fee", label: "Bank charge", help: "A fee the bank took, with its VAT" },
    { value: "payment", label: "Vendor payment", help: "You paid a vendor by transfer and it was not booked" },
    { value: "transfer", label: "To another account", help: "Money moved out to one of your own accounts" },
    { value: "journal", label: "Something else", help: "Post it to an account you choose" },
  ];
}

// ---------------------------------------------------------------- columns of a statement file
export function colLetter(i) {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// "A · Date", "C · Debit": every column of the sheet, named by its header, or by its first value when it has none.
export function columnOptions(rows, headerRow) {
  const hr = Number.isInteger(headerRow) ? headerRow : -1;
  const header = hr >= 0 ? rows[hr] || [] : [];
  const sample = rows[hr + 1] || [];
  const width = Math.max(0, ...rows.slice(0, 60).map((r) => r.length));
  return Array.from({ length: width }, (_, i) => {
    const head = String(header[i] ?? "").trim();
    const first = String(sample[i] ?? "").slice(0, 24).trim();
    // the header names a column; a value from the first row next to it makes it recognisable
    const named = head ? (first ? `${head} (${first})` : head) : first || "(empty)";
    return { value: String(i), label: `${colLetter(i)} · ${named}` };
  });
}

export const AMOUNT_MODES = [
  ["split", "Separate Debit and Credit columns"],
  ["signed", "One Amount column (money out has a minus sign)"],
  ["drcr", "An Amount column and a Dr/Cr column"],
];
export const DATE_ORDERS = [["DMY", "Day first (31/12/2026)"], ["MDY", "Month first (12/31/2026)"]];

const num = (v) => (v === "" || v === null || v === undefined ? undefined : Number(v));
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// What the person chose on screen (every value a string, "" for not chosen) to the mapping the server reads.
export function mappingFromForm(f) {
  const description = (f.description || []).map(Number).filter(Number.isFinite);
  const columns = strip({
    date: num(f.date), valueDate: num(f.valueDate),
    description: description.length === 0 ? undefined : description.length === 1 ? description[0] : description,
    reference: num(f.reference), cheque: num(f.cheque), balance: num(f.balance),
  });
  const amount = f.amountMode === "split"
    ? strip({ mode: "split", debit: num(f.debit), credit: num(f.credit) })
    : f.amountMode === "drcr"
      ? strip({ mode: "drcr", column: num(f.amount), flag: num(f.flag), invert: Boolean(f.invert) })
      : strip({ mode: "signed", column: num(f.amount), invert: Boolean(f.invert) });
  return { headerRow: Number.isInteger(Number(f.headerRow)) ? Number(f.headerRow) : -1, dateFormat: f.dateFormat || "DMY", columns, amount };
}

const str = (v) => (v === undefined || v === null ? "" : String(v));
export function formFromMapping(m = {}) {
  const c = m.columns || {};
  const a = m.amount || {};
  return {
    headerRow: str(m.headerRow ?? -1), dateFormat: m.dateFormat || "DMY",
    date: str(c.date), valueDate: str(c.valueDate), description: (Array.isArray(c.description) ? c.description : c.description === undefined ? [] : [c.description]).map(String),
    reference: str(c.reference), cheque: str(c.cheque), balance: str(c.balance),
    amountMode: a.mode || "signed", debit: str(a.debit), credit: str(a.credit), amount: str(a.column), flag: str(a.flag), invert: Boolean(a.invert),
  };
}

// Enough chosen to read the file: a date, and where the money is.
export function mappingReady(f) {
  if (f.date === "") return false;
  if (f.amountMode === "split") return f.debit !== "" || f.credit !== "";
  if (f.amountMode === "drcr") return f.amount !== "" && f.flag !== "";
  return f.amount !== "";
}

// ------------------------------------------------------------------------- card settlement
// The acquirer paid less than the books expected: the difference is the VAT it took on its commission,
// and any commission beyond what was booked at the sale. The VAT on the commission already booked is the
// first thing to explain; what is left over is extra commission. The person can change either figure.
export function splitDifference({ difference, feeBooked = 0, vatRate = 5 }) {
  const diff = round2(difference);
  if (diff <= 0) return { extraCommission: 0, vat: 0 };
  const vat = Math.min(diff, round2((Number(feeBooked) * Number(vatRate)) / 100));
  return { extraCommission: round2(diff - vat), vat };
}

// What is still unexplained, in fils; zero is what the server needs.
export const unexplained = (difference, extraCommission, vat) => (cents(difference) - cents(extraCommission) - cents(vat)) / 100;

// Could this payment be what these sales are worth less commission and VAT? Mirrors the server
// (CardSettlementService.limits), which is the one that refuses; this says so before the button.
//   the bank kept more than booked: at most 10% of the sales' net (never less than AED 5.00)
//   the bank paid more than booked: at most the commission that was booked (50 fils of rounding)
export function settlementCheck({ expected, fees, received }) {
  const e = cents(expected);
  const diff = e - cents(received);
  const maxKept = Math.max(500, Math.round(e * 0.1));
  const maxReturned = Math.max(50, cents(fees));
  if (diff > maxKept) {
    return { ok: false, code: "too-large", text: `The bank paid ${((diff) / 100).toFixed(2)} less than these sales are worth. That is more than commission and VAT could be (at most ${(maxKept / 100).toFixed(2)}). Check you ticked the right sales; refunds and chargebacks taken off a payment are posted as a journal first.` };
  }
  if (-diff > maxReturned) {
    return { ok: false, code: "exceeds", text: `The bank paid ${((-diff) / 100).toFixed(2)} more than these sales are worth after commission. Tick the other sales this payment covers.` };
  }
  return { ok: true, text: "" };
}

// A bank fee: the statement fixes the gross, so net and VAT are worked back from it and add up exactly.
// Mirrors the server (utils/bankStatement.js splitGross), which is the one that posts; this is the preview.
export function splitGross(gross, ratePercent) {
  const g = cents(gross);
  const rate = Number(ratePercent) || 0;
  if (!rate) return { net: round2(gross), vat: 0, exact: true };
  const guess = Math.round(g / (1 + rate / 100));
  for (const n of [guess, guess - 1, guess + 1, guess - 2, guess + 2]) {
    if (n + Math.round((n * rate) / 100) === g) return { net: n / 100, vat: (g - n) / 100, exact: true };
  }
  return { net: guess / 100, vat: (g - guess) / 100, exact: false };
}

// ------------------------------------------------------------------------------ the proof
// The lines of a bank reconciliation statement, in the order an accountant reads it.
export function proofRows(p) {
  if (!p) return [];
  return [
    { key: "statement", label: "Balance per bank statement", amount: p.statementBalance, strong: true },
    { key: "transit", label: "Add: receipts in the books the bank has not credited yet", amount: p.depositsInTransit?.total || 0, items: p.depositsInTransit?.items || [] },
    { key: "outstanding", label: "Less: payments in the books the bank has not paid yet", amount: p.outstandingPayments?.total || 0, items: p.outstandingPayments?.items || [] },
    { key: "adjustedBank", label: "Adjusted bank balance", amount: p.adjustedBank, strong: true, rule: true },
    { key: "books", label: "Balance per books", amount: p.bookBalance, strong: true },
    { key: "bankItems", label: "Add or less: bank items not in the books yet", amount: p.bankItemsNotInBooks?.total || 0, items: p.bankItemsNotInBooks?.items || [] },
    { key: "ignored", label: "Add or less: bank lines deliberately left out", amount: p.ignored?.total || 0, items: p.ignored?.items || [] },
    { key: "adjustedBook", label: "Adjusted book balance", amount: p.adjustedBook, strong: true, rule: true },
    { key: "difference", label: "Difference", amount: p.difference, strong: true },
  ];
}

// "3 lines left to deal with", "Everything is matched": the one sentence above the Finish button.
export function readiness(p) {
  if (!p) return { ready: false, text: "Enter the statement date and balance" };
  if (p.canFinish) return { ready: true, text: "The two sides agree. This can be finished." };
  return { ready: false, text: p.blockers?.[0]?.message || "Not ready yet" };
}
