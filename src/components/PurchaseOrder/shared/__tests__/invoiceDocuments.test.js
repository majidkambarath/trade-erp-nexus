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

  it("is a debit note for a registered supplier, and says which party it is for", () => {
    expect(doc.sheet.title).toBe("Debit note");
    expect(doc.sheet.number.label).toBe("Debit note no.");
    expect(doc.fileName).toBe("Debit-note_PR-1");
    expect(doc.sheet.party.heading).toBe("Supplier");
    expect(doc.sheet.party.trn).toBe("200000000000003");
    expect(doc.sheet.meta).toContainEqual(["Vendor reference", "VR-7"]);
  });

  it("never prints the company's own details as the supplier", () => {
    expect(doc.sheet.party.name).toBe("Al Maya");
    expect(doc.sheet.company.nameEn).toBe("NH Foods");
  });
});

describe("purchase invoice", () => {
  const registered = { vendorName: "Al Safa", trnNO: "100456783400003", vat: { status: "registered" } };
  const unregistered = { vendorName: "Corner Shop", vat: { status: "unregistered" } };

  it("a registered supplier's invoice is a tax invoice, drafts included", () => {
    const draft = buildPurchaseDocument({ transactionNo: "PO-1", status: "DRAFT", items: [] }, registered, company, "AED");
    expect(draft.sheet.title).toBe("Tax invoice");
    expect(draft.sheet.number.label).toBe("Draft invoice no.");
    expect(draft.fileName).toBe("Draft-Tax-invoice_PO-1");
    expect(draft.sheet.notice).toMatch(/draft tax invoice/);

    const approved = buildPurchaseDocument({ transactionNo: "PO-1", status: "APPROVED", items: [] }, registered, company, "AED");
    expect(approved.sheet.title).toBe("Tax invoice");
    expect(approved.sheet.number.label).toBe("Invoice no.");
    expect(approved.fileName).toBe("Tax-invoice_PO-1");
    expect(approved.sheet.party.vatStatus).toBe("Registered");
  });

  it("an unregistered supplier's is a purchase order and says no input VAT can be recovered", () => {
    const doc = buildPurchaseDocument({ transactionNo: "PO-2", status: "APPROVED", items: [] }, unregistered, company, "AED");
    expect(doc.sheet.title).toBe("Purchase order");
    expect(doc.sheet.number).toEqual({ label: "Order no.", value: "PO-2" });
    expect(doc.fileName).toBe("Purchase-order_PO-2");
    expect(doc.sheet.notice).toMatch(/no input VAT can be recovered/);
    expect(buildPurchaseDocument({ transactionNo: "PO-2", status: "DRAFT", items: [] }, unregistered, company, "AED").sheet.number.label).toBe("Draft order no.");
  });

  it("a supplier with only a TRN on file reads as registered", () => {
    const doc = buildPurchaseDocument({ transactionNo: "PO-3", status: "APPROVED", items: [] }, { vendorName: "X", trnNO: "100000000000003" }, company, "AED");
    expect(doc.sheet.title).toBe("Tax invoice");
  });

  it("a party that is not known at all is not claimed to be registered", () => {
    const doc = buildPurchaseDocument({ transactionNo: "PO-4", status: "DRAFT", items: [] }, {}, company, "AED");
    expect(doc.sheet.title).toBe("Purchase order");
  });
});

