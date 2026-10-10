import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, configure, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The item list's filter row and what the screen remembers: the search, the choices, the sort and a half-filled NEW item come back
// when the person goes to another page and returns. The screen used to carry its own SessionManager whose reads and writes all
// threw (`this` inside a module-level arrow function), so nothing was ever remembered; the filters also sat behind a toggle.
const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), status: vi.fn(), postable: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get, post: m.post, put: m.put, delete: vi.fn() } }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { postableAccounts: m.postable }, ApiError: class extends Error {} }));
// the barcode is drawn on a canvas, which jsdom does not have; it is not what these tests are about
vi.mock("react-barcode", () => ({ default: () => null }));

import { OrganisationProvider, useOrganisation } from "../../shell/OrganisationContext";
import { clearPageSessions } from "../../../lib/pageSession";
import StockManagement from "../StockManagement";

configure({ asyncUtilTimeout: 8000 });

const GENERAL = { _id: "cat1", name: "General", status: "Active" };
const OILS = { _id: "cat2", name: "Oils", status: "Active" };
const RICE = { _id: "s1", itemId: "ITM1", sku: "GE0001", itemName: "Basmati", itemType: "goods", category: GENERAL, vendorId: { _id: "v1", vendorName: "Gulf Foods" }, unitOfMeasure: "u-kg", currentStock: 4, reorderLevel: 10, purchasePrice: 10, salesPrice: 20, status: "Active", origin: "India", brand: "Royal" };
const OIL = { _id: "s3", itemId: "ITM3", sku: "OI0001", itemName: "Olive oil", itemType: "goods", category: OILS, vendorId: { _id: "v2", vendorName: "Delta Oils" }, unitOfMeasure: "u-kg", currentStock: 50, reorderLevel: 10, purchasePrice: 30, salesPrice: 45, status: "Inactive", origin: "Spain", brand: "Iberia" };
const SERVICE = { _id: "s2", itemId: "SRV1", sku: "GE0002", itemName: "Installation", itemType: "service", category: GENERAL, unitOfMeasure: "u-job", currentStock: 0, reorderLevel: 0, purchasePrice: 150, salesPrice: 400, status: "Active" };

const ALL_GRANTS = ["inventory.view", "inventory.create", "inventory.edit", "lookups.view"];
const statusFor = (grants) => ({
  organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: {},
  me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants },
});
function GrantsKnown() {
  const { me } = useOrganisation();
  return me ? <span data-testid="grants-known" /> : null;
}

let stocks;
// the header says how many items it holds once the list has loaded ("0 total items" before)
const loaded = (count) => screen.findByText(new RegExp(`${count} total items`));
const show = async ({ grants = ALL_GRANTS, count = stocks.length } = {}) => {
  m.status.mockImplementation(() => Promise.resolve(statusFor(grants)));
  const view = render(<MemoryRouter><OrganisationProvider><GrantsKnown /><StockManagement /></OrganisationProvider></MemoryRouter>);
  await screen.findByTestId("grants-known");
  if (count > 0) await loaded(count);
  return view;
};

beforeEach(() => {
  vi.clearAllMocks();
  clearPageSessions(); // what the screen keeps for the tab must not leak from one test into the next
  stocks = [RICE, OIL, SERVICE];
  m.postable.mockResolvedValue([]);
  m.post.mockResolvedValue({ data: { data: { stock: {} } } });
  m.put.mockResolvedValue({ data: { data: { stock: {} } } });
  m.get.mockImplementation((url) => {
    const data = {
      "/stock/stock": { stocks },
      "/categories/categories": { categories: [GENERAL, OILS] },
      "/vendors/vendors": [],
      "/uom/units": [{ _id: "u-kg", unitName: "Kg" }, { _id: "u-hour", unitName: "Hour" }],
    }[url];
    return Promise.resolve({ data: { data: data ?? {} } });
  });
});

