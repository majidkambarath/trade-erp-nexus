import { api } from "./accountingApi";

// Everything the customer and vendor account pages (and the Receivables / Payables lists) read.
// `kind` is "customer" or "vendor"; every call returns the response's `data` directly and fails
// with an ApiError carrying the server's message (see accountingApi).
//
// One sign convention runs through all of it: a positive `balance` is what the party owes us
// (customer) or what we owe them (vendor). The pages turn that into Dr/Cr for display.

const KINDS = {
  customer: {
    partyType: "Customer",
    ageingType: "receivable",
    list: "/ledger/credit-accounts",
    record: (id) => `/customers/${id}`,
  },
  vendor: {
    partyType: "Vendor",
    ageingType: "payable",
    list: "/ledger/debit-accounts",
    record: (id) => `/vendors/vendors/${id}`,
  },
};
const config = (kind) => KINDS[kind] || KINDS.customer;

// A date picker gives "2026-10-04". The server reads a bare date as midnight UTC, which is four
// o'clock in Dubai: an entry posted on the chosen last day would fall out of the range. So the
// range is sent as the whole Dubai day (UTC+4, no daylight saving).
const DUBAI = "+04:00";
export const startOfDay = (ymd) => (ymd ? new Date(`${ymd}T00:00:00.000${DUBAI}`).toISOString() : undefined);
export const endOfDay = (ymd) => (ymd ? new Date(`${ymd}T23:59:59.999${DUBAI}`).toISOString() : undefined);

export const partyAccountApi = {
  // The customer or vendor record: contact person, phone, email, TRN, terms, addresses, credit limit.
  party: (kind, id) => api.get(config(kind).record(id)),

  // The legacy list the Receivables / Payables pages have always been built on (one row per party).
  accounts: (kind) => api.get(config(kind).list),

  // Ledger balances for every party: { rows:[{ partyId, partyName, balance, overdue, paymentTerms,
  // creditLimit, available, utilisation, status }], totals }. `includeZero` keeps parties that
  // owe nothing in the list so a settled account still shows its own page.
  balances: (kind, params) =>
    api.get("/accounting/reports/party-balances", { type: kind === "vendor" ? "vendor" : "customer", includeZero: true, ...params }),

  // One party's balance row. A party with no ledger entries has no row, so the figure falls back
  // to the statement's closing balance (which also covers a company that has ledger posting off).
  async summary(kind, partyId) {
    const res = await partyAccountApi.balances(kind);
    const row = (res?.rows || []).find((r) => String(r.partyId) === String(partyId));
    if (row) return { ...row, source: "ledger" };
    const st = await partyAccountApi.statement({ kind, partyId });
    return { partyId, balance: st?.closing || 0, source: st?.source || "ledger" };
  },

  // Dated statement with a server-side running balance: { opening, rows, closing, totals, source }.
  statement: ({ kind, partyId, from, to }) =>
    api.get("/accounting/reports/statement", { partyId, partyType: config(kind).partyType, from: startOfDay(from), to: endOfDay(to) }),

  // Unpaid invoices of every party with their ageing buckets; the page picks its party's row.
  ageing: (kind) => api.get("/accounting/reports/ageing", { type: config(kind).ageingType }),
};
