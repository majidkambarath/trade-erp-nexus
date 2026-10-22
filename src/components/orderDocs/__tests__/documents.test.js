import { describe, it, expect } from "vitest";
import { buildTradeOrderDocument } from "../documents";

const company = { companyName: "ABC TRADE LLC", vatNumber: "100456789012345" };
const order = (over = {}) => ({ orderNo: "PORD-2026-0001", kind: "purchase", status: "DRAFT", items: [{ description: "Rice", qty: 10, price: 170, taxableAmount: 1700, vatAmount: 85, vatPercent: 5, lineTotal: 1785 }], ...over });

describe("buildTradeOrderDocument: an order is never titled as an invoice", () => {
  const registeredVendor = { vendorName: "Gulf Grain", trnNO: "100234561200003", vat: { status: "registered" } };
  const unregisteredVendor = { vendorName: "Corner Shop", vat: { status: "unregistered" } };
  const registeredCustomer = { customerName: "Al Noor", trnNumber: "100123456700003", vat: { status: "registered" } };
  const unregisteredCustomer = { customerName: "Walk-in", vat: { status: "unregistered" } };

  // An order posts nothing and carries no tax; the invoice made from it does. So the heading says "order" for every party,
  // registered or not - it used to read "Tax invoice" for a registered one, on a document that had issued no tax at all.
  it("a registered supplier's order is still a purchase order, with the order number kept as Order no.", () => {
    const doc = buildTradeOrderDocument(order(), registeredVendor, company, "AED");
    expect(doc.sheet.title).toBe("Purchase order");
    expect(doc.sheet.number).toEqual({ label: "Order no.", value: "PORD-2026-0001" });
    expect(doc.fileName).toBe("Purchase-order_PORD-2026-0001");
    expect(doc.sheet.notice).toMatch(/not an invoice/);
    expect(doc.sheet.party.vatStatus).toBe("Registered");
  });

  it("a registered customer's sales order is still a sales order, and says the invoice follows", () => {
    const doc = buildTradeOrderDocument(order({ kind: "sales", orderNo: "SORD-2026-0001" }), registeredCustomer, company, "AED");
    expect(doc.sheet.title).toBe("Sales order");
    expect(doc.sheet.number.value).toBe("SORD-2026-0001");
    expect(doc.sheet.notice).toMatch(/not an invoice/);
    expect(doc.sheet.notice).toMatch(/nothing is posted until it is approved/i);
  });

  it("an unregistered party's order keeps the same heading", () => {
    expect(buildTradeOrderDocument(order(), unregisteredVendor, company, "AED").sheet.title).toBe("Purchase order");
    const sales = buildTradeOrderDocument(order({ kind: "sales", orderNo: "SORD-2026-0002" }), unregisteredCustomer, company, "AED");
    expect(sales.sheet.title).toBe("Sales order");
    expect(sales.fileName).toBe("Sales-order_SORD-2026-0002");
    expect(sales.sheet.notice).toMatch(/not an invoice/);
  });

  it("a party's registration is printed under their name, and changes no heading", () => {
    const doc = buildTradeOrderDocument(order(), { vendorName: "X", trnNO: "100000000000003" }, company, "AED");
    expect(doc.sheet.party.vatStatus).toBe("Registered");
    expect(doc.sheet.title).toBe("Purchase order");
  });

  it("prints the line's taxable amount as its value", () => {
    const doc = buildTradeOrderDocument(order(), registeredVendor, company, "AED");
    expect(doc.sheet.lines[0].value).toBe(1700);
    expect(doc.sheet.totals.grandTotal).toBeCloseTo(1785, 2);
  });
});