const searchBox = () => screen.getByRole("searchbox", { name: "Search items" });
const clearButton = () => screen.queryByRole("button", { name: "Clear filters" });
// the category and vendor filters are typed-into lists: open one and pick an entry
const choose = async (name, option) => {
  const input = screen.getByRole("combobox", { name });
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown", keyCode: 40 });
  fireEvent.click(await screen.findByRole("option", { name: option }));
};
const shownIn = (label) => within(screen.getByText(label, { selector: "label" }).parentElement);
const rowNames = () => within(screen.getByRole("table", { name: "Stock items" })).getAllByRole("row").slice(1).map((r) => r.textContent);
// real time passing (the draft is kept two seconds after the last keystroke), inside act so the screen's timers are not flagged
const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe("the filter row", () => {
  it("is on the page without pressing anything first, and offers categories and vendors the list already holds", async () => {
    await show();
    expect(searchBox()).toBeVisible();
    for (const name of ["Category", "Vendor", "Status", "Item type", "Stock level"]) {
      expect(screen.getByRole("combobox", { name })).toBeVisible();
    }
    // no toggle to open them, and no clear button while nothing is set
    expect(screen.queryByTitle("Toggle filters")).not.toBeInTheDocument();
    expect(clearButton()).not.toBeInTheDocument();

    // the choices come from the items, so they are there although the item form was never opened (and nothing was fetched for them)
    const category = screen.getByRole("combobox", { name: "Category" });
    fireEvent.focus(category);
    fireEvent.keyDown(category, { key: "ArrowDown", keyCode: 40 });
    expect(await screen.findByRole("option", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Oils" })).toBeInTheDocument();
    expect(m.get).not.toHaveBeenCalledWith("/categories/categories");
    expect(m.get).not.toHaveBeenCalledWith("/vendors/vendors");
  });

  it("filters by every control, and a service is never low on stock", async () => {
    await show();
    fireEvent.change(searchBox(), { target: { value: "oil" } });
    expect(rowNames()).toHaveLength(1);
    expect(rowNames()[0]).toContain("OLIVE OIL");

    fireEvent.change(searchBox(), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "Inactive" } });
    expect(rowNames()).toHaveLength(1);
    expect(rowNames()[0]).toContain("OLIVE OIL");

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "" } });
    await choose("Vendor", "Gulf Foods");
    expect(rowNames()).toHaveLength(1);
    expect(rowNames()[0]).toContain("BASMATI");

    await choose("Category", "General");
    expect(rowNames()).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Stock level" }), { target: { value: "low" } });
    expect(rowNames()).toHaveLength(1); // Basmati: 4 <= 10
  });
});

