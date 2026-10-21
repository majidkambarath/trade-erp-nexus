import { api } from "./accountingApi";

// /api/v1/productions (trade ERP node/routes/stock/productionRoutes.js). Each call returns `data`, or throws an ApiError
// carrying the server's message, code and details.
export const productions = {
  list: (params) => api.get("/productions", params),
  get: (id) => api.get(`/productions/${id}`),
  create: (body) => api.post("/productions", body),
  update: (id, body) => api.put(`/productions/${id}`, body),
  remove: (id) => api.del(`/productions/${id}`),
  post: (id, body = {}) => api.post(`/productions/${id}/post`, body),
  reverse: (id, body = {}) => api.post(`/productions/${id}/reverse`, body),
  costReport: (params) => api.get("/productions/cost-report", params),
};
