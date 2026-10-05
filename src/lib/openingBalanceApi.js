import { api } from "./accountingApi";

// The go-live set-up: /api/v1/opening-balances. Every response is { success, data } and `api`
// hands back `data`; a failure is an ApiError carrying the server's message, code and details.
export const openingBalances = {
  // go-live date, each section's totals, the opening trial balance check, stock reconciliation, warnings
  summary: () => api.get("/opening-balances/summary"),
  setGoLive: (date) => api.put("/opening-balances/go-live", { date }), // -> { date, warnings }

  // account balances: one voucher, the difference goes to Opening Balance Equity
  accounts: () => api.get("/opening-balances/accounts"), // -> { goLive, equity, entered, available, vouchers }
  postAccounts: (body) => api.post("/opening-balances/accounts", body), // { date, lines: [{ accountId, debit, credit }] }
  reverseAccounts: (id) => api.del(`/opening-balances/accounts/${id}`),

  // customer / vendor open invoices (type: "customer" | "vendor")
  parties: (type) => api.get("/opening-balances/parties", { type }), // -> { rows, totals, available }
  postParties: (body) => api.post("/opening-balances/parties", body), // { type, date, rows: [{ partyId, reference?, date?, dueDate?, amount }] }
  reverseParty: (id) => api.del(`/opening-balances/parties/${id}`),

  // opening stock
  stock: () => api.get("/opening-balances/stock"), // -> { vouchers, items }
  postStock: (body) => api.post("/opening-balances/stock", body), // { date, rows: [{ itemId, qty, unitCost, batchNo?, expiryDate? }] }
  reverseStock: (id) => api.del(`/opening-balances/stock/${id}`),
};
