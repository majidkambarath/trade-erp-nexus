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
  // what closing (or reopening) a year would do and what stands in the way, then the closing itself; `acknowledge` is the
  // list of warning codes the person ticked
  yearEnd: (id) => api.get(`/accounting/fiscal-years/${id}/year-end`),
  closeFiscalYear: (id, body) => api.post(`/accounting/fiscal-years/${id}/close`, body),
  reopenFiscalYear: (id) => api.post(`/accounting/fiscal-years/${id}/reopen`),
  numberSeries: () => api.get("/accounting/number-series"),
  taxCodes: () => api.get("/accounting/tax-codes"),
  createTaxCode: (body) => api.post("/accounting/tax-codes", body),
  updateTaxCode: (id, body) => api.put(`/accounting/tax-codes/${id}`, body),
  settings: () => api.get("/accounting/settings"),
  saveSettings: (body) => api.put("/accounting/settings", body),
  ageing: (params) => api.get("/accounting/reports/ageing", params),
  statement: (params) => api.get("/accounting/reports/statement", params),
  // Ledger reports: dates are YYYY-MM-DD (the organisation's calendar days).
  generalLedger: (params) => api.get("/accounting/reports/general-ledger", params),
  profitLossDetail: (params) => api.get("/accounting/reports/profit-loss", params),
  dayBook: (params) => api.get("/accounting/reports/day-book", params),
  // the day book by day: how many vouchers of each kind, and what they came to
  dailySummary: (params) => api.get("/accounting/reports/daily-summary", params),
  voucherImpact: (id) => api.get(`/accounting/reports/voucher/${id}`),
  cashBook: (params) => api.get("/accounting/reports/cash-book", params),
  cashFlow: (params) => api.get("/accounting/reports/cash-flow", params),
  // the cash and bank position at the end of one day (?date=), and day by day over a range (?from=&to=)
  dayEnd: (params) => api.get("/accounting/reports/day-end", params),
  dayEndRegister: (params) => api.get("/accounting/reports/day-end/register", params),
  partyBalances: (params) => api.get("/accounting/reports/party-balances", params),
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

// Trade documents (purchase / sales orders and their returns). The router re-declares its own
// prefix inside the mount, which is why the path doubles.
export const documents = {
  // Everything one document did: ledger entries, stock movements, party balance, settlements,
  // e-invoice and the activity log behind it.
  audit: (id) => api.get(`/transactions/transactions/${id}/audit`),
};

// The VAT return (FTA 201), worked out from the approved documents; saved returns are the record.
export const vat = {
  compute: (params) => api.get("/vat-return/return", params),
  detail: (params) => api.get("/vat-return/detail", params),
  returns: () => api.get("/vat-return/returns"),
  getReturn: (id) => api.get(`/vat-return/returns/${id}`),
  saveDraft: (body) => api.post("/vat-return/returns", body),
  finalize: (id, body) => api.post(`/vat-return/returns/${id}/finalize`, body),
  file: (id, body) => api.post(`/vat-return/returns/${id}/file`, body),
  removeReturn: (id) => api.del(`/vat-return/returns/${id}`),
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
