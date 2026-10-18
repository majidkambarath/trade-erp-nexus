import { api } from "./accountingApi";

// /api/v1/process-orders (trade ERP node/routes/stock/processOrderRoutes.js). Each call returns `data`, or throws an
// ApiError carrying the server's message, code and details.
export const processOrders = {
  board: () => api.get("/process-orders/board"),
  assignees: () => api.get("/process-orders/assignees"),
  lastSteps: (stockId) => api.get("/process-orders/last-steps", { stockId }),
  list: (params) => api.get("/process-orders", params),
  get: (id) => api.get(`/process-orders/${id}`),
  create: (body) => api.post("/process-orders", body),
  update: (id, body) => api.put(`/process-orders/${id}`, body),
  remove: (id) => api.del(`/process-orders/${id}`),
  release: (id) => api.post(`/process-orders/${id}/release`, {}),
  cancel: (id) => api.post(`/process-orders/${id}/cancel`, {}),
  finish: (id, body) => api.post(`/process-orders/${id}/finish`, body),
  reopen: (id, body = {}) => api.post(`/process-orders/${id}/reopen`, body),
  startStep: (id, stepId) => api.post(`/process-orders/${id}/steps/${stepId}/start`, {}),
  completeStep: (id, stepId, body) => api.post(`/process-orders/${id}/steps/${stepId}/complete`, body),
  sendStep: (id, stepId, body = {}) => api.post(`/process-orders/${id}/steps/${stepId}/send`, body),
};
