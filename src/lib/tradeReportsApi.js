import axiosInstance from "../axios/axios";

// Thin wrappers over /trade-reports (services/reports/tradeReportsService.js). Responses are { success, data }; callers get
// `data` back, and a failure as an Error carrying the server's message and code. Dates are YYYY-MM-DD (organisation days).
const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false));

const get = (url, params) =>
  axiosInstance
    .get(`/trade-reports${url}`, { params: clean(params) })
    .then((res) => res.data?.data)
    .catch((err) => {
      const body = err.response?.data;
      const e = new Error(body?.message || err.message || "Request failed");
      e.code = body?.errorCode;
      e.status = err.response?.status;
      throw e;
    });

export const tradeReports = {
  // { direction: "sales" | "purchases", from, to, groupBy: "party" | "item" | "party_item" | "month", partyId, itemId, categoryId, search, monthly }
  summary: (params) => get("/summary", params),
  // { direction, from, to, partyId, itemId, categoryId, search, page, limit }
  register: (params) => get("/register", params),
  // { type: "customer" | "vendor", from, to, search, includeZero }
  partyMovement: (params) => get("/party-movement", params),
};
