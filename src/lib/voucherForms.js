// Pure logic behind the finance voucher forms, kept out of the components so it can be tested
// without rendering. Money is handled in whole cents so 0.1 + 0.2 never shows as 0.30000000000000004.

export const toCents = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
export const fromCents = (c) => Math.round(c) / 100;
export const money = (c) => fromCents(c).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ------------------------------------------------------------------ payment modes
export const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "transfer", label: "Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
];
// "online" is what older vouchers call a transfer.
export const modeLabel = (mode) => (mode === "online" ? "Transfer" : PAYMENT_MODES.find((m) => m.value === mode)?.label || mode || "");

export const emptyPayment = () => ({
  mode: "cash", accountId: "", reference: "", referenceDate: "",
  chequeNo: "", chequeDate: "", drawnOnBankId: "", drawnOnBankName: "",
  cardId: "", approvalCode: "",
});

const STALE_CHEQUE_DAYS = 183;
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

// What is missing or wrong for the chosen mode. The server checks again; this saves the round trip.
// `options` is the list the form was given (accounts, cards...).
export function validatePayment(p, { direction, options, voucherDate } = {}) {
  const e = {};
  const banks = options?.bankAccounts || [];
  if (p.mode === "cash") return e;
  if (["bank", "transfer", "cheque"].includes(p.mode) && !p.accountId && banks.length !== 1) {
    e.accountId = direction === "receipt" ? "Choose the bank account the money goes into" : "Choose the bank account it is paid from";
  }
  if (p.mode === "transfer" && !String(p.reference).trim()) e.reference = "Enter the transfer reference";
  if (p.mode === "cheque") {
    if (!String(p.chequeNo).trim()) e.chequeNo = "Enter the cheque number";
    else if (!/^[A-Za-z0-9-]{3,20}$/.test(String(p.chequeNo).trim())) e.chequeNo = "Use letters, digits and dashes only (3 to 20)";
    if (!p.chequeDate) e.chequeDate = "Enter the cheque date";
    else if (voucherDate && (dayStart(voucherDate) - dayStart(p.chequeDate)) / 86400000 > STALE_CHEQUE_DAYS) e.chequeDate = "This cheque is more than six months old";
    if (direction === "receipt" && !p.drawnOnBankId && !String(p.drawnOnBankName).trim()) e.drawnOnBankId = "Say which bank the cheque is drawn on";
  }
  if (p.mode === "card") {
    if (!p.cardId) e.cardId = "Choose the card";
    if (direction === "receipt" && !String(p.approvalCode).trim()) e.approvalCode = "Enter the approval code from the card slip";
  }
  return e;
}

// The fields the voucher API takes for a payment.
export function paymentPayload(p) {
  const d = {};
  if (p.accountId) d.accountId = p.accountId;
  if (["bank", "transfer"].includes(p.mode)) {
    if (p.reference) d.reference = p.reference.trim();
    if (p.mode === "transfer" && p.referenceDate) d.referenceDate = p.referenceDate;
  }
  if (p.mode === "cheque") {
    d.chequeNo = p.chequeNo.trim();
    d.chequeDate = p.chequeDate;
    if (p.drawnOnBankId) d.drawnOnBankId = p.drawnOnBankId;
    else if (p.drawnOnBankName) d.drawnOnBankName = p.drawnOnBankName.trim();
  }
  if (p.mode === "card") {
    d.cardId = p.cardId;
    if (p.approvalCode) d.approvalCode = p.approvalCode.trim();
  }
  return { paymentMode: p.mode, paymentDetails: d };
}

