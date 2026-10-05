import { drCr, todayInput } from "../../../utils/format";

// Pure rules for the customer / vendor account pages. Nothing here touches React or the network,
// so the figures that matter (sides, credit position, overdue) are easy to test on their own.

// The two kinds of account page differ in wording, routes and which way a balance reads. A
// positive balance from the server always means "they owe us" (customer) or "we owe them"
// (vendor); `sign` turns that into the ledger's debit-minus-credit.
export const KINDS = {
  customer: {
    kind: "customer",
    partyType: "Customer",
    noun: "customer",
    nounPlural: "customers",
    title: "Receivables",
    listLabel: "Receivables",
    listPath: "/credit-accounts",
    detailPath: (id) => `/credit-accounts/customer/${id}`,
    manageLabel: "Customers",
    managePath: "/customer-creation",
    payLabel: "Receive payment",
    payPath: "/receipt-voucher",
    balanceTitle: "Balance",
    idField: "customerId",
    nameField: "customerName",
    sign: 1,
    docNoun: "sales",
  },
  vendor: {
    kind: "vendor",
    partyType: "Vendor",
    noun: "vendor",
    nounPlural: "vendors",
    title: "Payables",
    listLabel: "Payables",
    listPath: "/debit-accounts",
    detailPath: (id) => `/debit-accounts/vendor/${id}`,
    manageLabel: "Vendors",
    managePath: "/vendor-creation",
    payLabel: "Make payment",
    payPath: "/payment-voucher",
    balanceTitle: "Balance owed",
    idField: "vendorId",
    nameField: "vendorName",
    sign: -1,
    docNoun: "purchase",
  },
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** The balance as debit minus credit, ready for <Balance net>. */
export const netOf = (kind, balance) => (KINDS[kind]?.sign ?? 1) * round2(balance);

/** "1,312.50 Dr" as plain text (CSV, labels). */
export const sideText = (net) => {
  const { text, side } = drCr(net);
  return side ? `${text} ${side}` : text;
};

// ---------- statement ----------

const VOUCHER_LABELS = {
  sales_order: "Sales invoice",
  sales_return: "Sales return",
  purchase_order: "Purchase invoice",
  purchase_return: "Purchase return",
  receipt: "Receipt",
  payment: "Payment",
  credit_note: "Credit note",
  debit_note: "Debit note",
  journal: "Journal",
  contra: "Contra",
  expense: "Expense",
  opening: "Opening balance",
  stock_writeoff: "Stock write-off",
};

const titleCase = (s) =>
  String(s || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

export const voucherLabel = (type) => VOUCHER_LABELS[type] || titleCase(type) || "Entry";

/** The voucher types present in a statement, as filter options, in reading order. */
export const typeOptions = (rows = []) =>
  [...new Set(rows.map((r) => r.voucherType).filter(Boolean))]
    .map((value) => ({ value, label: voucherLabel(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));

export const sumRows = (rows = []) => ({
  debit: round2(rows.reduce((t, r) => t + (Number(r.debit) || 0), 0)),
  credit: round2(rows.reduce((t, r) => t + (Number(r.credit) || 0), 0)),
});

// ---------- period presets ----------

export const PRESETS = [
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
  { id: "all", label: "All" },
];

/** The from / to a preset stands for, as YYYY-MM-DD in Dubai time ("" means unbounded). */
export function presetRange(id, today = todayInput()) {
  if (id === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (id === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: "", to: "" };
}

/** Which preset the current dates match, if any, so its button can show as pressed. */
export function activePreset(range, today = todayInput()) {
  return PRESETS.find((p) => {
    const r = presetRange(p.id, today);
    return r.from === (range.from || "") && r.to === (range.to || "");
  })?.id;
}

// ---------- credit and overdue ----------

/** How each credit state is worded and drawn. The label always carries the state; colour only helps. */
export const CREDIT_STATUS = {
  ok: { tone: "success", label: "Within limit", fill: "bg-primary", text: "text-foreground" },
  near: { tone: "warning", label: "Near limit", fill: "bg-status-warning", text: "text-status-warning" },
  over: { tone: "danger", label: "Over limit", fill: "bg-status-danger", text: "text-status-danger" },
};

/**
 * Where a customer stands against their credit limit. The server's party-balances row is the
 * source of truth; when the party has no ledger row yet, the same arithmetic runs on the party
 * record so the limit still shows. status: ok | near (80% or more) | over | no-limit.
 */
export function creditPosition({ summary, party } = {}) {
  const limit = Number(summary?.creditLimit ?? party?.creditLimit) || 0;
  const balance = Number(summary?.balance) || 0;
  if (limit <= 0) return { limit: 0, available: null, utilisation: null, status: "no-limit" };
  const utilisation = summary?.utilisation ?? round2((Math.max(balance, 0) / limit) * 100);
  const available = summary?.available ?? round2(limit - balance);
  const status = summary?.status && summary.status !== "no-limit" ? summary.status : balance > limit ? "over" : utilisation >= 80 ? "near" : "ok";
  return { limit, available, utilisation, status };
}

/** Overdue amount: the server's figure, or what the open invoices say when there is no ledger row. */
export function overdueAmount({ summary, ageingRow } = {}) {
  if (summary?.overdue != null) return round2(summary.overdue);
  if (!ageingRow) return 0;
  return round2((Number(ageingRow.total) || 0) - (Number(ageingRow.buckets?.current) || 0));
}

/** Open invoices already past their due date. */
export const overdueInvoiceCount = (invoices = []) => invoices.filter((i) => Number(i.daysPastDue) > 0).length;

export const DEFAULT_BUCKETS = [
  { key: "current", label: "Not yet due" },
  { key: "d1_30", label: "1-30 days" },
  { key: "d31_60", label: "31-60 days" },
  { key: "d61_90", label: "61-90 days" },
  { key: "d90plus", label: "Over 90 days" },
];

/** How late an open invoice is: the words and a tone, so colour is never the only signal. */
export function lateness(invoice) {
  const days = Number(invoice?.daysPastDue) || 0;
  if (days > 0) return { tone: days > 60 ? "danger" : "warning", text: `${days} ${days === 1 ? "day" : "days"} overdue` };
  const toDue = Number(invoice?.daysToDue) || 0;
  if (toDue > 0) return { tone: "neutral", text: `Due in ${toDue} ${toDue === 1 ? "day" : "days"}` };
  return { tone: "neutral", text: invoice?.daysToDue === 0 ? "Due today" : "Not yet due" };
}

const STATUS_TONES = { active: "success", compliant: "success", pending: "warning", inactive: "neutral", "non-compliant": "danger", expired: "danger" };
export const partyStatusTone = (status) => STATUS_TONES[String(status || "").toLowerCase()] || "neutral";

export const slug = (s) =>
  String(s || "account")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "account";
