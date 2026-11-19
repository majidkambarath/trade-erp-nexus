import { addDays } from "./calendarDays.js";

// Reading a list of trade documents (GET /transactions/transactions) one page at a time.
//
// The server does the work: it filters (status, party, a payment state, a search over number, references, people and line
// text, the period on the document's date for every type), sorts and pages, and counts what the filters leave. A second route,
// GET /transactions/transactions/summary, answers the figures on the cards for a whole period without sending the documents.
// Nothing is read beyond the page on screen, so a company with a hundred thousand documents opens as fast as one with a hundred.

export const SERVER_PAGE = 200; // the most one request returns

const EARLIEST = "1970-01-01T00:00:00.000Z";
const LATEST = "2100-01-01T00:00:00.000Z";

/**
 * The server's date filter for a period: whole calendar days of the organisation, both ends included (the server insists on
 * both ends of a custom range, so an open end gets a far one). `slack` widens each end by whole days and is for callers that
 * want a superset; the lists ask for the exact period (0).
 */
export function dateParams(period, { slack = 0 } = {}) {
  if (!period || period.all) return {};
  return {
    dateFilter: "CUSTOM",
    startDate: period.from ? `${addDays(period.from, -slack)}T00:00:00.000Z` : EARLIEST,
    endDate: period.to ? `${addDays(period.to, slack)}T23:59:59.999Z` : LATEST,
  };
}

// The sort keys the server knows; anything else a column header names is the document number.
const SORT_KEYS = { date: "date", amount: "amount", status: "status", customer: "party", vendor: "party", party: "party" };
export const serverSortKey = (key) => SORT_KEYS[key] || "number";

/**
 * The query of one page of a list.
 *   status   a document status, or "PAY:PAID" | "PAY:PARTIAL" | "PAY:UNPAID" | "PAY:OVERDUE" (what has been collected), or "ALL"
 *   partyId  one customer or vendor, or "ALL"
 */
export function listParams({ type, period, search, status, partyId, sort, order, page = 1, limit = 25 } = {}) {
  const params = { type, ...dateParams(period), page, limit: Math.min(SERVER_PAGE, Math.max(1, Number(limit) || 25)) };
  const needle = String(search ?? "").trim();
  if (needle) params.search = needle;
  if (status && status !== "ALL") {
    if (String(status).startsWith("PAY:")) params.payment = String(status).slice(4);
    else params.status = status;
  }
  if (partyId && partyId !== "ALL") params.partyId = partyId;
  if (sort) {
    params.sort = serverSortKey(sort);
    params.order = order === "asc" ? "asc" : "desc";
  }
  return params;
}

/** One page of documents: { rows, total, pages }. */
export async function fetchTransactionPage(http, query, { signal } = {}) {
  const res = await http.get("/transactions/transactions", { params: listParams(query), signal });
  const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
  const total = Number(res?.data?.pagination?.total);
  return { rows, total: Number.isFinite(total) ? total : rows.length, pages: Number(res?.data?.pagination?.pages) || 1 };
}

/** The cards of a period: counts by document state and by payment state, and the money. Null when it could not be read. */
export async function fetchTransactionSummary(http, { type, period }, { signal } = {}) {
  const res = await http.get("/transactions/transactions/summary", { params: { type, ...dateParams(period) }, signal });
  const d = res?.data?.data;
  return d && typeof d === "object" ? d : null;
}

/** How many documents a period holds (one row asked for, the server's count read), or null when it could not be learned. */
export async function fetchPeriodCount(http, { type, period }, { signal } = {}) {
  try {
    const res = await http.get("/transactions/transactions", { params: { type, ...dateParams(period), page: 1, limit: 1 }, signal });
    const n = Number(res?.data?.pagination?.total);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
