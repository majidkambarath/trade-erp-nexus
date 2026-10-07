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

describe("editing a saved sales order keeps each line's identity", () => {
  const V = VARIANTS.sales;

  it("sends the stored line id back, so delivery notes raised against the line stay attached", () => {
    const saved = { itemId: "s1", description: "Juice", qty: 4, price: 55, vatPercent: 5, _id: "line-1" };
    const row = V.rowFromSaved(saved);
    expect(row.lineId).toBe("line-1");
    const p = buildPayload(V, { partyId: "c1" }, [{ ...row, itemId: "s1" }], byId(stock()));
    expect(p.items[0]._id).toBe("line-1");
  });

  it("a line added in the form has no id yet", () => {
    const fresh = { ...V.rowTemplate(), itemId: "s1", qty: "4", rate: "55", vatPercent: "5" };
    const p = buildPayload(V, { partyId: "c1" }, [fresh], byId(stock()));
    expect("_id" in p.items[0]).toBe(false);
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

describe("quotation payload (the server prices it, so it carries inputs only)", () => {
  const V = VARIANTS.quotation;
  const row = { ...V.rowTemplate(), itemId: "s1", itemCode: "ITM1", description: "Basmati 5kg", qty: "10", rate: "20", vatPercent: "5", discountPercent: "10", taxCodeId: "tc1" };
  const form = { partyId: "c1", date: "2026-10-06", validUntil: "2026-11-05", reference: "RFQ-7", terms: "30 days", notes: "n", discount: "5", charges: [] };

  it("sends the unit price and the line's discount, tax code and VAT, and no totals", () => {
    const p = buildPayload(V, form, [row], byId(stock()));
    expect(p.items).toEqual([
      { itemId: "s1", itemCode: "ITM1", description: "Basmati 5kg", qty: 10, price: 20, vatPercent: 5, discountPercent: 10, taxCodeId: "tc1" },
    ]);
    for (const k of ["totalAmount", "status", "type", "transactionNo", "createdBy"]) expect(p).not.toHaveProperty(k);
    expect(p).toMatchObject({ partyId: "c1", date: "2026-10-06", validUntil: "2026-11-05", reference: "RFQ-7", terms: "30 days", discount: 5 });
  });

  it("leaves out blank lines and zero quantities", () => {
    const p = buildPayload(V, form, [row, V.rowTemplate(), { ...row, qty: "0" }], byId(stock()));
    expect(p.items).toHaveLength(1);
  });

  it("always sends the charges, even none, so removing the last one on an edit takes effect", () => {
    expect(buildPayload(V, form, [row], byId(stock())).charges).toEqual([]);
    const withCharge = buildPayload(V, { ...form, charges: [{ description: "Freight", amount: "25", vatPercent: "5" }, { description: "", amount: "" }] }, [row], byId(stock()));
    expect(withCharge.charges).toEqual([{ code: undefined, description: "Freight", amount: 25, vatPercent: 5 }]);
  });

  it("is its own document: its own endpoint, no status picker, valid until is required", () => {
    expect(V.endpoint).toBe("/quotations");
    expect(V.statusOptions).toBeNull();
    expect(V.secondDateKey).toBe("validUntil");
    expect(V.secondDateRequired).toBe(true);
    expect(V.attachments).toBe(false);
    expect(V.docType).toBeUndefined();
  });

  it("uses the sales order's grid and maths, so the figures match the invoice", () => {
    expect(V.columns).toBe(VARIANTS.sales.columns);
    const t = V.totals([{ ...row }]);
    expect(t.total).toBe("189.00"); // 10 x 20 = 200, 10% off = 180, + 5% VAT
    expect(V.totalAmount(t, { discount: "5" })).toBe(184);
  });

  it("opens a saved line with the stock that came with it", () => {
    const r = V.rowFromSaved({ itemId: "s1", description: "Rice", qty: 3, price: 20, vatPercent: 5, stockDetails: { currentStock: 42 } });
    expect(r.rate).toBe("20");
    expect(r.currentStock).toBe(42);
  });
});

describe("delivery note payload", () => {
  const V = VARIANTS.deliveryNote;
  const row = { ...V.rowTemplate(), itemId: "s1", description: "Rice", qty: "4", rate: "20", vatPercent: "5" };
  const form = { partyId: "c1", date: "2026-10-06", reference: "LPO-1", deliveryAddress: "Al Quoz", vehicleNo: "DXB 1", driverName: "Raju", charges: [], discount: "" };

  it("carries who is driving and where to, and a blank is sent as empty rather than dropped", () => {
    const p = buildPayload(V, form, [row], byId(stock()));
    expect(p).toMatchObject({ reference: "LPO-1", deliveryAddress: "Al Quoz", vehicleNo: "DXB 1", driverName: "Raju", contactPerson: "", contactPhone: "", driverPhone: "" });
    expect(p.items[0]).toMatchObject({ itemId: "s1", qty: 4, price: 20, vatPercent: 5 });
    expect(p).not.toHaveProperty("totalAmount");
  });

  it("has no second date, no terms, and asks the server what is free", () => {
    expect(V.hasSecondDate).toBe(false);
    expect(V.terms).toBe(false);
    expect(V.checkAvailability).toBe(true);
    expect(V.extraFields.map((f) => f.key)).toEqual(["deliveryAddress", "contactPerson", "contactPhone", "vehicleNo", "driverName", "driverPhone"]);
  });
});

describe("the four order documents are unchanged by the new ones", () => {
  it("still build a Transaction payload with a type, a status and a total", () => {
    const row = { ...VARIANTS.sales.rowTemplate(), itemId: "s1", qty: "4", rate: "55", vatPercent: "5" };
    const p = buildPayload(VARIANTS.sales, { partyId: "c1", status: "DRAFT" }, [row], byId(stock()));
    expect(p.type).toBe("sales_order");
    expect(p.status).toBe("DRAFT");
    expect(p.totalAmount).toBe(231);
    expect(VARIANTS.sales.endpoint).toBeUndefined();
    expect(VARIANTS.purchase.endpoint).toBeUndefined();
  });
});