describe("a line's value", () => {
  // Some paths stored the UNIT PRICE in `rate`; the server's own figures are what the sheet must print.
  const items = [
    { itemCode: "OIL", description: "Sunflower Oil", qty: 585, price: 150.74, rate: 150.74, taxableAmount: 88182.9, vatPercent: 5, vatAmount: 4409.15, lineTotal: 92592.05 },
  ];

  it("prints the taxable amount as the value, and the unit price follows from it", () => {
    const doc = buildPurchaseDocument({ transactionNo: "PO-5", status: "APPROVED", items }, { vendorName: "Al Safa", trnNO: "1" }, company, "AED");
    const line = doc.sheet.lines[0];
    expect(line.value).toBe(88182.9);
    expect(line.unitPrice).toBeCloseTo(150.74, 2);
    expect(line.total).toBeCloseTo(92592.05, 2);
    expect(doc.sheet.totals.gross).toBeCloseTo(88182.9, 2);
    expect(doc.sheet.totals.grandTotal).toBeCloseTo(92592.05, 2);
  });

  it("a line saved before taxableAmount existed keeps reading rate as its value", () => {
    const old = [{ description: "Rice", qty: 10, rate: 200, vatPercent: 5, vatAmount: 10 }];
    const doc = buildPurchaseDocument({ transactionNo: "PO-6", status: "APPROVED", items: old }, {}, company, "AED");
    expect(doc.sheet.lines[0].value).toBe(200);
    expect(doc.sheet.lines[0].unitPrice).toBe(20);
  });
});

describe("a line's item code", () => {
  const id = "6aca205ef01c0ca159fd8d19";
  const code = (it) => buildPurchaseDocument({ transactionNo: "PO-7", status: "APPROVED", items: [{ qty: 1, rate: 10, ...it }] }, {}, company, "AED").sheet.lines[0].code;

  it("prints the item's own code, never its database id", () => {
    expect(code({ itemCode: "OIL-18" })).toBe("OIL-18");
    expect(code({ itemCode: id, stockDetails: { itemId: "SUN7443", sku: "OIL-SUN-18" } })).toBe("SUN7443");
    expect(code({ itemCode: id, sku: "OIL-SUN-18" })).toBe("OIL-SUN-18");
  });

  it("leaves the code blank when only the id is known", () => {
    expect(code({ itemCode: id })).toBe("");
  });
});

describe("returns: the heading follows the party's registration, and the invoice returned is named", () => {
  const customer = { customerId: "C1", customerName: "Al Noor", trnNumber: "100123456700003", vat: { status: "registered" } };
  const walkIn = { customerName: "Walk-in", vat: { status: "unregistered" } };
  const ret = (over = {}) => ({ transactionNo: "SR-1", status: "APPROVED", items: [], returnOf: { transactionId: "i1", transactionNo: "SO-2026-0042" }, ...over });

  it("a registered customer's sales return is a tax credit note against the invoice", () => {
    const doc = buildSalesReturnDocument(ret(), customer, company, "AED");
    expect(doc.sheet.title).toBe("Tax credit note");
    expect(doc.sheet.number).toEqual({ label: "Credit note no.", value: "SR-1" });
    expect(doc.sheet.meta).toContainEqual(["Original invoice", "SO-2026-0042"]);
    expect(doc.sheet.notice).toMatch(/tax credit note.*against SO-2026-0042/);
    expect(doc.fileName).toBe("Tax-credit-note_SR-1");
  });

  it("an unregistered customer's stays a sales return, and is never a tax invoice", () => {
    const doc = buildSalesReturnDocument(ret(), walkIn, company, "AED");
    expect(doc.sheet.title).toBe("Sales return");
    expect(doc.sheet.number.label).toBe("Return no.");
  });

  it("a draft return says nothing is posted yet", () => {
    const doc = buildSalesReturnDocument(ret({ status: "DRAFT" }), customer, company, "AED");
    expect(doc.sheet.notice).toMatch(/draft/);
    expect(doc.sheet.notice).toMatch(/Nothing is posted and no stock moves until it is approved/);
  });

  it("a purchase return from an unregistered supplier stays a purchase return", () => {
    const doc = buildPurchaseReturnDocument(ret({ transactionNo: "PR-2" }), { vendorName: "Corner Shop", vat: { status: "unregistered" } }, company, "AED");
    expect(doc.sheet.title).toBe("Purchase return");
    expect(doc.sheet.meta).toContainEqual(["Original invoice", "SO-2026-0042"]);
  });
});
