import { describe, expect, it } from "vitest";
import {
  DOC_STATUS, addRow, daysToTerms, documentStatus, emptyBankAccount, emptyContact, emptyParty, errorCountBySection, expirySummary, fieldForServerError,
  firstSectionWithErrors, formToPayload, isValidSwift, isValidTrn, normalizeTrn, partyToForm, removeRow, sectionOf, setPrimary, termOptions, termsToDays,
  toDay, validateParty, withCreditDays, withPaymentTerms,
} from "../partyForms";

const TRN = "100123456700003";
const IBAN = "AE070331234567890123456"; // checksum-valid

const filled = (kind = "customer", over = {}) => ({
  ...emptyParty(kind), name: kind === "vendor" ? "Gulf Mills" : "Al Noor Mart", contactPerson: "Sara Khan",
  billingAddress: "Deira, Dubai", address: "Jebel Ali", ...over,
});

describe("TRN and SWIFT", () => {
  it("a TRN is exactly 15 digits, spaces and dashes ignored", () => {
    expect(isValidTrn(TRN)).toBe(true);
    expect(isValidTrn("1001 2345 6700 003")).toBe(true);
    expect(isValidTrn("100-123-456-700-003")).toBe(true);
    expect(isValidTrn("10012345670000")).toBe(false);
    expect(isValidTrn("1001234567000030")).toBe(false);
    expect(isValidTrn("10012345670000A")).toBe(false);
    expect(normalizeTrn(" 1001 2345-6700 003 ")).toBe(TRN);
  });
  it("SWIFT / BIC has 8 or 11 characters in the BIC pattern", () => {
    for (const ok of ["EBILAEAD", "ebilaead", "EBILAEADXXX", "EBIL AEAD"]) expect(isValidSwift(ok)).toBe(true);
    for (const bad of ["EBILAEA", "EBILAEADX", "EBILAEADXX", "1234AEAD", ""]) expect(isValidSwift(bad)).toBe(false);
  });
});

describe("payment terms and credit days", () => {
  it("reads days from the wording, and finds the wording for days", () => {
    expect(termsToDays("Net 45")).toBe(45);
    expect(termsToDays("60 days")).toBe(60);
    expect(termsToDays("Cash on Delivery")).toBe(0);
    expect(termsToDays("COD")).toBe(0);
    expect(daysToTerms("customer", 0)).toBe("Cash on Delivery");
    expect(daysToTerms("vendor", 0)).toBe("COD");
    expect(daysToTerms("customer", 90)).toBe("Net 90");
    expect(daysToTerms("vendor", 45, "45 days")).toBe("45 days");
    expect(daysToTerms("customer", 0, "Prepaid")).toBe("Prepaid");
  });
  it("choosing a term sets the days, typing the days sets the term", () => {
    const f = withPaymentTerms(filled(), "customer", "Net 60");
    expect([f.paymentTerms, f.creditDays]).toEqual(["Net 60", "60"]);
    const g = withCreditDays(f, "customer", "90");
    expect([g.paymentTerms, g.creditDays]).toEqual(["Net 90", "90"]);
    const h = withCreditDays(g, "customer", "");
    expect([h.paymentTerms, h.creditDays]).toEqual(["Net 90", ""]); // clearing the days keeps the label
    expect(withCreditDays(g, "customer", "9999").paymentTerms).toBe("Net 90"); // an impossible number changes nothing
    expect(termOptions("customer", "Net 90")).toEqual(["Net 30", "Net 45", "Net 60", "Cash on Delivery", "Prepaid", "Net 90"]);
    expect(termOptions("vendor", "COD")).toHaveLength(6);
  });
});

