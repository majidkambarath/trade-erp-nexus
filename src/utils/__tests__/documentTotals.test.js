import { describe, it, expect } from "vitest";
import { documentTotals } from "../documentTotals";

describe("documentTotals", () => {
  it("uses the server's pricing, so charges, header discount and round-off reach the printout", () => {
    const t = documentTotals({
      items: [{ rate: 3600, vatAmount: 180 }],
      charges: [{ description: "Freight", amount: 50, vatAmount: 2.5 }, { description: "Free", amount: 0 }],
      pricing: { gross: 4000, lineDiscount: 400, net: 3600, lineVat: 180, chargesNet: 50, chargesVat: 2.5, headerDiscount: 10, roundOff: 0.5, grandTotal: 3823 },
    });
    expect(t).toMatchObject({ priced: true, gross: 3600, lineDiscount: 400, chargesNet: 50, vat: 182.5, headerDiscount: 10, roundOff: 0.5, grandTotal: 3823 });
    expect(t.charges).toHaveLength(1); // a zero charge is not printed
    // the printed rows add up to the grand total
    expect(t.gross + t.chargesNet + t.vat - t.headerDiscount + t.roundOff).toBeCloseTo(t.grandTotal, 2);
  });

  it("falls back to the line sums for documents saved before server pricing existed", () => {
    const t = documentTotals({ discount: 20, items: [{ rate: 200, vatAmount: 10 }, { rate: 300, vatAmount: 15 }] });
    expect(t).toMatchObject({ priced: false, gross: 500, vat: 25, headerDiscount: 20, grandTotal: 505 });
  });
});

describe("documentTotals: reverse charge", () => {
  it("reads the VAT the buyer assesses from the server's pricing, apart from the VAT and the total", () => {
    const t = documentTotals({
      items: [{ rate: 400, vatAmount: 0, rcmVat: 20 }, { rate: 200, vatAmount: 10 }],
      pricing: { net: 600, lineDiscount: 0, lineVat: 10, rcmVat: 20, chargesNet: 0, chargesVat: 0, headerDiscount: 0, roundOff: 0, grandTotal: 610 },
    });
    expect(t.rcmVat).toBe(20);
    expect(t.vat).toBe(10);
    expect(t.grandTotal).toBe(610);
  });

  it("falls back to the lines when the document has no pricing (as the list's rows do), and is 0 with none", () => {
    expect(documentTotals({ items: [{ rate: 400, vatAmount: 0, rcmVat: 20 }, { rate: 200, vatAmount: 10 }] })).toMatchObject({ rcmVat: 20, vat: 10, grandTotal: 610 });
    expect(documentTotals({ items: [{ rate: 200, vatAmount: 10 }] }).rcmVat).toBe(0);
    expect(documentTotals({ items: [{ rate: 1, vatAmount: 0 }], pricing: { net: 1, lineVat: 0, grandTotal: 1 } }).rcmVat).toBe(0);
  });
});
