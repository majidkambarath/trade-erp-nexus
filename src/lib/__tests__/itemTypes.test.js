import { describe, it, expect } from "vitest";
import {
  GOODS, SERVICE, buildItemPayload, emptyItemForm, isService, isStocked, itemFormFromStock, itemStats, itemTypeLabel, matchesType, pickerLabel,
  rowIsService, stockLevelText, stockedItemIds, switchItemType, validateItemForm,
} from "../itemTypes";

const goods = { _id: "g1", itemId: "ITM1", sku: "GE0001", itemName: "Rice", itemType: "goods", category: { _id: "c1" }, unitOfMeasure: "u1", currentStock: 4, reorderLevel: 10, purchasePrice: 10, salesPrice: 20, status: "Active", origin: "India", brand: "Royal" };
const service = { _id: "s1", itemId: "SRV1", sku: "GE0002", itemName: "Installation", itemType: "service", category: { _id: "c1" }, unitOfMeasure: "u2", currentStock: 0, reorderLevel: 0, purchasePrice: 150, salesPrice: 400, status: "Active", incomeAccountId: "a-inc", expenseAccountId: { _id: "a-exp", accountName: "Subcontractors" } };

describe("goods or service", () => {
  it("an item with no type is goods: nothing that existed before needs changing", () => {
    expect(isService({})).toBe(false);
    expect(isStocked({})).toBe(true);
    expect(isService(undefined)).toBe(false);
    expect(isService({ itemType: "service" })).toBe(true);
    expect(isService({ itemType: "weird" })).toBe(false);
    expect(itemTypeLabel({})).toBe("Goods");
    expect(itemTypeLabel(service)).toBe("Service");
  });

  it("the picker names a service, and the stock level of one is a dash", () => {
    expect(pickerLabel(goods)).toBe("ITM1 - Rice");
    expect(pickerLabel(service)).toBe("SRV1 - Installation (Service)");
    expect(stockLevelText(goods)).toBe("4");
    expect(stockLevelText({ currentStock: 0 })).toBe("0");
    expect(stockLevelText(service)).toBe("—");
  });

  it("filters the list by type", () => {
    const list = [goods, service, { _id: "old", itemName: "Legacy" }];
    expect(list.filter((i) => matchesType(i, "")).length).toBe(3);
    expect(list.filter((i) => matchesType(i, "goods")).map((i) => i._id)).toEqual(["g1", "old"]);
    expect(list.filter((i) => matchesType(i, "service")).map((i) => i._id)).toEqual(["s1"]);
  });

  it("counts a service as an item but never as low stock or stock value", () => {
    const stats = itemStats([goods, service, { ...service, _id: "s2", currentStock: 5, purchasePrice: 100 }]);
    expect(stats).toMatchObject({ totalItems: 3, serviceItems: 2, lowStockItems: 1, totalValue: 40, activeItems: 3 });
    expect(itemStats([])).toMatchObject({ totalItems: 0, serviceItems: 0, lowStockItems: 0, totalValue: 0 });
    expect(itemStats(undefined).totalItems).toBe(0);
  });
});

