import axiosInstance from "../axios/axios";

// Thin wrappers over the accounting, e-invoicing and batch endpoints. Every backend response is
// { success, data } (or { success:false, message, errorCode, details }), so callers get `data`
// back directly and failures as an Error carrying the server's message, code and details.

export class ApiError extends Error {
  constructor(message, { code, details, status } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const unwrap = (promise) =>
  promise
    .then((res) => res.data?.data)
    .catch((err) => {
      const body = err.response?.data;
      throw new ApiError(body?.message || err.message || "Request failed", {
        code: body?.errorCode,
        details: body?.details,
        status: err.response?.status,
      });
    });

export const api = {
  get: (url, params) => unwrap(axiosInstance.get(url, { params })),
  post: (url, body) => unwrap(axiosInstance.post(url, body)),
  put: (url, body) => unwrap(axiosInstance.put(url, body)),
  patch: (url, body) => unwrap(axiosInstance.patch(url, body)),
  del: (url) => unwrap(axiosInstance.delete(url)),
};

export const accounting = {
  chart: (params) => api.get("/accounting/chart", params),
  // Every account a voucher may post to, flat and without balances: for the account pickers.
  postableAccounts: () => api.get("/accounting/accounts/postable"),
  restoreDefaults: () => api.post("/accounting/chart/defaults"),
  createAccount: (body) => api.post("/accounting/accounts", body),
  updateAccount: (id, body) => api.put(`/accounting/accounts/${id}`, body),
  accountLedger: (id, params) => api.get(`/accounting/accounts/${id}/ledger`, params),
  groups: () => api.get("/accounting/account-groups"),
  createGroup: (body) => api.post("/accounting/account-groups", body),
  updateGroup: (id, body) => api.put(`/accounting/account-groups/${id}`, body),
  configuration: () => api.get("/accounting/account-configuration"),
  saveMappings: (mappings) => api.put("/accounting/account-configuration", { mappings }),
  readiness: () => api.get("/accounting/account-configuration/readiness"),
  setPosting: (enabled) => api.put("/accounting/account-configuration/posting", { enabled }),
  fiscalYears: () => api.get("/accounting/fiscal-years"),
  createFiscalYear: (body) => api.post("/accounting/fiscal-years", body),
  closeFiscalYear: (id) => api.post(`/accounting/fiscal-years/${id}/close`),
  reopenFiscalYear: (id) => api.post(`/accounting/fiscal-years/${id}/reopen`),
  numberSeries: () => api.get("/accounting/number-series"),
  taxCodes: () => api.get("/accounting/tax-codes"),
  createTaxCode: (body) => api.post("/accounting/tax-codes", body),
  updateTaxCode: (id, body) => api.put(`/accounting/tax-codes/${id}`, body),
  settings: () => api.get("/accounting/settings"),
  saveSettings: (body) => api.put("/accounting/settings", body),
  ageing: (params) => api.get("/accounting/reports/ageing", params),
  statement: (params) => api.get("/accounting/reports/statement", params),
  returnable: (id, params) => api.get(`/accounting/returnable/${id}`, params),
  auditLog: (params) => api.get("/accounting/audit-log", params),
  attachments: (ownerType, ownerId) => api.get("/accounting/attachments", { ownerType, ownerId }),
  deleteAttachment: (id) => api.del(`/accounting/attachments/${id}`),
  // The financial reports share one endpoint; the response is { report }.
  report: (reportType, params) => api.get("/vouchers/reports/financial", { reportType, ...params }).then((d) => d.report),
  trialBalance: (params) => accounting.report("trial_balance", params),
  profitLoss: (params) => accounting.report("profit_loss", params),
  balanceSheet: (params) => accounting.report("balance_sheet", params),
};

export const batches = {
  list: (params) => api.get("/batches", params),
  writeOff: (id, body) => api.post(`/batches/${id}/write-off`, body),
};

export const einvoice = {
  settings: () => api.get("/einvoice/settings"),
  saveSettings: (body) => api.put("/einvoice/settings", body),
  readiness: () => api.get("/einvoice/readiness"),
  fixParty: (id, body) => api.patch(`/einvoice/parties/${id}`, body),
  documents: (params) => api.get("/einvoice/documents", params),
  preview: (id) => api.get(`/einvoice/preview/${id}`),
  submit: (id) => api.post(`/einvoice/submit/${id}`),
  submissions: (params) => api.get("/einvoice/submissions", params),
  submission: (id) => api.get(`/einvoice/submissions/${id}`),
  retry: (id) => api.post(`/einvoice/submissions/${id}/retry`),
  refresh: (id) => api.post(`/einvoice/submissions/${id}/refresh`),
  dashboard: () => api.get("/einvoice/dashboard"),
  inbound: (params) => api.get("/einvoice/inbound", params),
  addInbound: (body) => api.post("/einvoice/inbound", body),
  accept: (id, body) => api.post(`/einvoice/inbound/${id}/accept`, body),
  reject: (id, body) => api.post(`/einvoice/inbound/${id}/reject`, body),
};

// Files are downloaded through the authenticated API (a plain <a href> would carry no token),
// then handed to the browser as a blob.
export async function downloadAttachment(attachment) {
  const res = await axiosInstance.get(`/accounting/attachments/${attachment.attachmentId}`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = attachment.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function uploadAttachment(file, { ownerType, ownerId, label } = {}) {
  const form = new FormData();
  form.append("file", file);
  if (label) form.append("label", label);
  if (ownerType && ownerId) {
    form.append("ownerType", ownerType);
    form.append("ownerId", ownerId);
  }
  return unwrap(axiosInstance.post("/accounting/attachments", form, { headers: { "Content-Type": "multipart/form-data" } }));
}

export const linkAttachment = (id, body) => api.post(`/accounting/attachments/${id}/link`, body);
