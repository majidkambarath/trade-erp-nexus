import { describe, expect, it } from "vitest";
import { amountIn, inDocumentCurrency, isForeignDoc } from "../foreignDocument";

const stored = {
  totalAmount: 3856.13, paidAmount: 0, outstandingAmount: 3856.13, pricing: { lineVat: 183.63, chargesVat: 0, grandTotal: 3856.13 },
  items: [{ qty: 10, price: 367.25, taxableAmount: 3672.5, vatAmount: 183.63, lineTotal: 3856.13, rate: 3672.5, fx: { price: 100, grossAmount: 1000, discountAmount: 0, taxableAmount: 1000, vatAmount: 50, lineTotal: 1050 } }],
  charges: [{ description: "Freight", amount: 146.9, vatAmount: 7.35, fx: { amount: 40, vatAmount: 2 } }],
  fx: { currency: "USD", rate: 3.6725, decimals: 2, totalAmount: 1050, paidAmount: 0, creditedAmount: 0, outstandingAmount: 1050, pricing: { grandTotal: 1050, lineVat: 50, net: 1000 } },
};

describe("a document in a foreign currency", () => {
  it("is shown in its own currency, with the base figures kept aside", () => {
    const d = inDocumentCurrency(stored);
    expect(d.currency).toBe("USD");
    expect(d.exchangeRate).toBe(3.6725);
    expect(d.totalAmount).toBe(1050);
    expect(d.outstandingAmount).toBe(1050);
    expect(d.items[0].price).toBe(100);
    expect(d.items[0].vatAmount).toBe(50);
    expect(d.items[0].base.vatAmount).toBe(183.63);
    expect(d.charges[0].amount).toBe(40);
    expect(d.pricing.grandTotal).toBe(1050);
    expect(d.base.totalAmount).toBe(3856.13);
    expect(d.base.vatAmount).toBe(183.63);
  });
  it("leaves a base-currency document exactly as it is", () => {
    const base = { totalAmount: 105, items: [{ price: 100 }] };
    expect(inDocumentCurrency(base)).toBe(base);
    expect(isForeignDoc(base)).toBe(false);
    expect(isForeignDoc(stored)).toBe(true);
  });
  it("does not change its input", () => {
    const copy = JSON.parse(JSON.stringify(stored));
    inDocumentCurrency(stored);
    expect(stored).toEqual(copy);
  });
  it("names the currency in an amount", () => {
    expect(amountIn("USD", 1050)).toBe("USD 1,050.00");
    expect(amountIn("", 1050)).toBe("1,050.00");
  });
});
