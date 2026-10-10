import { addDays } from "./calendarDays.js";

// Reading a whole list of trade documents (GET /transactions/transactions) for one period.
//
// What the server does with that route, read from services/orderPurchase/transactionService.js getAllTransactions, because the
// screens used to assume otherwise:
//   - it pages: `limit` defaults to 20 and is capped at 200. The four order screens never sent one, so they only ever held the
//     newest TWENTY documents and paged inside those; a company with hundreds saw two pages.
//   - `dateFilter=CUSTOM&startDate&endDate` filters on `date`... except for the two return types, where it filters on
//     `returnDate`, which nothing ever writes - so any date filter on a returns list matched nothing. Returns are therefore
//     read without dates (`serverDates: false`) and cut to the period in the browser.
//   - it sorts on createdAt only, and `search` looks at number, notes, creator and line text (not the party's name).
// So a screen asks for its period (a little wide: see `slack`), reads every page, and then filters, searches, sorts and
// pages in the browser, where all of that works on the whole set. The result says when the safety cap was hit.

export const SERVER_PAGE = 200; // the most one request returns
export const MAX_PAGES = 10; // 2,000 documents; beyond that the list says it is showing the newest

const EARLIEST = "1970-01-01T00:00:00.000Z";
const LATEST = "2100-01-01T00:00:00.000Z";

/**
 * The server's date filter for a period. `slack` widens each end by whole days: a document's date is stored at UTC midnight,
 * but one written with a clock time (or by an older version) can sit a few hours either side of its day, and the browser's own
 * day test (listPeriod.inPeriod) is the exact one - the server only has to send a superset.
 */
export function dateParams(period, { slack = 1 } = {}) {
  if (!period || period.all) return {};
  return {
    dateFilter: "CUSTOM",
    startDate: period.from ? `${addDays(period.from, -slack)}T00:00:00.000Z` : EARLIEST,
    endDate: period.to ? `${addDays(period.to, slack)}T23:59:59.999Z` : LATEST,
  };
}

/**
 * Read every page of a list.
 *
 * @param http         the axios instance (anything with .get(url, { params }))
 * @param type         "sales_order" | "purchase_order" | "sales_return" | "purchase_return"
 * @param period       a resolved list period (lib/listPeriod.js)
 * @param serverDates  false for the return types (see above): no date filter is sent
 * @param compare      { from, to } of an earlier period, to learn how many documents it holds (one request for a count; only
 *                     when the server filters by date)
 * @returns { rows, total, truncated, previousTotal }   `total` is the server's count for the request, `truncated` is true when
 *                     more exist than MAX_PAGES holds, `previousTotal` is null when it could not be learned
 */
export async function fetchAllTransactions(http, { type, period, serverDates = true, compare = null, pageSize = SERVER_PAGE, maxPages = MAX_PAGES, signal } = {}) {
  const base = { type, ...(serverDates ? dateParams(period) : {}) };
  const rows = [];
  const seen = new Set();
  let page = 1;
  let pages = 1;
  let total = 0;
  while (page <= Math.min(pages, maxPages)) {
    const res = await http.get("/transactions/transactions", { params: { ...base, page, limit: pageSize }, signal });
    const batch = Array.isArray(res?.data?.data) ? res.data.data : [];
    for (const row of batch) {
      const id = String(row?._id ?? row?.id ?? "");
      if (id && seen.has(id)) continue; // a document created while we paged can move one row across a page boundary
      if (id) seen.add(id);
      rows.push(row);
    }
    pages = Number(res?.data?.pagination?.pages) || 1;
    total = Number(res?.data?.pagination?.total) || rows.length;
    if (!batch.length) break;
    page += 1;
  }

  let previousTotal = null;
  if (serverDates && compare && (compare.from || compare.to)) {
    const res = await http.get("/transactions/transactions", { params: { type, ...dateParams(compare, { slack: 0 }), page: 1, limit: 1 }, signal });
    const n = res?.data?.pagination?.total;
    previousTotal = Number.isFinite(Number(n)) && n !== undefined && n !== null ? Number(n) : null;
  }

  return { rows, total: Math.max(total, rows.length), truncated: pages > maxPages, previousTotal };
}
