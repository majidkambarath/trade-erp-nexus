import { api } from "./accountingApi";

// /api/v1/job-work (trade ERP node/routes/stock/jobWorkRoutes.js). Each call returns `data`, or throws an ApiError
// carrying the server's message, code and details.
export const jobWork = {
  list: (params) => api.get("/job-work", params),
  get: (id) => api.get(`/job-work/${id}`),
  activity: (id) => api.get(`/job-work/${id}/activity`),
  create: (body) => api.post("/job-work", body),
  update: (id, body) => api.put(`/job-work/${id}`, body),
  remove: (id) => api.del(`/job-work/${id}`),
  send: (id) => api.post(`/job-work/${id}/send`, {}),
  cancel: (id) => api.post(`/job-work/${id}/cancel`, {}),
  receive: (id, body) => api.post(`/job-work/${id}/receive`, body),
  reverseReceipt: (id, receiptId, body = {}) => api.post(`/job-work/${id}/receipts/${receiptId}/reverse`, body),
};
