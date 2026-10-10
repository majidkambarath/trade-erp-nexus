import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrderForm from "../OrderForm";
import { VARIANTS, recalcRow } from "../variants";
import { QUICK_CREATE, isRequired, missingRequired } from "../quickCreate";
import axiosInstance from "../../../axios/axios";

// A service (consulting, delivery, installation) sits in the same item list and the same picker as goods, but it has no
// quantity on hand: the form must say so, never ask the server whether it is available, and never ask for a batch.

vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div>Attachments panel</div>, linkPending: vi.fn(async () => []) }));
vi.mock("../../../lib/processTransaction", () => ({ applyAfterSave: vi.fn(async () => ({ done: true, status: "APPROVED" })) }));

const customers = [{ _id: "c1", customerId: "C1", customerName: "Al Noor Grocery", billingAddress: "Deira", phone: "04 1", trnNumber: "1", paymentTerms: "Net 30" }];
const vendors = [{ _id: "v1", vendorId: "V1", vendorName: "Gulf Freight", address: "Jebel Ali" }];
const rice = { _id: "s1", itemId: "ITM1", itemName: "Basmati 5kg", purchasePrice: 10, salesPrice: 20, currentStock: 40, taxPercent: 5 };
const install = { _id: "s2", itemId: "SRV1", itemName: "Installation", itemType: "service", purchasePrice: 150, salesPrice: 400, currentStock: 0, taxPercent: 5 };
const stockItems = [rice, install];

const row = (V, stock, extra = {}) => recalcRow(V, { ...V.rowTemplate(), itemId: stock._id, itemCode: stock.itemId, qty: "2", ...V.hydrate(V.rowTemplate(), stock), ...extra });

const show = async (ui) => {
  const out = render(ui);
  await act(async () => {});
  return out;
};

function Harness({ variant, initial, parties = customers }) {
  const [formData, setFormData] = useState(initial);
  return (
    <OrderForm
      variant={variant} formData={formData} setFormData={setFormData} parties={parties} stockItems={stockItems}
      notify={() => {}} setActiveView={() => {}} resetForm={() => {}} onSuccess={() => {}} activeView="create"
    />
  );
}

const noteForm = (items) => ({
  transactionNo: "", partyId: "c1", partyType: "Customer", date: "2026-10-06", reference: "LPO-1", deliveryAddress: "Al Quoz", contactPerson: "", contactPhone: "",
  vehicleNo: "", driverName: "", driverPhone: "", notes: "", discount: "0", charges: [], items,
});

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockImplementation(async (url) => {
    if (url === "/delivery-notes/availability") return { data: { data: [{ itemId: "s1", onHand: 40, committed: 0, available: 40 }] } };
    return { data: { data: [] } };
  });
});

describe("a chosen service fills its line", () => {
  it("marks the line a service, with nothing on hand, in every document that sells or buys", () => {
    for (const key of ["sales", "salesReturn", "purchase", "purchaseReturn"]) {
      const V = VARIANTS[key];
      const hydrated = V.hydrate(V.rowTemplate(), install);
      expect(hydrated.itemType, key).toBe("service");
      if ("currentStock" in hydrated) expect(hydrated.currentStock, key).toBeNull();
    }
    expect(VARIANTS.sales.hydrate(VARIANTS.sales.rowTemplate(), install).rate).toBe("400"); // its sales price
    expect(VARIANTS.purchase.hydrate(VARIANTS.purchase.rowTemplate(), install).currentPurchasePrice).toBe("150"); // its purchase price
  });

  it("leaves goods exactly as they were", () => {
    const hydrated = VARIANTS.sales.hydrate(VARIANTS.sales.rowTemplate(), rice);
    expect(hydrated).toMatchObject({ itemType: "goods", currentStock: 40 });
  });

  it("reads a saved service line back as a service, from the line or from the item details joined to it", () => {
    const saved = { _id: "l1", itemId: "s2", itemCode: "SRV1", description: "Installation", qty: 2, price: 400, vatPercent: 5 };
    expect(VARIANTS.sales.rowFromSaved({ ...saved, itemType: "service" })).toMatchObject({ itemType: "service", currentStock: null });
    // a delivery note's lines arrive with the item's details joined on
    expect(VARIANTS.deliveryNote.rowFromSaved({ ...saved, stockDetails: { itemType: "service", currentStock: null } })).toMatchObject({ itemType: "service", currentStock: null });
    expect(VARIANTS.deliveryNote.rowFromSaved({ ...saved, stockDetails: { currentStock: 12 } })).toMatchObject({ itemType: "goods", currentStock: 12 });
    expect(VARIANTS.sales.rowFromSaved({ ...saved, currentStock: 12 })).toMatchObject({ itemType: "goods", currentStock: 12 });
    expect(VARIANTS.salesReturn.rowFromSaved({ ...saved, itemType: "service" })).toMatchObject({ itemType: "service", currentStock: null });
  });
});

