import { describe, it, expect } from "vitest";
import { buildFromShare } from "../shareSheet";
import { sheetMarkup } from "../../PurchaseOrder/shared/documentPdf";

const company = { companyName: "Harbour Trading", vatNumber: "100999888700003", addressLine1: "Al Quoz", city: "Dubai" };
const party = { customerName: "Al Noor Trading", customerId: "C1", billingAddress: "Quoz", paymentTerms: "Net 30" };

describe("the customer's page draws a quotation, a delivery note and a statement", () => {
  it("a quotation: the offer, its validity and the lines", () => {
    const doc = buildFromShare({
      kind: "quotation", company, party, currency: "AED",
      document: { quotationNo: "QT-2026-0001", date: "2026-11-18T00:00:00.000Z", validUntil: "2026-12-18T00:00:00.000Z", status: "SENT", terms: "30 days", items: [{ description: "Rice", qty: 10, price: 20, taxableAmount: 200, vatPercent: 5, vatAmount: 10, lineTotal: 210 }], pricing: { net: 200, lineVat: 10, grandTotal: 210 }, totalAmount: 210 },
    });
    expect(doc.title).toBe("Quotation");
    expect(doc.number).toBe("QT-2026-0001");
    const html = sheetMarkup(doc.sheet, { copy: doc.copies[0], accent: "#0f766e" });
    expect(html).toContain("Rice");
    expect(html).toContain("30 days");
  });

  it("a delivery note: quantities and the delivery particulars, with no prices", () => {
    const doc = buildFromShare({
      kind: "delivery_note", company, party, currency: "AED",
      document: { deliveryNoteNo: "DLN-2026-0001", date: "2026-11-18T00:00:00.000Z", status: "DELIVERED", vehicleNo: "DXB A 1", driverName: "Raju", receivedBy: "Store", deliveredAt: "2026-11-19T00:00:00.000Z", items: [{ itemCode: "R1", description: "Rice", qty: 6, deliveredQty: 6 }] },
    });
    expect(doc.title).toBe("Delivery note");
    expect(doc.number).toBe("DLN-2026-0001");
    const html = sheetMarkup(doc.sheet, { copy: doc.copies[0], accent: "#0f766e" });
    expect(html).toContain("Rice");
    expect(html).toContain("Raju");
    expect(html).toContain("Store");
  });

  it("a statement: opening, every row with its balance, closing, as one page with a single root", () => {
    const doc = buildFromShare({
      kind: "statement", company, currency: "AED", party: { customerName: "Al Noor Trading", customerId: "C1", billingAddress: "Quoz" },
      statement: { from: "2026-11-01", to: "2026-11-18", opening: 0, closing: 210, totals: { debit: 210, credit: 0 }, rows: [{ date: "2026-11-05T00:00:00.000Z", voucherNo: "SO-2026-0001", voucherType: "sales_order", narration: "Sales invoice", debit: 210, credit: 0, balance: 210 }] },
    });
    expect(doc.title).toBe("Statement of account");
    const html = sheetMarkup(doc.sheet, { copy: doc.copies[0], accent: "#0f766e" });
    expect(html).toContain("SO-2026-0001");
    expect(html).toContain("210.00 Dr");
    expect(html).toContain("Al Noor Trading");
    expect(html.startsWith("<div")).toBe(true);
    expect(html.endsWith("</div>")).toBe(true);
  });

  it("a statement that was cut short says so", () => {
    const doc = buildFromShare({ kind: "statement", company, currency: "AED", party, statement: { from: "2026-01-01", to: "2026-11-18", opening: 0, closing: 0, totals: {}, rows: [], truncated: true } });
    expect(sheetMarkup(doc.sheet, { copy: "x", accent: "#0f766e" })).toContain("Only the first 1,000 entries");
  });

  it("an unknown kind is still nothing", () => {
    expect(buildFromShare({ kind: "carrier_pigeon" })).toBeNull();
  });
});
