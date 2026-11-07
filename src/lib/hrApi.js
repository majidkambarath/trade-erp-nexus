import axiosInstance from "../axios/axios";
import { api, unwrap } from "./accountingApi";

// /api/v1/hr (trade ERP node/routes/hr/hrRoutes.js): employees and their contracts/cost rates. Each call
// returns `data`, or throws an ApiError carrying the server's message, code and details.
// No `stats` here on purpose: GET /hr/employees/stats exists and serves the older staff module, but the
// Overview screen already reads its active-employee figure from coverage() - a second source behind a number
// the page already shows is worse than no second source at all.
export const employees = {
  list: (params) => api.get("/hr/employees", params),
  get: (id) => api.get(`/hr/employees/${id}`),
  // Uploads (idProof, addressProof): a FormData body. The shared axios instance defaults to a JSON content
  // type and flattens a FormData otherwise, so the multipart header has to be set here explicitly - the
  // same trap the CRM's and garage's own file uploads already found.
  create: (form) => unwrap(axiosInstance.post("/hr/employees", form, { headers: { "Content-Type": "multipart/form-data" } })),
  update: (id, form) => unwrap(axiosInstance.put(`/hr/employees/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } })),
  remove: (id) => api.del(`/hr/employees/${id}`),
};

// D15: an employee's own self-service portal account, set up or reset by HR.
export const employeePortal = {
  status: (staffId) => api.get(`/hr/employees/${staffId}/portal`),
  set: (staffId, body) => api.post(`/hr/employees/${staffId}/portal`, body),
  disable: (staffId) => api.del(`/hr/employees/${staffId}/portal`),
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

// W3: shifts, the holiday calendar, leave types - organisation-wide setup masters.
export const shifts = {
  list: () => api.get("/hr/shifts"),
  create: (body) => api.post("/hr/shifts", body),
  update: (id, body) => api.put(`/hr/shifts/${id}`, body),
  remove: (id) => api.del(`/hr/shifts/${id}`),
};

export const holidays = {
  list: (params) => api.get("/hr/holidays", params),
  create: (body) => api.post("/hr/holidays", body),
  remove: (id) => api.del(`/hr/holidays/${id}`),
};

export const leaveTypes = {
  list: () => api.get("/hr/leave-types"),
  create: (body) => api.post("/hr/leave-types", body),
  update: (id, body) => api.put(`/hr/leave-types/${id}`, body),
  remove: (id) => api.del(`/hr/leave-types/${id}`),
};

// The muster. Marking a day is its own permission (hr.attendance), separate from hr.manage.
export const attendance = {
  muster: (params) => api.get("/hr/attendance", params),
  forDay: (day) => api.get(`/hr/attendance/${day}`),
  markDay: (body) => api.post("/hr/attendance", body),
};

// Leave requests: a third kind in the SAME approvals queue a trade document or a voucher already uses
// (D13) - deciding one is reached from the Approvals page, not a separate "approve" button here, except
// that this screen offers the shortcut too since it is the natural place to act on one's own team's request.
export const leaveRequests = {
  list: (params) => api.get("/hr/leave-requests", params),
  get: (id) => api.get(`/hr/leave-requests/${id}`),
  balance: (staffId, leaveTypeId, day) => api.get("/hr/leave-requests/balance", { staffId, leaveTypeId, day }),
  submit: (body) => api.post("/hr/leave-requests", body),
  decide: (id, body) => api.post(`/hr/leave-requests/${id}/decide`, body),
  cancel: (id) => api.post(`/hr/leave-requests/${id}/cancel`),
};

// W4: an employee's own KYC register - the labour costing's own expiry-blocks-assignment check reads the
// same records.
export const employeeDocuments = {
  forStaff: (staffId) => api.get(`/hr/employees/${staffId}/documents`),
  create: (body) => api.post("/hr/employee-documents", body),
  update: (id, body) => api.put(`/hr/employee-documents/${id}`, body),
  remove: (id) => api.del(`/hr/employee-documents/${id}`),
  expiring: (params) => api.get("/hr/employee-documents/expiring", params),
};

// Salary components: read hr.view (they are rules, not anyone's pay); write hr.payroll.
export const salaryComponents = {
  list: () => api.get("/hr/salary-components"),
  create: (body) => api.post("/hr/salary-components", body),
  update: (id, body) => api.put(`/hr/salary-components/${id}`, body),
  remove: (id) => api.del(`/hr/salary-components/${id}`),
};

// A run - planning strips every figure unless the caller holds hr.confidential, same split contracts has.
export const payroll = {
  plan: (period) => api.get("/hr/payroll/plan", { period }),
  post: (period, acknowledge) => api.post("/hr/payroll/post", { period, acknowledge }),
  reverse: (runId, reason) => api.post(`/hr/payroll/runs/${runId}/reverse`, { reason }),
  runs: () => api.get("/hr/payroll/runs"),
  payslips: (runId) => api.get(`/hr/payroll/runs/${runId}/payslips`),
  payslipsForStaff: (staffId) => api.get(`/hr/employees/${staffId}/payslips`),
};

// Departments: the one structured grouping (designations stay free text).
export const departments = {
  list: () => api.get("/hr/departments"),
  create: (body) => api.post("/hr/departments", body),
  update: (id, body) => api.put(`/hr/departments/${id}`, body),
  remove: (id) => api.del(`/hr/departments/${id}`),
};

// W6: onboarding/exit checklists and a plain appraisal - no new permission key, hr.view/hr.manage cover it.
export const checklists = {
  forStaff: (staffId) => api.get(`/hr/employees/${staffId}/checklists`),
  start: (body) => api.post("/hr/checklists", body),
  addItem: (body) => api.post("/hr/checklist-items", body),
  markDone: (id) => api.post(`/hr/checklist-items/${id}/done`),
  remove: (id) => api.del(`/hr/checklist-items/${id}`),
};

export const appraisals = {
  forStaff: (staffId) => api.get(`/hr/employees/${staffId}/appraisals`),
  create: (staffId, body) => api.post(`/hr/employees/${staffId}/appraisals`, body),
};

// Assets: what was issued to whom, and when it came back - never a stock movement.
export const assets = {
  list: (params) => api.get("/hr/assets", params),
  forStaff: (staffId) => api.get(`/hr/employees/${staffId}/assets`),
  issue: (body) => api.post("/hr/assets", body),
  markReturned: (id, body) => api.post(`/hr/assets/${id}/return`, body),
  remove: (id) => api.del(`/hr/assets/${id}`),
};
