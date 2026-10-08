import { API_BASE_URL } from "../axios/axios";

// The public document link. These two calls use a bare fetch on purpose, NOT the axios instance: that
// instance attaches a sign-in token and, on a 401, sends the browser to the sign-in page. A customer
// opening an emailed link has no session and must never be sent there, and nothing they ask for
// carries one.

export class ShareError extends Error {
  constructor(code, { company = null, status = 0, message } = {}) {
    super(message || code);
    this.name = "ShareError";
    this.code = code; // SHARE_NOT_FOUND | SHARE_REVOKED | SHARE_EXPIRED | SHARE_RATE_LIMIT | OFFLINE | ERROR
    this.company = company; // only a valid link can tell who to ask
    this.status = status;
  }
}

const url = (token, tail = "") => `${API_BASE_URL}/share/${encodeURIComponent(token)}${tail}`;

export async function fetchShared(token) {
  let res;
  try {
    res = await fetch(url(token), { credentials: "omit", headers: { Accept: "application/json" } });
  } catch {
    throw new ShareError("OFFLINE");
  }
  const body = await res.json().catch(() => null);
  if (res.ok && body?.data) return body.data;
  throw new ShareError(body?.errorCode || "ERROR", { company: body?.details?.company || null, status: res.status, message: body?.message });
}

// "The page loaded": sent once, after the document is on screen. A mail scanner that merely fetches the
// link never runs this, which is the whole point of it. Fire and forget: a failure here changes nothing
// the customer sees.
export function markViewed(token) {
  try {
    fetch(url(token, "/viewed"), { method: "POST", credentials: "omit", keepalive: true }).catch(() => {});
  } catch { /* nothing to do */ }
}
