// Pure logic behind the Opening balances screen (the go-live set-up), kept out of the components so
// it can be tested without rendering. Money is handled in whole cents, so 0.1 + 0.2 never shows as
// 0.30000000000000004. The server checks everything again; this saves the round trip and shows the
// person what the post will do before they press it.
import { fromCents, toCents } from "./voucherForms";
import { formatNumber } from "../utils/format";

// 1,234.50 as the app shows money, and the calendar day ("YYYY-MM-DD") of a date the server sends.
export const fmt = (n) => formatNumber(n ?? 0, 2);
export const day = (v) => (v ? String(v).slice(0, 10) : "");

const text = (v) => String(v ?? "").trim();
const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");

// ------------------------------------------------------------------------- 1. account balances

export const emptyAccountRow = () => ({ accountId: "", debit: "", credit: "" });
const usedAccount = (r) => r.accountId || toCents(r.debit) || toCents(r.credit);

// Debits, credits and the balancing line to Opening Balance Equity (whichever side is short), in cents.
export function accountTotals(rows) {
  const used = rows.filter(usedAccount);
  const debit = used.reduce((t, r) => t + toCents(r.debit), 0);
  const credit = used.reduce((t, r) => t + toCents(r.credit), 0);
  const diff = debit - credit;
  return {
    count: used.length, debit, credit, diff,
    equity: { amount: Math.abs(diff), side: diff > 0 ? "credit" : diff < 0 ? "debit" : null },
  };
}

// { [rowIndex]: message, _?: message }. A spare row with nothing in it is not an error.
export function validateAccountRows(rows) {
  const errors = {};
  const seen = new Map();
  const used = rows.map((r, i) => ({ r, i })).filter(({ r }) => usedAccount(r));
  if (!used.length) errors._ = "Enter at least one account balance";
  for (const { r, i } of used) {
    const d = toCents(r.debit);
    const c = toCents(r.credit);
    if (!r.accountId) errors[i] = "Choose an account";
    else if (d < 0 || c < 0) errors[i] = "Amounts cannot be negative";
    else if (d > 0 && c > 0) errors[i] = "Enter a debit or a credit, not both";
    else if (!d && !c) errors[i] = "Enter an amount";
    else if (seen.has(r.accountId)) errors[i] = `This account is already on row ${seen.get(r.accountId) + 1}`;
    if (r.accountId && !seen.has(r.accountId)) seen.set(r.accountId, i);
  }
  return errors;
}

export function accountsPayload({ date, rows }) {
  return {
    date,
    lines: rows.filter(usedAccount).map((r) => ({
      accountId: r.accountId,
      debit: toCents(r.debit) ? fromCents(toCents(r.debit)) : 0,
      credit: toCents(r.credit) ? fromCents(toCents(r.credit)) : 0,
    })),
  };
}

// ----------------------------------------------------------------- 2. customer / vendor invoices

export const emptyPartyRow = () => ({ partyId: "", reference: "", date: "", dueDate: "", amount: "" });
const usedParty = (r) => r.partyId || text(r.reference) || toCents(r.amount);

export function partyTotals(rows) {
  const used = rows.filter(usedParty);
  return { count: used.length, cents: used.reduce((t, r) => t + toCents(r.amount), 0), parties: new Set(used.map((r) => r.partyId).filter(Boolean)).size };
}

// goLive: "YYYY-MM-DD". existing: the opening invoices already entered ({ partyId, reference }), so an
// invoice (or a second lump sum) that is already there is caught before the round trip.
export function validatePartyRows(rows, { goLive, existing = [] } = {}) {
  const errors = {};
  const used = rows.map((r, i) => ({ r, i })).filter(({ r }) => usedParty(r));
  if (!used.length) errors._ = "Enter at least one invoice";
  const EARLIER = "earlier";
  const taken = new Map(existing.map((e) => [`${e.partyId}|${text(e.reference)}`, EARLIER]));
  for (const { r, i } of used) {
    const ref = text(r.reference);
    const amount = toCents(r.amount);
    const start = r.date || goLive;
    if (!r.partyId) errors[i] = "Choose who it is for";
    else if (!(amount > 0)) errors[i] = "Enter an amount greater than zero";
    else if (ref.length > 60) errors[i] = "The invoice number is longer than 60 characters";
    else if (r.date && isIso(goLive) && r.date > goLive) errors[i] = "An invoice dated after the go-live day is not an opening balance";
    else if (r.dueDate && isIso(start) && r.dueDate < start) errors[i] = "The due date is before the invoice date";
    else {
      const key = `${r.partyId}|${ref}`;
      if (taken.has(key)) {
        const where = taken.get(key);
        errors[i] = ref
          ? `Invoice ${ref} is already ${where === EARLIER ? "entered" : `on ${where}`}`
          : where === EARLIER ? "A lump-sum balance for this party was entered earlier" : `This party already has a lump sum on ${where}`;
      } else taken.set(key, `row ${i + 1}`);
    }
  }
  return errors;
}

