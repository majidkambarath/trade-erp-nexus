import { describe, it, expect } from "vitest";
import { documentTotals, purchaseReturnTotals, salesReturnPayloadItem, rowLine } from "../lineMath";

describe("purchase return totals (regression: every return saved totalAmount 0)", () => {
  // These are the row fields POForm.addItem actually creates.
  const row = (qty, currentPurchasePrice, vatPercent) => ({
    itemId: "stock-1",
    qty: String(qty),
    currentPurchasePrice: String(currentPurchasePrice),
    vatPercent: String(vatPercent),
    total: "0.00",
  });

  it("posts the VAT-inclusive total of its lines, not zero", () => {
    const t = purchaseReturnTotals([row(10, 12.5, 5)]);
    expect(t.subtotal).toBe("125.00");
    expect(t.tax).toBe("6.25");
    expect(t.total).toBe("131.25");
  });

  it("sums several lines with mixed VAT correctly", () => {
    const t = purchaseReturnTotals([row(10, 12.5, 5), row(4, 22, 0)]);
    expect(t.subtotal).toBe("213.00");
    expect(t.total).toBe("219.25");
  });

  it("ignores rows that have no item or no quantity", () => {
    const blank = { itemId: "", qty: "", currentPurchasePrice: "5", vatPercent: "5" };
    expect(purchaseReturnTotals([blank, row(2, 10, 5)]).total).toBe("21.00");
  });

  it("returns zeros for an empty document", () => {
    expect(purchaseReturnTotals([])).toEqual({ subtotal: "0.00", tax: "0.00", total: "0.00", discount: "0.00" });
  });
});

describe("sales return payload (regressions: wrong VAT field, quantity counted twice)", () => {
  const salesRow = { itemId: "stock-9", description: "Juice", qty: "10", salesPrice: "12.5", taxPercent: "5", category: "Drinks" };

  it("sends vatPercent, never taxPercent, which the backend ignores", () => {
    const p = salesReturnPayloadItem(salesRow);
    expect(p.vatPercent).toBe(5);
    expect(p).not.toHaveProperty("taxPercent");
  });

  it("line total is VAT-inclusive and counts quantity exactly once", () => {
    // 10 x 12.50 = 125.00 value, + 5% = 131.25. The old formula gave 10 x 125 x 1.05 = 1312.50.
    const p = salesReturnPayloadItem(salesRow);
    expect(p.rate).toBe(125);
    expect(p.vatAmount).toBe(6.25);
    expect(p.lineTotal).toBe(131.25);
  });

  it("keeps quantity positive; direction comes from the transaction type", () => {
    expect(salesReturnPayloadItem({ ...salesRow, qty: "-4" }).qty).toBe(4);
  });
});

describe("line maths agrees with the backend contract", () => {
  // Mirrors calculateItems in services/orderPurchase/transactionService.js.
  const backend = (qty, price, vat) => {
    const value = qty * price;
    const vatAmount = (value * vat) / 100;
    return { vatAmount: +vatAmount.toFixed(2), lineTotal: +(value + vatAmount).toFixed(2) };
  };
  it.each([[10, 12.5, 5], [3, 99.99, 5], [7, 33.33, 0], [120, 8.75, 5]])(
    "qty=%s price=%s vat=%s%%",
    (q, p, v) => {
      const got = rowLine({ qty: q, price: p, vatPercent: v });
      const want = backend(q, p, v);
      expect(got.vatAmount).toBeCloseTo(want.vatAmount, 2);
      expect(got.lineTotal).toBeCloseTo(want.lineTotal, 2);
    }
  );
});

describe("documentTotals", () => {
  it("prices each row with the function the caller supplies", () => {
    const rows = [{ itemId: "a", qty: 2, rate: 10, vatPercent: 0 }];
    expect(documentTotals(rows, (r) => r.rate).total).toBe("20.00");
  });
});

// ================================= reverse charge =================================
// The supplier charges no VAT; the buyer assesses it. A reverse-charge line has VAT 0 and lineTotal = lineValue, with the assessed VAT
// as `rcmVat` beside them: the preview of what the server prices (utils/pricing.js) and posts.
describe("reverse charge", () => {
  it("a line has no VAT in its total and carries the assessed VAT beside it", () => {
    const l = rowLine({ qty: "4", price: "100", vatPercent: "5", reverseCharge: true });
    expect(l).toMatchObject({ lineValue: 400, vatAmount: 0, lineTotal: 400, rcmVat: 20, reverseCharge: true });
  });

  it("is assessed on the discounted value", () => {
    expect(rowLine({ qty: "10", price: "100", vatPercent: "5", discountPercent: "10", reverseCharge: true })).toMatchObject({ lineValue: 900, vatAmount: 0, lineTotal: 900, rcmVat: 45 });
  });

  it("any other line is exactly what it was, with no reverse-charge keys", () => {
    const l = rowLine({ qty: "4", price: "100", vatPercent: "5" });
    expect(l).toEqual({ lineValue: 400, vatAmount: 20, lineTotal: 420, lineGross: 400, discount: 0 });
    expect(rowLine({ qty: "4", price: "100", vatPercent: "5", reverseCharge: false })).toEqual(l);
  });

  it("a document keeps the assessed VAT out of its total, and only a document with a reverse-charge line has the key", () => {
    const rows = [
      { itemId: "a", qty: "4", price: "100", vatPercent: "5", reverseCharge: true },
      { itemId: "b", qty: "2", price: "100", vatPercent: "5" },
    ];
    expect(documentTotals(rows, (r) => r.price)).toEqual({ subtotal: "600.00", tax: "10.00", total: "610.00", discount: "0.00", rcmVat: "20.00" });
    expect(documentTotals([rows[1]], (r) => r.price)).not.toHaveProperty("rcmVat");
  });
});
