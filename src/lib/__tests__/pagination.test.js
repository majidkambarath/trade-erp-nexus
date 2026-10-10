import { describe, it, expect } from "vitest";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, clampPage, pageButtons, pageCount, pageFigures, pageSlice, showingText } from "../pagination";

const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe("how many pages", () => {
  it("rounds up, and an empty list still has one page", () => {
    expect(pageCount(0, 10)).toBe(1);
    expect(pageCount(10, 10)).toBe(1);
    expect(pageCount(11, 10)).toBe(2);
    expect(pageCount(134, 25)).toBe(6);
    expect(pageCount(undefined, 25)).toBe(1);
  });

  it("offers the sizes the pickers show, with a default among them", () => {
    expect(PAGE_SIZES).toContain(DEFAULT_PAGE_SIZE);
  });
});

describe("a page past the end is never shown", () => {
  it("holds the page inside 1..last", () => {
    expect(clampPage(5, 30, 10)).toBe(3);
    expect(clampPage(0, 30, 10)).toBe(1);
    expect(clampPage(-2, 30, 10)).toBe(1);
    expect(clampPage(2, 0, 10)).toBe(1);
    expect(clampPage("2", 30, 10)).toBe(2);
    expect(clampPage(NaN, 30, 10)).toBe(1);
  });

  it("a filter that leaves fewer rows shows the last page that exists, with rows on it", () => {
    // the person was on page 6 of 134; the filter leaves 12 rows at 25 per page
    const page = pageSlice(rows(12), 6, 25);
    expect(page).toMatchObject({ page: 1, pages: 1, total: 12, start: 1, end: 12 });
    expect(page.rows).toHaveLength(12);
  });

  it("deleting the only row of the last page lands on the previous page, not on an empty one", () => {
    const page = pageSlice(rows(20), 3, 10); // page 3 had been the 21st row, now gone
    expect(page).toMatchObject({ page: 2, pages: 2, start: 11, end: 20 });
  });
});

describe("one page of rows", () => {
  it("gives the rows and 1-based positions", () => {
    const p = pageSlice(rows(134), 2, 50);
    expect(p).toMatchObject({ page: 2, pages: 3, total: 134, start: 51, end: 100 });
    expect(p.rows[0].id).toBe(51);
    expect(p.rows[49].id).toBe(100);
  });

  it("the last page is short", () => {
    const p = pageSlice(rows(134), 3, 50);
    expect(p).toMatchObject({ start: 101, end: 134 });
    expect(p.rows).toHaveLength(34);
  });

  it("an empty list has no positions at all", () => {
    expect(pageSlice([], 1, 10)).toMatchObject({ rows: [], page: 1, pages: 1, total: 0, start: 0, end: 0 });
    expect(pageSlice(undefined, 1, 10)).toMatchObject({ total: 0, start: 0 });
  });

  it("the same figures for a list the server pages", () => {
    expect(pageFigures({ page: 2, size: 20, total: 45 })).toEqual({ page: 2, pages: 3, total: 45, size: 20, start: 21, end: 40 });
    expect(pageFigures({ page: 3, size: 20, total: 45 })).toMatchObject({ start: 41, end: 45 });
    expect(pageFigures({ page: 9, size: 20, total: 45 })).toMatchObject({ page: 3 });
    expect(pageFigures({ page: 1, size: 20, total: 0 })).toMatchObject({ start: 0, end: 0, pages: 1 });
  });
});

describe("the page buttons", () => {
  it("shows every page of a short list", () => {
    expect(pageButtons(1, 1)).toEqual([1]);
    expect(pageButtons(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the first, the last and a window around the current page, with ... where pages are left out", () => {
    expect(pageButtons(1, 20)).toEqual([1, 2, 3, "...", 20]);
    expect(pageButtons(7, 20)).toEqual([1, "...", 5, 6, 7, 8, 9, "...", 20]);
    expect(pageButtons(20, 20)).toEqual([1, "...", 18, 19, 20]);
  });

  it("never hides a single page behind ...", () => {
    expect(pageButtons(4, 20)).toEqual([1, 2, 3, 4, 5, 6, "...", 20]);
    expect(pageButtons(17, 20)).toEqual([1, "...", 15, 16, 17, 18, 19, 20]);
  });
});

describe("the words", () => {
  it("says which rows are shown out of how many", () => {
    expect(showingText({ start: 11, end: 20, total: 134 }, "orders")).toBe("Showing 11 to 20 of 134 orders");
    expect(showingText({ start: 1, end: 1, total: 1 }, "orders")).toBe("Showing 1 to 1 of 1 order");
    expect(showingText({ start: 0, end: 0, total: 0 }, "orders")).toBe("No orders");
    expect(showingText({ start: 1, end: 3, total: 3 }, "sales returns", "sales return")).toBe("Showing 1 to 3 of 3 sales returns");
  });
});
