import { describe, it, expect } from "vitest";
import {
  bankRows,
  companyBlock,
  invoiceLines,
  rowsWithValue,
  tint,
  totalInWords,
  vatBreakdown,
  withChargesVat,
} from "../invoiceModel";

describe("tint", () => {
  it("mixes the accent with white by the share given", () => {
    expect(tint("#000000", 0.5)).toBe("#808080");
    expect(tint("#ffffff", 0.1)).toBe("#ffffff");
  });
});

describe("invoiceLines", () => {
  it("derives the unit price from the line value and quantity", () => {
    const [line] = invoiceLines([{ itemCode: "QA 1", description: "Dates", qty: 23, rate: 227.7, vatAmount: 11.39, vatPercent: 5 }]);
    expect(line.unitPrice).toBeCloseTo(9.9, 2);
    expect(line.total).toBeCloseTo(239.09, 2);
  });

  it("keeps a stored 0% rate as 0 (it used to print 5)", () => {
    const [line] = invoiceLines([{ qty: 1, rate: 100, vatAmount: 0, vatPercent: 0 }]);
    expect(line.vatPercent).toBe(0);
  });

  it("treats a line with no stored rate as the standard 5%", () => {
    const [line] = invoiceLines([{ qty: 1, rate: 100, vatAmount: 5 }]);
    expect(line.vatPercent).toBe(5);
  });

  it("reads numeric strings from older documents", () => {
    const [line] = invoiceLines([{ qty: "2", rate: "200", vatAmount: "10", vatPercent: "5" }]);
    expect(line.unitPrice).toBe(100);
    expect(line.total).toBe(210);
  });
});

describe("vatBreakdown", () => {
  it("groups the lines by rate, highest rate first", () => {
    const lines = invoiceLines([
      { qty: 1, rate: 100, vatAmount: 5, vatPercent: 5 },
      { qty: 1, rate: 50, vatAmount: 0, vatPercent: 0 },
      { qty: 1, rate: 25, vatAmount: 1.25, vatPercent: 5 },
    ]);
    expect(vatBreakdown(lines)).toEqual([
      { rate: 5, taxable: 125, vat: 6.25 },
      { rate: 0, taxable: 50, vat: 0 },
    ]);
  });

  it("adds a charges row when the charges carry VAT, so the breakdown adds up to the total VAT", () => {
    const rows = vatBreakdown(invoiceLines([{ qty: 1, rate: 100, vatAmount: 5, vatPercent: 5 }]));
    const withCharges = withChargesVat(rows, 6.5);
    expect(withCharges.at(-1)).toEqual({ rate: null, label: "Charges", taxable: 0, vat: 1.5 });
  });

  it("adds no charges row when the lines already account for the VAT", () => {
    const rows = vatBreakdown(invoiceLines([{ qty: 1, rate: 100, vatAmount: 5, vatPercent: 5 }]));
    expect(withChargesVat(rows, 5)).toHaveLength(1);
  });
});

describe("placeholders are never printed", () => {
  it("leaves the company block empty when Settings has nothing", () => {
    const c = companyBlock({});
    expect(c.nameEn).toBe("");
    expect(c.address).toEqual([]);
    expect(c.contact).toEqual([]);
    expect(c.trn).toBe("");
  });

  it("prints only the contact details that are set", () => {
    const c = companyBlock({ phoneNumber: "+971 4 000 0000", email: "" });
    expect(c.contact).toEqual(["Tel: +971 4 000 0000"]);
  });

  it("drops empty bank rows, so an unset account is not printed", () => {
    expect(bankRows({ bankName: "", accountNumber: "", ibanNumber: "AE07 0331" })).toEqual([["IBAN", "AE07 0331"]]);
    expect(bankRows({})).toEqual([]);
  });

  it("drops rows without a value", () => {
    expect(rowsWithValue([["A", "1"], ["B", ""], ["C", null], ["D", undefined], ["E", 0]])).toEqual([["A", "1"], ["E", 0]]);
  });
});

describe("totalInWords", () => {
  it("writes the total in dirhams and fils", () => {
    expect(totalInWords(239.09, "AED")).toBe("Two Hundred Thirty Nine Dirhams and Nine Fils Only");
  });

  it("uses the code for a currency it does not know", () => {
    expect(totalInWords(10, "XYZ")).toContain("XYZ");
  });
});
