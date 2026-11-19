import { describe, it, expect, vi } from "vitest";
import { dateParams, fetchPeriodCount, fetchTransactionPage, fetchTransactionSummary, listParams, serverSortKey } from "../transactionList";
import { resolveListPeriod } from "../listPeriod";

// One page of a list from a server that filters, sorts, pages and counts.

const MONTH = resolveListPeriod({}, "2026-10-10");

describe("the date filter it asks for", () => {
  it("is exactly the period's whole days, both ends included", () => {
    expect(dateParams(MONTH)).toEqual({ dateFilter: "CUSTOM", startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T23:59:59.999Z" });
    expect(dateParams(MONTH, { slack: 1 })).toEqual({ dateFilter: "CUSTOM", startDate: "2026-09-30T00:00:00.000Z", endDate: "2026-11-01T23:59:59.999Z" });
  });

  it("sends nothing for all time, and gives an open end a far one (the server insists on both)", () => {
    expect(dateParams(resolveListPeriod({ preset: "all" }, "2026-10-10"))).toEqual({});
    const from = dateParams(resolveListPeriod({ preset: "custom", from: "2026-03-05" }, "2026-10-10"));
    expect(from.startDate).toBe("2026-03-05T00:00:00.000Z");
    expect(from.endDate).toMatch(/^2100-/);
    const until = dateParams(resolveListPeriod({ preset: "custom", to: "2026-03-05" }, "2026-10-10"));
    expect(until.startDate).toMatch(/^1970-/);
  });
});

describe("the query of a page", () => {
  it("carries the period, the page and its size, and only the filters that are set", () => {
    const q = listParams({ type: "sales_order", period: MONTH, page: 3, limit: 50 });
    expect(q).toMatchObject({ type: "sales_order", page: 3, limit: 50, dateFilter: "CUSTOM" });
    for (const k of ["search", "status", "payment", "partyId", "sort", "order"]) expect(q).not.toHaveProperty(k);
  });

  it("turns the payment choices into the payment filter and leaves a document status alone", () => {
    expect(listParams({ status: "PAY:PARTIAL" })).toMatchObject({ payment: "PARTIAL" });
    expect(listParams({ status: "PAY:PARTIAL" })).not.toHaveProperty("status");
    expect(listParams({ status: "APPROVED" })).toMatchObject({ status: "APPROVED" });
    expect(listParams({ status: "ALL", partyId: "ALL" })).not.toHaveProperty("status");
  });

  it("trims the search, names the party and maps the column headers to the server's sort keys", () => {
    expect(listParams({ search: "  acme ", partyId: "p1", sort: "customer", order: "asc" })).toMatchObject({ search: "acme", partyId: "p1", sort: "party", order: "asc" });
    expect(listParams({ sort: "id", order: "desc" })).toMatchObject({ sort: "number", order: "desc" });
    expect(serverSortKey("amount")).toBe("amount");
    expect(serverSortKey("vendor")).toBe("party");
    expect(serverSortKey("anything else")).toBe("number");
  });

  it("never asks for more than the server returns", () => {
    expect(listParams({ limit: 5000 }).limit).toBe(200);
    expect(listParams({ limit: 0 }).limit).toBe(25);
  });
});

describe("reading", () => {
  it("a page is its rows and the server's own count", async () => {
    const http = { get: vi.fn(async () => ({ data: { data: [{ _id: "a" }, { _id: "b" }], pagination: { total: 530, pages: 266 } } })) };
    const r = await fetchTransactionPage(http, { type: "sales_order", period: MONTH, limit: 2 });
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get.mock.calls[0][0]).toBe("/transactions/transactions");
    expect(r).toEqual({ rows: [{ _id: "a" }, { _id: "b" }], total: 530, pages: 266 });
  });

  it("a reply with no pagination block is taken as the whole list", async () => {
    const r = await fetchTransactionPage({ get: async () => ({ data: { data: [{ _id: "a" }] } }) }, {});
    expect(r).toMatchObject({ total: 1, pages: 1 });
    expect(await fetchTransactionPage({ get: async () => ({ data: {} }) }, {})).toMatchObject({ rows: [], total: 0 });
  });

  it("the cards come from the summary route, for the period only", async () => {
    const http = { get: vi.fn(async () => ({ data: { data: { count: 7, paid: 2 } } })) };
    expect(await fetchTransactionSummary(http, { type: "sales_order", period: MONTH })).toEqual({ count: 7, paid: 2 });
    expect(http.get.mock.calls[0][0]).toBe("/transactions/transactions/summary");
    expect(http.get.mock.calls[0][1].params).toEqual({ type: "sales_order", ...dateParams(MONTH) });
    expect(await fetchTransactionSummary({ get: async () => ({ data: {} }) }, {})).toBeNull();
  });

  it("the earlier period's size is one row asked for and the total read; unknown (null) when it cannot be learned", async () => {
    const http = { get: vi.fn(async () => ({ data: { data: [], pagination: { total: 41 } } })) };
    expect(await fetchPeriodCount(http, { type: "sales_order", period: MONTH })).toBe(41);
    expect(http.get.mock.calls[0][1].params).toMatchObject({ page: 1, limit: 1 });
    expect(await fetchPeriodCount({ get: async () => ({ data: {} }) }, { period: MONTH })).toBeNull();
    expect(await fetchPeriodCount({ get: async () => { throw new Error("down"); } }, { period: MONTH })).toBeNull();
  });
});
