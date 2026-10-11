import axiosInstance from "../axios/axios";
import { api, ApiError } from "./accountingApi";

// Sales and purchase ORDERS (commitments that post nothing) and GOODS RECEIVED (the vendor-side twin of a delivery note).
// Every answer is { success, data }; a list also carries `pagination`, so lists are read through axios and keep it.
// The invoice a receipt or an order becomes is an ordinary purchase / sales invoice (a Transaction): approving it is what
// posts, so nothing here moves stock or touches the ledger.

const toApiError = (err) => {
  const body = err.response?.data;
  return new ApiError(body?.message || err.message || "Request failed", { code: body?.errorCode, details: body?.details, status: err.response?.status });
};

const list = (url, params) =>
  axiosInstance
    .get(url, { params })
    .then((res) => ({ rows: res.data?.data || [], pagination: res.data?.pagination || { current: 1, pages: 1, total: 0, limit: 20 } }))
    .catch((err) => {
      throw toApiError(err);
    });

export const tradeOrders = {
  // { kind: "sales" | "purchase", status, partyId, search, dateFrom, dateTo, page, limit }
  list: (params) => list("/trade-orders", params),
  summary: (kind) => api.get("/trade-orders/summary", { kind }),
  get: (id) => api.get(`/trade-orders/${id}`),
  activity: (id) => api.get(`/trade-orders/${id}/activity`),
  remove: (id) => api.del(`/trade-orders/${id}`),
  confirm: (id) => api.post(`/trade-orders/${id}/confirm`, {}),
  cancel: (id, body) => api.post(`/trade-orders/${id}/cancel`, body || {}),
  close: (id, body) => api.post(`/trade-orders/${id}/close`, body || {}),
  reopen: (id) => api.post(`/trade-orders/${id}/reopen`, {}),
  // -> { invoice, documents }: ONE draft invoice for everything delivered / received on the order and not yet invoiced
  invoice: (id, body) => api.post(`/trade-orders/${id}/invoice`, body || {}),
};

export const goodsReceipts = {
  list: (params) => list("/goods-receipts", params),
  summary: () => api.get("/goods-receipts/summary"),
  // what can still be received on each line of a confirmed purchase order
  fromOrder: (orderId) => api.get(`/goods-receipts/from-order/${orderId}`),
  get: (id) => api.get(`/goods-receipts/${id}`),
  activity: (id) => api.get(`/goods-receipts/${id}/activity`),
  remove: (id) => api.del(`/goods-receipts/${id}`),
  create: (body) => api.post("/goods-receipts", body),
  update: (id, body) => api.put(`/goods-receipts/${id}`, body),
  receive: (id, body) => api.post(`/goods-receipts/${id}/receive`, body),
  cancel: (id, body) => api.post(`/goods-receipts/${id}/cancel`, body || {}),
  // -> { purchaseInvoice, goodsReceipts }: one draft purchase invoice for one or several received receipts of a vendor
  invoice: (body) => api.post("/goods-receipts/invoice", body),
};
