import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import InvoiceSheet from "../InvoiceSheet";
import { buildPurchaseDocument, buildPurchaseReturnDocument, buildSalesDocument, buildSalesReturnDocument, reverseChargeNote } from "../invoiceDocuments";
import { invoiceLines, vatBreakdown } from "../invoiceModel";
import { buildDeliveryNoteDocument, buildQuotationDocument } from "../../../salesDocs/documents";

// A reverse-charge line charges no VAT. On OUR SALE that is the supplier's invoice, which must say the recipient accounts for the VAT
// (Executive Regulation Art. 59(1)(l)); on our PURCHASE the VAT we assess is shown beside the total and never in it.

const company = { companyName: "NH Foods", vatNumber: "100000000000003" };
const customer = { customerId: "C1", customerName: "Al Noor", trnNumber: "100999888700003" };
const vendor = { vendorId: "V1", vendorName: "Gulf Mills", trnNO: "200000000000003" };

const standard = { itemCode: "RICE", description: "Rice", qty: 2, rate: 200, vatAmount: 10, vatPercent: 5, taxKind: "standard" };
const reverse = { itemCode: "SRV", description: "Imported consulting", qty: 1, rate: 500, vatAmount: 0, vatPercent: 5, taxKind: "reverse_charge", rcmVat: 25 };
const older = { ...reverse, vatAmount: 25, rcmVat: undefined }; // saved before the VAT stopped being charged on such a line

const render1 = (sheet) =>
  render(<InvoiceSheet {...sheet} copy="Customer copy" accent="#1f2937" />);

describe("the printed lines", () => {
  it("marks a reverse-charge line, whose rate is not an invoice rate", () => {
    const [a, b] = invoiceLines([standard, reverse]);
    expect(a).not.toHaveProperty("reverseCharge");
    expect(b).toMatchObject({ reverseCharge: true, vat: 0, total: 500, rcmVat: 25 });
  });

  it("prints a line saved before that (it charged the VAT) as an ordinary one", () => {
    expect(invoiceLines([older])[0]).toMatchObject({ vat: 25, total: 525 });
    expect(invoiceLines([older])[0]).not.toHaveProperty("reverseCharge");
  });

  it("gives reverse-charge lines a row of their own in the VAT breakdown, with no VAT", () => {
    const rows = vatBreakdown(invoiceLines([standard, reverse]));
    expect(rows).toEqual([
      { rate: 5, taxable: 200, vat: 10 },
      { rate: null, label: "Reverse charge", taxable: 500, vat: 0 },
    ]);
  });
});

