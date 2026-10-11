import { describe, it, expect } from "vitest";
import { partyVat, vatAdvice } from "../partyVat";

describe("partyVat", () => {
  it("reads the master's status and TRN", () => {
    expect(partyVat({ vat: { status: "registered", trn: "100234561200003" } })).toMatchObject({ status: "registered", label: "VAT registered", trn: "100234561200003", missingTrn: false });
    expect(partyVat({ vat: { status: "unregistered" } })).toMatchObject({ status: "unregistered", label: "Not VAT registered", trn: "" });
    expect(partyVat({ vat: { status: "exempt" } }).label).toBe("VAT exempt");
    expect(partyVat({ vat: { status: "designated_zone", trn: "100234561200003" } }).label).toBe("Designated zone");
  });

  it("falls back to the legacy TRN fields of a record saved before the VAT block", () => {
    expect(partyVat({ trnNumber: "100123456700003" })).toMatchObject({ status: "registered", trn: "100123456700003" });
    expect(partyVat({ trnNO: "100123456700004" })).toMatchObject({ status: "registered", trn: "100123456700004" });
    expect(partyVat({ customerName: "Walk-in" })).toMatchObject({ status: "unregistered", trn: "" });
  });

  it("flags a registration with no number", () => {
    expect(partyVat({ vat: { status: "registered" } }).missingTrn).toBe(true);
    expect(partyVat({ vat: { status: "unregistered" } }).missingTrn).toBe(false);
  });

  it("says nothing for no party", () => {
    expect(partyVat(null)).toBeNull();
    expect(vatAdvice({ partyType: "Vendor", party: null })).toEqual([]);
  });
});

describe("vatAdvice", () => {
  const unregistered = { vat: { status: "unregistered" } };
  const registered = { vat: { status: "registered", trn: "100234561200003" } };

  it("warns when VAT is on a purchase from a vendor that is not registered", () => {
    const [n] = vatAdvice({ partyType: "Vendor", party: unregistered, vatAmount: 10 });
    expect(n.tone).toBe("warning");
    expect(n.text).toMatch(/cannot charge VAT/);
    expect(n.text).toMatch(/cannot be claimed back/);
  });

  it("is only a note when there is no VAT on the purchase", () => {
    const [n] = vatAdvice({ partyType: "Vendor", party: unregistered, vatAmount: 0 });
    expect(n.tone).toBe("info");
  });

  it("tells a sale to an unregistered customer that no TRN prints and VAT still applies", () => {
    const [n] = vatAdvice({ partyType: "Customer", party: unregistered, vatAmount: 50 });
    expect(n.tone).toBe("info");
    expect(n.text).toMatch(/no customer TRN/);
    expect(n.text).toMatch(/VAT is charged/);
  });

  it("warns on a registered party with no TRN, on either side", () => {
    expect(vatAdvice({ partyType: "Customer", party: { vat: { status: "registered" } } })[0]).toMatchObject({ tone: "warning" });
    expect(vatAdvice({ partyType: "Vendor", party: { vat: { status: "registered" } } })[0].text).toMatch(/no TRN on file/);
  });

  it("has nothing to say about an ordinary registered party", () => {
    expect(vatAdvice({ partyType: "Vendor", party: registered, vatAmount: 100 })).toEqual([]);
    expect(vatAdvice({ partyType: "Customer", party: registered, vatAmount: 100 })).toEqual([]);
  });

  it("points an exempt or designated-zone party to the tax code", () => {
    expect(vatAdvice({ partyType: "Customer", party: { vat: { status: "exempt" } } })[0].text).toMatch(/tax code/);
    expect(vatAdvice({ partyType: "Vendor", party: { vat: { status: "designated_zone", trn: "100234561200003" } } })[0].text).toMatch(/designated zone/);
  });
});
