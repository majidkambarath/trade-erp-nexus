import { api } from "./accountingApi";

// /api/v1/van-sales (trade ERP node/routes/vansales/vanSalesRoutes.js). Each call returns `data`, or throws an
// ApiError carrying the server's message, code and details.

export const vans = {
  list: (params) => api.get("/van-sales/vans", params),
  get: (id) => api.get(`/van-sales/vans/${id}`),
  create: (body) => api.post("/van-sales/vans", body),
  update: (id, body) => api.put(`/van-sales/vans/${id}`, body),
};

export const routes = {
  list: (params) => api.get("/van-sales/routes", params),
  get: (id) => api.get(`/van-sales/routes/${id}`),
  create: (body) => api.post("/van-sales/routes", body),
  update: (id, body) => api.put(`/van-sales/routes/${id}`, body),
};

// The module's own narrow pick lists: a salesman may hold no sales or accounts permission at all.
export const choices = {
  assignees: () => api.get("/van-sales/assignees"),
  customers: (params) => api.get("/van-sales/customers", params),
  payment: () => api.get("/van-sales/payment-choices"),
  position: (customerId) => api.get(`/van-sales/customers/${customerId}/position`),
  returnable: (invoiceId) => api.get(`/van-sales/invoices/${invoiceId}/returnable`),
};

export const trips = {
  list: (params) => api.get("/van-sales/trips", params),
  mine: () => api.get("/van-sales/trips/mine"),
  get: (id) => api.get(`/van-sales/trips/${id}`),
  activity: (id) => api.get(`/van-sales/trips/${id}/activity`),
  open: (body) => api.post("/van-sales/trips", body),
  load: (id, body) => api.post(`/van-sales/trips/${id}/load`, body),
  depart: (id) => api.post(`/van-sales/trips/${id}/depart`),
  cancel: (id) => api.post(`/van-sales/trips/${id}/cancel`),
  sell: (id, body) => api.post(`/van-sales/trips/${id}/sell`, body),
  collect: (id, body) => api.post(`/van-sales/trips/${id}/collect`, body),
  returnGoods: (id, body) => api.post(`/van-sales/trips/${id}/return`, body),
  unload: (id, body) => api.post(`/van-sales/trips/${id}/unload`, body),
  settlement: (id, params) => api.get(`/van-sales/trips/${id}/settlement`, params),
  settle: (id, body) => api.post(`/van-sales/trips/${id}/settle`, body),
  prices: (id, customerId) => api.get(`/van-sales/trips/${id}/prices`, { customerId }),
  visits: (id) => api.get(`/van-sales/trips/${id}/visits`),
  visit: (id, body) => api.post(`/van-sales/trips/${id}/visits`, body),
  transfer: (id, body) => api.post(`/van-sales/trips/${id}/transfer`, body),
  whatsapp: (id, invoiceId, body) => api.post(`/van-sales/trips/${id}/invoices/${invoiceId}/whatsapp`, body),
  offlinePack: (id, params) => api.get(`/van-sales/trips/${id}/offline`, params),
  sync: (id, body) => api.post(`/van-sales/trips/${id}/sync`, body),
};

export const priceLists = {
  list: (params) => api.get("/van-sales/price-lists", params),
  get: (id) => api.get(`/van-sales/price-lists/${id}`),
  create: (body) => api.post("/van-sales/price-lists", body),
  update: (id, body) => api.put(`/van-sales/price-lists/${id}`, body),
};

export const reports = {
  summary: (params) => api.get("/van-sales/reports/summary", params),
};
