import { describe, it, expect } from "vitest";
import { VARIANTS, buildPayload } from "../variants";
import { formFromSaved } from "../editForm";

const stock = { _id: "s1", itemId: "ITM1", itemName: "Rice", salesPrice: 100, purchasePrice: 40, vatPercent: 5, taxPercent: 5, currentStock: 50, category: { name: "Rice" } };
const byId = new Map([["s1", stock]]);

describe("an invoice made in a foreign currency", () => {
  const V = VARIANTS.sales;
  const row = { ...V.rowTemplate(), itemId: "s1", description: "Rice", qty: "10", rate: "100", vatPercent: "5" };

  it("sends its currency and rate; the prices stay as typed, in that currency", () => {
    const p = buildPayload(V, { partyId: "c1", currency: "USD", exchangeRate: "3.6725" }, [row], byId);
    expect(p.currency).toBe("USD");
    expect(p.exchangeRate).toBe(3.6725);
    expect(p.items[0].price).toBe(100);
    expect(p.totalAmount).toBe(1050);
  });

  it("sends the reason for a rate away from the one on file, and sends no rate when none is set", () => {
    const p = buildPayload(V, { partyId: "c1", currency: "USD", rateOverrideReason: "agreed" }, [row], byId);
    expect(p.exchangeRate).toBeUndefined();
    expect(p.rateOverrideReason).toBe("agreed");
  });

  it("sends nothing about currency for a base-currency document, nor for a return (it follows its invoice)", () => {
    expect("currency" in buildPayload(V, { partyId: "c1" }, [row], byId)).toBe(false);
    const R = VARIANTS.salesReturn;
    const r = { ...R.rowTemplate(), itemId: "s1", qty: "1", rate: "100", vatPercent: "5" };
    expect("currency" in buildPayload(R, { partyId: "c1", currency: "USD", exchangeRate: "3.6725" }, [r], byId, { linkedRef: "o1" })).toBe(false);
  });

  it("is opened for editing in its own currency, with the rate it was made at", () => {
    const saved = {
      transactionNo: "SO-1", partyId: "c1", date: "2026-11-18", status: "DRAFT", discount: 0, totalAmount: 3856.13,
      items: [{ _id: "l1", itemId: "s1", description: "Rice", qty: 10, price: 367.25, rate: 3672.5, vatPercent: 5, vatAmount: 183.63, taxableAmount: 3672.5, lineTotal: 3856.13, fx: { price: 100, grossAmount: 1000, discountAmount: 0, taxableAmount: 1000, vatAmount: 50, lineTotal: 1050 } }],
      fx: { currency: "USD", rate: 3.6725, decimals: 2, totalAmount: 1050, outstandingAmount: 1050 },
    };
    const f = formFromSaved(V, saved);
    expect(f.currency).toBe("USD");
    expect(f.exchangeRate).toBe("3.6725");
    expect(String(f.items[0].rate)).toBe("100");
  });

  it("opens a base-currency document with no currency at all", () => {
    const f = formFromSaved(V, { transactionNo: "SO-2", partyId: "c1", items: [] });
    expect("currency" in f).toBe(false);
  });
});