export function partyPayload({ type, date, rows }) {
  return {
    type, date,
    rows: rows.filter(usedParty).map((r) => ({
      partyId: r.partyId,
      ...(text(r.reference) ? { reference: text(r.reference) } : {}),
      ...(r.date ? { date: r.date } : {}),
      ...(r.dueDate ? { dueDate: r.dueDate } : {}),
      amount: fromCents(toCents(r.amount)),
    })),
  };
}

// ------------------------------------------------------------------------------------ 3. stock

export const emptyStockRow = () => ({ itemId: "", qty: "", unitCost: "", batchNo: "", expiryDate: "" });
const usedStock = (r) => r.itemId || text(r.qty) || text(r.unitCost) || text(r.batchNo);

// Value of a row in cents: quantity x unit cost to 2 decimals, the way the server rounds it.
export function stockRowCents(row) {
  const q = num(row.qty);
  const c = num(row.unitCost);
  if (!Number.isFinite(q) || !Number.isFinite(c) || q <= 0 || c < 0) return 0;
  return Math.round(q * c * 100 + 1e-9);
}

export function stockTotals(rows) {
  const used = rows.filter(usedStock);
  return {
    count: used.length,
    items: new Set(used.map((r) => r.itemId).filter(Boolean)).size,
    qty: used.reduce((t, r) => t + (num(r.qty) > 0 ? num(r.qty) : 0), 0),
    cents: used.reduce((t, r) => t + stockRowCents(r), 0),
  };
}

// items: [{ _id, itemName, batchTracked, canEnter }]. Errors block; warnings do not.
export function validateStockRows(rows, items, goLive) {
  const errors = {};
  const warnings = {};
  const byId = new Map(items.map((i) => [String(i._id), i]));
  const used = rows.map((r, i) => ({ r, i })).filter(({ r }) => usedStock(r));
  if (!used.length) errors._ = "Enter at least one item";
  for (const { r, i } of used) {
    const item = byId.get(String(r.itemId));
    const q = num(r.qty);
    const c = text(r.unitCost) === "" ? NaN : num(r.unitCost);
    if (!r.itemId) errors[i] = "Choose an item";
    else if (!item) errors[i] = "This item is not available for opening stock";
    else if (item.canEnter === false) errors[i] = `${item.itemName} already has stock movements: use a stock adjustment`;
    else if (!(q > 0)) errors[i] = "The quantity must be greater than zero";
    else if (!Number.isFinite(c) || c < 0) errors[i] = "Enter the unit cost (0 or more)";
    else if (text(r.batchNo).length > 60) errors[i] = "The batch number is longer than 60 characters";
    else if (item.batchTracked && (!text(r.batchNo) || !r.expiryDate)) errors[i] = `${item.itemName} is batch-tracked: enter the batch number and the expiry date`;
    if (!errors[i] && r.expiryDate && isIso(goLive) && r.expiryDate <= goLive) {
      warnings[i] = "Expires on or before the go-live day, so it will already show as expired";
    }
  }
  return { errors, warnings };
}

// What the entry will leave behind per item: quantity, value and the weighted-average cost.
export function itemAverages(rows, items) {
  const byId = new Map(items.map((i) => [String(i._id), i]));
  const map = new Map();
  for (const r of rows.filter(usedStock)) {
    if (!r.itemId || !(num(r.qty) > 0)) continue;
    const e = map.get(r.itemId) || { itemId: r.itemId, itemName: byId.get(String(r.itemId))?.itemName || "", qty: 0, cents: 0 };
    e.qty += num(r.qty);
    e.cents += stockRowCents(r);
    map.set(r.itemId, e);
  }
  // the average to 5 decimals, as the costing engine keeps it
  return [...map.values()].map((e) => ({ ...e, avg: e.qty > 0 ? Math.round((e.cents / 100 / e.qty) * 1e5) / 1e5 : 0 }));
}

export function stockPayload({ date, rows }) {
  return {
    date,
    rows: rows.filter(usedStock).map((r) => ({
      itemId: r.itemId, qty: num(r.qty), unitCost: num(r.unitCost),
      ...(text(r.batchNo) ? { batchNo: text(r.batchNo) } : {}),
      ...(r.expiryDate ? { expiryDate: r.expiryDate } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------------- the review

// The sections that already hold something, so the go-live date can be shown as fixed.
export const hasEntries = (summary) => {
  const s = summary?.sections;
  return Boolean(s && (s.accounts.vouchers || s.customers.rows || s.vendors.rows || s.stock.vouchers));
};

// Opening Balance Equity as a debit-minus-credit figure for the Balance component: a credit balance is negative.
export const equityNet = (summary) => -(summary?.trialBalance?.equity?.openingBalance || 0);
