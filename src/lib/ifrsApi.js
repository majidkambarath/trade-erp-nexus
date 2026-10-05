import { api } from "./accountingApi";

// IFRS statements, read from the general ledger (backend: /api/v1/ifrs). Responses are
// { success, data }; `api` unwraps them and turns a failure into an Error carrying the server's
// message. Every call takes the dates as YYYY-MM-DD and `compare`:
//   compare   "prior-year" (default) | "prior-period" | "none"
//   position and notes     { asAt, compare }  (position also accepts `from`, where "profit for the
//                          period" starts; left out, it is the start of the fiscal year)
//   the other statements   { from, to, compare }
export const ifrs = {
  financialPosition: (params) => api.get("/ifrs/financial-position", params),
  profitOrLoss: (params) => api.get("/ifrs/profit-or-loss", params),
  changesInEquity: (params) => api.get("/ifrs/changes-in-equity", params),
  cashFlows: (params) => api.get("/ifrs/cash-flows", params),
  notes: (params) => api.get("/ifrs/notes", params),
};
