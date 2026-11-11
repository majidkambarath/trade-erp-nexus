import { describe, it, expect } from "vitest";
import {
  buildSalesDocument,
  buildPurchaseDocument,
  buildPurchaseReturnDocument,
  buildSalesReturnDocument,
} from "../invoiceDocuments";

const company = { companyName: "NH Foods", vatNumber: "100000000000003" };
const items = [{ itemCode: "QA 1", description: "Dates", qty: 4, rate: 50, vatAmount: 2.5, vatPercent: 5 }];

describe("sales return", () => {
  const customer = { customerId: "CUST-9", customerName: "Spinneys", trnNumber: "" };
  const doc = buildSalesReturnDocument({ transactionNo: "SR-1", status: "CONFIRMED", items, date: "2026-10-05" }, customer, company, "AED");

  it("is titled as a credit note, never as a tax invoice", () => {
    // the company here has a tax number, so the credit it gives carries the tax word, as its invoice does
    expect(doc.sheet.title).toBe("Tax credit note");
    expect(doc.sheet.number).toEqual({ label: "Credit note no.", value: "SR-1" });
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

  it("is a debit note, and says which party it is for", () => {
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

  // The page IS the supplier's bill, so an unregistered supplier's is still an invoice - a plain one, with no input tax to claim.
  // It used to be titled "Purchase order", which is a different document altogether (the non-posting order, under Orders).
  it("an unregistered supplier's is a plain purchase invoice and says no input VAT can be recovered", () => {
    const doc = buildPurchaseDocument({ transactionNo: "PO-2", status: "APPROVED", items: [] }, unregistered, company, "AED");
    expect(doc.sheet.title).toBe("Purchase invoice");
    expect(doc.sheet.number).toEqual({ label: "Invoice no.", value: "PO-2" });
    expect(doc.fileName).toBe("Purchase-invoice_PO-2");
    expect(doc.sheet.notice).toMatch(/no input VAT can be recovered/);
    expect(buildPurchaseDocument({ transactionNo: "PO-2", status: "DRAFT", items: [] }, unregistered, company, "AED").sheet.number.label).toBe("Draft invoice no.");
  });

  it("a supplier with only a TRN on file reads as registered", () => {
    const doc = buildPurchaseDocument({ transactionNo: "PO-3", status: "APPROVED", items: [] }, { vendorName: "X", trnNO: "100000000000003" }, company, "AED");
    expect(doc.sheet.title).toBe("Tax invoice");
  });

  it("a party that is not known at all is not claimed to be registered", () => {
    const doc = buildPurchaseDocument({ transactionNo: "PO-4", status: "DRAFT", items: [] }, {}, company, "AED");
    expect(doc.sheet.title).toBe("Purchase invoice");
    expect(doc.sheet.party.vatStatus).toBe("");
  });

  // A document states the party's tax position only where somebody positively recorded one. "Unregistered" was printed for a
  // party nobody had classified AND for one saved with the party form's own default, which is every party saved through it -
  // so the paper asserted something about almost every customer that the business had never said.
  it("a party who is not registered is described on the paper at all", () => {
    const unclassified = buildPurchaseDocument({ transactionNo: "PO-5", status: "APPROVED", items: [] }, { vendorName: "Corner Shop" }, company, "AED");
    expect(unclassified.sheet.party.vatStatus).toBe("");
    expect(unclassified.sheet.party.trn).toBe("");

    const stored = buildPurchaseDocument({ transactionNo: "PO-6", status: "APPROVED", items: [] }, { vendorName: "Corner Shop", vat: { status: "unregistered" } }, company, "AED");
    expect(stored.sheet.party.vatStatus).toBe("");

    // A record holding BOTH "not registered" and a stray tax number contradicts itself. The status is the deliberate
    // statement, so the number is left off: a TRN in the Bill to block means the party is registered.
    const contradictory = buildPurchaseDocument({ transactionNo: "PO-7", status: "APPROVED", items: [] }, { vendorName: "Corner Shop", trnNO: "100000000000003", vat: { status: "unregistered" } }, company, "AED");
    expect(contradictory.sheet.party.trn).toBe("");
    expect(contradictory.sheet.party.vatStatus).toBe("");
    expect(contradictory.sheet.title).toBe("Purchase invoice");
  });

  // The other two classifications are deliberate statements and are printed as they always were.
  it("an exempt or designated-zone party is still described", () => {
    const exempt = buildPurchaseDocument({ transactionNo: "PO-8", status: "APPROVED", items: [] }, { vendorName: "X", vat: { status: "exempt" } }, company, "AED");
    expect(exempt.sheet.party.vatStatus).toBe("Exempt");
    const zone = buildPurchaseDocument({ transactionNo: "PO-9", status: "APPROVED", items: [] }, { vendorName: "X", trnNO: "100000000000003", vat: { status: "designated_zone" } }, company, "AED");
    expect(zone.sheet.party.vatStatus).toBe("Designated zone");
    expect(zone.sheet.party.trn).toBe("100000000000003");
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

describe("returns: a credit note and a debit note, with the invoice returned named", () => {
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

  // The credit follows OUR registration, as the invoice it credits does: the customer's own status changes nothing.
  it("an unregistered customer is credited by the same note, and a company with no tax number gives a plain credit note", () => {
    const sameNote = buildSalesReturnDocument(ret(), walkIn, company, "AED");
    expect(sameNote.sheet.title).toBe("Tax credit note");
    const doc = buildSalesReturnDocument(ret(), walkIn, { companyName: "NH Foods", vatNumber: "" }, "AED");
    expect(doc.sheet.title).toBe("Credit note");
    expect(doc.sheet.number.label).toBe("Credit note no.");
    expect(doc.fileName).toBe("Credit-note_SR-1");
    expect(doc.sheet.notice).not.toMatch(/tax/i);
  });

  it("a draft return says nothing is posted yet", () => {
    const doc = buildSalesReturnDocument(ret({ status: "DRAFT" }), customer, company, "AED");
    expect(doc.sheet.notice).toMatch(/draft/);
    expect(doc.sheet.notice).toMatch(/Nothing is posted and no stock moves until it is approved/);
  });

  it("a purchase return is the same debit note whoever the supplier is", () => {
    const doc = buildPurchaseReturnDocument(ret({ transactionNo: "PR-2" }), { vendorName: "Corner Shop", vat: { status: "unregistered" } }, company, "AED");
    expect(doc.sheet.title).toBe("Debit note");
    expect(doc.sheet.party.vatStatus).toBe(""); // a supplier who is not registered is simply not described
    expect(doc.sheet.meta).toContainEqual(["Original invoice", "SO-2026-0042"]);
  });
});

// --- what a document carries beside its number -------------------------------------------------
// These guard the three things added on 5 Nov 2026: the organisation's own typed reference, the
// vehicle a garage invoice was for, and the fields the product's OWN e-invoice validator
// (utils/eInvoice.js REQUIRED_INVOICE / REQUIRED_BUYER) has always demanded while the printed sheet
// had nowhere to put them.

const row = (meta, label) => meta.find(([k]) => k === label);

describe("the serial number a person types", () => {
  const cust = { customerId: "C1", customerName: "Spinneys", paymentTerms: "Net 30" };
  const vend = { vendorId: "V1", vendorName: "Gulf Supply" };
  const base = { transactionNo: "X-1", status: "APPROVED", date: "2026-11-05", items };

  it("prints on all four documents, under its own label", () => {
    const docs = [
      buildSalesDocument({ ...base, serialNo: "GRG-114" }, cust, company, "AED"),
      buildPurchaseDocument({ ...base, serialNo: "GRG-114" }, vend, company, "AED"),
      buildSalesReturnDocument({ ...base, serialNo: "GRG-114" }, cust, company, "AED"),
      buildPurchaseReturnDocument({ ...base, serialNo: "GRG-114" }, vend, company, "AED"),
    ];
    for (const d of docs) expect(d.sheet.meta).toContainEqual(["Serial no.", "GRG-114"]);
  });

  // It is optional, and `rowsWithValue` is what keeps an unused reference off the paper rather than
  // printing an empty row under a heading.
  it("leaves no row at all when nobody typed one", () => {
    const d = buildSalesDocument(base, cust, company, "AED");
    expect(row(d.sheet.meta, "Serial no.")).toBeUndefined();
  });

  // The automatic number is untouched: the serial sits beside it, it does not replace it.
  it("does not become the document's number", () => {
    const d = buildSalesDocument({ ...base, transactionNo: "SO-2026-0010", serialNo: "GRG-114" }, cust, company, "AED");
    expect(d.sheet.number.value).toBe("SO-2026-0010");
  });
});

describe("the vehicle a garage invoice was for", () => {
  const cust = { customerId: "C1", customerName: "Ali Hassan" };
  const base = { transactionNo: "SO-1", status: "APPROVED", date: "2026-11-05", items };

  it("names it by plate and by chassis, as two rows", () => {
    const d = buildSalesDocument(
      { ...base, jobCardRef: { jobNo: "JC-2026-0017", plateNumber: "A 11111", chassisNo: "JTEBU29J100123456" } },
      cust, company, "AED",
    );
    expect(d.sheet.meta).toContainEqual(["Job card no.", "JC-2026-0017"]);
    expect(d.sheet.meta).toContainEqual(["Vehicle", "A 11111"]);
    expect(d.sheet.meta).toContainEqual(["Chassis (VIN)", "JTEBU29J100123456"]);
  });

  // A car may be on file with one identifier and not the other - vehicleModel.js indexes both
  // partially for exactly that reason - so each row has to stand on its own.
  it("prints whichever of the two the vehicle actually has", () => {
    const plateOnly = buildSalesDocument({ ...base, jobCardRef: { jobNo: "JC-1", plateNumber: "A 11111" } }, cust, company, "AED");
    expect(plateOnly.sheet.meta).toContainEqual(["Vehicle", "A 11111"]);
    expect(row(plateOnly.sheet.meta, "Chassis (VIN)")).toBeUndefined();

    const vinOnly = buildSalesDocument({ ...base, jobCardRef: { jobNo: "JC-1", chassisNo: "VIN-ONLY-1" } }, cust, company, "AED");
    expect(vinOnly.sheet.meta).toContainEqual(["Chassis (VIN)", "VIN-ONLY-1"]);
    expect(row(vinOnly.sheet.meta, "Vehicle")).toBeUndefined();
  });

  // Every invoice that is not a garage one - which is nearly all of them - reads exactly as before.
  it("says nothing about a vehicle on an ordinary invoice", () => {
    const d = buildSalesDocument(base, cust, company, "AED");
    for (const label of ["Job card no.", "Vehicle", "Chassis (VIN)"]) expect(row(d.sheet.meta, label)).toBeUndefined();
  });
});

describe("the due date, and where the customer is", () => {
  const base = { transactionNo: "SO-1", status: "APPROVED", date: "2026-11-05T00:00:00.000Z", items };

  // Only an opening invoice stores a dueDate, so printing the stored field alone would leave the row
  // blank on nearly every invoice. This is `dueDateOf` - the rule the lists and the ageing report use.
  it("works the due date out from the party's terms when none is stored", () => {
    const d = buildSalesDocument(base, { customerId: "C1", customerName: "Spinneys", paymentTerms: "Net 30" }, company, "AED");
    expect(row(d.sheet.meta, "Due date")[1]).toBe("05/12/2026");
  });

  it("prefers a stored due date to the terms", () => {
    const d = buildSalesDocument({ ...base, dueDate: "2026-11-20T00:00:00.000Z" }, { customerId: "C1", customerName: "S", paymentTerms: "Net 30" }, company, "AED");
    expect(row(d.sheet.meta, "Due date")[1]).toBe("20/11/2026");
  });

  // A credit note is not owed on a date; it has none and must not invent one.
  it("gives a credit note no due date", () => {
    const d = buildSalesReturnDocument(base, { customerId: "C1", customerName: "S", paymentTerms: "Net 30" }, company, "AED");
    expect(row(d.sheet.meta, "Due date")).toBeUndefined();
  });

  it("prints the customer's city and country when the record has them", () => {
    const d = buildSalesDocument(base, { customerId: "C1", customerName: "S", eInvoice: { city: "Dubai", countryCode: "AE" } }, company, "AED");
    expect(d.sheet.party.locality).toBe("Dubai, AE");
  });

  // A vendor record has no structured locality at all, so the purchase side must pass none rather
  // than reach for a field that does not exist.
  it("claims no locality for a vendor, or for a customer whose address is one blob", () => {
    expect(buildPurchaseDocument(base, { vendorId: "V1", vendorName: "Gulf" }, company, "AED").sheet.party.locality).toBeUndefined();
    expect(buildSalesDocument(base, { customerId: "C1", customerName: "S" }, company, "AED").sheet.party.locality).toBe("");
  });

  // The sheet has always drawn a Terms block and no invoice ever fed it.
  it("passes the document's own terms to the sheet", () => {
    const d = buildSalesDocument({ ...base, terms: "Payment within 30 days." }, { customerId: "C1", customerName: "S" }, company, "AED");
    expect(d.sheet.terms).toBe("Payment within 30 days.");
  });
});
