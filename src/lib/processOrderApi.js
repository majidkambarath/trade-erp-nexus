import { api } from "./accountingApi";

// Fired after anything that changes whose work a step is (start, done, sent, finished): the menu count reads it again.
export const PROCESS_WORK_CHANGED = "process-work-changed";
const announced = (promise) =>
  promise.then((r) => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(PROCESS_WORK_CHANGED));
    return r;
  });

// /api/v1/process-orders and /api/v1/process-routes (trade ERP node/routes/stock/processOrderRoutes.js,
// processRouteRoutes.js). Each call returns `data`, or throws an ApiError carrying the server's message, code and details.
export const processOrders = {
  board: () => api.get("/process-orders/board"),
  myWork: () => api.get("/process-orders/my-work"),
  analysis: (params) => api.get("/process-orders/analysis", params),
  expenseVouchers: (search) => api.get("/process-orders/expense-vouchers", search ? { search } : undefined),
  assignees: () => api.get("/process-orders/assignees"),
  lastSteps: (stockId) => api.get("/process-orders/last-steps", { stockId }),
  list: (params) => api.get("/process-orders", params),
  get: (id) => api.get(`/process-orders/${id}`),
  create: (body) => api.post("/process-orders", body),
  update: (id, body) => api.put(`/process-orders/${id}`, body),
  remove: (id) => api.del(`/process-orders/${id}`),
  release: (id) => announced(api.post(`/process-orders/${id}/release`, {})),
  cancel: (id) => announced(api.post(`/process-orders/${id}/cancel`, {})),
  finish: (id, body) => announced(api.post(`/process-orders/${id}/finish`, body)),
  reopen: (id, body = {}) => announced(api.post(`/process-orders/${id}/reopen`, body)),
  startStep: (id, stepId) => announced(api.post(`/process-orders/${id}/steps/${stepId}/start`, {})),
  completeStep: (id, stepId, body) => announced(api.post(`/process-orders/${id}/steps/${stepId}/complete`, body)),
  sendStep: (id, stepId, body = {}) => announced(api.post(`/process-orders/${id}/steps/${stepId}/send`, body)),
  addCost: (id, body) => api.post(`/process-orders/${id}/costs`, body),
  removeCost: (id, costId) => api.del(`/process-orders/${id}/costs/${costId}`),
};

export const processRoutes = {
  list: (params) => api.get("/process-routes", params),
  get: (id) => api.get(`/process-routes/${id}`),
  plan: (params) => api.get("/process-routes/plan", params),
  create: (body) => api.post("/process-routes", body),
  update: (id, body) => api.put(`/process-routes/${id}`, body),
  remove: (id) => api.del(`/process-routes/${id}`),
};
