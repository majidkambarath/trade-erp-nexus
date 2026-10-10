import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The stock movement list: it opens on this calendar month and says so, includes the whole of its last day, and has real
// pages (it used to show "1 to 10 of 10" and only ever the first five page buttons). Its figures are signed by direction, a
// row names the person (never their account id), a date is a day (never "04:00"), and the search and choices are still there
// when the person comes back to the page.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: api }));

import InventoryManagement from "../InventoryManagement";
import { todayInput, formatDate, formatCurrencyAED } from "../../../utils/format";
import { lastDayOf } from "../../../lib/calendarDays";
import { clearPageSessions } from "../../../lib/pageSession";

const month = todayInput().slice(0, 7);
// the currency formatter writes a non-breaking space; the DOM text is compared with ordinary ones
const money = (n) => formatCurrencyAED(n).replace(/\s+/g, " ");
const ACCOUNT_ID = "6aca1d9b5caae294d2bad5cf";
const movement = (n, extra = {}) => ({ _id: `m${n}`, stockId: `ITM-${n}`, itemName: `Rice ${n}`, quantity: 5, previousStock: 0, newStock: 5, eventType: "PURCHASE_RECEIVE", referenceNumber: `REF-${n}`, unitCost: 2, totalValue: 10, location: "MAIN", date: `${month}-01T00:00:00.000Z`, createdBy: ACCOUNT_ID, createdByName: "Mariam Haddad", ...extra });
let all = [];
let stats;
const calls = () => api.get.mock.calls.filter((c) => c[0] === "/inventory/inventory").map((c) => c[1].params);
const last = () => calls()[calls().length - 1];

beforeEach(() => {
  api.get.mockReset();
  clearPageSessions();
  all = Array.from({ length: 60 }, (_, i) => movement(i + 1));
  stats = { totalMovements: 60, stockIn: 1, stockOut: 0, valueIn: 10, valueOut: 0, totalValue: 10, recentMovements: 1 };
  api.get.mockImplementation(async (url, cfg) => {
    if (url === "/inventory/inventory") {
      const { page, limit } = cfg.params;
      return { data: { data: { movements: all.slice((page - 1) * limit, page * limit) }, total: all.length, totalPages: Math.ceil(all.length / limit) } };
    }
    if (url === "/inventory/inventory/stats") return { data: { data: { stats } } };
    return { data: { data: { stocks: [] } } };
  });
});

const show = () => render(<MemoryRouter><InventoryManagement /></MemoryRouter>);

describe("the stock movement list", () => {
  it("opens on this calendar month, to the very end of its last day, and says so under the title", async () => {
    show();
    await screen.findByText("REF-1");
    expect(calls()[0]).toMatchObject({ startDate: `${month}-01`, endDate: `${lastDayOf(month)}T23:59:59.999Z`, page: 1, limit: 25 });
    expect(document.body).toHaveTextContent("60 movements");
    expect(document.body).toHaveTextContent("This month");
    expect(document.body).toHaveTextContent(`${formatDate(`${month}-01`)} – ${formatDate(lastDayOf(month))}`);
  });

  it("the Period control widens it to all time, and back to this month", async () => {
    show();
    await screen.findByText("REF-1");
    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "all" } });
    await waitFor(() => expect(last().startDate).toBeUndefined());
    expect(last().endDate).toBeUndefined();
    expect(document.body).toHaveTextContent("All time");
    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "month" } });
    await waitFor(() => expect(last().startDate).toBe(`${month}-01`));
  });

  it("says which rows are shown out of how many, and can reach any page, not only the first five", async () => {
    all = Array.from({ length: 400 }, (_, i) => movement(i + 1)); // 16 pages of 25
    show();
    await screen.findByText("REF-1");
    expect(screen.getByText("Showing 1 to 25 of 400 movements")).toBeInTheDocument();
    const pager = screen.getByRole("navigation", { name: "Pages" });
    fireEvent.click(within(pager).getByRole("button", { name: "Page 16" }));
    await screen.findByText("REF-376");
    expect(screen.getByText("Showing 376 to 400 of 400 movements")).toBeInTheDocument();
    expect(last().page).toBe(16);
  });

  it("a page size goes back to the first page", async () => {
    show();
    await screen.findByText("REF-1");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: "Next" }));
    await screen.findByText("REF-26");
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), { target: { value: "50" } });
    await waitFor(() => expect(last()).toMatchObject({ page: 1, limit: 50 }));
    expect(await screen.findByText("Showing 1 to 50 of 60 movements")).toBeInTheDocument();
  });
});

