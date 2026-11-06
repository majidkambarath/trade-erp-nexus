import axiosInstance from "../axios/axios";
import { api, unwrap } from "./accountingApi";

// /api/v1/hr (trade ERP node/routes/hr/hrRoutes.js): employees and their contracts/cost rates. Each call
// returns `data`, or throws an ApiError carrying the server's message, code and details.
export const employees = {
  list: (params) => api.get("/hr/employees", params),
  stats: () => api.get("/hr/employees/stats"),
  get: (id) => api.get(`/hr/employees/${id}`),
  // Uploads (idProof, addressProof): a FormData body. The shared axios instance defaults to a JSON content
  // type and flattens a FormData otherwise, so the multipart header has to be set here explicitly - the
  // same trap the CRM's and garage's own file uploads already found.
  create: (form) => unwrap(axiosInstance.post("/hr/employees", form, { headers: { "Content-Type": "multipart/form-data" } })),
  update: (id, form) => unwrap(axiosInstance.put(`/hr/employees/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } })),
  remove: (id) => api.del(`/hr/employees/${id}`),
};

export const contracts = {
  // Pay figures are stripped out of every row unless the caller holds hr.confidential - the server decides
  // this, not the screen, so there is nothing to ask for here.
  list: (staffId) => api.get(`/hr/employees/${staffId}/contracts`),
  create: (staffId, body) => api.post(`/hr/employees/${staffId}/contracts`, body),
  update: (id, body) => api.put(`/hr/contracts/${id}`, body),
  remove: (id) => api.del(`/hr/contracts/${id}`),
};

// Who, right now, cannot be costed - the Overview screen's one real figure.
export const coverage = (params) => api.get("/hr/coverage", params);

// W2: gratuity and Emiratisation. The server strips the per-employee breakdown from a gratuity preview
// unless the caller holds hr.confidential - there is nothing to ask for here, it just comes back narrower.
export const gratuity = {
  preview: (month) => api.get("/hr/compliance/gratuity/preview", { month }),
  accruals: () => api.get("/hr/compliance/gratuity/accruals"),
  accrue: (month) => api.post("/hr/compliance/gratuity/accrue", { month }),
  reverse: (id, reason) => api.post(`/hr/compliance/gratuity/${id}/reverse`, { reason }),
};

export const emiratisation = () => api.get("/hr/compliance/emiratisation");

export const statutoryRules = {
  list: (country) => api.get("/hr/statutory-rules", country ? { country } : undefined),
  create: (body) => api.post("/hr/statutory-rules", body),
  remove: (id) => api.del(`/hr/statutory-rules/${id}`),
};
