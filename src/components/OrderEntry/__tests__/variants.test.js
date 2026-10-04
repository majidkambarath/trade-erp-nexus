import { describe, it, expect } from "vitest";
import { VARIANTS, buildPayload } from "../variants";
import { nextSku, QUICK_CREATE, missingRequired } from "../quickCreate";

const stock = (over = {}) => ({
  _id: "s1", itemId: "ITM1", itemName: "Basmati 5kg", brand: "Royal", origin: "India",
  purchasePrice: 40, salesPrice: 55, vatPercent: 5, taxPercent: 5, currentStock: 12,
  category: { name: "Rice" }, ...over,
});
const byId = (...items) => new Map(items.map((s) => [String(s._id), s]));

describe("purchase return payload (regression: priced with the system price, total 0)", () => {
  const V = VARIANTS.purchaseReturn;
  // The user types 12.50; the stock record says 40. The return must use 12.50.
  const row = { ...V.rowTemplate(), itemId: "s1", description: "Basmati", qty: "10", currentPurchasePrice: "12.5", vatPercent: "5" };

  it("prices each line at the entered unit price, not the system price", () => {
    const p = buildPayload(V, { partyId: "v1", deliveryDate: "2026-10-04" }, [row], byId(stock()), { linkedRef: null });
    expect(p.items[0].price).toBe(12.5);
    expect(p.items[0].lineTotal).toBe(131.25);
  });

  it("posts a non-zero total", () => {
    const p = buildPayload(V, { partyId: "v1" }, [row], byId(stock()));
    expect(p.totalAmount).toBe(131.25);
    expect(p.type).toBe("purchase_return");
    expect(p.partyType).toBe("Vendor");
  });

  it("sends linkedRef as null when no source order is chosen", () => {
    const p = buildPayload(V, { partyId: "v1" }, [row], byId(stock()), { linkedRef: undefined });
    expect(p).not.toHaveProperty("linkedRef");
  });
});

describe("sales return payload (regressions: taxPercent ignored, quantity counted twice)", () => {
  const V = VARIANTS.salesReturn;
  const row = { ...V.rowTemplate(), itemId: "s1", description: "Juice", qty: "10", salesPrice: "12.5", taxPercent: "5", category: "Drinks" };
  const p = buildPayload(V, { partyId: "c1" }, [row], byId(stock()));
  const item = p.items[0];

  it("sends vatPercent, never taxPercent", () => {
    expect(item.vatPercent).toBe(5);
    expect(item).not.toHaveProperty("taxPercent");
  });

  it("counts quantity once and is VAT-inclusive", () => {
    expect(item.rate).toBe(125);
    expect(item.lineTotal).toBe(131.25);
    expect(p.totalAmount).toBe(131.25);
  });

  it("uses the canonical Customer casing", () => {
    expect(p.partyType).toBe("Customer");
    expect(p.type).toBe("sales_return");
  });
});

describe("sales order payload", () => {
  const V = VARIANTS.sales;
  const row = { ...V.rowTemplate(), itemId: "s1", qty: "4", rate: "55", vatPercent: "5" };

  it("applies the document discount to the total and never goes below zero", () => {
    const p = buildPayload(V, { partyId: "c1", discount: "20", refNo: "LPO-9", docNo: "D-1" }, [row], byId(stock()));
    expect(p.totalAmount).toBe(211); // 220 + 5% VAT = 231, less the 20 discount
    expect(p.discount).toBe(20);
    expect(p.lpono).toBe("LPO-9");
    expect(p.docno).toBe("D-1");
    const huge = buildPayload(V, { partyId: "c1", discount: "9999" }, [row], byId(stock()));
    expect(huge.totalAmount).toBe(0);
  });

  it("sends the unit price as price, which the backend recalculates from", () => {
    const p = buildPayload(V, { partyId: "c1" }, [row], byId(stock()));
    expect(p.items[0].price).toBe(55);
    expect(p.items[0].lineTotal).toBe(231);
  });
});

