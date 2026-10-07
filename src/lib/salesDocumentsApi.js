import axiosInstance from "../axios/axios";
import { api, ApiError } from "./accountingApi";

// Quotations and delivery notes. Every answer is { success, data }; a list also carries `pagination`,
// which is why lists are read through axios here and keep it, the way the voucher lists do.

const toApiError = (err) => {
  const body = err.response?.data;
  return new ApiError(body?.message || err.message || "Request failed", {
    code: body?.errorCode,
    details: body?.details,
    status: err.response?.status,
  });
};

const list = (url, params) =>
  axiosInstance
    .get(url, { params })
    .then((res) => ({ rows: res.data?.data || [], pagination: res.data?.pagination || { current: 1, pages: 1, total: 0, limit: 20 } }))
    .catch((err) => {
      throw toApiError(err);
    });

export const quotations = {
  list: (params) => list("/quotations", params),
  summary: () => api.get("/quotations/summary"),
  get: (id) => api.get(`/quotations/${id}`),
  activity: (id) => api.get(`/quotations/${id}/activity`),
  remove: (id) => api.del(`/quotations/${id}`),
  send: (id) => api.post(`/quotations/${id}/send`, {}),
  accept: (id, body) => api.post(`/quotations/${id}/accept`, body),
  reject: (id, body) => api.post(`/quotations/${id}/reject`, body),
  revise: (id) => api.post(`/quotations/${id}/revise`, {}),
  // -> { quotation, salesOrder }: a DRAFT sales order, which is the invoice
  convert: (id, body) => api.post(`/quotations/${id}/convert`, body || {}),
  // -> { quotation, deliveryNote }: the goods go first and are invoiced afterwards
  toDeliveryNote: (id, body) => api.post(`/quotations/${id}/delivery-note`, body || {}),
};

export const deliveryNotes = {
  list: (params) => list("/delivery-notes", params),
  summary: () => api.get("/delivery-notes/summary"),
  // delivered and not yet invoiced, oldest first, each with its 14-day invoice clock
  uninvoiced: (params) => api.get("/delivery-notes/uninvoiced", params),
  // on hand, promised on notes not yet invoiced, and what is left to promise
  availability: (itemIds, excludeId) => api.get("/delivery-notes/availability", { itemIds: [].concat(itemIds).join(","), excludeId }),
  // what can still be delivered on each line of a sales order
  fromOrder: (orderId) => api.get(`/delivery-notes/from-order/${orderId}`),
  get: (id) => api.get(`/delivery-notes/${id}`),
  pickList: (id) => api.get(`/delivery-notes/${id}/pick-list`),
  activity: (id) => api.get(`/delivery-notes/${id}/activity`),
  remove: (id) => api.del(`/delivery-notes/${id}`),
  dispatch: (id, body) => api.post(`/delivery-notes/${id}/dispatch`, body || {}),
  deliver: (id, body) => api.post(`/delivery-notes/${id}/deliver`, body),
  cancel: (id, body) => api.post(`/delivery-notes/${id}/cancel`, body || {}),
  create: (body) => api.post("/delivery-notes", body),
  update: (id, body) => api.put(`/delivery-notes/${id}`, body),
  // -> { salesOrder, deliveryNotes }: one draft invoice for one or several delivered notes of a customer
  invoice: (body) => api.post("/delivery-notes/invoice", body),
};

// A customer's quotations, orders and delivery notes joined into deals (the customer profile's Documents tab).
export const documentFlow = {
  customer: (customerId) => api.get(`/document-flow/customer/${customerId}`),
};

// A sales order the customer will not take the rest of. `preview` says what closing would do and refuses
// (with the reason) when it cannot be done; `reopen` undoes it while nothing has been built on it.
export const orderClose = {
  preview: (orderId) => api.get(`/transactions/transactions/${orderId}/close-short`),
  closeShort: (orderId, body) => api.post(`/transactions/transactions/${orderId}/close-short`, body),
  reopen: (orderId) => api.post(`/transactions/transactions/${orderId}/reopen-short`, {}),
};