describe("document expiry (Dubai calendar day)", () => {
  const at = (expiry, over = {}) => documentStatus(expiry, { today: "2026-10-05", ...over });
  it("today, today + 30 and yesterday are the edges", () => {
    expect(at("2026-10-04")).toEqual({ status: DOC_STATUS.EXPIRED, daysLeft: -1 });
    expect(at("2026-10-05")).toEqual({ status: DOC_STATUS.EXPIRING_SOON, daysLeft: 0 });
    expect(at("2026-11-04")).toEqual({ status: DOC_STATUS.EXPIRING_SOON, daysLeft: 30 });
    expect(at("2026-11-05")).toEqual({ status: DOC_STATUS.VALID, daysLeft: 31 });
  });
  it("no date is no expiry; a bad date is invalid", () => {
    for (const none of ["", null, undefined, "  "]) expect(at(none).status).toBe(DOC_STATUS.NO_EXPIRY);
    for (const bad of ["abc", "2026-02-30", "31/12/2026"]) expect(at(bad).status).toBe(DOC_STATUS.INVALID_DATE);
  });
  it("reads a server timestamp at UTC midnight as that day, and any other moment on the Dubai calendar", () => {
    expect(toDay("2026-10-04T00:00:00.000Z")).toBe("2026-10-04");
    expect(toDay("2026-10-04T20:00:00.000Z")).toBe("2026-10-05"); // Dubai midnight
    expect(toDay("2026-10-04")).toBe("2026-10-04");
    expect(toDay("")).toBe("");
    expect(at("2026-10-04T00:00:00.000Z").status).toBe(DOC_STATUS.EXPIRED);
  });
  it("summarises a party's documents by the one that needs attention first", () => {
    const docs = [
      { typeName: "Passport", expiryDate: "2027-01-01" },
      { typeName: "Trade licence", expiryDate: "2026-10-15" },
      { typeName: "Emirates ID", expiryDate: "2026-09-30" },
      { typeName: "Bank letter", expiryDate: "" },
    ];
    expect(expirySummary(docs, { today: "2026-10-05" })).toEqual({ status: DOC_STATUS.EXPIRED, daysLeft: -5, typeName: "Emirates ID", count: 2 });
    expect(expirySummary(docs.slice(0, 2), { today: "2026-10-05" })).toMatchObject({ status: DOC_STATUS.EXPIRING_SOON, daysLeft: 10, typeName: "Trade licence", count: 1 });
    expect(expirySummary([docs[0], docs[3]], { today: "2026-10-05" })).toBeNull();
    expect(expirySummary(undefined)).toBeNull();
  });
});

describe("rows with one primary", () => {
  it("the first row added is primary; setPrimary moves it; removing the primary hands it on", () => {
    let rows = addRow([], emptyContact());
    rows = addRow(rows, emptyContact());
    expect(rows.map((r) => r.isPrimary)).toEqual([true, false]);
    rows = setPrimary(rows, 1);
    expect(rows.map((r) => r.isPrimary)).toEqual([false, true]);
    rows = removeRow(rows, 1);
    expect(rows.map((r) => r.isPrimary)).toEqual([true]);
    expect(removeRow([], 0)).toEqual([]);
    const banks = addRow(addRow([], emptyBankAccount()), emptyBankAccount());
    expect(banks.filter((b) => b.isPrimary)).toHaveLength(1);
  });
});