const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
// The form state for an existing voucher (editing).
export function paymentFromVoucher(v) {
  const d = v?.paymentDetails || {};
  const mode = v?.paymentMode === "online" ? "transfer" : v?.paymentMode || "cash";
  return {
    ...emptyPayment(), mode,
    accountId: d.accountId || "",
    reference: d.reference || d.onlineDetails?.transactionId || "",
    referenceDate: isoDay(d.referenceDate || d.onlineDetails?.transactionDate),
    chequeNo: d.chequeDetails?.chequeNumber || "",
    chequeDate: isoDay(d.chequeDetails?.chequeDate),
    drawnOnBankId: d.drawnOnBankId || "", drawnOnBankName: d.drawnOnBankName || "",
    cardId: d.cardId || "", approvalCode: d.approvalCode || "",
  };
}

// One line describing how a voucher was paid, for lists and printouts.
export function describePayment(v) {
  const d = v?.paymentDetails || {};
  switch (v?.paymentMode) {
    case "cash": return d.accountName ? `Cash - ${d.accountName}` : "Cash";
    case "bank": return [d.accountName, d.reference && `ref ${d.reference}`].filter(Boolean).join(" · ") || "Bank";
    case "transfer":
    case "online": return [d.accountName, `ref ${d.reference || d.onlineDetails?.transactionId || "-"}`].filter(Boolean).join(" · ");
    case "cheque": return [`Cheque ${d.chequeDetails?.chequeNumber || ""}`, d.drawnOnBankName, d.isPDC && "post-dated"].filter(Boolean).join(" · ");
    case "card": return [d.cardLabel, d.cardTypeName, d.cardLast4 && `•••• ${d.cardLast4}`, d.approvalCode && `auth ${d.approvalCode}`].filter(Boolean).join(" · ");
    default: return "";
  }
}

// ------------------------------------------------------------------------- journal
export const emptyJournalRow = () => ({ accountId: "", narration: "", debit: "", credit: "" });

export function journalTotals(rows) {
  const debit = rows.reduce((t, r) => t + toCents(r.debit), 0);
  const credit = rows.reduce((t, r) => t + toCents(r.credit), 0);
  return { debit, credit, diff: debit - credit, balanced: debit > 0 && debit === credit };
}

// A row that has anything in it counts; an untouched spare row does not.
const used = (r) => r.accountId || toCents(r.debit) || toCents(r.credit);

export function validateJournal(rows) {
  const lines = rows.map((r, i) => ({ r, i })).filter(({ r }) => used(r));
  const errors = {};
  if (lines.length < 2) errors._ = "A journal needs at least two lines";
  for (const { r, i } of lines) {
    if (!r.accountId) errors[i] = "Choose an account";
    else if (toCents(r.debit) < 0 || toCents(r.credit) < 0) errors[i] = "Amounts cannot be negative";
    else if (toCents(r.debit) > 0 && toCents(r.credit) > 0) errors[i] = "Enter a debit or a credit, not both";
    else if (!toCents(r.debit) && !toCents(r.credit)) errors[i] = "Enter an amount";
  }
  const t = journalTotals(lines.map(({ r }) => r));
  if (!errors._ && !t.balanced) errors._ = t.debit === 0 && t.credit === 0 ? "Enter the amounts" : `Debits and credits differ by ${money(Math.abs(t.diff))}`;
  return errors;
}

// Tally-style help: when a row gets its account and has no amount yet, offer the amount that
// balances the voucher, on the side that needs it.
export function suggestBalance(rows, index) {
  const others = rows.filter((_, i) => i !== index);
  const { diff } = journalTotals(others);
  if (diff === 0) return null;
  return diff > 0 ? { side: "credit", amount: fromCents(diff) } : { side: "debit", amount: fromCents(-diff) };
}

export function journalPayload({ date, narration, rows }) {
  return {
    voucherType: "journal", date, narration,
    lines: rows.filter(used).map((r) => ({
      accountId: r.accountId, narration: r.narration?.trim() || undefined,
      debit: toCents(r.debit) ? fromCents(toCents(r.debit)) : 0,
      credit: toCents(r.credit) ? fromCents(toCents(r.credit)) : 0,
    })),
  };
}