describe("the item form", () => {
  it("starts as goods and blank", () => {
    expect(emptyItemForm()).toMatchObject({ itemType: GOODS, itemName: "", incomeAccountId: "", expenseAccountId: "", status: "Active" });
    expect(emptyItemForm(SERVICE).itemType).toBe(SERVICE);
  });

  it("opens a saved item with its type and accounts, whether they arrive as ids or populated", () => {
    expect(itemFormFromStock(goods)).toMatchObject({ itemType: GOODS, category: "c1", currentStock: "4", reorderLevel: "10", origin: "India", incomeAccountId: "" });
    const form = itemFormFromStock(service);
    expect(form).toMatchObject({ itemType: SERVICE, unitOfMeasure: "u2", incomeAccountId: "a-inc", expenseAccountId: "a-exp", currentStock: "0" });
    expect(itemFormFromStock({ ...goods, itemType: undefined }).itemType).toBe(GOODS);
  });

  it("going to a service drops what only goods have; going back does not bring it back", () => {
    const form = { ...emptyItemForm(), itemName: "X", currentStock: "5", reorderLevel: "2", batchNumber: "B", expiryDate: "2027-01-01", barcodeQrCode: "1", origin: "UAE", brand: "Y", salesPrice: "9" };
    const svc = switchItemType(form, SERVICE);
    expect(svc).toMatchObject({ itemType: SERVICE, itemName: "X", salesPrice: "9", currentStock: "", reorderLevel: "", batchNumber: "", expiryDate: "", barcodeQrCode: "", origin: "", brand: "" });
    const back = switchItemType({ ...svc, incomeAccountId: "a", expenseAccountId: "b" }, GOODS);
    expect(back).toMatchObject({ itemType: GOODS, itemName: "X", currentStock: "", incomeAccountId: "", expenseAccountId: "" });
  });

  it("asks goods for origin and brand and a service for neither", () => {
    const base = { ...emptyItemForm(), itemName: "N", sku: "S1", category: "c1", unitOfMeasure: "u1" };
    expect(validateItemForm(base)).toEqual({ origin: "Origin is required", brand: "Brand is required" });
    expect(validateItemForm({ ...base, itemType: SERVICE })).toEqual({});
    expect(validateItemForm({ ...base, origin: "a", brand: "b" })).toEqual({});
  });

  it("checks the fields both kinds share, and the quantities only of goods", () => {
    const base = { ...emptyItemForm(SERVICE), itemName: "", sku: "", category: "", unitOfMeasure: "", salesPrice: "-1", purchasePrice: "x" };
    expect(Object.keys(validateItemForm(base)).sort()).toEqual(["category", "itemName", "purchasePrice", "salesPrice", "sku", "unitOfMeasure"]);
    expect(validateItemForm(base).unitOfMeasure).toMatch(/hour, job, month/);
    const g = { ...emptyItemForm(), itemName: "N", sku: "S", category: "c", unitOfMeasure: "u", origin: "a", brand: "b", currentStock: "-2", reorderLevel: "abc" };
    expect(Object.keys(validateItemForm(g)).sort()).toEqual(["currentStock", "reorderLevel"]);
    // a service ignores a leftover quantity: it is never sent
    expect(validateItemForm({ ...g, itemType: SERVICE })).toEqual({});
  });

  it("sends a service with no stock fields at all, and goods exactly as before", () => {
    const base = { ...emptyItemForm(), itemName: "N", sku: "S1", category: "c1", unitOfMeasure: "u1", salesPrice: "400", vendorId: "" };
    const svc = buildItemPayload({ ...base, itemType: SERVICE, incomeAccountId: "a-inc", currentStock: "9", batchNumber: "B" });
    expect(svc).toEqual({ itemType: "service", sku: "S1", itemName: "N", categoryId: "c1", unitOfMeasure: "u1", purchasePrice: 0, salesPrice: 400, status: "Active", vendorId: "", incomeAccountId: "a-inc", expenseAccountId: null });
    const g = buildItemPayload({ ...base, origin: "UAE", brand: "B", currentStock: "12", reorderLevel: "3", batchNumber: "B1", expiryDate: "2027-01-01", barcodeQrCode: "123", incomeAccountId: "ignored" });
    expect(g).toEqual({
      itemType: "goods", sku: "S1", itemName: "N", categoryId: "c1", unitOfMeasure: "u1", purchasePrice: 0, salesPrice: 400, status: "Active", vendorId: "",
      barcodeQrCode: "123", reorderLevel: 3, batchNumber: "B1", expiryDate: "2027-01-01", currentStock: 12, origin: "UAE", brand: "B",
    });
  });
});

describe("the order form's rows", () => {
  it("knows a service line, and asks availability of the goods only", () => {
    expect(rowIsService({ itemType: "service" })).toBe(true);
    expect(rowIsService({ itemType: "goods" })).toBe(false);
    expect(rowIsService({})).toBe(false);
    expect(rowIsService(undefined)).toBe(false);
    const rows = [{ itemId: "b" }, { itemId: "a", itemType: "goods" }, { itemId: "s", itemType: "service" }, { itemId: "a" }, { itemId: "" }, {}];
    expect(stockedItemIds(rows)).toEqual(["a", "b"]);
    expect(stockedItemIds([{ itemId: "s", itemType: "service" }])).toEqual([]);
    expect(stockedItemIds(undefined)).toEqual([]);
  });
});
