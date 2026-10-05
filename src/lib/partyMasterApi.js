import axiosInstance from "../axios/axios";

// Customer and vendor master data: the document-type master, the document-expiry list, the party
// record behind an account, and saving a customer / vendor. Every response is { success, data };
// callers get `data`, and a failure is an Error carrying the server's message, code and details.

const unwrap = (promise) =>
  promise
    .then((res) => res.data?.data)
    .catch((err) => {
      const body = err.response?.data;
      throw Object.assign(new Error(body?.message || err.message || "Request failed"), {
        name: "ApiError",
        code: body?.errorCode,
        details: body?.details,
        status: err.response?.status,
      });
    });

const get = (url, params) => unwrap(axiosInstance.get(url, { params }));
const post = (url, body) => unwrap(axiosInstance.post(url, body));
const put = (url, body) => unwrap(axiosInstance.put(url, body));
const del = (url) => unwrap(axiosInstance.delete(url));

export const partyMaster = {
  // KYC document types (Trade licence, Emirates ID...). `params`: { active: "true", q }.
  documentTypes: {
    list: (params) => get("/document-types", params),
    create: (body) => post("/document-types", body),
    update: (id, body) => put(`/document-types/${id}`, body),
    remove: (id) => del(`/document-types/${id}`),
  },

  // Documents that have expired or expire within `withinDays` (default 30):
  // { asOf, withinDays, rows: [{ partyType, partyId, partyName, documentType, number, expiryDate, status, daysLeft }], summary }
  documentExpiry: (params) => get("/document-expiry", params),

  // The account form for a Receivable / Payable group. `create` makes the customer or vendor and its
  // account in the chosen group; `get` finds the party behind an account ({ kind, party });
  // `update` saves the party and the account's own settings together.
  accountParty: {
    create: (body) => post("/accounting/accounts/party", body),
    get: (accountId) => get(`/accounting/accounts/${accountId}/party`),
    update: (accountId, body) => put(`/accounting/accounts/${accountId}/party`, body),
  },

  // Saving a customer or vendor from their own screens (the routes repeat their prefix on purpose).
  parties: {
    save: (kind, id, body) => {
      if (kind === "vendor") return id ? put(`/vendors/vendors/${id}`, body) : post("/vendors/vendors", body);
      return id ? put(`/customers/${id}`, body) : post("/customers", body);
    },
  },
};