export function journalRowsFromVoucher(v) {
  return (v?.entries || []).map((e) => ({
    accountId: e.accountId, narration: e.description || "",
    debit: e.debitAmount ? String(e.debitAmount) : "", credit: e.creditAmount ? String(e.creditAmount) : "",
  }));
}

// ----------------------------------------------------------------------- debit / credit notes
export const emptyNoteLine = () => ({ accountId: "", description: "", amount: "", taxCodeId: "" });

// taxCodes: [{ _id, ratePercent }]. VAT is rounded per line, as the server does.
export function noteTotals(lines, taxCodes = []) {
  const rate = (id) => Number(taxCodes.find((t) => String(t._id) === String(id))?.ratePercent) || 0;
  let net = 0;
  let vat = 0;
  for (const l of lines) {
    const amount = toCents(l.amount);
    net += amount;
    vat += Math.round((amount * rate(l.taxCodeId)) / 100);
  }
  return { net, vat, total: net + vat };
}

// What the voucher will post, shown before saving: party on one side, lines (and VAT) on the other.
export function notePreview({ type, partyName, partyType, lines, accounts, totals }) {
  const isDebit = type === "debit_note";
  const rows = [{ account: partyName || (partyType === "Vendor" ? "Vendor" : "Customer"), side: isDebit ? "Dr" : "Cr", amount: totals.total }];
  for (const l of lines) {
    if (!toCents(l.amount)) continue;
    rows.push({ account: accounts.find((a) => String(a._id) === String(l.accountId))?.accountName || "Choose an account", side: isDebit ? "Cr" : "Dr", amount: toCents(l.amount) });
  }
  if (totals.vat > 0) rows.push({ account: partyType === "Vendor" ? "Input VAT" : "Output VAT", side: isDebit ? "Cr" : "Dr", amount: totals.vat });
  return rows;
}

export function validateNote({ partyId, lines }) {
  const e = {};
  if (!partyId) e.partyId = "Choose who the note is for";
  const used = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.accountId || toCents(l.amount));
  if (!used.length) e._ = "Add at least one line";
  for (const { l, i } of used) {
    if (!l.accountId) e[i] = "Choose an account";
    else if (!(toCents(l.amount) > 0)) e[i] = "Enter an amount";
  }
  return e;
}

// ------------------------------------------------------------------------------ chart accounts
// Every postable account in the chart, flat, with its category. `chart` is the /accounting/chart
// payload (categories > groups > children, each group holding its accounts).
export function flattenAccounts(chart, { categories, groupNames } = {}) {
  const out = [];
  const walk = (group, category, path) => {
    for (const a of group.accounts || []) {
      if (a.isActive === false || a.allowDirectPosting === false) continue;
      out.push({ ...a, category, groupName: group.name, path: [...path, group.name].join(" › ") });
    }
    for (const c of group.children || []) walk(c, category, [...path, group.name]);
  };
  for (const cat of chart?.categories || []) {
    if (categories && !categories.includes(cat.category)) continue;
    for (const g of cat.groups || []) walk(g, cat.category, []);
    for (const a of cat.ungrouped || []) if (a.isActive !== false) out.push({ ...a, category: cat.category, groupName: "", path: "" });
  }
  return groupNames ? out.filter((a) => groupNames.includes(a.groupName)) : out;
}

// What happened to a voucher the server has just saved. One a person may not post on their own (over their approval limit, or an
// amount the organisation wants two approvers for) comes back PENDING: saved, numbered, not posted, waiting in the approvals list.
export const savedVerb = (saved, { updated = false } = {}) => (saved?.status === "pending" ? "saved, waiting for approval - not posted yet" : updated ? "updated" : "posted");

export const accountOption = (a) => ({
  value: a._id, label: a.accountName, hint: a.accountCode,
  searchText: `${a.accountCode} ${a.groupName || ""} ${a.category || ""}`,
});