describe("purchase order payload", () => {
  const V = VARIANTS.purchase;
  const row = { ...V.rowTemplate(), itemId: "s1", qty: "2", currentPurchasePrice: "10", vatPercent: "5" };

  it("line total is VAT-inclusive (regression: it used to be VAT-exclusive)", () => {
    const p = buildPayload(V, { partyId: "v1" }, [row], byId(stock()));
    expect(p.items[0].lineTotal).toBe(21);
    expect(p.items[0].vatAmount).toBe(1);
  });

  it("skips blank rows and rows with no quantity", () => {
    const blank = V.rowTemplate();
    const p = buildPayload(V, { partyId: "v1" }, [row, blank, { ...row, qty: "0" }], byId(stock()));
    expect(p.items).toHaveLength(1);
  });
});

describe("hydration from a stock record", () => {
  it("purchase keeps a price the user already typed", () => {
    const h = VARIANTS.purchase.hydrate({ currentPurchasePrice: "13" }, stock());
    expect(h.currentPurchasePrice).toBe("13");
  });

  it("purchase fills an empty price from the stock record", () => {
    const h = VARIANTS.purchase.hydrate({ currentPurchasePrice: "" }, stock());
    expect(h.currentPurchasePrice).toBe("40");
  });

  it("sales fills the unit price from sales price, and reads the stock VAT rate", () => {
    const h = VARIANTS.sales.hydrate({ rate: "" }, stock({ taxPercent: 0 }));
    expect(h.rate).toBe("55");
    expect(h.vatPercent).toBe("0");
  });

  it("sales return takes the category name from the populated record", () => {
    expect(VARIANTS.salesReturn.hydrate({}, stock()).category).toBe("Rice");
  });
});

describe("nextSku", () => {
  it("uses the category prefix and starts at 0001", () => {
    expect(nextSku("Rice", [])).toBe("RI0001");
  });

  it("continues after the highest existing number for that prefix", () => {
    expect(nextSku("Rice", ["RI0007", "RI0002", "OI0099"])).toBe("RI0008");
  });

  it("ignores SKUs from other prefixes", () => {
    expect(nextSku("Oil", ["RI0500"])).toBe("OI0001");
  });

  it("takes the first two characters, then drops non-letters, exactly as the stock page does", () => {
    // "3 Fruit" -> "3 " -> "" : the stock page produces the same bare number, so we match it.
    expect(nextSku("3 Fruit", [])).toBe("0001");
    expect(nextSku("Fruit", [])).toBe("FR0001");
  });
});

describe("quick-create payloads", () => {
  it("vendor sends the three required fields plus status", () => {
    const p = QUICK_CREATE.vendor.payload({ vendorName: " Al Maya ", contactPerson: "Omar", address: "Dubai" });
    expect(p).toMatchObject({ vendorName: "Al Maya", contactPerson: "Omar", address: "Dubai", status: "Compliant" });
  });

  it("customer never sends undefined for fields the backend trims", () => {
    const p = QUICK_CREATE.customer.payload({ customerName: "Spinneys", contactPerson: "Ali", billingAddress: "Abu Dhabi" });
    expect(p.phone).toBe("");
    expect(p.contactPerson).toBe("Ali");
    for (const v of Object.values(p)) expect(v).not.toBeUndefined();
  });

  it("stock item generates the SKU from the category", () => {
    const p = QUICK_CREATE.stockItem.payload(
      { itemName: "Basmati", category: "c1", unitOfMeasure: "u1", origin: "India", brand: "Royal" },
      { categoryName: "Rice", existingSkus: ["RI0004"] }
    );
    expect(p.sku).toBe("RI0005");
    expect(p.categoryId).toBe("c1");
    expect(p.unitOfMeasure).toBe("u1");
  });

  it("reports the first missing required field", () => {
    expect(missingRequired(QUICK_CREATE.vendor, { vendorName: "X", contactPerson: "", address: "" }).name).toBe("contactPerson");
    expect(missingRequired(QUICK_CREATE.vendor, { vendorName: "X", contactPerson: "Y", address: "Z" })).toBeNull();
  });
});
