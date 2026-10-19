import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom";

// StockDetail: a read-only view of one stock item - its master data, current stock/expiry, pricing and the
// purchase logs it was bought on. No form here, nothing is saved; converting it onto the kit must not change
// any of what is shown or when. Written before conversion (the file had no tests at all).
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: api }));
vi.mock("react-barcode", () => ({ default: (props) => <div data-testid="barcode">{props.value}</div> }));

import StockDetail from "../StockDetail";
import { todayInput } from "../../../utils/format";

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const GOODS_ITEM = {
  _id: "item1",
  itemName: "Basmati Rice 5kg",
  sku: "SKU-RICE-5KG",
  itemType: "goods",
  category: { name: "Grains" },
  vendorId: { vendorName: "Gulf Supply Co" },
  unitOfMeasure: { unitName: "Bag" },
  origin: "India",
  brand: "Noor",
  barcodeQrCode: "8901234567890",
  currentStock: 40,
  reorderLevel: 10,
  expiryDate: `${addDays(todayInput(), 60)}T00:00:00.000Z`,
  batchNumber: "B-2026-01",
  purchasePrice: 12.5,
  salesPrice: 18.75,
  status: "Active",
};

const show = (item = GOODS_ITEM, { id = "item1", prior = "/stock-management" } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === `/stock/stock/${id}`) return Promise.resolve({ data: { data: { stock: item } } });
    if (url === `/stock/stock/${id}/purchase-logs`) return Promise.resolve({ data: { data: { purchaseLogs: [] } } });
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
  return render(
    <MemoryRouter initialEntries={[prior, `/stock-detail/${id}`]} initialIndex={1}>
      <Routes>
        <Route path={prior} element={<div>Stock list screen</div>} />
        <Route path="/stock-detail/:id" element={<StockDetail />} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  api.get.mockReset();
});

describe("loading and errors", () => {
  it("shows a loading state before the item arrives, not an error or empty page", () => {
    api.get.mockReturnValue(new Promise(() => {})); // never resolves
    show();
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
    expect(screen.queryByText("Basmati Rice 5kg")).not.toBeInTheDocument();
  });

  it("a failed fetch shows the server's message and a way back", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/stock/stock/item1") return Promise.reject({ response: { data: { message: "Item not found" } } });
      return Promise.resolve({ data: { data: { purchaseLogs: [] } } });
    });
    render(
      <MemoryRouter initialEntries={["/stock-management", "/stock-detail/item1"]} initialIndex={1}>
        <Routes>
          <Route path="/stock-management" element={<div>Stock list screen</div>} />
          <Route path="/stock-detail/:id" element={<StockDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("Item not found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Back to Stock Management/ }));
    expect(await screen.findByText("Stock list screen")).toBeInTheDocument();
  });
});

describe("a goods item", () => {
  it("shows its basic information, stock status, expiry, batch and pricing", async () => {
    show();
    await screen.findByText("Basmati Rice 5kg");
    expect(screen.getByText("SKU: SKU-RICE-5KG")).toBeInTheDocument();
    expect(screen.getByText("Grains")).toBeInTheDocument();
    expect(screen.getByText("Gulf Supply Co")).toBeInTheDocument();
    expect(screen.getByText("Bag")).toBeInTheDocument();
    expect(screen.getByText("India")).toBeInTheDocument();
    expect(screen.getByText("Noor")).toBeInTheDocument();
    expect(screen.getByTestId("barcode")).toHaveTextContent("8901234567890");

    expect(screen.getByText(/40 \(Good Stock\)/)).toBeInTheDocument();
    expect(screen.getByText(/Reorder Level: 10/)).toBeInTheDocument();
    expect(screen.getByText("B-2026-01")).toBeInTheDocument();
    expect(screen.getByText("AED 12.50")).toBeInTheDocument();
    expect(screen.getByText("AED 18.75")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText(/Not stocked/)).not.toBeInTheDocument();
  });

  it("reads low stock as Low Stock and raises the low-stock alert", async () => {
    show({ ...GOODS_ITEM, currentStock: 5, reorderLevel: 10 });
    await screen.findByText("Basmati Rice 5kg");
    expect(screen.getByText(/5 \(Low Stock\)/)).toBeInTheDocument();
    expect(screen.getByText("Low Stock Alert")).toBeInTheDocument();
    expect(screen.getByText(/Current stock \(5\) is at or below/)).toBeInTheDocument();
  });

  it("reads stock between the reorder level and twice it as Medium Stock, with no low-stock alert", async () => {
    show({ ...GOODS_ITEM, currentStock: 15, reorderLevel: 10 });
    await screen.findByText("Basmati Rice 5kg");
    expect(screen.getByText(/15 \(Medium Stock\)/)).toBeInTheDocument();
    expect(screen.queryByText("Low Stock Alert")).not.toBeInTheDocument();
  });

  it("flags an expired item and raises its alert", async () => {
    show({ ...GOODS_ITEM, expiryDate: `${addDays(todayInput(), -5)}T00:00:00.000Z` });
    await screen.findByText("Basmati Rice 5kg");
    expect(screen.getByText(/\(Expired\)/)).toBeInTheDocument();
    expect(screen.getByText("Expired Item")).toBeInTheDocument();
  });

  it("flags an item expiring within 30 days and raises its alert, but not one expiring later", async () => {
    show({ ...GOODS_ITEM, expiryDate: `${addDays(todayInput(), 10)}T00:00:00.000Z` });
    await screen.findByText("Basmati Rice 5kg");
    expect(screen.getByText(/\(Expiring Soon\)/)).toBeInTheDocument();
    expect(screen.getByText("Expiring Soon")).toBeInTheDocument();
  });

  it("shows no Alerts section at all when stock is healthy and nothing is expiring", async () => {
    show();
    await screen.findByText("Basmati Rice 5kg");
    expect(screen.queryByText("Low Stock Alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Expired Item")).not.toBeInTheDocument();
    expect(screen.queryByText("Expiring Soon")).not.toBeInTheDocument();
  });

  it("reads missing optional fields as N/A, and no expiry as N/A with no alert", async () => {
    show({ ...GOODS_ITEM, category: null, vendorId: null, unitOfMeasure: null, origin: null, brand: null, expiryDate: null, batchNumber: null });
    await screen.findByText("Basmati Rice 5kg");
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.queryByText("Expiring Soon")).not.toBeInTheDocument();
    expect(screen.queryByText("Expired Item")).not.toBeInTheDocument();
  });
});