describe("validateParty", () => {
  it("asks for the name, contact person and billing address of a customer; the address of a vendor", () => {
    expect(validateParty("customer", emptyParty("customer"))).toMatchObject({
      name: "Customer name is required", contactPerson: "Contact person is required", billingAddress: "Billing address is required",
    });
    expect(validateParty("vendor", emptyParty("vendor"))).toMatchObject({ name: "Vendor name is required", address: "Address is required" });
    expect(validateParty("customer", filled())).toEqual({});
    expect(validateParty("vendor", filled("vendor"))).toEqual({});
  });
  it("a registered party needs a 15-digit TRN; the message counts what was typed", () => {
    const f = (over) => filled("customer", over);
    expect(validateParty("customer", f({ vatStatus: "registered" }))["vat.trn"]).toBe("Enter the 15-digit TRN");
    expect(validateParty("customer", f({ vatStatus: "registered", trn: "12345" }))["vat.trn"]).toBe("A UAE TRN is exactly 15 digits (5 entered)");
    expect(validateParty("customer", f({ vatStatus: "designated_zone", trn: "12345" }))["vat.trn"]).toMatch(/15 digits/);
    expect(validateParty("customer", f({ vatStatus: "registered", trn: "1001 2345 6700 003" }))).toEqual({});
    expect(validateParty("customer", f({ vatStatus: "exempt" }))).toEqual({}); // exempt may have none
    expect(validateParty("customer", f({ vatStatus: "exempt", trn: "12" }))["vat.trn"]).toMatch(/15 digits/);
    expect(validateParty("customer", f({ vatStatus: "unregistered", trn: "" }))).toEqual({});
    // a half-typed form is not scolded for what is only needed on save
    expect(validateParty("customer", f({ vatStatus: "registered" }), { strict: false })["vat.trn"]).toBeUndefined();
  });
  it("email, phone, website, credit limit and credit days", () => {
    const e = validateParty("customer", filled("customer", { email: "nope", phone: "12", website: "not a site", creditLimit: "-5", creditDays: "400" }));
    expect(Object.keys(e).sort()).toEqual(["credit.days", "creditLimit", "email", "phone", "website"]);
    expect(validateParty("customer", filled("customer", { email: "a@b.ae", phone: "+971 50 123 4567", website: "www.example.ae", creditLimit: "1500.50", creditDays: "45" }))).toEqual({});
    expect(validateParty("customer", filled("customer", { creditDays: "1.5" }))["credit.days"]).toMatch(/whole number/);
  });
  it("contacts: a named row, a valid email; empty rows are ignored", () => {
    const f = filled("customer", { contacts: [emptyContact(), { ...emptyContact(), email: "x@y.ae" }, { ...emptyContact(), name: "Huda", email: "bad" }] });
    expect(validateParty("customer", f)).toEqual({ "contacts.1.name": "Enter the contact's name", "contacts.2.email": "Enter a valid email address" });
  });
  it("bank accounts: bank, account or IBAN, IBAN checksum, SWIFT", () => {
    const row = (over) => ({ ...emptyBankAccount(), isPrimary: true, ...over });
    const run = (over) => validateParty("vendor", filled("vendor", { bankAccounts: [row(over)] }));
    expect(run({ bankName: "ADCB", iban: IBAN, swiftCode: "ADCBAEAA" })).toEqual({});
    expect(run({ accountNumber: "123456" })["bankAccounts.0.bankId"]).toBe("Choose the bank");
    expect(run({ bankName: "ADCB" })["bankAccounts.0.accountNumber"]).toBe("Enter the account number or the IBAN");
    expect(run({ bankName: "ADCB", iban: "AE070331234567890123457" })["bankAccounts.0.iban"]).toMatch(/not valid/);
    expect(run({ bankName: "ADCB", accountNumber: "123456", swiftCode: "ADCB" })["bankAccounts.0.swiftCode"]).toMatch(/8 or 11/);
    expect(run({ bankName: "ADCB", accountNumber: "12" })["bankAccounts.0.accountNumber"]).toMatch(/4 to 34/);
    expect(run({ bankId: "b1", accountNumber: "123456" })).toEqual({});
  });
  it("documents: type, number length from the type, expiry required by the type, dates in order", () => {
    const types = [
      { _id: "tl", name: "Trade licence", requiresExpiry: true, minLength: 3, maxLength: 10 },
      { _id: "bl", name: "Bank letter", requiresExpiry: false, minLength: null, maxLength: null },
    ];
    const doc = (over) => ({ documentTypeId: "tl", typeName: "", number: "CN-1234", issueDate: "2025-01-01", expiryDate: "2027-01-01", attachmentId: "", fileName: "", isVerified: false, ...over });
    const run = (over) => validateParty("customer", filled("customer", { documents: [doc(over)] }), { documentTypes: types });
    expect(run({})).toEqual({});
    expect(run({ documentTypeId: "", number: "1" })["documents.0.documentTypeId"]).toBe("Choose the document type");
    expect(run({ number: "" })["documents.0.number"]).toBe("Enter the document number");
    expect(run({ number: "AB" })["documents.0.number"]).toBe("The number needs at least 3 characters");
    expect(run({ number: "ABCDEFGHIJK" })["documents.0.number"]).toBe("The number can have at most 10 characters");
    expect(run({ expiryDate: "" })["documents.0.expiryDate"]).toBe("This document type needs an expiry date");
    expect(run({ documentTypeId: "bl", number: "", expiryDate: "" })).toEqual({});
    expect(run({ expiryDate: "2025-01-01" })["documents.0.expiryDate"]).toBe("The expiry date must be after the issue date");
    expect(run({ expiryDate: "2024-12-31" })["documents.0.expiryDate"]).toBe("The expiry date must be after the issue date");
    expect(run({ expiryDate: "2025-02-30" })["documents.0.expiryDate"]).toBe("Enter a valid expiry date");
    expect(run({ issueDate: "x" })["documents.0.issueDate"]).toBe("Enter a valid issue date");
  });
  it("points each error at its section so the form can open the right tab", () => {
    expect(sectionOf("name")).toBe("basic");
    expect(sectionOf("vat.trn")).toBe("vat");
    expect(sectionOf("creditLimit")).toBe("credit");
    expect(sectionOf("credit.days")).toBe("credit");
    expect(sectionOf("contacts.0.name")).toBe("contacts");
    expect(sectionOf("bankAccounts.2.iban")).toBe("bank");
    expect(sectionOf("documents.1.number")).toBe("documents");
    const errors = { "documents.0.number": "x", "vat.trn": "y", "contacts.0.name": "z", "contacts.1.name": "z" };
    expect(firstSectionWithErrors(errors)).toBe("vat");
    expect(firstSectionWithErrors({})).toBeNull();
    expect(errorCountBySection(errors)).toEqual({ documents: 1, vat: 1, contacts: 2 });
  });
  it("a refusal from the server lands on its field", () => {
    expect(fieldForServerError({ code: "DUPLICATE_TRN" })).toBe("vat.trn");
    expect(fieldForServerError({ code: "TRN_REQUIRED" })).toBe("vat.trn");
    expect(fieldForServerError({ code: "DUPLICATE_ACCOUNT" })).toBe("name");
    expect(fieldForServerError({ code: "INVALID_CREDIT_DAYS" })).toBe("credit.days");
    expect(fieldForServerError({ code: "SOMETHING_ELSE" })).toBeNull();
    expect(fieldForServerError(null)).toBeNull();
  });
});

