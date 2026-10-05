import axiosInstance from "../axios/axios";

// The home dashboard, one call per part so the first screen does not wait for the rest. Every figure
// is worked out by the server from the same reports the other screens use, in AED. Every backend
// response is { success, data } (or { success:false, message, errorCode }), so callers get `data`
// back directly and failures as an Error carrying the server's message and code.
//
// Every call takes the period: { period: "week" | "month" | "quarter" } (default month), or
// { month: "YYYY-MM" }, or { from, to } as YYYY-MM-DD.

export class DashboardError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = "DashboardError";
    this.code = code;
    this.status = status;
  }
}

const get = (part, params = {}) =>
  axiosInstance
    .get(`/dashboard-summary${part}`, { params })
    .then((res) => res.data?.data)
    .catch((err) => {
      const body = err.response?.data;
      throw new DashboardError(body?.message || err.message || "Request failed", { code: body?.errorCode, status: err.response?.status });
    });

export const dashboard = {
  // header figures, ops status, collection rate, 8-month trend, top product, VAT, attention, recent activity
  summary: (params) => get("", params),
  // the charts under them on the Dashboard tab
  analytics: (params) => get("/analytics", params),
  // the Sales, Inventory and Reports tabs
  sales: (params) => get("/sales", params),
  inventory: (params) => get("/inventory", params),
  reports: (params) => get("/reports", params),
};
