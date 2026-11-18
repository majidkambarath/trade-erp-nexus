import { describe, it, expect } from "vitest";
import { gstBreakdown, invoiceLines } from "../invoiceModel";
import { buildSalesDocument } from "../invoiceDocuments";
import { placeLabel, stateCodeOfGstin, secondHalfLabel, stateName } from "../../../../lib/gstStates";

// India GST on the printed invoice: the item's HSN / SAC code on its line, the tax summary by code and rate with CGST / SGST / IGST,
// and where the supply is made. A document without the split prints exactly as before.
const gstLine = (extra = {}) => ({
  itemCode: "BO-1", description: "Bolt", qty: 10, rate: 1000, price: 100, taxableAmount: 1000, vatPercent: 18, vatAmount: 180, hsnCode: "7318",
  gst: { cgst: 90, sgst: 90, igst: 0 }, ...extra,
});

describe("invoiceLines with GST", () => {
  it("carries the HSN code and the component split only when the line has them", () => {
    const [a] = invoiceLines([gstLine()]);
    expect(a.hsn).toBe("7318");
    expect(a.gst).toEqual({ cgst: 90, sgst: 90, igst: 0 });
    const [b] = invoiceLines([{ itemCode: "X", description: "Plain", qty: 1, rate: 100, vatAmount: 5, vatPercent: 5 }]);
    expect("hsn" in b).toBe(false);
    expect("gst" in b).toBe(false);
  });
});

describe("gstBreakdown", () => {
  it("is null for an invoice priced without the split, so the rate table stays", () => {
    expect(gstBreakdown(invoiceLines([{ itemCode: "X", description: "Plain", qty: 1, rate: 100, vatAmount: 5, vatPercent: 5 }]))).toBeNull();
  });

  it("sums by HSN code and rate, with a total row", () => {
    const lines = invoiceLines([
      gstLine(),
      gstLine({ rate: 500, taxableAmount: 500, vatAmount: 90, gst: { cgst: 45, sgst: 45, igst: 0 } }),
      gstLine({ hsnCode: "9954", vatPercent: 5, rate: 200, taxableAmount: 200, vatAmount: 10, gst: { cgst: 5, sgst: 5, igst: 0 } }),
    ]);
    const b = gstBreakdown(lines);
    expect(b.rows.map((r) => [r.hsn, r.rate, r.taxable, r.cgst, r.sgst, r.igst])).toEqual([
      ["7318", 18, 1500, 135, 135, 0],
      ["9954", 5, 200, 5, 5, 0],
    ]);
    expect(b.total).toEqual({ taxable: 1700, cgst: 140, sgst: 140, igst: 0 });
  });

  it("adds the charges as a row of their own and leaves out reverse-charge lines", () => {
    const lines = invoiceLines([gstLine(), { ...gstLine({ taxKind: "reverse_charge", vatAmount: 0, rcmVat: 90, gst: { cgst: 0, sgst: 0, igst: 0 } }), taxKind: "reverse_charge" }]);
    const b = gstBreakdown(lines, [{ amount: 100, vatPercent: 18, gst: { cgst: 9, sgst: 9, igst: 0 } }]);
    expect(b.rows.some((r) => r.label === "Charges" && r.taxable === 100 && r.cgst === 9)).toBe(true);
    expect(b.total.taxable).toBe(1100);
  });

  it("an inter-state invoice is all IGST", () => {
    const b = gstBreakdown(invoiceLines([gstLine({ gst: { cgst: 0, sgst: 0, igst: 180 } })]));
    expect([b.total.cgst, b.total.sgst, b.total.igst]).toEqual([0, 0, 180]);
  });
});

describe("a sales document with a place of supply", () => {
  const company = { companyName: "Brivox", vatNumber: "27AAPFU0939F1ZV" };
  const customer = { customerId: "C1", customerName: "Far Co", trnNumber: "" };
  const so = { transactionNo: "SO-1", status: "APPROVED", date: "2026-11-02", items: [gstLine({ gst: { cgst: 0, sgst: 0, igst: 180 } })], placeOfSupply: "29", gstType: "inter" };

  it("prints the place of supply and hands the sheet its GST summary", () => {
    const { sheet } = buildSalesDocument(so, customer, company, "INR");
    expect(sheet.meta.some(([k, v]) => k === "Place of supply" && v === "29 - Karnataka")).toBe(true);
    expect(sheet.gstBreakdown.total.igst).toBe(180);
    expect(sheet.secondHalf).toBe("SGST");
  });

  it("prints exactly as before when the document has no place of supply or split", () => {
    const { sheet } = buildSalesDocument({ ...so, placeOfSupply: "", items: [{ itemCode: "X", description: "Plain", qty: 1, rate: 100, vatAmount: 5, vatPercent: 5 }] }, customer, company, "AED");
    expect(sheet.meta.some(([k]) => k === "Place of supply")).toBe(false);
    expect(sheet.gstBreakdown).toBeNull();
  });
});

describe("state names", () => {
  it("name a code, read a GSTIN, and call the second half UTGST in a union territory", () => {
    expect(stateName("27")).toBe("Maharashtra");
    expect(placeLabel("29")).toBe("29 - Karnataka");
    expect(placeLabel("25")).toBe("");
    expect(stateCodeOfGstin("29AAPFU0939F1ZV")).toBe("29");
    expect(stateCodeOfGstin("XX")).toBe("");
    expect(secondHalfLabel("38")).toBe("UTGST");
    expect(secondHalfLabel("27")).toBe("SGST");
  });
});