describe("record <-> form", () => {
  it("builds the form from a record that has the new blocks", () => {
    const f = partyToForm("customer", {
      customerName: "Al Noor", contactPerson: "Sara", billingAddress: "Deira", status: "Inactive", creditLimit: 25000, paymentTerms: "Net 45",
      vat: { status: "designated_zone", trn: TRN, tradeLicenseNo: "TL-1" }, credit: { days: 45 }, website: "www.alnoor.ae",
      contacts: [{ name: "Huda", isPrimary: true }],
      bankAccounts: [{ bankId: { _id: "b1" }, bankName: "ENBD", iban: IBAN, swiftCode: "EBILAEAD", isPrimary: true }],
      documents: [{ _id: "d1", documentTypeId: "tl", typeName: "Trade licence", number: "CN-1", issueDate: "2025-01-01T00:00:00.000Z", expiryDate: "2026-01-01T00:00:00.000Z", attachmentId: "a1", fileName: "tl.pdf", isVerified: true }],
    });
    expect(f).toMatchObject({
      name: "Al Noor", status: "Inactive", creditLimit: "25000", paymentTerms: "Net 45", creditDays: "45", vatStatus: "designated_zone", trn: TRN, tradeLicenseNo: "TL-1", website: "www.alnoor.ae",
    });
    expect(f.contacts).toEqual([{ name: "Huda", designation: "", email: "", phone: "", isPrimary: true }]);
    expect(f.bankAccounts[0]).toMatchObject({ bankId: "b1", iban: IBAN, isPrimary: true });
    expect(f.documents[0]).toMatchObject({ key: "d1", documentTypeId: "tl", issueDate: "2025-01-01", expiryDate: "2026-01-01", attachmentId: "a1", isVerified: true, pending: false });
  });
  it("an older record reads from its legacy fields", () => {
    const c = partyToForm("customer", { customerName: "Old", contactPerson: "x", trnNumber: TRN, paymentTerms: "Net 60" });
    expect(c).toMatchObject({ vatStatus: "registered", trn: TRN, paymentTerms: "Net 60", creditDays: "60" });
    const v = partyToForm("vendor", { vendorName: "Old V", trnNO: TRN, paymentTerms: "COD", address: "Sharjah", status: "Pending" });
    expect(v).toMatchObject({ name: "Old V", vatStatus: "registered", trn: TRN, paymentTerms: "COD", creditDays: "0", address: "Sharjah", status: "Pending" });
    expect(partyToForm("customer", { customerName: "No VAT" }).vatStatus).toBe("unregistered");
    expect(partyToForm("customer", undefined).status).toBe("Active");
  });
  it("builds the customer body: normalised TRN, numbers, blank rows dropped", () => {
    const body = formToPayload("customer", filled("customer", {
      name: "  Al Noor  ", vatStatus: "registered", trn: "1001 2345 6700 003", tradeLicenseNo: " TL-9 ", creditLimit: "1500.5", paymentTerms: "Net 45", creditDays: "45", salesPerson: "",
      contacts: [{ ...emptyContact(), name: "Huda", isPrimary: true }, emptyContact()],
      bankAccounts: [{ ...emptyBankAccount(), bankId: "b1", bankName: "ignored", iban: "ae07 0331 2345 6789 0123 456", swiftCode: "ebilaead", isPrimary: true }, emptyBankAccount()],
      documents: [{ key: "k", documentTypeId: "tl", typeName: "x", number: " CN-1 ", issueDate: "", expiryDate: "2027-01-01", attachmentId: "a1", fileName: "tl.pdf", isVerified: true }, { key: "k2", documentTypeId: "", typeName: "", number: "", issueDate: "", expiryDate: "", attachmentId: "", fileName: "", isVerified: false }],
    }));
    expect(body).toMatchObject({
      customerName: "Al Noor", billingAddress: "Deira, Dubai", salesPerson: null, creditLimit: 1500.5, paymentTerms: "Net 45", credit: { days: 45 },
      vat: { status: "registered", trn: TRN, tradeLicenseNo: "TL-9" },
    });
    expect(body.contacts).toEqual([{ name: "Huda", designation: "", email: "", phone: "", isPrimary: true }]);
    expect(body.bankAccounts).toEqual([{ bankId: "b1", bankName: "", accountNumber: "", iban: IBAN, swiftCode: "EBILAEAD", isPrimary: true }]);
    expect(body.documents).toEqual([{ documentTypeId: "tl", typeName: "", number: "CN-1", issueDate: "", expiryDate: "2027-01-01", attachmentId: "a1", fileName: "tl.pdf", isVerified: true }]);
    expect(body).not.toHaveProperty("vendorName");
  });
  it("builds the vendor body, and an unregistered party sends no TRN", () => {
    const body = formToPayload("vendor", filled("vendor", { vatStatus: "unregistered", trn: "100123456700003", status: "Pending", creditDays: "" }));
    expect(body).toMatchObject({ vendorName: "Gulf Mills", address: "Jebel Ali", status: "Pending", vat: { status: "unregistered", trn: "" } });
    expect(body).not.toHaveProperty("credit");
    expect(body).not.toHaveProperty("customerName");
    expect(body).not.toHaveProperty("creditLimit");
  });
});