describe("the sales order form", () => {
  const form = (items) => ({ transactionNo: "", partyId: "c1", partyType: "Customer", date: "2026-10-06", deliveryDate: "2026-10-07", status: "DRAFT", refNo: "", docNo: "", notes: "", discount: "0", charges: [], items });

  it("names a service in the item picker and says Service where goods show their stock", async () => {
    await show(<Harness variant={VARIANTS.sales} initial={form([row(VARIANTS.sales, rice), row(VARIANTS.sales, install)])} />);
    expect(screen.getByText("SRV1 - Installation (Service)")).toBeInTheDocument();
    expect(screen.getByText("ITM1 - Basmati 5kg")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("40")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Service")).toBeInTheDocument();
    expect(within(rows[1]).queryByText("0")).not.toBeInTheDocument();
  });

  it("saves a service line like any other: the server decides it is a service", async () => {
    axiosInstance.post.mockResolvedValue({ data: { data: { _id: "t1", partyId: "c1", items: [] } } });
    await show(<Harness variant={VARIANTS.sales} initial={form([row(VARIANTS.sales, install)])} />);
    const save = screen.getByRole("button", { name: /save so/i });
    await act(async () => { save.click(); });
    const [url, body] = axiosInstance.post.mock.calls[0];
    expect(url).toBe("/transactions/transactions");
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ itemId: "s2", qty: 2, price: 400 });
    expect(body.items[0]).not.toHaveProperty("itemType");
    expect(body.items[0]).not.toHaveProperty("batchNumber");
  });
});

describe("the purchase form", () => {
  it("has no batch or expiry to record for a service line", async () => {
    const form = { transactionNo: "", partyId: "v1", partyType: "Vendor", date: "2026-10-06", deliveryDate: "2026-10-07", status: "DRAFT", notes: "", discount: "0", charges: [], items: [row(VARIANTS.purchase, rice), row(VARIANTS.purchase, install)] };
    await show(<Harness variant={VARIANTS.purchase} initial={form} parties={vendors} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByLabelText(/^Batch, row 1/)).toBeInTheDocument();
    expect(within(rows[1]).queryByRole("textbox", { name: /^Batch/ })).not.toBeInTheDocument();
    expect(within(rows[1]).getByLabelText(/^Batch, row 2: not applicable to a service/)).toBeInTheDocument();
    expect(within(rows[1]).getByLabelText(/^Expiry, row 2: not applicable to a service/)).toBeInTheDocument();
  });
});

describe("the delivery note form", () => {
  it("asks about the goods only, and a service alone asks nothing and warns about nothing", async () => {
    await show(<Harness variant={VARIANTS.deliveryNote} initial={noteForm([row(VARIANTS.deliveryNote, rice), row(VARIANTS.deliveryNote, install, { qty: "1000" })])} />);
    expect(axiosInstance.get).toHaveBeenCalledWith("/delivery-notes/availability", { params: { itemIds: "s1", excludeId: undefined } });
    expect(screen.queryByText("Not enough free stock for this delivery note")).not.toBeInTheDocument();
  });

  it("makes no availability request at all for a note of services", async () => {
    await show(<Harness variant={VARIANTS.deliveryNote} initial={noteForm([row(VARIANTS.deliveryNote, install, { qty: "1000" })])} />);
    expect(axiosInstance.get).not.toHaveBeenCalledWith("/delivery-notes/availability", expect.anything());
    expect(screen.queryByText("Not enough free stock for this delivery note")).not.toBeInTheDocument();
  });
});

describe("creating an item from an order line", () => {
  const base = { itemName: "Installation", category: "c1", unitOfMeasure: "u1" };

  it("a service asks for no origin or brand; goods still do", () => {
    const spec = QUICK_CREATE.stockItem;
    expect(missingRequired(spec, { ...base, itemType: "goods" })?.name).toBe("origin");
    expect(missingRequired(spec, { ...base, itemType: "goods", origin: "India" })?.name).toBe("brand");
    expect(missingRequired(spec, { ...base, itemType: "service" })).toBeNull();
    const origin = spec.fields.find((f) => f.name === "origin");
    expect(isRequired(origin, { itemType: "service" })).toBe(false);
    expect(isRequired(origin, {})).toBe(true);
    expect(isRequired({ required: true })).toBe(true);
    expect(isRequired({})).toBe(false);
  });

  it("sends the type, and for a service the usual blank stock fields", () => {
    const goods = QUICK_CREATE.stockItem.payload({ ...base, origin: "India", brand: "Royal" }, { categoryName: "Rice", existingSkus: [] });
    expect(goods.itemType).toBe("goods");
    const service = QUICK_CREATE.stockItem.payload({ ...base, itemType: "service" }, { categoryName: "Services", existingSkus: [] });
    expect(service).toMatchObject({ itemType: "service", currentStock: 0, reorderLevel: 0, batchNumber: "", expiryDate: null, barcodeQrCode: "" });
  });
});
