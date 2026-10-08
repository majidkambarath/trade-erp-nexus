import axiosInstance from "../axios/axios";
import { api, ApiError } from "./accountingApi";

// Sending a document to the customer. Every answer is { success, data }; a failure becomes an ApiError so
// the dialog shows the server's own words and keeps what was typed.
const toApiError = (err) => {
  const body = err.response?.data;
  return new ApiError(body?.message || err.message || "Request failed", {
    code: body?.errorCode,
    details: body?.details,
    status: err.response?.status,
  });
};

export const documentSends = {
  // The PDF travels as a file in a normal form post, not as text inside JSON: the server keeps a copy of
  // every JSON body in memory, and an attachment would sit there three times.
  // -> { send, share: { url, expiresAt } | null, duplicate }
  send: (fields, file, idempotencyKey) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null || v === "") continue;
      form.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    }
    if (file) form.append("pdf", file, file.name || "document.pdf");
    return axiosInstance
      // The shared client defaults to a JSON content type, and with that set it flattens a FormData to JSON:
      // the file is silently dropped and the email goes out with no attachment. Saying multipart here lets the
      // browser write the boundary and send the file as it is.
      .post("/messaging/send", form, { headers: { "Content-Type": "multipart/form-data", "Idempotency-Key": idempotencyKey } })
      .then((res) => res.data?.data)
      .catch((err) => { throw toApiError(err); });
  },
  // -> { send, waUrl, share, duplicate }. waUrl is what to open; null when this press was already handled.
  handoff: (body, idempotencyKey) =>
    axiosInstance
      .post("/messaging/handoff", body, { headers: { "Idempotency-Key": idempotencyKey } })
      .then((res) => res.data?.data)
      .catch((err) => { throw toApiError(err); }),
  history: (sourceType, sourceId) => api.get("/messaging/sends", { sourceType, sourceId, limit: 50 }),
  retry: (id) => api.post(`/messaging/sends/${id}/retry`, {}),
  withdraw: (shareId, reason) => api.post(`/messaging/shares/${shareId}/revoke`, { reason }),
};

export const sendSettings = {
  get: () => api.get("/messaging/settings"),
  save: (body) => api.put("/messaging/settings", body),
  readiness: () => api.get("/messaging/readiness"),
  test: (to) => api.post("/messaging/test", { to }),
};
