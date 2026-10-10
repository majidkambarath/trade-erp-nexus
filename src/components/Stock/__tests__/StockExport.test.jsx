import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, configure } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The item export is built by the shared CSV writer: a name with a quote or a comma stays in its cell, and a cell that would run as a
// spreadsheet formula is neutralised. (It was hand-built: a name with a quote broke the row, and "=HYPERLINK(...)" was a formula.)
const m = vi.hoisted(() => ({ get: vi.fn(), status: vi.fn(), postable: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { postableAccounts: m.postable }, ApiError: class extends Error {} }));
vi.mock("react-barcode", () => ({ default: () => null }));

import { OrganisationProvider, useOrganisation } from "../../shell/OrganisationContext";
import { clearPageSessions } from "../../../lib/pageSession";
import StockManagement from "../StockManagement";

configure({ asyncUtilTimeout: 8000 });

const item = (n, extra) => ({ _id: `s${n}`, itemId: `ITM${n}`, sku: `SK${n}`, itemName: `Item ${n}`, itemType: "goods", unitOfMeasure: "u-kg", currentStock: 5, reorderLevel: 1, purchasePrice: 10, salesPrice: 12, status: "Active", ...extra });

function GrantsKnown() {
  const { me } = useOrganisation();
  return me ? <span data-testid="grants-known" /> : null;
}

let captured;
let click;

beforeEach(() => {
  vi.clearAllMocks();
  clearPageSessions();
  captured = null;
  m.status.mockResolvedValue({
    organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: {},
    me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants: ["inventory.view", "lookups.view"] },
  });
  m.postable.mockResolvedValue([]);
  const stocks = [
    item(1, { itemName: 'Rice "Premium", 5kg', brand: "Royal, Gold" }),
    item(2, { itemName: '=HYPERLINK("http://evil.example","click")' }),
    item(3, { itemName: "Olive oil" }),
  ];
  m.get.mockImplementation((url) => {
    const data = { "/stock/stock": { stocks }, "/categories/categories": { categories: [] }, "/vendors/vendors": [], "/uom/units": [{ _id: "u-kg", unitName: "Kg" }] }[url];
    return Promise.resolve({ data: { data: data ?? {} } });
  });
  // the file the person would be given
  globalThis.URL.createObjectURL = vi.fn((blob) => { captured = blob; return "blob:test"; });
  globalThis.URL.revokeObjectURL = vi.fn();
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => click.mockRestore());

const read = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = reject;
  r.readAsText(blob);
});

describe("exporting the stock list", () => {
  it("keeps a quote or comma inside its cell and defuses a formula", async () => {
    render(<MemoryRouter><OrganisationProvider><GrantsKnown /><StockManagement /></OrganisationProvider></MemoryRouter>);
    await screen.findByTestId("grants-known");
    await screen.findByText(/3 total items/);

    fireEvent.click(screen.getByRole("button", { name: "Export to CSV" }));
    await waitFor(() => expect(captured).not.toBeNull());
    const text = (await read(captured)).replace(/^\uFEFF/, "");
    const lines = text.split("\r\n");

    expect(lines[0].split(",")[0]).toBe("ItemID");
    expect(lines).toHaveLength(4); // the header and three items: no row was split
    // the quote is doubled and the cell quoted; the comma in the brand stays in the brand
    expect(text).toContain('"Rice ""Premium"", 5kg"');
    expect(text).toContain('"Royal, Gold"');
    // the formula is text now, never a formula
    expect(text).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(text).not.toMatch(/(^|,)"?=HYPERLINK/m);
  });
});
