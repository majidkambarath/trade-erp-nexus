import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildDeliveryNoteDocument, buildPickListDocument, buildQuotationDocument } from "../documents";
import { sheetComponent, sheetMarkup } from "../../PurchaseOrder/shared/documentPdf";
import InvoiceSheet from "../../PurchaseOrder/shared/InvoiceSheet";
import DeliverySheet from "../../PurchaseOrder/shared/DeliverySheet";

const company = { companyName: "Zarvia Trading LLC", vatNumber: "100123456700003", addressLine1: "Al Quoz, Dubai", phoneNumber: "04 123 4567" };
const customer = { customerName: "Al Noor Grocery", customerId: "C1", billingAddress: "Deira, Dubai", shippingAddress: "Warehouse 4, Al Quoz", phone: "050 111 2222", paymentTerms: "Net 30", trnNumber: "100999999900003" };

const line = (over = {}) => ({
  itemCode: "R1", description: "Basmati 5kg", qty: 10, price: 20, discountPercent: 10, discountAmount: 20,
  grossAmount: 200, taxableAmount: 180, vatPercent: 5, vatAmount: 9, lineTotal: 189, stockDetails: { unit: "BAG" }, ...over,
});
const priced = {
  gross: 200, lineDiscount: 20, net: 180, lineVat: 9, chargesNet: 25, chargesVat: 1.25, headerDiscount: 5, roundOff: 0, grandTotal: 210.25,
};

describe("quotation document", () => {
  const q = {
    quotationNo: "QT-2026-0007", status: "SENT", displayStatus: "EXPIRED", date: "2026-10-06T00:00:00.000Z", validUntil: "2026-11-05T00:00:00.000Z",
    reference: "RFQ-77", terms: "Payment within 30 days", items: [line()], charges: [{ description: "Freight", amount: 25, vatPercent: 5, vatAmount: 1.25 }],
    discount: 5, pricing: priced, totalAmount: 210.25,
  };
  const doc = buildQuotationDocument(q, customer, company, "AED");

  it("is titled and numbered as a quotation, never as a tax invoice", () => {
    expect(doc.sheet.title).toBe("Quotation");
    expect(doc.sheet.number).toEqual({ label: "Quotation no.", value: "QT-2026-0007" });
    expect(doc.fileName).toBe("Quotation_QT-2026-0007");
    expect(doc.sheet.notice).toMatch(/not a tax invoice/);
    expect(doc.missingTrn).toBe(false);
  });

  it("shows what the server priced, including freight and the header discount", () => {
    expect(doc.sheet.totals.grandTotal).toBe(210.25);
    expect(doc.sheet.totals.headerDiscount).toBe(5);
    expect(doc.sheet.totals.lineDiscount).toBe(20);
    expect(doc.sheet.totals.charges).toHaveLength(1);
    // the line value is after its discount, which is what the sheet's value column means
    expect(doc.sheet.lines[0]).toMatchObject({ qty: 10, value: 180, vat: 9, total: 189 });
  });

  it("prints the terms and an acceptance box, and the customer's details", () => {
    expect(doc.sheet.terms).toBe("Payment within 30 days");
    expect(doc.sheet.acceptance).toBe(true);
    expect(doc.sheet.party).toMatchObject({ heading: "Quotation for", name: "Al Noor Grocery", trn: "100999999900003" });
    const keys = doc.sheet.meta.map(([k]) => k);
    expect(keys).toEqual(["Date", "Valid until", "Customer ref.", "Payment terms"]);
  });

  it("carries the status the person sees, so an expired offer is not shown as merely sent", () => {
    expect(doc.status).toBe("EXPIRED");
  });

  it("renders on the priced sheet, with the terms and the acceptance box in the markup", () => {
    expect(sheetComponent(doc.sheet)).toBe(InvoiceSheet);
    const html = sheetMarkup(doc.sheet, { copy: "Customer copy", accent: "#1c1c1a" });
    expect(html).toContain("Quotation");
    expect(html).toContain("Payment within 30 days");
    expect(html).toContain("Accepted on the terms above");
    expect(html).toContain("QT-2026-0007");
  });

  it("leaves the invoice sheet exactly as it was when there are no terms or acceptance", () => {
    const plain = { ...doc.sheet, terms: "", acceptance: false };
    const html = renderToStaticMarkup(React.createElement(InvoiceSheet, { ...plain, copy: "Customer copy", accent: "#1c1c1a" }));
    expect(html).not.toContain("Terms");
    expect(html).not.toContain("Accepted on the terms above");
  });
});