describe("the search, the choices and the sort are kept", () => {
  it("are still there after going to another page and coming back", async () => {
    const first = await show();
    fireEvent.change(searchBox(), { target: { value: "oil" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "Inactive" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Item type" }), { target: { value: "goods" } });
    await choose("Vendor", "Delta Oils");
    fireEvent.click(screen.getByRole("button", { name: /Item Info/ }));
    expect(screen.getByRole("button", { name: /Item Info/ })).toHaveTextContent("↑");
    first.unmount();

    // another visit: the first render already has them (nothing flashes unfiltered)
    await show();
    expect(searchBox()).toHaveValue("oil");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("Inactive");
    expect(screen.getByRole("combobox", { name: "Item type" })).toHaveValue("goods");
    expect(shownIn("Vendor").getByText("Delta Oils")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Stock level" })).toHaveValue("");
    expect(rowNames()).toHaveLength(1);
    expect(rowNames()[0]).toContain("OLIVE OIL");
    expect(screen.getByRole("button", { name: /Item Info/ })).toHaveTextContent("↑");
    expect(clearButton()).toBeInTheDocument();
  });

  it("keeps the low-stock choice and shows a kept choice even when no item carries it any more", async () => {
    const first = await show();
    fireEvent.change(screen.getByRole("combobox", { name: "Stock level" }), { target: { value: "low" } });
    await choose("Category", "General");
    first.unmount();

    // the category's only items were deleted meanwhile: the filter still shows (and says) what it is filtering by
    stocks = [OIL];
    await show();
    expect(screen.getByRole("combobox", { name: "Stock level" })).toHaveValue("low");
    expect(shownIn("Category").getByText("General")).toBeInTheDocument();
    expect(await screen.findByText("No stock items match the search or filters")).toBeInTheDocument();
  });

  it("is emptied by clearPageSessions, which sign-out calls: the next person starts clean", async () => {
    const first = await show();
    fireEvent.change(searchBox(), { target: { value: "oil" } });
    first.unmount();
    clearPageSessions();
    await show();
    expect(searchBox()).toHaveValue("");
  });
});

describe("Clear filters", () => {
  it("is offered only while something is set, and empties the search and every choice", async () => {
    await show();
    expect(clearButton()).not.toBeInTheDocument();

    fireEvent.change(searchBox(), { target: { value: "oil" } });
    expect(clearButton()).toBeInTheDocument();
    fireEvent.change(searchBox(), { target: { value: "" } });
    expect(clearButton()).not.toBeInTheDocument();

    fireEvent.change(searchBox(), { target: { value: "bas" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "Active" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Item type" }), { target: { value: "goods" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Stock level" }), { target: { value: "low" } });
    await choose("Vendor", "Gulf Foods");
    await choose("Category", "General");
    expect(rowNames()).toHaveLength(1);

    fireEvent.click(clearButton());
    expect(searchBox()).toHaveValue("");
    for (const name of ["Status", "Item type", "Stock level"]) expect(screen.getByRole("combobox", { name })).toHaveValue("");
    expect(shownIn("Category").queryByText("General")).not.toBeInTheDocument();
    expect(shownIn("Vendor").queryByText("Gulf Foods")).not.toBeInTheDocument();
    expect(clearButton()).not.toBeInTheDocument();
    expect(rowNames()).toHaveLength(3);
  });
});

describe("the empty states", () => {
  it("say nothing matches when a search or filter is on, and offer the way back", async () => {
    await show();
    fireEvent.change(searchBox(), { target: { value: "zzz-no-such-item" } });
    expect(screen.getByText("No stock items match the search or filters")).toBeInTheDocument();
    expect(screen.queryByText("No stock items yet")).not.toBeInTheDocument();
    // not offered as "add your first item": there are items
    expect(screen.queryByRole("button", { name: /add first item/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(searchBox()).toHaveValue("");
    expect(rowNames()).toHaveLength(3);
  });

  it("say there are none yet when there are none, and offer Add only to a role that can create", async () => {
    stocks = [];
    const first = await show({ count: 0 });
    expect(await screen.findByText("No stock items yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add first item/i })).toBeInTheDocument();
    first.unmount();

    await show({ grants: ["inventory.view", "lookups.view"], count: 0 });
    expect(await screen.findByText("No stock items yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add first item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add stock item/i })).not.toBeInTheDocument();
  });
});

describe("a half-filled new item is kept", () => {
  const openAdd = () => fireEvent.click(screen.getByRole("button", { name: /add stock item/i }));
  const nameField = () => screen.getByPlaceholderText("Enter item name");
  const pick = async (selectText, optionText) => {
    fireEvent.click(await screen.findByText(selectText));
    fireEvent.click(await screen.findByText(optionText));
  };

  it("comes back after another page, and is gone once cancelled", async () => {
    const first = await show();
    openAdd();
    fireEvent.change(await screen.findByPlaceholderText("Enter item name"), { target: { value: "Flour" } });
    // it is kept two seconds after the person stops typing; the form says so
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument();
    first.unmount();

    const second = await show();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); // it waits behind the Add button, not open under them
    openAdd();
    expect(await screen.findByDisplayValue("Flour")).toBeInTheDocument();
    expect(screen.getByText(/Draft saved/)).toBeInTheDocument();

    // cancelling throws it away
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    second.unmount();

    await show();
    openAdd();
    expect(nameField()).toHaveValue("");
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
  }, 30000);

  it("is gone after a successful save", async () => {
    const first = await show();
    openAdd();
    await pick("Select category", "General");
    fireEvent.change(nameField(), { target: { value: "Flour" } });
    await pick(/Select unit/, "Kg");
    fireEvent.change(screen.getByPlaceholderText("Enter country of origin"), { target: { value: "UAE" } });
    fireEvent.change(screen.getByPlaceholderText("Enter brand name"), { target: { value: "Al Ain" } });
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    await waitFor(() => expect(m.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    first.unmount();

    await show();
    openAdd();
    expect(nameField()).toHaveValue("");
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
  }, 30000);

  it("an untouched form is not a draft: nothing is kept for one that was only opened", async () => {
    const first = await show();
    openAdd();
    await screen.findByRole("dialog");
    await wait(2300);
    // the status opens on "Active" and the type is set: neither is something the person typed
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
    first.unmount();

    await show();
    openAdd();
    expect(nameField()).toHaveValue("");
  }, 30000);

  it("keeps a SKU the person typed by hand instead of replacing it with the next automatic one", async () => {
    const first = await show();
    openAdd();
    await pick("Select category", "General");
    // choosing the category fills the SKU in automatically; switch to Manual and type our own
    await waitFor(() => expect(screen.getByPlaceholderText("Enter SKU code")).toHaveValue("GE0003"));
    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    fireEvent.change(screen.getByPlaceholderText("Enter SKU code"), { target: { value: "MY-SKU-1" } });
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument();
    first.unmount();

    await show();
    openAdd();
    // the category list is fetched as the form opens; once it is there the automatic rule would run if it were still on
    await within(await screen.findByRole("dialog")).findByText("General");
    expect(screen.getByPlaceholderText("Enter SKU code")).toHaveValue("MY-SKU-1");
    expect(screen.getByRole("button", { name: "Manual" })).toBeInTheDocument();
  }, 30000);

  it("an item being edited is not kept: it would come back as a NEW item carrying another item's SKU", async () => {
    const first = await show();
    const row = screen.getByText("BASMATI").closest("tr");
    fireEvent.click(within(row).getByTitle("Edit item"));
    fireEvent.change(await screen.findByDisplayValue("Basmati"), { target: { value: "Basmati XL" } });
    await wait(2300);
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
    first.unmount();

    await show();
    openAdd();
    expect(nameField()).toHaveValue("");
    expect(screen.getByPlaceholderText("Enter SKU code")).toHaveValue("");
  }, 30000);
});
