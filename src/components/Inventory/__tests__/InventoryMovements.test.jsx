import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The stock movement list: it opens on this calendar month and says so, includes the whole of its last day, and has real
// pages (it used to show "1 to 10 of 10" and only ever the first five page buttons).
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: api }));

import InventoryManagement from "../InventoryManagement";
import { todayInput, formatDateGB } from "../../../utils/format";
import { lastDayOf } from "../../../lib/calendarDays";

const month = todayInput().slice(0, 7);
const movement = (n) => ({ _id: `m${n}`, stockId: `ITM-${n}`, itemName: `Rice ${n}`, quantity: 5, eventType: "PURCHASE_RECEIVE", referenceNumber: `REF-${n}`, unitCost: 2, totalValue: 10, location: "MAIN", date: `${month}-01T00:00:00.000Z`, createdBy: "Boss" });
let all = [];
const calls = () => api.get.mock.calls.filter((c) => c[0] === "/inventory/inventory").map((c) => c[1].params);
const last = () => calls()[calls().length - 1];

beforeEach(() => {
  api.get.mockReset();
  all = Array.from({ length: 60 }, (_, i) => movement(i + 1));
  api.get.mockImplementation(async (url, cfg) => {
    if (url === "/inventory/inventory") {
      const { page, limit } = cfg.params;
      return { data: { data: { movements: all.slice((page - 1) * limit, page * limit) }, total: all.length, totalPages: Math.ceil(all.length / limit) } };
    }
    if (url === "/inventory/inventory/stats") return { data: { data: { stats: { totalMovements: all.length, stockIn: 1, stockOut: 0, totalValue: 10, recentMovements: 1 } } } };
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
    expect(document.body).toHaveTextContent(`${formatDateGB(`${month}-01`)} – ${formatDateGB(lastDayOf(month))}`);
  });

  it("'Show all time' drops the dates, and 'This month' brings them back", async () => {
    show();
    await screen.findByText("REF-1");
    fireEvent.click(screen.getByRole("button", { name: "Show all time" }));
    await waitFor(() => expect(last().startDate).toBe(""));
    expect(last().endDate).toBe("");
    expect(document.body).toHaveTextContent("All time");
    fireEvent.click(screen.getByRole("button", { name: "This month" }));
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
