import { api } from "./accountingApi";

// /api/v1/garage (trade ERP node/routes/garage/garageRoutes.js): vehicles and job cards. Each call returns
// `data`, or throws an ApiError carrying the server's message, code and details.
export const vehicles = {
  list: (params) => api.get("/garage/vehicles", params),
  find: (params) => api.get("/garage/vehicles/find", params),
  get: (id) => api.get(`/garage/vehicles/${id}`),
  activity: (id) => api.get(`/garage/vehicles/${id}/activity`),
  create: (body) => api.post("/garage/vehicles", body),
  update: (id, body) => api.put(`/garage/vehicles/${id}`, body),
};

export const jobCards = {
  board: () => api.get("/garage/job-cards/board"),
  assignees: () => api.get("/garage/job-cards/assignees"),
  analysis: (params) => api.get("/garage/job-cards/analysis", params),
  committed: (itemIds) => api.get("/garage/job-cards/committed", { itemIds }),
  list: (params) => api.get("/garage/job-cards", params),
  get: (id) => api.get(`/garage/job-cards/${id}`),
  activity: (id) => api.get(`/garage/job-cards/${id}/activity`),
  create: (body) => api.post("/garage/job-cards", body),
  update: (id, body) => api.put(`/garage/job-cards/${id}`, body),
  remove: (id) => api.del(`/garage/job-cards/${id}`),
  sendEstimate: (id) => api.post(`/garage/job-cards/${id}/send-estimate`, {}),
  recordApproval: (id, body) => api.post(`/garage/job-cards/${id}/approve`, body),
  reviseEstimate: (id, body) => api.post(`/garage/job-cards/${id}/revise-estimate`, body),
  startTask: (id, taskId) => api.post(`/garage/job-cards/${id}/tasks/${taskId}/start`, {}),
  completeTask: (id, taskId, body) => api.post(`/garage/job-cards/${id}/tasks/${taskId}/complete`, body),
  createInvoice: (id, body) => api.post(`/garage/job-cards/${id}/invoice`, body),
  release: (id, body) => api.post(`/garage/job-cards/${id}/release`, body),
  cancel: (id, body) => api.post(`/garage/job-cards/${id}/cancel`, body),
};