describe("what a row says", () => {
  it("names the person, never their account id", async () => {
    all = [movement(1), movement(2, { createdByName: null })];
    show();
    await screen.findByText("REF-1");
    expect(screen.getAllByText("Mariam Haddad").length).toBeGreaterThan(0);
    expect(screen.getByText("Unknown user")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(ACCOUNT_ID);
  });

  it("shows a movement's date as a day, with no time of day", async () => {
    show();
    await screen.findByText("REF-1");
    expect(screen.getAllByText(formatDate(`${month}-01`)).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\b\d{2}:\d{2}\b/);
  });

  it("a stock-out is worth a minus and in red; a stock-in a plus and in green", async () => {
    // the stored cost is positive both ways: it is the quantity that gives the direction
    all = [movement(1, { quantity: 4, totalValue: 40 }), movement(2, { quantity: -3, totalValue: 30, eventType: "SALES_DISPATCH" })];
    show();
    await screen.findByText("REF-1");
    const rows = screen.getAllByRole("row");
    const inRow = rows.find((r) => r.textContent.includes("REF-1"));
    const outRow = rows.find((r) => r.textContent.includes("REF-2"));
    expect(inRow).toHaveTextContent(`+${money(40)}`);
    expect(outRow).toHaveTextContent(`−${money(30)}`);
    expect(outRow.textContent).not.toContain(`+${money(30)}`);
    expect(within(outRow).getByText(money(30)).className).toMatch(/status-danger/);
    expect(within(inRow).getByText(money(40)).className).toMatch(/status-success/);
  });

  it("the value card is the net value, with what came in and went out said under it", async () => {
    stats = { totalMovements: 4, stockIn: 2, stockOut: 2, valueIn: 1250.5, valueOut: 450, totalValue: 800.5, recentMovements: 0 };
    show();
    await screen.findByText("REF-1");
    const card = (await screen.findByText("Net Value")).closest("div").parentElement;
    await waitFor(() => expect(card).toHaveTextContent(money(800.5)));
    expect(card).toHaveTextContent(`In ${money(1250.5)}`);
    expect(card).toHaveTextContent(`Out ${money(450)}`);
  });
});

describe("the search and the choices are kept", () => {
  it("are still there after going to another page and coming back, and sent with the request", async () => {
    const first = show();
    await screen.findByText("REF-1");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search movements" }), { target: { value: "rice" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Event type" }), { target: { value: "SALES_DISPATCH" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "lastMonth" } });
    await waitFor(() => expect(last()).toMatchObject({ search: "rice", eventType: "SALES_DISPATCH" }));
    first.unmount();

    show();
    await screen.findByText("REF-1");
    expect(screen.getByRole("searchbox", { name: "Search movements" })).toHaveValue("rice");
    expect(screen.getByRole("combobox", { name: "Event type" })).toHaveValue("SALES_DISPATCH");
    expect(screen.getByRole("combobox", { name: "Period" })).toHaveValue("lastMonth");
    expect(calls()[calls().length - 1]).toMatchObject({ search: "rice", eventType: "SALES_DISPATCH" });
  });

  it("Clear filters empties the search and the two choices, and is offered only while one is set", async () => {
    show();
    await screen.findByText("REF-1");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Direction" }), { target: { value: "OUT" } });
    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(last().movementType).toBeUndefined());
    expect(screen.getByRole("combobox", { name: "Direction" })).toHaveValue("");
  });

  it("the filters are on the page without pressing anything first", async () => {
    show();
    await screen.findByText("REF-1");
    expect(screen.getByRole("searchbox", { name: "Search movements" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Event type" })).toBeVisible();
  });
});