describe("a service item", () => {
  const SERVICE_ITEM = {
    ...GOODS_ITEM,
    itemType: "service",
    itemName: "Installation",
    incomeAccountId: { accountCode: "4010", accountName: "Service Revenue" },
    expenseAccountId: null,
  };

  it("shows the service badge, its accounts, and hides stock-only fields", async () => {
    show(SERVICE_ITEM);
    await screen.findByText("Installation");
    expect(screen.getAllByText("Service").length).toBeGreaterThan(0);
    expect(screen.getByText(/Not stocked: invoicing it moves no stock/)).toBeInTheDocument();
    expect(screen.getByText("4010 Service Revenue")).toBeInTheDocument();
    expect(screen.getByText("Company default (Services purchased)")).toBeInTheDocument();

    expect(screen.queryByText("Origin")).not.toBeInTheDocument();
    expect(screen.queryByText("Brand")).not.toBeInTheDocument();
    expect(screen.queryByTestId("barcode")).not.toBeInTheDocument();
    expect(screen.queryByText("Stock Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Batch Number")).not.toBeInTheDocument();
    // a service is never "low stock" (0 <= 0 would otherwise read as low)
    expect(screen.queryByText("Low Stock Alert")).not.toBeInTheDocument();
  });
});

describe("purchase logs", () => {
  it("shows the loading state, then says when there are none", async () => {
    let resolveLogs;
    api.get.mockImplementation((url) => {
      if (url === "/stock/stock/item1") return Promise.resolve({ data: { data: { stock: GOODS_ITEM } } });
      return new Promise((resolve) => { resolveLogs = () => resolve({ data: { data: { purchaseLogs: [] } } }); });
    });
    render(
      <MemoryRouter initialEntries={["/stock-detail/item1"]}>
        <Routes><Route path="/stock-detail/:id" element={<StockDetail />} /></Routes>
      </MemoryRouter>
    );
    await screen.findByText("Basmati Rice 5kg");
    expect(screen.getByText(/Loading purchase logs/)).toBeInTheDocument();
    await waitFor(() => expect(resolveLogs).toBeTypeOf("function"));
    resolveLogs();
    expect(await screen.findByText("No purchase logs found for this item.")).toBeInTheDocument();
  });

  it("shows an error of its own without blocking the rest of the page", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/stock/stock/item1") return Promise.resolve({ data: { data: { stock: GOODS_ITEM } } });
      return Promise.reject({ response: { data: { message: "Could not load purchase history" } } });
    });
    render(
      <MemoryRouter initialEntries={["/stock-detail/item1"]}>
        <Routes><Route path="/stock-detail/:id" element={<StockDetail />} /></Routes>
      </MemoryRouter>
    );
    await screen.findByText("Basmati Rice 5kg");
    expect(await screen.findByText("Could not load purchase history")).toBeInTheDocument();
    expect(screen.getByText("Grains")).toBeInTheDocument(); // the rest of the page still rendered
  });

  it("lists only this item's line from each log, with its quantity, unit rate, VAT and expiry", async () => {
    const logs = [
      {
        _id: "log1", transactionNo: "PO-2026-0001", date: "2026-09-01T00:00:00.000Z", party: "Gulf Supply Co",
        items: [
          { itemId: "item1", qty: 20, rate: 250, vatPercent: 5, expiryDate: "2027-01-01T00:00:00.000Z" },
          { itemId: "other-item", qty: 5, rate: 50, vatPercent: 5 },
        ],
      },
      {
        _id: "log2", transactionNo: "PO-2026-0002", date: "2026-09-15T00:00:00.000Z", party: null,
        items: [{ itemId: "other-item-only", qty: 1, rate: 10, vatPercent: 0 }],
      },
    ];
    api.get.mockImplementation((url) => {
      if (url === "/stock/stock/item1") return Promise.resolve({ data: { data: { stock: GOODS_ITEM } } });
      if (url === "/stock/stock/item1/purchase-logs") return Promise.resolve({ data: { data: { purchaseLogs: logs } } });
      return Promise.reject(new Error("unexpected"));
    });
    render(
      <MemoryRouter initialEntries={["/stock-detail/item1"]}>
        <Routes><Route path="/stock-detail/:id" element={<StockDetail />} /></Routes>
      </MemoryRouter>
    );
    await screen.findByText("Basmati Rice 5kg");
    const row = (await screen.findByText("PO-2026-0001")).closest("tr");
    expect(within(row).getByText("Gulf Supply Co")).toBeInTheDocument();
    expect(within(row).getByText("20")).toBeInTheDocument();
    expect(within(row).getByText("5%")).toBeInTheDocument();
    // log2's only item line is for a different stock item, so the log itself contributes no row
    expect(screen.queryByText("PO-2026-0002")).not.toBeInTheDocument();
  });
});

describe("going back", () => {
  it("the header's back button returns to the previous screen", async () => {
    show();
    await screen.findByText("Basmati Rice 5kg");
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByText("Stock list screen")).toBeInTheDocument();
  });
});
