import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, configure } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The item screen with services: the Goods / Service choice at the top of the form, what a service hides (quantity, reorder level,
// batch, expiry, barcode, origin, brand), the two accounts it may name, what it sends, and how the list and its figures treat it.
const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), status: vi.fn(), postable: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get, post: m.post, put: m.put, delete: vi.fn() } }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { postableAccounts: m.postable }, ApiError: class extends Error {} }));

import { OrganisationProvider, useOrganisation } from "../../shell/OrganisationContext";
import { clearPageSessions } from "../../../lib/pageSession";
import StockManagement from "../StockManagement";

configure({ asyncUtilTimeout: 8000 });

const CATEGORY = { _id: "cat1", name: "General", status: "Active" };
const RICE = { _id: "s1", itemId: "ITM1", sku: "GE0001", itemName: "Basmati", itemType: "goods", category: CATEGORY, unitOfMeasure: "u-kg", currentStock: 4, reorderLevel: 10, purchasePrice: 10, salesPrice: 20, status: "Active", origin: "India", brand: "Royal" };
const SERVICE = { _id: "s2", itemId: "SRV1", sku: "GE0002", itemName: "Installation", itemType: "service", category: CATEGORY, unitOfMeasure: "u-job", currentStock: 0, reorderLevel: 0, purchasePrice: 150, salesPrice: 400, status: "Active", incomeAccountId: "a-inc", expenseAccountId: null };
const ACCOUNTS = [
  { _id: "a-inc", accountCode: "4100", accountName: "Consulting Income", category: "INCOME", groupName: "Sales Income", path: "Sales Income" },
  { _id: "a-exp", accountCode: "5200", accountName: "Subcontractors", category: "EXPENSE", groupName: "Operating Expenses", path: "Operating Expenses" },
];

const statusFor = (grants) => ({
  organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: {},
  me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants },
});
function GrantsKnown() {
  const { me } = useOrganisation();
  return me ? <span data-testid="grants-known" /> : null;
}
const show = async (grants = ["inventory.view", "inventory.create", "inventory.edit", "lookups.view"]) => {
  m.status.mockImplementation(() => Promise.resolve(statusFor(grants)));
  render(<MemoryRouter><OrganisationProvider><GrantsKnown /><StockManagement /></OrganisationProvider></MemoryRouter>);
  await screen.findByTestId("grants-known");
  await screen.findByText("BASMATI");
};

beforeEach(() => {
  vi.clearAllMocks();
  clearPageSessions(); // what the screen keeps for the tab must not leak from one test into the next
  m.postable.mockResolvedValue(ACCOUNTS);
  m.post.mockResolvedValue({ data: { data: { stock: {} } } });
  m.put.mockResolvedValue({ data: { data: { stock: {} } } });
  m.get.mockImplementation((url) => {
    const data = {
      "/stock/stock": { stocks: [RICE, SERVICE] },
      "/categories/categories": { categories: [CATEGORY] },
      "/vendors/vendors": [],
      "/uom/units": [{ _id: "u-job", unitName: "Job" }, { _id: "u-hour", unitName: "Hour" }],
    }[url];
    return Promise.resolve({ data: { data: data ?? {} } });
  });
});

const openAddForm = async () => {
  fireEvent.click(screen.getByRole("button", { name: /add stock item/i }));
  return screen.findByRole("radiogroup", { name: "Item type" });
};
const pick = async (selectText, optionText) => {
  fireEvent.click(await screen.findByText(selectText));
  fireEvent.click(await screen.findByText(optionText));
};