describe("a sale with a reverse-charge line (the supplier's tax invoice)", () => {
  const so = { transactionNo: "SO-1", status: "APPROVED", date: "2026-10-05", items: [standard, reverse] };
  const sheet = buildSalesDocument(so, customer, company, "AED").sheet;

  it("carries the statement, citing the Decree-Law, and not the amount the customer assesses", () => {
    expect(sheet.reverseCharge.statement).toMatch(/Reverse charge applies: VAT to be accounted for by the recipient/);
    expect(sheet.reverseCharge.statement).toMatch(/Article 48/);
    expect(sheet.reverseCharge.amount).toBeUndefined();
  });

  it("totals the net of the reverse-charge line with the VAT of the others only", () => {
    expect(sheet.totals).toMatchObject({ vat: 10, grandTotal: 710 });
  });

  it("draws RC where the rate would be, a Reverse charge row in the breakdown, and the statement on the page", () => {
    render1(sheet);
    const rows = screen.getAllByRole("row");
    const line = rows.find((r) => within(r).queryByText("Imported consulting"));
    expect(within(line).getByText("RC")).toBeInTheDocument();
    expect(screen.getByText("Reverse charge", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText(/Reverse charge applies: VAT to be accounted for by the recipient/)).toBeInTheDocument();
    expect(screen.queryByText("VAT self-assessed (reverse charge)")).not.toBeInTheDocument();
  });

  it("says nothing of the kind on an ordinary invoice or on a line that did charge VAT", () => {
    expect(buildSalesDocument({ ...so, items: [standard] }, customer, company, "AED").sheet.reverseCharge).toBeNull();
    expect(buildSalesDocument({ ...so, items: [standard, older] }, customer, company, "AED").sheet.reverseCharge).toBeNull();
    render1(buildSalesDocument({ ...so, items: [standard] }, customer, company, "AED").sheet);
    expect(screen.queryByText(/Reverse charge applies/)).not.toBeInTheDocument();
    expect(screen.queryByText("RC")).not.toBeInTheDocument();
  });

  it("is on its credit note too", () => {
    const back = buildSalesReturnDocument({ transactionNo: "SR-1", items: [reverse] }, customer, company, "AED").sheet;
    expect(back.reverseCharge.statement).toMatch(/Reverse charge applies/);
  });
});

describe("a purchase with a reverse-charge line (our own document)", () => {
  const po = { transactionNo: "PO-1", status: "APPROVED", items: [standard, reverse], pricing: { net: 700, lineVat: 10, rcmVat: 25, grandTotal: 710 } };
  const sheet = buildPurchaseDocument(po, vendor, company, "AED").sheet;

  it("shows the VAT we assess beside the total, and says it is ours and not payable to the supplier", () => {
    expect(sheet.reverseCharge).toMatchObject({ amountLabel: "VAT self-assessed (reverse charge)", amount: 25 });
    expect(sheet.reverseCharge.statement).toMatch(/AED 25\.00/);
    expect(sheet.reverseCharge.statement).toMatch(/not payable to the supplier/);
    expect(sheet.totals.grandTotal).toBe(710);
  });

  it("is drawn under the grand total", () => {
    render1(sheet);
    expect(screen.getByText("VAT self-assessed (reverse charge)")).toBeInTheDocument();
    expect(screen.getByText(/not payable to the supplier/)).toBeInTheDocument();
  });

  it("works out the amount from the lines when the list's row has no pricing, and on a return", () => {
    const bare = buildPurchaseDocument({ transactionNo: "PO-2", items: [reverse] }, vendor, company, "AED").sheet;
    expect(bare.reverseCharge.amount).toBe(25);
    const ret = buildPurchaseReturnDocument({ transactionNo: "PR-1", items: [reverse] }, vendor, company, "AED").sheet;
    expect(ret.reverseCharge.amountLabel).toBe("VAT self-assessed (reverse charge)");
  });
});

describe("the other documents", () => {
  it("an offer on a reverse-charge line tells the customer the VAT is theirs, and says nothing on a document that names no side", () => {
    const q = buildQuotationDocument({ quotationNo: "QT-1", validUntil: "2026-11-01", items: [{ ...reverse, taxableAmount: 500 }] }, customer, company, "AED");
    expect(q.sheet.reverseCharge.statement).toMatch(/Reverse charge applies/);
    expect(q.sheet.lines[0].reverseCharge).toBe(true);
  });

  it("does not guess a side: a document that names none says nothing", () => {
    expect(reverseChargeNote(invoiceLines([reverse]), {}, undefined, "AED")).toBeNull();
    expect(reverseChargeNote(invoiceLines([standard]), {}, "supplier", "AED")).toBeNull();
  });

  it("a delivery note prints RC where the rate would be", () => {
    const dn = { deliveryNoteNo: "DLN-1", status: "DELIVERED", items: [{ ...reverse, qty: 1, lineTotal: 500, deliveredQty: 1, price: 500 }, { ...standard, lineTotal: 210, price: 100, qty: 2 }] };
    const doc = buildDeliveryNoteDocument(dn, customer, company, "AED", { showPrices: true });
    expect(doc.sheet.lines.map((l) => Boolean(l.reverseCharge))).toEqual([true, false]);
  });
});
