import { afterEach, describe, expect, it } from "vitest";
import { isUae, say, taxIdWord, taxTerms, taxWord } from "../taxTerms";
import { resetOrgLocale, setOrgLocale } from "../../utils/orgLocale";

afterEach(() => resetOrgLocale());

describe("the tax words follow the organisation's country", () => {
  it("VAT and TRN in the UAE (the default), GST and GSTIN in India, VAT no. / GST no. / Tax no. elsewhere", () => {
    expect([taxWord(), taxIdWord(), isUae()]).toEqual(["VAT", "TRN", true]);
    setOrgLocale({ country: "IN" });
    expect([taxWord(), taxIdWord(), isUae()]).toEqual(["GST", "GSTIN", false]);
    expect(taxTerms("GB")).toMatchObject({ tax: "VAT", taxId: "VAT no." });
    expect(taxTerms("SG")).toMatchObject({ tax: "GST", taxId: "GST no." });
    expect(taxTerms("JP")).toMatchObject({ tax: "Tax", taxId: "Tax no." });
  });

  it("say() rewrites a help text written with VAT and TRN, whole words only", () => {
    expect(say("VAT paid on purchases, shown with the vendor's TRN.")).toBe("VAT paid on purchases, shown with the vendor's TRN.");
    setOrgLocale({ country: "IN" });
    expect(say("VAT paid on purchases, shown with the vendor's TRN.")).toBe("GST paid on purchases, shown with the vendor's GSTIN.");
    expect(say("VATable")).toBe("VATable");
    expect(say(undefined)).toBe("");
  });
});
