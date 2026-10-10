// Page arithmetic for a list that is paged in the browser, and the words and buttons that go with it. Pure, so the edges
// (an empty list, a page past the end after a filter, a deleted last row) are tested without rendering anything.

export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

/** How many pages `total` rows make at `size` per page. An empty list still has one (empty) page. */
export const pageCount = (total, size) => Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(size) || 1)));

/** A requested page held inside 1..last, so a filter that leaves fewer rows never leaves the person on an empty page. */
export function clampPage(page, total, size) {
  const n = Math.floor(Number(page)) || 1;
  return Math.min(Math.max(1, n), pageCount(total, size));
}

/**
 * The rows of one page and where they sit.
 *   start, end   1-based positions of the first and last row shown (0 and 0 for an empty list)
 *   page         the page actually shown (clamped)
 */
export function pageSlice(rows, page, size) {
  const list = Array.isArray(rows) ? rows : [];
  const pageSize = Math.max(1, Number(size) || DEFAULT_PAGE_SIZE);
  const shown = clampPage(page, list.length, pageSize);
  const from = (shown - 1) * pageSize;
  const slice = list.slice(from, from + pageSize);
  return {
    rows: slice,
    page: shown,
    pages: pageCount(list.length, pageSize),
    total: list.length,
    size: pageSize,
    start: slice.length ? from + 1 : 0,
    end: slice.length ? from + slice.length : 0,
  };
}

/** The same figures for a list the server pages: its page, its size and its total. */
export function pageFigures({ page, size, total }) {
  const pageSize = Math.max(1, Number(size) || DEFAULT_PAGE_SIZE);
  const count = Math.max(0, Number(total) || 0);
  const shown = clampPage(page, count, pageSize);
  const start = count ? (shown - 1) * pageSize + 1 : 0;
  return { page: shown, pages: pageCount(count, pageSize), total: count, size: pageSize, start, end: count ? Math.min(shown * pageSize, count) : 0 };
}

/**
 * The page buttons: the first, the last, and a window of `around` pages either side of the current one, with "..." where
 * pages are left out. Short lists are every page.  pageButtons(7, 20) -> [1, "...", 5, 6, 7, 8, 9, "...", 20]
 */
export function pageButtons(page, pages, around = 2) {
  if (pages <= 1) return [1];
  const wanted = new Set([1, pages]);
  for (let p = page - around; p <= page + around; p += 1) if (p >= 1 && p <= pages) wanted.add(p);
  const sorted = [...wanted].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0) {
      const gap = p - sorted[i - 1];
      if (gap === 2) out.push(sorted[i - 1] + 1); // one missing page is shown, not hidden behind "..."
      else if (gap > 2) out.push("...");
    }
    out.push(p);
  });
  return out;
}

/** "Showing 11 to 20 of 134 orders" / "No orders". */
export function showingText({ start, end, total }, noun = "documents", one) {
  if (!total) return `No ${noun}`;
  const singular = one || (noun.endsWith("s") ? noun.slice(0, -1) : noun);
  return `Showing ${start} to ${end} of ${total} ${total === 1 ? singular : noun}`;
}
