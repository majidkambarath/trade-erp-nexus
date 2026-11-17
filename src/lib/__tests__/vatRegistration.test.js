import { describe, expect, it } from "vitest";
import { noVatCodeOf, registeredFor, registeredFrom, salesWithoutVat } from "../vatRegistration";

const company = { vatNumber: "100123456700003", vatRegistered: true };

describe("is VAT switched off for what the organisation sells?", () => {
  it("only when the server says the rule governs it and it is not registered", () => {
    expect(salesWithoutVat({ vatRegistration: { governs: true, registered: false } })).toBe(true);
    expect(salesWithoutVat({ vatRegistration: { governs: true, registered: true } })).toBe(false);
    expect(salesWithoutVat({ vatRegistration: { governs: false, registered: true } })).toBe(false);
    // an older server, or a status still loading, changes nothing
    expect(salesWithoutVat({})).toBe(false);
    expect(salesWithoutVat(null)).toBe(false);
  });

  it("the No VAT code is the organisation's own active out-of-scope code", () => {
    const codes = [{ _id: "a", kind: "standard" }, { _id: "b", kind: "out_of_scope", isActive: false }, { _id: "c", kind: "out_of_scope" }];
    expect(noVatCodeOf(codes)._id).toBe("c");
    expect(noVatCodeOf([{ _id: "a", kind: "standard" }])).toBeNull();
  });
});

describe("was the organisation registered when this document was made?", () => {
  it("a stamp from the server wins", () => {
    expect(registeredFor(company, "2026-01-05", false)).toBe(false);
    expect(registeredFor({ ...company, vatRegistered: false }, "2026-01-05", true)).toBe(true);
    // a stamp cannot invent a number to print
    expect(registeredFor({ vatNumber: "" }, "2026-01-05", true)).toBe(false);
  });

  it("with no stamp (a document from before the rule) the company's details decide as they always did", () => {
    expect(registeredFor(company, "2026-01-05")).toBe(true);
    expect(registeredFor({ ...company, vatRegistered: false }, "2026-01-05")).toBe(false);
    expect(registeredFor({ vatNumber: "" }, "2026-01-05")).toBe(false);
    expect(registeredFor(undefined, undefined)).toBe(false);
  });

  it("and the registration day, when there is one, splits the invoices before it from the ones on and after it", () => {
    const c = { ...company, vatRegisteredFrom: "2026-03-01" };
    expect(registeredFrom(c)).toBe("2026-03-01");
    expect(registeredFor(c, "2026-02-28")).toBe(false);
    expect(registeredFor(c, "2026-03-01")).toBe(true);
    expect(registeredFor(c, "2026-03-01T10:00:00.000Z")).toBe(true);
    expect(registeredFor(c, undefined)).toBe(true); // no date to judge: the company's own answer
  });
});
