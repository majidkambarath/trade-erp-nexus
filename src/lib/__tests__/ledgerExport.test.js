import { describe, it, expect, vi } from "vitest";
import { DAY_BOOK_HEADERS, EXPORT_MAX_PAGES, EXPORT_PAGE, JOURNAL_HEADERS, dayBookRows, exportedText, fetchAllPages, journalRows } from "../ledgerExport";

// A server with `total` rows that pages like the day book: `limit` is capped, the page it used comes back.
const server = (total, { cap = 200, id = (i) => `v${i}` } = {}) => {
  const all = Array.from({ length: total }, (_, i) => ({ voucherId: id(i), voucherNo: `V-${i}` }));
  return vi.fn(async ({ page, limit }) => {
    const size = Math.min(limit, cap);
    return { total, page, limit: size, rows: all.slice((page - 1) * size, page * size) };
  });
};

describe("reading every page", () => {
  it("asks for the biggest page the server allows and walks them to the total", async () => {
    const fetchPage = server(1198);
    const { rows, total, truncated } = await fetchAllPages(fetchPage);
    expect(EXPORT_PAGE).toBe(200);
    expect(fetchPage.mock.calls.map(([p]) => p)).toEqual([1, 2, 3, 4, 5, 6].map((page) => ({ page, limit: 200 })));
    expect(rows).toHaveLength(1198);
    expect(total).toBe(1198);
    expect(truncated).toBe(false);
    expect(rows[0].voucherNo).toBe("V-0");
    expect(rows.at(-1).voucherNo).toBe("V-1197");
  });

  it("takes one request for a short list, and none beyond for an empty one", async () => {
    const few = server(7);
    expect((await fetchAllPages(few)).rows).toHaveLength(7);
    expect(few).toHaveBeenCalledTimes(1);

    const none = server(0);
    expect(await fetchAllPages(none)).toEqual({ rows: [], total: 0, truncated: false });
    expect(none).toHaveBeenCalledTimes(1);
  });

  it("counts pages by the size the server says it used, when it caps below what was asked", async () => {
    const fetchPage = server(230, { cap: 50 });
    const { rows } = await fetchAllPages(fetchPage);
    expect(rows).toHaveLength(230);
    expect(fetchPage).toHaveBeenCalledTimes(5);
  });

  it("keeps a row once when a voucher posted meanwhile moved it across a page boundary", async () => {
    const pages = [
      { total: 5, limit: 3, rows: [{ voucherId: "a" }, { voucherId: "b" }, { voucherId: "c" }] },
      { total: 5, limit: 3, rows: [{ voucherId: "c" }, { voucherId: "d" }, { voucherId: "e" }] },
    ];
    const { rows } = await fetchAllPages(async ({ page }) => pages[page - 1], { pageSize: 3 });
    expect(rows.map((r) => r.voucherId)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("stops at the hard limit and says the file holds only the newest", async () => {
    expect(EXPORT_MAX_PAGES).toBe(100);
    const fetchPage = server(1000);
    const { rows, total, truncated } = await fetchAllPages(fetchPage, { pageSize: 10, maxPages: 3 });
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(30);
    expect(total).toBe(1000);
    expect(truncated).toBe(true);
  });

  it("does not loop on a server that stops answering with rows", async () => {
    const fetchPage = vi.fn(async () => ({ total: 500, limit: 200, rows: [] }));
    const { rows, truncated } = await fetchAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([]);
    expect(truncated).toBe(false);
  });

  it("passes a failure on, so no half file is written", async () => {
    const fetchPage = vi.fn(async ({ page }) => {
      if (page === 2) throw new Error("Server busy");
      return { total: 400, limit: 200, rows: Array.from({ length: 200 }, (_, i) => ({ voucherId: `p${i}` })) };
    });
    await expect(fetchAllPages(fetchPage)).rejects.toThrow("Server busy");
  });

  it("reads a response with no rows or total as empty", async () => {
    expect(await fetchAllPages(async () => ({}))).toEqual({ rows: [], total: 0, truncated: false });
    expect(await fetchAllPages(async () => undefined)).toEqual({ rows: [], total: 0, truncated: false });
  });
});

describe("the rows of each file", () => {
  const day = (iso) => `<${iso.slice(0, 10)}>`;

  it("writes the day book one voucher a row", () => {
    expect(DAY_BOOK_HEADERS).toEqual(["Date", "Voucher", "Type", "Party", "Narration", "Amount"]);
    const rows = dayBookRows([{ date: "2026-10-04T08:00:00Z", voucherNo: "SO-1", typeLabel: "Sales invoice", party: "Al Noor", narration: "n", amount: 210 }], day);
    expect(rows).toEqual([["<2026-10-04>", "SO-1", "Sales invoice", "Al Noor", "n", 210]]);
  });

  it("writes the journals one line a row, the debit and credit as numbers", () => {
    expect(JOURNAL_HEADERS).toEqual(["Date", "Voucher", "Narration", "Account code", "Account", "Debit", "Credit"]);
    const rows = journalRows([
      { date: "2026-10-04T08:00:00Z", voucherNo: "JV-1", narration: "Accrual", lines: [{ accountCode: "OPEX0006", accountName: "Rent", debit: 10, credit: 0 }, { accountCode: "CASH0001", accountName: "Cash", debit: 0, credit: 10 }] },
      { date: "2026-10-05T08:00:00Z", voucherNo: "JV-2", narration: "", lines: undefined },
    ], day);
    expect(rows).toEqual([
      ["<2026-10-04>", "JV-1", "Accrual", "OPEX0006", "Rent", 10, 0],
      ["<2026-10-04>", "JV-1", "Accrual", "CASH0001", "Cash", 0, 10],
    ]);
  });
});

describe("what the toast says", () => {
  it("gives the count, with grouping and the right singular", () => {
    expect(exportedText({ written: 1198, total: 1198, truncated: false }, "voucher", "vouchers")).toBe("Exported 1,198 vouchers");
    expect(exportedText({ written: 1, total: 1, truncated: false }, "journal", "journals")).toBe("Exported 1 journal");
  });

  it("says when it is not all of them", () => {
    expect(exportedText({ written: 20000, total: 25310, truncated: true }, "voucher", "vouchers"))
      .toBe("Exported the newest 20,000 vouchers of 25,310. Narrow the dates to export the rest.");
  });
});
