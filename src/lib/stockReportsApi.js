import axiosInstance from "../axios/axios";

// Thin wrappers over /stock-reports. Every backend response is { success, data } (or
// { success:false, message, errorCode }), so callers get `data` back directly and failures as an
// Error carrying the server's message and code. Dates are YYYY-MM-DD (the organisation's calendar days).

export class StockReportError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = "StockReportError";
    this.code = code;
    this.status = status;
  }
}

// Blank filters are left out of the query string instead of being sent as empty values.
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

const get = (url, params) =>
  axiosInstance
    .get(`/stock-reports${url}`, { params: clean(params) })
    .then((res) => res.data?.data)
    .catch((err) => {
      const body = err.response?.data;
      throw new StockReportError(body?.message || err.message || "Request failed", { code: body?.errorCode, status: err.response?.status });
    });

export const stockReports = {
  // items and categories for the filter pickers
  lookups: () => get("/lookups"),
  // { asOn, categoryId, search, groupBy: "item" | "category" }
  valuation: (params) => get("/valuation", params),
  // { asOn }: the valuation's comparison with the Inventory account at the end of a day (what the month and year close read)
  ledgerCheck: (params) => get("/ledger-check", params),
  // { from, to, categoryId, search }
  movement: (params) => get("/movement", params),
  // { itemId, from, to }
  itemLedger: (params) => get("/item-ledger", params),
  // { from, to, groupBy: "item" | "category" | "customer", direction: "sales" | "purchases", categoryId, search }
  salesAnalysis: (params) => get("/sales-analysis", params),
  // { withinDays, categoryId, search }
  expiry: (params) => get("/expiry", params),
  // { days, categoryId, search }
  slowMoving: (params) => get("/slow-moving", params),
  // { categoryId, search }
  reorder: (params) => get("/reorder", params),
};
