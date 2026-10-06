import { api } from "./accountingApi";

// Bank statement import, matching and reconciliation, and card settlement:
// /api/v1/banking/reconciliation/*. The bank account is always `accountId`; the account an entry is
// posted to (a fee's expense account, the other side of a journal) is `postToAccountId`.
const R = "/banking/reconciliation";

export const reconcile = {
  accounts: () => api.get(`${R}/accounts`),

  // where reconciliation of an account starts
  setupPreview: (accountId, startDay) => api.get(`${R}/setup/preview`, { accountId, startDay }),
  setupStatus: (accountId) => api.get(`${R}/setup/status`, { accountId }),
  saveSetup: (body) => api.put(`${R}/setup`, body),
  profile: (accountId) => api.get(`${R}/profile`, { accountId }),

  // statements
  previewImport: (body) => api.post(`${R}/import/preview`, body),
  importStatement: (body) => api.post(`${R}/import`, body),
  imports: (accountId) => api.get(`${R}/imports`, { accountId }),
  voidImport: (id) => api.del(`${R}/imports/${id}`),

  // the worklist
  lines: (params) => api.get(`${R}/lines`, params),
  entries: (params) => api.get(`${R}/entries`, params),
  allocation: (lineId, params) => api.get(`${R}/lines/${lineId}/allocation`, params),
  match: (body) => api.post(`${R}/matches`, body),
  accept: (body) => api.post(`${R}/matches/accept`, body),
  unmatch: (id, deleteVouchers = false) => api.del(`${R}/matches/${id}${deleteVouchers ? "?deleteVouchers=true" : ""}`),
  ignore: (lineId, reason) => api.post(`${R}/lines/${lineId}/ignore`, { reason }),
  unignore: (lineId) => api.post(`${R}/lines/${lineId}/unignore`, {}),
  createFromLine: (lineId, body) => api.post(`${R}/lines/${lineId}/create`, body),

  // the proof and the reconciliations
  proof: (params) => api.get(`${R}/proof`, params),
  finish: (body) => api.post(`${R}/reconciliations`, body),
  reconciliations: (accountId) => api.get(`${R}/reconciliations`, { accountId }),
  reconciliation: (id) => api.get(`${R}/reconciliations/${id}`),
  reopen: (id, body) => api.post(`${R}/reconciliations/${id}/reopen`, body),

  // card settlement
  cardUnsettled: (params) => api.get(`${R}/card/unsettled`, params),
  cardSettle: (body) => api.post(`${R}/card/settle`, body),
  cardSettlements: (params) => api.get(`${R}/card/settlements`, params),
  cardVariance: (params) => api.get(`${R}/card/variance`, params),
  cardAgeing: (params) => api.get(`${R}/card/ageing`, params),
};