describe("delivery note document", () => {
  const dn = {
    deliveryNoteNo: "DLN-2026-0012", status: "DISPATCHED", date: "2026-10-06T00:00:00.000Z", reference: "LPO-1", source: { kind: "sales_order", no: "SO-2026-0031" },
    deliveryAddress: "", contactPerson: "Ali", contactPhone: "050 111 2222", vehicleNo: "DXB A 12345", driverName: "Raju", driverPhone: "055 000 1111",
    items: [line(), line({ itemCode: "O1", description: "Oil 1L", qty: 4, price: 50, lineTotal: 210, stockDetails: { unit: "CTN" } })],
    pricing: priced, notes: "Call before arriving",
  };

  it("has its own sheet, titled as a delivery note and not an invoice", () => {
    const doc = buildDeliveryNoteDocument(dn, customer, company, "AED");
    expect(doc.sheet.layout).toBe("delivery");
    expect(sheetComponent(doc.sheet)).toBe(DeliverySheet);
    expect(doc.sheet.title).toBe("Delivery note");
    expect(doc.sheet.notice).toMatch(/not a tax invoice/);
    expect(doc.fileName).toBe("Delivery-note_DLN-2026-0012");
    expect(doc.copies).toEqual(["Customer copy", "Office copy"]);
  });

  it("has no prices unless asked, because the person at the door does not need them", () => {
    const off = buildDeliveryNoteDocument(dn, customer, company, "AED");
    expect(off.sheet.showPrices).toBe(false);
    expect(off.sheet.totals).toBeNull();
    const html = sheetMarkup(off.sheet, { copy: "Customer copy", accent: "#1c1c1a" });
    expect(html).not.toContain("Unit price");
    expect(html).not.toContain("Grand total");

    const on = buildDeliveryNoteDocument(dn, customer, company, "AED", { showPrices: true });
    expect(on.sheet.totals.grandTotal).toBe(210.25);
    expect(sheetMarkup(on.sheet, { copy: "Customer copy", accent: "#1c1c1a" })).toContain("Unit price");
  });

  it("delivers to the note's address, else the customer's shipping address, else billing", () => {
    expect(buildDeliveryNoteDocument(dn, customer, company, "AED").sheet.party.address).toBe("Warehouse 4, Al Quoz");
    expect(buildDeliveryNoteDocument({ ...dn, deliveryAddress: "Jebel Ali" }, customer, company, "AED").sheet.party.address).toBe("Jebel Ali");
    expect(buildDeliveryNoteDocument(dn, { ...customer, shippingAddress: "" }, company, "AED").sheet.party.address).toBe("Deira, Dubai");
  });

  it("says what it is against, who is driving, and units on each line", () => {
    const doc = buildDeliveryNoteDocument(dn, customer, company, "AED");
    expect(doc.sheet.meta).toContainEqual(["Against", "Sales order SO-2026-0031"]);
    expect(doc.sheet.meta).toContainEqual(["Vehicle", "DXB A 12345"]);
    expect(doc.sheet.meta.map(([k]) => k)).not.toContain("Delivered on"); // not delivered yet
    expect(doc.sheet.lines.map((l) => l.unit)).toEqual(["BAG", "CTN"]);
    expect(doc.sheet.signatures.deliveredBy).toContainEqual(["Driver", "Raju"]);
    expect(doc.sheet.signatures.receivedBy).toEqual([]); // blank for the customer to sign
  });

  it("once delivered, shows what was accepted, what was short and why, and who signed", () => {
    const done = {
      ...dn, status: "DELIVERED", deliveredAt: "2026-10-07T08:00:00.000Z", receivedBy: "Store keeper", proofNote: "signed and stamped",
      items: [line({ deliveredQty: 8, shortReason: "2 bags torn" }), line({ itemCode: "O1", description: "Oil 1L", qty: 4, deliveredQty: 4, stockDetails: { unit: "CTN" } })],
    };
    const doc = buildDeliveryNoteDocument(done, customer, company, "AED");
    expect(doc.sheet.lines[0]).toMatchObject({ qty: 10, deliveredQty: 8, short: 2, shortReason: "2 bags torn" });
    expect(doc.sheet.lines[1]).toMatchObject({ deliveredQty: 4, short: 0 });
    expect(doc.sheet.signatures.receivedBy).toContainEqual(["Name", "Store keeper"]);
    const html = sheetMarkup(doc.sheet, { copy: "Customer copy", accent: "#1c1c1a" });
    expect(html).toContain("Delivered");
    expect(html).toContain("2 bags torn");
    expect(html).toContain("Store keeper");
  });
});

