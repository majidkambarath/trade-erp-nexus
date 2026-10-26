import axiosInstance from "../axios/axios";
import { api, unwrap } from "./accountingApi";

// /api/v1/garage (trade ERP node/routes/garage/garageRoutes.js): vehicles and job cards. Each call returns
// `data`, or throws an ApiError carrying the server's message, code and details.
export const vehicles = {
  list: (params) => api.get("/garage/vehicles", params),
  find: (params) => api.get("/garage/vehicles/find", params),
  catalogue: () => api.get("/garage/vehicles/catalogue"),
  get: (id) => api.get(`/garage/vehicles/${id}`),
  activity: (id) => api.get(`/garage/vehicles/${id}/activity`),
  jobs: (id) => api.get(`/garage/vehicles/${id}/jobs`),
  create: (body) => api.post("/garage/vehicles", body),
  update: (id, body) => api.put(`/garage/vehicles/${id}`, body),
};

// Narrow party pickers for a job card's forms (id, name, code, active) - a garage-only person has neither
// sales.view/accounts.view nor purchase.view/accounts.view, so /customers/customers and /vendors/vendors
// would refuse them. Separate from `jobCards` below since a vehicle form reads `partyChoices.customers` too.
export const partyChoices = {
  customers: (params) => api.get("/garage/customers", params),
  vendors: (params) => api.get("/garage/vendors", params),
  // A new walk-in customer, created on the spot from the vehicle or job card form (name only - a one-person
  // customer is the usual case at a counter; the rest is filled in later on the real Customers screen).
  createCustomer: (name) => api.post("/garage/customers", { name }),
};

export const jobCards = {
  board: () => api.get("/garage/job-cards/board"),
  assignees: () => api.get("/garage/job-cards/assignees"),
  staff: () => api.get("/garage/job-cards/staff"),
  analysis: (params) => api.get("/garage/job-cards/analysis", params),
  comebackCandidates: (vehicleId, odometer) => api.get("/garage/job-cards/comeback-candidates", { vehicleId, odometer }),
  committed: (itemIds) => api.get("/garage/job-cards/committed", { itemIds }),
  list: (params) => api.get("/garage/job-cards", params),
  get: (id) => api.get(`/garage/job-cards/${id}`),
  activity: (id) => api.get(`/garage/job-cards/${id}/activity`),
  create: (body) => api.post("/garage/job-cards", body),
  update: (id, body) => api.put(`/garage/job-cards/${id}`, body),
  remove: (id) => api.del(`/garage/job-cards/${id}`),
  recordCheckIn: (id, body) => api.put(`/garage/job-cards/${id}/check-in`, body),
  sendEstimate: (id) => api.post(`/garage/job-cards/${id}/send-estimate`, {}),
  recordApproval: (id, body) => api.post(`/garage/job-cards/${id}/approve`, body),
  reviseEstimate: (id, body) => api.post(`/garage/job-cards/${id}/revise-estimate`, body),
  startTask: (id, taskId) => api.post(`/garage/job-cards/${id}/tasks/${taskId}/start`, {}),
  completeTask: (id, taskId, body) => api.post(`/garage/job-cards/${id}/tasks/${taskId}/complete`, body),
  createInvoice: (id, body) => api.post(`/garage/job-cards/${id}/invoice`, body),
  release: (id, body) => api.post(`/garage/job-cards/${id}/release`, body),
  cancel: (id, body) => api.post(`/garage/job-cards/${id}/cancel`, body),
};

export const setup = {
  bays: (params) => api.get("/garage/bays", params),
  createBay: (body) => api.post("/garage/bays", body),
  updateBay: (id, body) => api.put(`/garage/bays/${id}`, body),
  services: (params) => api.get("/garage/services", params),
  createService: (body) => api.post("/garage/services", body),
  updateService: (id, body) => api.put(`/garage/services/${id}`, body),
  plan: (serviceId) => api.get("/garage/services/plan", { serviceId }),
};

export const claims = {
  ageing: () => api.get("/garage/claims/ageing"),
  list: (params) => api.get("/garage/claims", params),
  get: (id) => api.get(`/garage/claims/${id}`),
  activity: (id) => api.get(`/garage/claims/${id}/activity`),
  create: (body) => api.post("/garage/claims", body),
  update: (id, body) => api.put(`/garage/claims/${id}`, body),
  remove: (id) => api.del(`/garage/claims/${id}`),
  submit: (id) => api.post(`/garage/claims/${id}/submit`, {}),
  recordSurvey: (id, body) => api.post(`/garage/claims/${id}/survey`, body),
  recordApproval: (id, body) => api.post(`/garage/claims/${id}/decide`, body),
  raiseInvoices: (id) => api.post(`/garage/claims/${id}/raise-invoices`, {}),
};

// Files on a job card, a vehicle or a claim - one door shape for all three, the same as CRM's filesFor
// (lib/crmApi.js). `kind` is "jobcard" | "vehicle" | "claim", matching the server's ownerType.
const FILE_BASE = { jobcard: (id) => `/garage/job-cards/${id}/attachments`, vehicle: (id) => `/garage/vehicles/${id}/attachments`, claim: (id) => `/garage/claims/${id}/attachments` };
export function filesFor(kind, id) {
  const base = FILE_BASE[kind](id);
  return {
    list: () => api.get(base),
    upload: (file, label) => {
      const form = new FormData();
      form.append("file", file);
      if (label) form.append("label", label);
      return unwrap(axiosInstance.post(base, form, { headers: { "Content-Type": "multipart/form-data" } }));
    },
    remove: (item) => api.del(`/garage/attachments/${item.attachmentId}`),
    // through the authenticated API (a plain link would carry no token), then handed to the browser as a blob
    download: async (item) => {
      const res = await axiosInstance.get(`/garage/attachments/${item.attachmentId}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
