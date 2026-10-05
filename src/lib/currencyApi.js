import axiosInstance from "../axios/axios";
import { ApiError } from "./accountingApi";

// The currency master, its exchange rates and the foreign-currency register. Every response is
// { success, data }; callers get `data` back and failures as an ApiError carrying the server's
// message and errorCode (NO_RATE, RATE_OUT_OF_TOLERANCE, CURRENCY_IN_USE...).
const unwrap = (promise) =>
  promise
    .then((res) => res.data?.data)
    .catch((err) => {
      const body = err.response?.data;
      throw new ApiError(body?.message || err.message || "Request failed", { code: body?.errorCode, details: body?.details, status: err.response?.status });
    });

export const currencies = {
  // every currency: code, name, symbol, decimals, isBase, isActive, latestRate, latestRateDate, rateCount, used
  list: () => unwrap(axiosInstance.get("/currencies")),
  create: (body) => unwrap(axiosInstance.post("/currencies", body)),
  update: (code, body) => unwrap(axiosInstance.put(`/currencies/${code}`, body)),
  remove: (code) => unwrap(axiosInstance.delete(`/currencies/${code}`)),

  rates: (code, params) => unwrap(axiosInstance.get(`/currencies/${code}/rates`, { params })),
  addRate: (code, body) => unwrap(axiosInstance.post(`/currencies/${code}/rates`, body)),
  // the rate a voucher dated `date` (YYYY-MM-DD) would be made at, with the allowed tolerance
  rate: (code, date) => unwrap(axiosInstance.get("/currencies/rate", { params: { code, date } })),

  settings: () => unwrap(axiosInstance.get("/currencies/settings")),
  updateSettings: (body) => unwrap(axiosInstance.put("/currencies/settings", body)),

  // { rows, totals, truncated } for foreign-currency receipts and payments
  register: (params) => unwrap(axiosInstance.get("/currencies/register", { params })),
};