describe("pick list document", () => {
  const dn = { status: "DRAFT" };
  const pick = {
    deliveryNoteNo: "DLN-2026-0012", customer: "Al Noor Grocery", date: "2026-10-06T00:00:00.000Z", minShelfLifeDays: 45,
    lines: [
      { itemCode: "M1", description: "Milk 1L", unit: "CTN", qty: 50, basis: "suggested", unallocated: 0, batches: [{ batchNumber: "M-OLD", expiryDate: "2026-11-01T00:00:00.000Z", qty: 40 }, { batchNumber: "M-NEW", expiryDate: "2027-02-01T00:00:00.000Z", qty: 10 }] },
      { itemCode: "R1", description: "Rice", unit: "BAG", qty: 5, basis: "suggested", unallocated: 5, batches: [] },
    ],
  };

  it("lists the batches to take, in order, with a tick box", () => {
    const doc = buildPickListDocument(pick, dn, customer, company);
    expect(doc.sheet.mode).toBe("pick");
    expect(doc.sheet.title).toBe("Pick list");
    expect(doc.sheet.lines[0].batches.map((b) => b.batchNumber)).toEqual(["M-OLD", "M-NEW"]);
    const html = sheetMarkup(doc.sheet, { copy: "Warehouse copy", accent: "#1c1c1a" });
    expect(html).toContain("M-OLD");
    expect(html).toContain("Picked");
    expect(html).toContain("has no batch on record");
  });

  it("states the shelf-life floor and is honest that batches are a suggestion", () => {
    const doc = buildPickListDocument(pick, dn, customer, company);
    expect(doc.sheet.meta).toContainEqual(["Shelf life", "at least 45 days left"]);
    expect(doc.sheet.notice).toMatch(/suggested first-expiry-first-out/);
  });

  it("says so when the batches are the ones an approved order already took", () => {
    const allocated = { ...pick, lines: pick.lines.map((l) => ({ ...l, basis: "allocated" })) };
    expect(buildPickListDocument(allocated, dn, customer, company).sheet.notice).toMatch(/already taken by the sales order/);
  });
});

describe("a number must never leak onto the page", () => {
  // `{line.short && <span/>}` prints a stray "0" when short is the number 0; the printed note showed
  // "Basmati Rice 5kg0" until the screenshot was read.
  it("a fully delivered line prints its description and nothing after it", () => {
    const dn = {
      deliveryNoteNo: "DLN-2026-0013", status: "DELIVERED", date: "2026-10-06T00:00:00.000Z", deliveredAt: "2026-10-07T08:00:00.000Z", receivedBy: "Ali",
      items: [line({ deliveredQty: 10, description: "Basmati 5kg" })], pricing: priced,
    };
    const doc = buildDeliveryNoteDocument(dn, customer, company, "AED");
    expect(doc.sheet.lines[0].short).toBe(0);
    const html = sheetMarkup(doc.sheet, { copy: "Customer copy", accent: "#1c1c1a" });
    expect(html).not.toMatch(/Basmati 5kg<!-- -->0|Basmati 5kg0/);
    expect(html).toMatch(/Basmati 5kg<\/td>/);
    expect(html).not.toContain("Short ");
  });

  it("a pick list line with every unit allocated prints no remark", () => {
    const pick = { deliveryNoteNo: "DLN-2026-0013", customer: "Al Noor", date: "2026-10-06T00:00:00.000Z", minShelfLifeDays: 0, lines: [{ itemCode: "M1", description: "Milk 1L", unit: "CTN", qty: 5, basis: "suggested", unallocated: 0, batches: [{ batchNumber: "B1", expiryDate: null, qty: 5 }] }] };
    const html = sheetMarkup(buildPickListDocument(pick, { status: "DRAFT" }, customer, company).sheet, { copy: "Warehouse copy", accent: "#1c1c1a" });
    expect(html).toMatch(/Milk 1L<\/td>/);
  });
});
