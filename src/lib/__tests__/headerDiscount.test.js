import { describe, expect, it } from "vitest";
import { shareHeaderDiscount } from "../headerDiscount";

// The form's preview of a discount on the whole invoice. The worked examples are the server's (trade ERP node/utils/__tests__/headerDiscount.test.js).
describe("shareHeaderDiscount", () => {
  it("105 off one 5% line of 1,000 takes 100 off the net and 5 off the tax", () => {
    expect(shareHeaderDiscount([{ net: 1000, vat: 50 }], 105)).toEqual({ applied: 105, net: 900, tax: 45 });
  });

  it("is shared by what each line costs, and the total falls by exactly the amount", () => {
    const lines = [{ net: 100, vat: 5 }, { net: 300, vat: 15 }, { net: 100, vat: 0 }]; // 105 + 315 + 100 = 520
    const r = shareHeaderDiscount(lines, 52);
    expect(r.applied).toBe(52);
    expect(Math.round((r.net + r.tax) * 100) / 100).toBe(468);
    expect(r.tax).toBe(18); // a tenth off the 20 of tax
  });

  it("is held to what the lines cost, and does nothing for nothing", () => {
    expect(shareHeaderDiscount([{ net: 100, vat: 5 }], 500)).toEqual({ applied: 105, net: 0, tax: 0 });
    expect(shareHeaderDiscount([{ net: 100, vat: 5 }], 0)).toEqual({ applied: 0, net: 100, tax: 5 });
    expect(shareHeaderDiscount([], 10)).toEqual({ applied: 0, net: 0, tax: 0 });
  });

  it("the total never moves, whatever the amounts", () => {
    let seed = 11;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let n = 0; n < 500; n++) {
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => {
        const net = Math.round(rnd() * 50000) / 100;
        const rate = [0, 5, 18][Math.floor(rnd() * 3)];
        return { net, vat: Math.round(net * rate) / 100 };
      });
      const total = Math.round(lines.reduce((t, l) => t + l.net + l.vat, 0) * 100) / 100;
      const typed = Math.round(rnd() * total * 90) / 100;
      const r = shareHeaderDiscount(lines, typed);
      expect(Math.round((r.net + r.tax) * 100) / 100).toBeCloseTo(total - r.applied, 2);
    }
  });
});
