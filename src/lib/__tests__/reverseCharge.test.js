import { describe, it, expect } from "vitest";
import { REVERSE_CHARGE, SUPPLIER_STATEMENT, isReverseCharge, lineHint, recipientStatement, taxCodeLabel } from "../reverseCharge";

describe("is it reverse charge?", () => {
  it("reads a tax code, a saved line and a form row", () => {
    expect(isReverseCharge({ kind: REVERSE_CHARGE })).toBe(true); // a tax code
    expect(isReverseCharge({ taxKind: "reverse_charge" })).toBe(true); // a saved line
    expect(isReverseCharge({ reverseCharge: true })).toBe(true); // a form row, once its code is chosen
  });

  it("is false for every other kind, for nothing and for a missing code", () => {
    for (const x of [{ kind: "standard" }, { taxKind: "zero_rated" }, { taxKind: null }, { reverseCharge: false }, {}, null, undefined]) {
      expect(isReverseCharge(x)).toBe(false);
    }
  });
});

describe("what the screens say", () => {
  it("names a reverse-charge code for what it does, and leaves the others alone", () => {
    expect(taxCodeLabel({ name: "Reverse charge 5%", kind: "reverse_charge", ratePercent: 5 })).toBe("Reverse charge 5% (5% self-assessed)");
    expect(taxCodeLabel({ name: "Standard 5%", kind: "standard", ratePercent: 5 })).toBe("Standard 5% (5%)");
  });

  it("explains the VAT cell of a line that shows 0", () => {
    expect(lineHint(5, "AED 20.00")).toBe("Reverse charge: 5% = AED 20.00 self-assessed");
  });

  it("the supplier's invoice says the recipient accounts for the VAT, citing the Decree-Law (Executive Regulation Art. 59(1)(l))", () => {
    expect(SUPPLIER_STATEMENT).toMatch(/reverse charge applies/i);
    expect(SUPPLIER_STATEMENT).toMatch(/accounted for by the recipient/i);
    expect(SUPPLIER_STATEMENT).toMatch(/Federal Decree-Law No\. 8 of 2017, Article 48/);
  });

  it("our own purchase says the VAT is ours, not the supplier's", () => {
    const text = recipientStatement("AED 45.00");
    expect(text).toMatch(/AED 45\.00/);
    expect(text).toMatch(/not payable to the supplier/);
  });
});
