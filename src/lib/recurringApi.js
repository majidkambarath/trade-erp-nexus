import { api } from "./accountingApi";

// Recurring invoices (/recurring-invoices): templates that make a DRAFT sales invoice on a schedule.
export const recurringInvoices = {
  list: (params) => api.get("/recurring-invoices", params),
  get: (id) => api.get(`/recurring-invoices/${id}`),
  pause: (id) => api.post(`/recurring-invoices/${id}/pause`, {}),
  resume: (id) => api.post(`/recurring-invoices/${id}/resume`, {}),
  run: (id) => api.post(`/recurring-invoices/${id}/run`, {}),
  remove: (id) => api.del(`/recurring-invoices/${id}`),
};
