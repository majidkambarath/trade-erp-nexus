import { describe, it, expect } from "vitest";
import {
  buildPurchaseDocument,
  buildPurchaseReturnDocument,
  buildSalesReturnDocument,
} from "../invoiceDocuments";

const company = { companyName: "NH Foods", vatNumber: "100000000000003" };
const items = [{ itemCode: "QA 1", description: "Dates", qty: 4, rate: 50, vatAmount: 2.5, vatPercent: 5 }];

describe("sales return", () => {
  const customer = { customerId: "CUST-9", customerName: "Spinneys", trnNumber: "" };
  const doc = buildSalesReturnDocument({ transactionNo: "SR-1", status: "CONFIRMED", items, date: "2026-10-05" }, customer, company, "AED");

  it("is titled as a return, never as a tax invoice", () => {
    expect(doc.sheet.title).toBe("Sales return");
    expect(doc.sheet.number).toEqual({ label: "Return no.", value: "SR-1" });
    expect(doc.sheet.notice).not.toMatch(/tax invoice/i);
  });

  it("names the customer from the list, falling back to the saved name", () => {
    expect(doc.sheet.party.name).toBe("Spinneys");
    const fallback = buildSalesReturnDocument({ transactionNo: "SR-2", items: [], customerName: "Saved name" }, {}, company, "AED");
    expect(fallback.sheet.party.name).toBe("Saved name");
  });

  it("totals the returned lines with VAT", () => {
    expect(doc.sheet.totals.grandTotal).toBe(52.5);
  });
});

describe("purchase return", () => {
  const vendor = { vendorId: "VEND-1", vendorName: "Al Maya", trnNO: "200000000000003", paymentTerms: "" };
  const doc = buildPurchaseReturnDocument({ transactionNo: "PR-1", status: "PENDING", items, vendorReference: "VR-7" }, vendor, company, "AED");

  it("is titled as a return against the vendor", () => {
    expect(doc.sheet.title).toBe("Purchase return");
    expect(doc.sheet.party.heading).toBe("Supplier");
    expect(doc.sheet.party.trn).toBe("200000000000003");
    expect(doc.sheet.meta).toContainEqual(["Vendor reference", "VR-7"]);
  });

  it("never prints the company's own details as the supplier", () => {
    expect(doc.sheet.party.name).toBe("Al Maya");
    expect(doc.sheet.company.nameEn).toBe("NH Foods");
  });
});

describe("purchase order", () => {
  it("uses the purchase order title and number", () => {
    const doc = buildPurchaseDocument({ transactionNo: "PO-1", status: "DRAFT", items: [] }, {}, company, "AED");
    expect(doc.sheet.title).toBe("Purchase order");
    expect(doc.fileName).toBe("Purchase-order_PO-1");
  });
});
