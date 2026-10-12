import { describe, it, expect } from "vitest";
import { buildTradeOrderDocument } from "../documents";

const company = { companyName: "ABC TRADE LLC", vatNumber: "100456789012345" };
const order = (over = {}) => ({ orderNo: "PORD-2026-0001", kind: "purchase", status: "DRAFT", items: [{ description: "Rice", qty: 10, price: 170, taxableAmount: 1700, vatAmount: 85, vatPercent: 5, lineTotal: 1785 }], ...over });

describe("buildTradeOrderDocument: the heading follows the party's registration", () => {
  const registeredVendor = { vendorName: "Gulf Grain", trnNO: "100234561200003", vat: { status: "registered" } };
  const unregisteredVendor = { vendorName: "Corner Shop", vat: { status: "unregistered" } };
  const registeredCustomer = { customerName: "Al Noor", trnNumber: "100123456700003", vat: { status: "registered" } };
  const unregisteredCustomer = { customerName: "Walk-in", vat: { status: "unregistered" } };

  it("a registered supplier's order reads Tax invoice, with the order number kept as Order no.", () => {
    const doc = buildTradeOrderDocument(order(), registeredVendor, company, "AED");
    expect(doc.sheet.title).toBe("Tax invoice");
    expect(doc.sheet.number).toEqual({ label: "Order no.", value: "PORD-2026-0001" });
    expect(doc.fileName).toBe("Tax-invoice_PORD-2026-0001");
    expect(doc.sheet.notice).toMatch(/Nothing is posted until the invoice made from it is approved/);
    expect(doc.sheet.party.vatStatus).toBe("Registered");
  });

  it("a registered customer's sales order reads Tax invoice too", () => {
    const doc = buildTradeOrderDocument(order({ kind: "sales", orderNo: "SORD-2026-0001" }), registeredCustomer, company, "AED");
    expect(doc.sheet.title).toBe("Tax invoice");
    expect(doc.sheet.number.value).toBe("SORD-2026-0001");
  });

  it("an unregistered party's order keeps the plain order heading", () => {
    expect(buildTradeOrderDocument(order(), unregisteredVendor, company, "AED").sheet.title).toBe("Purchase order");
    const sales = buildTradeOrderDocument(order({ kind: "sales", orderNo: "SORD-2026-0002" }), unregisteredCustomer, company, "AED");
    expect(sales.sheet.title).toBe("Sales order");
    expect(sales.fileName).toBe("Sales-order_SORD-2026-0002");
    expect(sales.sheet.notice).toMatch(/not an invoice/);
  });

  it("a party with only a TRN on file reads as registered", () => {
    const doc = buildTradeOrderDocument(order(), { vendorName: "X", trnNO: "100000000000003" }, company, "AED");
    expect(doc.sheet.title).toBe("Tax invoice");
  });

  it("prints the line's taxable amount as its value", () => {
    const doc = buildTradeOrderDocument(order(), registeredVendor, company, "AED");
    expect(doc.sheet.lines[0].value).toBe(1700);
    expect(doc.sheet.totals.grandTotal).toBeCloseTo(1785, 2);
  });
});
