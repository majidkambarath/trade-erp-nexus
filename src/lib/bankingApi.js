import { api } from "./accountingApi";

// Banks, card types, cards, cheques and the options the receipt / payment forms offer.
export const banking = {
  options: () => api.get("/banking/payment-options"),

  banks: (params) => api.get("/banking/banks", params),
  createBank: (body) => api.post("/banking/banks", body),
  updateBank: (id, body) => api.put(`/banking/banks/${id}`, body),

  cardTypes: (params) => api.get("/banking/card-types", params),
  createCardType: (body) => api.post("/banking/card-types", body),
  updateCardType: (id, body) => api.put(`/banking/card-types/${id}`, body),

  cards: (params) => api.get("/banking/cards", params),
  createCard: (body) => api.post("/banking/cards", body),
  updateCard: (id, body) => api.put(`/banking/cards/${id}`, body),

  cheques: (params) => api.get("/banking/cheques", params),
  clearCheque: (id, body) => api.post(`/banking/cheques/${id}/clear`, body),
  bounceCheque: (id, body) => api.post(`/banking/cheques/${id}/bounce`, body),
  cancelCheque: (id, body) => api.post(`/banking/cheques/${id}/cancel`, body),
};

// Vouchers of every type share one set of endpoints. The list comes back as
// { status, results, pagination, data }, so it is read through axios directly.
import axiosInstance from "../axios/axios";
import { ApiError } from "./accountingApi";

const fail = (err) => {
  const body = err.response?.data;
  throw new ApiError(body?.message || err.message || "Request failed", { code: body?.errorCode, details: body?.details, status: err.response?.status });
};

export const vouchers = {
  list: (params) =>
    axiosInstance
      .get("/vouchers/vouchers", { params })
      .then((r) => ({ rows: r.data?.data || [], pagination: r.data?.pagination || { current: 1, pages: 1, total: 0 } }))
      .catch(fail),
  // The server answers { voucher, ledgerEntries }; the screens read the voucher itself.
  get: (id) =>
    axiosInstance
      .get(`/vouchers/vouchers/${id}`)
      .then((r) => { const d = r.data?.data; return d?.voucher ? { ...d.voucher, ledgerEntries: d.ledgerEntries } : d; })
      .catch(fail),
  create: (body) => axiosInstance.post("/vouchers/vouchers", body).then((r) => r.data?.data).catch(fail),
  update: (id, body) => axiosInstance.put(`/vouchers/vouchers/${id}`, { ...body, forceUpdate: true }).then((r) => r.data?.data).catch(fail),
  remove: (id) => axiosInstance.delete(`/vouchers/vouchers/${id}`).then((r) => r.data).catch(fail),
  // Approve (or reject) a voucher that is waiting. Above the organisation's second-approver amount an approve only records the
  // first approval and answers { approval: { awaitingSecond: true } }, leaving the voucher pending (lib/approvals wasFirstApproval).
  approve: (id, action = "approve") => axiosInstance.patch(`/vouchers/vouchers/${id}/approve`, { action }).then((r) => r.data?.data).catch(fail),
  // Everything the voucher did: its ledger entries, the invoices it settled, its cheque and the
  // activity log behind it.
  audit: (id) => axiosInstance.get(`/vouchers/vouchers/${id}/audit`).then((r) => r.data?.data).catch(fail),
};
