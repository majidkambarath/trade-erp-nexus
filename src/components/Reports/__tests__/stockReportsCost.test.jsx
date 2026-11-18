import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Stock reports about cost and margin are for inventory.viewCost: the server refuses them to anyone else (stockReportRoutes.js), so the page
// does not draw their tabs, and opens on one that is left.
const m = vi.hoisted(() => ({
  lookups: vi.fn(), valuation: vi.fn(), movement: vi.fn(), itemLedger: vi.fn(),
  salesAnalysis: vi.fn(), expiry: vi.fn(), slowMoving: vi.fn(), reorder: vi.fn(),
}));
const org = vi.hoisted(() => ({ cost: false }));
vi.mock("../../../lib/stockReportsApi", () => ({ stockReports: m }));
vi.mock("../../shell/OrganisationContext", () => ({
  useOrganisation: () => ({ featureOn: () => true, can: (k) => (k === "inventory.viewCost" ? org.cost : true), canAny: () => true }),
}));

import StockReports from "../StockReports";

const at = (url = "/") => render(<MemoryRouter initialEntries={[url]}><StockReports /></MemoryRouter>);
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.lookups.mockResolvedValue({ items: [], categories: [] });
  const side = { batches: 0, qty: 0 }; // (what the server sends once the cost fields are gone)
  m.expiry.mockResolvedValue({ withinDays: 30, asOn: "2026-10-04", rows: [], totals: { batches: 0, items: 0, qty: 0, expired: side, expiring: side } });
  m.slowMoving.mockResolvedValue({ rows: [], totals: {} });
  m.reorder.mockResolvedValue({ rows: [], totals: { items: 0, outOfStock: 0 } });
});

describe("stock reports and cost", () => {
  it("draws only the tabs that need no cost, and opens on the first of them", async () => {
    org.cost = false;
    at();
    const list = await screen.findByRole("tablist", { name: "Stock reports" });
    const names = [...list.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(names).toEqual(["Expiry", "Reorder"]); // slow stock is ranked by value at cost: a cost report
    expect(await screen.findByRole("tab", { name: "Expiry" })).toHaveAttribute("aria-selected", "true");
    expect(m.valuation).not.toHaveBeenCalled();
  });

  it("a link to a cost tab falls back to a tab that is drawn", async () => {
    org.cost = false;
    at("/?tab=valuation");
    expect(await screen.findByRole("tab", { name: "Expiry" })).toHaveAttribute("aria-selected", "true");
    expect(m.valuation).not.toHaveBeenCalled();
  });

  it("draws every tab for someone who holds the permission", async () => {
    org.cost = true;
    m.valuation.mockResolvedValue({ rows: [], totals: {}, groups: [] });
    at();
    const list = await screen.findByRole("tablist", { name: "Stock reports" });
    const names = [...list.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(names).toEqual(["Valuation", "Movement", "Item ledger", "Sales analysis", "Expiry", "Slow stock", "Reorder"]);
  });
});
