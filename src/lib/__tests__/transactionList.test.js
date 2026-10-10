import { describe, it, expect, vi } from "vitest";
import { MAX_PAGES, SERVER_PAGE, dateParams, fetchAllTransactions } from "../transactionList";
import { resolveListPeriod } from "../listPeriod";

// Reading a whole list from a server that pages at 200 and filters returns on a date nothing writes.

const MONTH = resolveListPeriod({}, "2026-10-10");
const doc = (n) => ({ _id: `d${n}`, transactionNo: `SO-${n}` });
const docs = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => doc(from + i));

// a fake server over `all`: honours page / limit and reports a pagination block
const server = (all) => ({
  get: vi.fn(async (_url, { params }) => {
    const limit = params.limit;
    const page = params.page;
    return { data: { data: all.slice((page - 1) * limit, page * limit), pagination: { current: page, pages: Math.ceil(all.length / limit), total: all.length, limit } } };
  }),
});

describe("the date filter it asks for", () => {
  it("is a CUSTOM range a day wider each side, because the browser's own day test is the exact one", () => {
    expect(dateParams(MONTH)).toEqual({ dateFilter: "CUSTOM", startDate: "2026-09-30T00:00:00.000Z", endDate: "2026-11-01T23:59:59.999Z" });
    expect(dateParams(MONTH, { slack: 0 })).toEqual({ dateFilter: "CUSTOM", startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T23:59:59.999Z" });
  });

  it("sends nothing for all time, and gives an open end a far one (the server insists on both)", () => {
    expect(dateParams(resolveListPeriod({ preset: "all" }, "2026-10-10"))).toEqual({});
    const from = dateParams(resolveListPeriod({ preset: "custom", from: "2026-03-05" }, "2026-10-10"));
    expect(from.startDate).toBe("2026-03-04T00:00:00.000Z");
    expect(from.endDate).toMatch(/^2100-/);
    const until = dateParams(resolveListPeriod({ preset: "custom", to: "2026-03-05" }, "2026-10-10"));
    expect(until.startDate).toMatch(/^1970-/);
  });
});

describe("reading every page", () => {
  it("a list that fits in one page is one request, and says nothing is missing", async () => {
    const http = server(docs(1, 30));
    const r = await fetchAllTransactions(http, { type: "sales_order", period: MONTH });
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get.mock.calls[0][1].params).toMatchObject({ type: "sales_order", page: 1, limit: SERVER_PAGE, dateFilter: "CUSTOM" });
    expect(r.rows).toHaveLength(30);
    expect(r).toMatchObject({ total: 30, truncated: false, previousTotal: null });
  });

  it("hundreds of documents are read in pages of 200, in order, with none lost or repeated", async () => {
    const all = docs(1, 530);
    const http = server(all);
    const r = await fetchAllTransactions(http, { type: "sales_order", period: MONTH });
    expect(http.get).toHaveBeenCalledTimes(3);
    expect(r.rows).toHaveLength(530);
    expect(r.rows.map((x) => x._id)).toEqual(all.map((x) => x._id));
    expect(r.truncated).toBe(false);
  });

  it("a document that moves across a page boundary while paging is not listed twice", async () => {
    const page1 = docs(1, 200);
    const page2 = [doc(200), ...docs(201, 250)]; // d200 was pushed onto page 2
    const http = {
      get: vi.fn(async (_u, { params }) => ({ data: { data: params.page === 1 ? page1 : page2, pagination: { pages: 2, total: 251 } } })),
    };
    const r = await fetchAllTransactions(http, { type: "sales_order", period: MONTH });
    expect(r.rows).toHaveLength(250);
    expect(new Set(r.rows.map((x) => x._id)).size).toBe(250);
  });

  it("stops at the cap and says the list is not whole", async () => {
    const all = docs(1, 200 * (MAX_PAGES + 2));
    const http = server(all);
    const r = await fetchAllTransactions(http, { type: "sales_order", period: MONTH });
    expect(http.get).toHaveBeenCalledTimes(MAX_PAGES);
    expect(r.rows).toHaveLength(200 * MAX_PAGES);
    expect(r).toMatchObject({ truncated: true, total: all.length });
  });

  it("a reply with no pagination block (an older server, a test double) is taken as the whole list", async () => {
    const http = { get: vi.fn(async () => ({ data: { data: docs(1, 3) } })) };
    const r = await fetchAllTransactions(http, { type: "sales_order", period: MONTH });
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ total: 3, truncated: false });
  });

  it("an empty reply ends the loop", async () => {
    const http = { get: vi.fn(async () => ({ data: { data: [], pagination: { pages: 9, total: 0 } } })) };
    const r = await fetchAllTransactions(http, { type: "sales_order", period: MONTH });
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(r.rows).toEqual([]);
  });
});

describe("returns are read without dates", () => {
  it("sends no date filter at all, so the server's returnDate (never written) cannot empty the list", async () => {
    const http = server(docs(1, 5));
    await fetchAllTransactions(http, { type: "sales_return", period: MONTH, serverDates: false });
    const params = http.get.mock.calls[0][1].params;
    expect(params).not.toHaveProperty("dateFilter");
    expect(params).not.toHaveProperty("startDate");
    expect(params).toMatchObject({ type: "sales_return", page: 1 });
  });
});

describe("how many documents the previous period holds", () => {
  it("is one request for a count, exact days, learned from the server's own total", async () => {
    const http = {
      get: vi.fn(async (_u, { params }) => ({ data: { data: params.limit === 1 ? [doc(1)] : docs(1, 4), pagination: { pages: 1, total: params.limit === 1 ? 37 : 4 } } })),
    };
    const r = await fetchAllTransactions(http, { type: "sales_order", period: MONTH, compare: { from: "2026-09-01", to: "2026-09-30" } });
    expect(r.previousTotal).toBe(37);
    const second = http.get.mock.calls[1][1].params;
    expect(second).toMatchObject({ limit: 1, startDate: "2026-09-01T00:00:00.000Z", endDate: "2026-09-30T23:59:59.999Z" });
  });

  it("is unknown (null) when the server gives no total, and is not asked for returns", async () => {
    const plain = { get: vi.fn(async () => ({ data: { data: docs(1, 2) } })) };
    expect((await fetchAllTransactions(plain, { type: "sales_order", period: MONTH, compare: { from: "2026-09-01", to: "2026-09-30" } })).previousTotal).toBeNull();
    const http = server(docs(1, 2));
    await fetchAllTransactions(http, { type: "sales_return", period: MONTH, serverDates: false, compare: { from: "2026-09-01", to: "2026-09-30" } });
    expect(http.get).toHaveBeenCalledTimes(1);
  });
});
