import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, configure } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// A real book holds records that are not perfectly filled in: sku and itemName are required on the
// model today, but findOneAndUpdate skips validators and rows written before they were required still
// exist. One such row used to take the WHOLE PAGE down - "Cannot read properties of undefined (reading
// 'localeCompare')" on the page error screen - because the next-SKU sort and the search box both read
// those fields straight. Neither is a figure anybody is owed: a record missing a field simply does not
// match, and an item with no SKU is not the one to count up from.
const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), status: vi.fn(), postable: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get, post: m.post, put: m.put, delete: vi.fn() } }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { postableAccounts: m.postable }, ApiError: class extends Error {} }));

import { OrganisationProvider, useOrganisation } from "../../shell/OrganisationContext";
import { clearPageSessions } from "../../../lib/pageSession";
import StockManagement from "../StockManagement";

configure({ asyncUtilTimeout: 8000 });

const CATEGORY = { _id: "cat1", name: "General", status: "Active" };
const base = { category: CATEGORY, unitOfMeasure: "u-kg", status: "Active", currentStock: 1, reorderLevel: 0, purchasePrice: 1, salesPrice: 2, itemType: "goods" };
const RICE = { ...base, _id: "s1", itemId: "ITM1", sku: "GE0001", itemName: "Basmati" };
const FLOUR = { ...base, _id: "s2", itemId: "ITM2", sku: "GE0002", itemName: "Flour" };
// the row that used to blank the screen: saved before SKU was required, so it has none at all
const NO_SKU = { ...base, _id: "s3", itemId: "ITM3", itemName: "Legacy tin" };
const NO_NAME = { ...base, _id: "s4", itemId: "ITM4", sku: "GE0004" };

const statusFor = (grants) => ({
  organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: {},
  me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants },
});
function GrantsKnown() {
  const { me } = useOrganisation();
  return me ? <span data-testid="grants-known" /> : null;
}
const show = async (stocks) => {
  m.get.mockImplementation((url) => {
    const data = {
      "/stock/stock": { stocks },
      "/categories/categories": { categories: [CATEGORY] },
      "/vendors/vendors": [],
      "/uom/units": [{ _id: "u-kg", unitName: "Kg" }],
    }[url];
    return Promise.resolve({ data: { data: data ?? {} } });
  });
  m.status.mockImplementation(() => Promise.resolve(statusFor(["inventory.view", "inventory.create", "inventory.edit", "lookups.view"])));
  render(<MemoryRouter><OrganisationProvider><GrantsKnown /><StockManagement /></OrganisationProvider></MemoryRouter>);
  await screen.findByTestId("grants-known");
  await screen.findByText("BASMATI");
};

beforeEach(() => {
  vi.clearAllMocks();
  clearPageSessions();
  m.postable.mockResolvedValue([]);
  m.post.mockResolvedValue({ data: { data: { stock: {} } } });
  m.put.mockResolvedValue({ data: { data: { stock: {} } } });
});

describe("an item that is missing a field other items have", () => {
  it("searching does not blank the screen when an item has no SKU or no name", async () => {
    await show([RICE, FLOUR, NO_SKU, NO_NAME]);
    // one character used to be enough: item.sku.toLowerCase() threw on the row that had none
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "basmati" } });
    expect(screen.getByText("BASMATI")).toBeInTheDocument();
    expect(screen.queryByText("FLOUR")).not.toBeInTheDocument();
    // the incomplete rows are simply not matches - they are not an error
    expect(screen.queryByText("LEGACY TIN")).not.toBeInTheDocument();
  });

  it("finds a record by a field it does have, while another record is missing that field", async () => {
    await show([RICE, FLOUR, NO_SKU, NO_NAME]);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "ge0002" } });
    expect(screen.getByText("FLOUR")).toBeInTheDocument();
    expect(screen.queryByText("BASMATI")).not.toBeInTheDocument();
  });

  it("works out the next SKU although an item in that category has none", async () => {
    await show([RICE, FLOUR, NO_SKU]);
    fireEvent.click(screen.getByRole("button", { name: /add stock item/i }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("combobox", { name: "Category" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown", keyCode: 40 });
    // the menu is portalled to document.body, outside the dialog's own subtree
    fireEvent.click(await screen.findByRole("option", { name: "General" }));
    // GE0002 is the highest SKU in the category; the item with none is not the one to count up from
    const sku = dialog.querySelector('input[name="sku"]');
    expect(sku).toHaveValue("GE0003");
  });
});
