import { describe, it, expect } from "vitest";
import { passwordStrength, validateProfile } from "../settingsForm";

const company = { companyName: "NH Foods", addressLine1: "Deira", addressLine2: "", city: "Dubai", state: "Dubai", country: "United Arab Emirates", postalCode: "", phoneNumber: "", emailAddress: "", website: "" };
const bank = { bankName: "", accountName: "", accountNumber: "", ibanNumber: "", swiftCode: "", currency: "AED" };

describe("validateProfile", () => {
  it("accepts a complete profile with no bank details", () => {
    expect(validateProfile(company, bank)).toEqual({});
  });
  it("names each missing required field", () => {
    const e = validateProfile({ ...company, companyName: "", addressLine1: " ", city: "", state: "" }, bank);
    expect(Object.keys(e).sort()).toEqual(["addressLine1", "city", "companyName", "state"]);
  });
  it("accepts long top-level domains, which the old pattern refused", () => {
    expect(validateProfile({ ...company, emailAddress: "accounts@nhfoods.company" }, bank)).toEqual({});
    expect(validateProfile({ ...company, emailAddress: "not-an-email" }, bank).emailAddress).toBeTruthy();
  });
  it("checks the IBAN checksum and the SWIFT shape only when they are filled in", () => {
    expect(validateProfile(company, { ...bank, ibanNumber: "AE07 0331 2345 6789 0123 456", swiftCode: "ebilaead" })).toEqual({});
    expect(validateProfile(company, { ...bank, ibanNumber: "AE070331234567890123457" }).ibanNumber).toBeTruthy();
    expect(validateProfile(company, { ...bank, swiftCode: "EBIL" }).swiftCode).toBeTruthy();
    expect(validateProfile(company, { ...bank, swiftCode: "EBILAEADXXX" })).toEqual({});
  });
});

describe("passwordStrength", () => {
  it("rises with length, mixed case, digits and symbols", () => {
    expect(passwordStrength("abc")).toBe(0);
    expect(passwordStrength("abcdef")).toBe(1);
    expect(passwordStrength("abcdefghij")).toBe(2);
    expect(passwordStrength("abcdefGHIJ")).toBe(3);
    expect(passwordStrength("abcdefGHI1!")).toBe(4);
  });
});
