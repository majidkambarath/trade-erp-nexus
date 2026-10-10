// Exporting the day book and the journals register to a file. Both lists are paged by the server (GET /accounting/reports/day-book:
// `limit` is capped at 200), and the CSV button used to write only the page on screen - 50 vouchers of 1,198 - which reads as a
// complete export. So an export reads every page first. Pure: the screen passes the function that fetches one page, which keeps
// the paging, the dedupe and the hard stop testable without a network or a render.

import { formatNumber } from "../utils/format";

export const EXPORT_PAGE = 200; // the most one request returns
export const EXPORT_MAX_PAGES = 100; // 20,000 vouchers; beyond that the export says it holds the newest

/**
 * Read every page of a paged report.
 *
 * @param fetchPage  ({ page, limit }) => Promise<{ rows, total, limit? }>; the caller adds its own filters
 * @returns { rows, total, truncated }   `total` is what the server counted, `truncated` is true when more exist than `maxPages`
 *                                       pages hold (the newest come first, so those are the ones kept)
 */
export async function fetchAllPages(fetchPage, { pageSize = EXPORT_PAGE, maxPages = EXPORT_MAX_PAGES } = {}) {
  const rows = [];
  const seen = new Set();
  let total = 0;
  let pages = 1;
  for (let page = 1; page <= Math.min(pages, maxPages); page += 1) {
    const res = await fetchPage({ page, limit: pageSize });
    const batch = Array.isArray(res?.rows) ? res.rows : [];
    // the server may cap the page below what was asked for: count pages by what it says it used
    const size = Math.max(1, Number(res?.limit) || pageSize);
    total = Number(res?.total) || 0;
    pages = Math.max(1, Math.ceil(total / size));
    for (const row of batch) {
      const id = row?.voucherId;
      if (id && seen.has(id)) continue; // a voucher posted while we paged can move one row across a page boundary
      if (id) seen.add(id);
      rows.push(row);
    }
    if (!batch.length) break;
  }
  return { rows, total: Math.max(total, rows.length), truncated: pages > maxPages };
}

export const DAY_BOOK_HEADERS = ["Date", "Voucher", "Type", "Party", "Narration", "Amount"];

/** The day book as CSV rows: one per voucher. `formatDay` writes a date the way the person reads dates. */
export const dayBookRows = (rows, formatDay) =>
  rows.map((r) => [formatDay(r.date), r.voucherNo, r.typeLabel, r.party, r.narration, r.amount]);

export const JOURNAL_HEADERS = ["Date", "Voucher", "Narration", "Account code", "Account", "Debit", "Credit"];

/** The journals register as CSV rows: one per line of each journal. */
export const journalRows = (rows, formatDay) =>
  rows.flatMap((r) => (r.lines || []).map((l) => [formatDay(r.date), r.voucherNo, r.narration, l.accountCode, l.accountName, l.debit, l.credit]));

const count = (n, one, many) => `${formatNumber(n, 0)} ${n === 1 ? one : many}`;

/** What the toast says when an export finished: the number written, and that it is not all of them when it is not. */
export function exportedText({ written, total, truncated }, one, many) {
  if (truncated) return `Exported the newest ${count(written, one, many)} of ${formatNumber(total, 0)}. Narrow the dates to export the rest.`;
  return `Exported ${count(written, one, many)}`;
}
