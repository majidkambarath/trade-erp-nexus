import { describe, it, expect } from "vitest";
import { approvalsFrom, approvalsPayload, passwordStrength, validateProfile } from "../settingsForm";

const company = { companyName: "Harbour Trading", addressLine1: "Deira", addressLine2: "", city: "Dubai", state: "Dubai", country: "United Arab Emirates", postalCode: "", phoneNumber: "", emailAddress: "", website: "" };
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
    expect(validateProfile({ ...company, emailAddress: "accounts@harbourtrading.company" }, bank)).toEqual({});
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

describe("the approval rules form", () => {
  it("starts from what the server stored, and an unset rule reads as off", () => {
    expect(approvalsFrom({ separateApprover: true, secondApprovalAbove: 5000 })).toEqual({ separateApprover: true, secondApprovalAbove: "5000" });
    expect(approvalsFrom({ separateApprover: false, secondApprovalAbove: null })).toEqual({ separateApprover: false, secondApprovalAbove: "" });
    expect(approvalsFrom(undefined)).toEqual({ separateApprover: false, secondApprovalAbove: "" });
    expect(approvalsFrom({ secondApprovalAbove: 0 }).secondApprovalAbove).toBe("0"); // 0 is a real amount: every document needs two
  });

  it("sends the amount as a number, and nothing as null (switched off)", () => {
    expect(approvalsPayload({ separateApprover: true, secondApprovalAbove: "5000" })).toEqual({ ok: true, body: { approvals: { separateApprover: true, secondApprovalAbove: 5000 } } });
    expect(approvalsPayload({ separateApprover: false, secondApprovalAbove: " 1,250.50 " }).body.approvals.secondApprovalAbove).toBe(1250.5);
    expect(approvalsPayload({ separateApprover: false, secondApprovalAbove: "" }).body.approvals.secondApprovalAbove).toBeNull();
    expect(approvalsPayload({ separateApprover: false, secondApprovalAbove: "0" }).body.approvals.secondApprovalAbove).toBe(0);
  });

  it("refuses an amount that is not an amount, before anything is sent", () => {
    for (const bad of ["plenty", "-5", "5 000", "1e3", "5.", "."]) expect(approvalsPayload({ separateApprover: false, secondApprovalAbove: bad }).ok).toBe(false);
    expect(approvalsPayload({ separateApprover: false, secondApprovalAbove: "plenty" }).error).toMatch(/amount of 0 or more/);
  });
});