describe("the item list", () => {
  it("shows a Service badge and no stock level for a service, and keeps it out of the low-stock count", async () => {
    await show();
    const table = screen.getByRole("table", { name: "Stock items" });
    const rows = within(table).getAllByRole("row").slice(1);
    const service = rows.find((r) => within(r).queryByText("INSTALLATION"));
    expect(within(service).getByText("Service")).toBeInTheDocument();
    expect(within(service).getByText("Not stocked")).toBeInTheDocument();
    expect(within(service).queryByText(/Reorder:/)).not.toBeInTheDocument();
    const goods = rows.find((r) => within(r).queryByText("BASMATI"));
    expect(within(goods).queryByText("Service")).not.toBeInTheDocument();
    expect(within(goods).getByText("Reorder: 10")).toBeInTheDocument();
    // one low-stock item (the rice, 4 <= 10): the service's 0 <= 0 is not counted
    const lowCard = screen.getByText("Low Stock Alert").closest("div");
    expect(within(lowCard.parentElement).getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/2 total items \(1 service\)/)).toBeInTheDocument();
  });

  it("filters to goods or to services", async () => {
    await show();
    // the filters are on the page already: nothing to open first
    const filter = screen.getByRole("combobox", { name: "Item type" });
    fireEvent.change(filter, { target: { value: "service" } });
    expect(screen.getByText("INSTALLATION")).toBeInTheDocument();
    expect(screen.queryByText("BASMATI")).not.toBeInTheDocument();
    fireEvent.change(filter, { target: { value: "goods" } });
    expect(screen.getByText("BASMATI")).toBeInTheDocument();
    expect(screen.queryByText("INSTALLATION")).not.toBeInTheDocument();
    // a service is never low on stock
    fireEvent.change(filter, { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Stock level" }), { target: { value: "low" } });
    expect(screen.getByText("BASMATI")).toBeInTheDocument();
    expect(screen.queryByText("INSTALLATION")).not.toBeInTheDocument();
  });
});

describe("the item form", () => {
  it("starts as goods, with every stock field", async () => {
    await show();
    const group = await openAddForm();
    expect(within(group).getByRole("radio", { name: /goods/i })).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: /service/i })).toHaveAttribute("aria-checked", "false");
    for (const placeholder of ["Enter current stock", "Enter reorder level", "Enter batch number", "Enter country of origin", "Enter brand name"]) {
      expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
    }
    expect(screen.queryByText("Accounts")).not.toBeInTheDocument();
  });

  it("a service hides quantity, reorder level, batch, expiry, barcode, origin and brand, and offers its two accounts", async () => {
    await show();
    const group = await openAddForm();
    fireEvent.click(within(group).getByRole("radio", { name: /service/i }));
    expect(within(group).getByRole("radio", { name: /service/i })).toHaveAttribute("aria-checked", "true");
    for (const placeholder of ["Enter current stock", "Enter reorder level", "Enter batch number", "Enter country of origin", "Enter brand name"]) {
      expect(screen.queryByPlaceholderText(placeholder)).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Expiry date")).not.toBeInTheDocument();
    expect(screen.queryByText("Barcode")).not.toBeInTheDocument();
    expect(screen.queryByText("Stock Information")).not.toBeInTheDocument();
    expect(screen.getByText("Add New Service")).toBeInTheDocument();
    expect(screen.getByLabelText("Income account")).toBeInTheDocument();
    expect(screen.getByLabelText("Expense account")).toBeInTheDocument();
    expect(screen.getByText(/Unit \(hour, job, month/)).toBeInTheDocument();
    // prices stay: a service has a sales price and a purchase price
    expect(screen.getByPlaceholderText("Enter sales price")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter purchase price")).toBeInTheDocument();

    // and back: the stock fields return
    fireEvent.click(within(group).getByRole("radio", { name: /goods/i }));
    expect(screen.getByPlaceholderText("Enter current stock")).toBeInTheDocument();
    expect(screen.queryByLabelText("Income account")).not.toBeInTheDocument();
  });

  it("creates a service: origin and brand are not asked, and no stock field is sent", async () => {
    await show();
    const group = await openAddForm();
    fireEvent.click(within(group).getByRole("radio", { name: /service/i }));
    await pick("Select category", "General");
    fireEvent.change(screen.getByPlaceholderText("Enter item name"), { target: { value: "Consulting" } });
    await pick(/Select unit/, "Hour");
    fireEvent.change(screen.getByPlaceholderText("Enter sales price"), { target: { value: "400" } });

    // the income account, chosen from the postable accounts of the right kind (an expense account is not offered)
    const income = screen.getByLabelText("Income account");
    fireEvent.focus(income);
    fireEvent.keyDown(income, { key: "ArrowDown", keyCode: 40 });
    expect(await screen.findByText("Consulting Income")).toBeInTheDocument();
    expect(screen.queryByText("Subcontractors")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Consulting Income"));

    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    await waitFor(() => expect(m.post).toHaveBeenCalledTimes(1));
    const [url, body] = m.post.mock.calls[0];
    expect(url).toBe("/stock/stock");
    expect(body).toMatchObject({ itemType: "service", itemName: "Consulting", categoryId: "cat1", unitOfMeasure: "u-hour", salesPrice: 400, purchasePrice: 0, incomeAccountId: "a-inc", expenseAccountId: null });
    for (const key of ["currentStock", "reorderLevel", "batchNumber", "expiryDate", "barcodeQrCode", "origin", "brand"]) expect(body).not.toHaveProperty(key);
  });

  it("goods still need origin and brand, and send exactly what they always did", async () => {
    await show();
    await openAddForm();
    await pick("Select category", "General");
    fireEvent.change(screen.getByPlaceholderText("Enter item name"), { target: { value: "Flour" } });
    await pick(/Select unit/, "Hour");
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    expect(await screen.findByText("Origin is required")).toBeInTheDocument();
    expect(screen.getByText("Brand is required")).toBeInTheDocument();
    expect(m.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("Enter country of origin"), { target: { value: "UAE" } });
    fireEvent.change(screen.getByPlaceholderText("Enter brand name"), { target: { value: "Al Ain" } });
    fireEvent.change(screen.getByPlaceholderText("Enter current stock"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    await waitFor(() => expect(m.post).toHaveBeenCalledTimes(1));
    expect(m.post.mock.calls[0][1]).toMatchObject({ itemType: "goods", itemName: "Flour", currentStock: 12, reorderLevel: 0, origin: "UAE", brand: "Al Ain" });
    expect(m.post.mock.calls[0][1]).not.toHaveProperty("incomeAccountId");
  });

  it("opens a saved service as a service, with its account", async () => {
    await show();
    const row = screen.getByText("INSTALLATION").closest("tr");
    fireEvent.click(within(row).getByTitle("Edit item"));
    const group = await screen.findByRole("radiogroup", { name: "Item type" });
    expect(within(group).getByRole("radio", { name: /service/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Edit Service")).toBeInTheDocument();
    expect(await screen.findByText("Consulting Income")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter current stock")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /update item/i }));
    await waitFor(() => expect(m.put).toHaveBeenCalledTimes(1));
    expect(m.put.mock.calls[0][0]).toBe("/stock/stock/s2");
    expect(m.put.mock.calls[0][1]).toMatchObject({ itemType: "service", incomeAccountId: "a-inc", expenseAccountId: null });
    expect(m.put.mock.calls[0][1]).not.toHaveProperty("currentStock");
  });
});
