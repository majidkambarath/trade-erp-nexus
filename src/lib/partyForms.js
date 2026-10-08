import { isValidIban, normalizeIban } from "./iban";
import { toInputDate, todayInput } from "../utils/format";

// Pure logic of the customer / vendor form: the rules the server applies (so a mistake is caught
// before the request), and the two translations between the API record and the form fields.
// Nothing here renders anything or calls the server; see components/parties for the screens.

// ---- constants ---------------------------------------------------------------------------------

export const VAT_STATUSES = [
  { value: "registered", label: "VAT registered" },
  { value: "unregistered", label: "Not registered" },
  { value: "exempt", label: "Exempt" },
  { value: "designated_zone", label: "Designated zone" },
];
export const vatStatusLabel = (v) => VAT_STATUSES.find((s) => s.value === v)?.label || "";
const TRN_REQUIRED_FOR = ["registered", "designated_zone"];

export const CUSTOMER_TERMS = ["Net 30", "Net 45", "Net 60", "Cash on Delivery", "Prepaid"];
export const VENDOR_TERMS = ["30 days", "Net 30", "45 days", "Net 60", "60 days", "COD"];
export const CUSTOMER_STATUSES = ["Active", "Inactive"];
export const VENDOR_STATUSES = ["Compliant", "Non-compliant", "Pending", "Expired"];
export const DEFAULT_TERMS = { customer: "Net 30", vendor: "30 days" };
export const MAX_CREDIT_DAYS = 365;
export const DEFAULT_WARNING_DAYS = 30;

export const SECTIONS = [
  { id: "basic", label: "Basic" },
  { id: "vat", label: "VAT" },
  { id: "credit", label: "Credit and terms" },
  { id: "contacts", label: "Contacts" },
  { id: "bank", label: "Bank accounts" },
  { id: "documents", label: "KYC documents" },
];

// ---- small checks ------------------------------------------------------------------------------

export const normalizeTrn = (v) => String(v ?? "").replace(/[\s-]/g, "");
export const isValidTrn = (v) => /^\d{15}$/.test(normalizeTrn(v));
export const isValidSwift = (v) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(v ?? "").replace(/\s+/g, "").toUpperCase());
export const isEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v).trim());
export const isPhone = (v) => /^\+?[\d\s()-]{7,20}$/.test(String(v).trim());
const isWebsite = (v) => /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]{2,}$/i.test(String(v).trim());
const blank = (v) => !String(v ?? "").trim();
export { isValidIban, normalizeIban };

// ---- payment terms and credit days -------------------------------------------------------------

export const termsToDays = (terms) => {
  const m = /(\d+)/.exec(String(terms || ""));
  return m ? Number(m[1]) : 0;
};
export const termsFor = (kind) => (kind === "vendor" ? VENDOR_TERMS : CUSTOMER_TERMS);
export const isStandardTerms = (kind, terms) => termsFor(kind).includes(terms);

// The label that stands for `days`: the current one when it already means that many days.
export function daysToTerms(kind, days, current) {
  if (current && (isStandardTerms(kind, current) || /^Net \d{1,3}$/.test(current)) && termsToDays(current) === days) return current;
  if (days === 0) return kind === "vendor" ? "COD" : "Cash on Delivery";
  return `Net ${days}`;
}

// The terms list for the select: the standard terms, plus the current one when it is a custom "Net 90".
export function termOptions(kind, current) {
  const base = termsFor(kind);
  return current && !base.includes(current) ? [...base, current] : base;
}

// Choosing a payment term sets the credit days it means; typing the days sets the matching term.
export function withPaymentTerms(form, kind, terms) {
  return { ...form, paymentTerms: terms, creditDays: terms ? String(termsToDays(terms)) : "" };
}
export function withCreditDays(form, kind, days) {
  const n = Number(days);
  const ok = days !== "" && Number.isInteger(n) && n >= 0 && n <= MAX_CREDIT_DAYS;
  return { ...form, creditDays: days, paymentTerms: ok ? daysToTerms(kind, n, form.paymentTerms) : form.paymentTerms };
}

// ---- document expiry (the same Dubai-calendar rules as the server) -----------------------------

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayMs = (day) => {
  const m = DAY_RE.exec(day);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
};
const isRealDay = (day) => {
  const m = DAY_RE.exec(String(day || ""));
  if (!m) return false;
  const d = new Date(dayMs(day));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};

// "YYYY-MM-DD" for a date value from the form or the server ("2026-01-09" or "2026-01-09T00:00:00.000Z").
// A server date at exactly UTC midnight is that day; any other moment is read on the Dubai calendar.
export function toDay(value) {
  if (!value) return "";
  const text = String(value);
  if (isRealDay(text)) return text;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return ""; // only a full timestamp beyond a bare day (the engine would roll 30 February into March)
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  if (text.endsWith("T00:00:00.000Z") || text.endsWith("T00:00:00Z")) return d.toISOString().slice(0, 10);
  return toInputDate(d);
}

export const DOC_STATUS = { VALID: "VALID", EXPIRING_SOON: "EXPIRING_SOON", EXPIRED: "EXPIRED", NO_EXPIRY: "NO_EXPIRY", INVALID_DATE: "INVALID_DATE" };

// { status, daysLeft } for an expiry date. Today is the Dubai day unless given.
export function documentStatus(expiry, { today = todayInput(), warningDays = DEFAULT_WARNING_DAYS } = {}) {
  if (expiry === null || expiry === undefined || String(expiry).trim() === "") return { status: DOC_STATUS.NO_EXPIRY, daysLeft: null };
  const day = toDay(expiry);
  if (!day) return { status: DOC_STATUS.INVALID_DATE, daysLeft: null };
  const daysLeft = Math.round((dayMs(day) - dayMs(today)) / 86400000);
  if (daysLeft < 0) return { status: DOC_STATUS.EXPIRED, daysLeft };
  return { status: daysLeft <= warningDays ? DOC_STATUS.EXPIRING_SOON : DOC_STATUS.VALID, daysLeft };
}

export const daysLeftText = (daysLeft) => {
  if (daysLeft === null || daysLeft === undefined) return "";
  const plural = (n) => `${n} day${n === 1 ? "" : "s"}`;
  if (daysLeft === 0) return "Expires today";
  return daysLeft > 0 ? `Expires in ${plural(daysLeft)}` : `Expired ${plural(-daysLeft)} ago`;
};

// What the lists show for a party: the worst state among its documents, or null when nothing needs attention.
//   { status: "EXPIRED" | "EXPIRING_SOON", daysLeft, typeName, count }   the soonest / most overdue one, and how many need attention
export function expirySummary(documents, opts) {
  let worst = null;
  let count = 0;
  for (const d of documents || []) {
    const s = documentStatus(d.expiryDate, opts);
    if (s.status !== DOC_STATUS.EXPIRED && s.status !== DOC_STATUS.EXPIRING_SOON) continue;
    count += 1;
    if (!worst || s.daysLeft < worst.daysLeft) worst = { ...s, typeName: d.typeName || "Document" };
  }
  return worst ? { ...worst, count } : null;
}

// ---- rows (contacts, bank accounts, documents) -------------------------------------------------

export const emptyContact = () => ({ name: "", designation: "", email: "", phone: "", isPrimary: false });
export const emptyBankAccount = () => ({ bankId: "", bankName: "", accountNumber: "", iban: "", swiftCode: "", isPrimary: false });
let rowKey = 0;
export const emptyDocument = () => ({ key: `new-${(rowKey += 1)}`, documentTypeId: "", typeName: "", number: "", issueDate: "", expiryDate: "", attachmentId: "", fileName: "", isVerified: false, pending: false });

// The first row of a list is primary when none is; exactly one row is primary afterwards.
export function addRow(rows, row) {
  const next = [...rows, row];
  if (!("isPrimary" in row) || next.some((r) => r.isPrimary)) return next;
  return next.map((r, i) => ({ ...r, isPrimary: i === 0 }));
}
export function setPrimary(rows, index) {
  return rows.map((r, i) => ({ ...r, isPrimary: i === index }));
}
// Removing the primary row hands the flag to the first one left.
export function removeRow(rows, index) {
  const next = rows.filter((_, i) => i !== index);
  return next.length && "isPrimary" in next[0] && !next.some((r) => r.isPrimary) ? next.map((r, i) => ({ ...r, isPrimary: i === 0 })) : next;
}
export const updateRow = (rows, index, patch) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r));

const rowIsBlank = (row, keys) => keys.every((k) => blank(row[k]));
const CONTACT_KEYS = ["name", "designation", "email", "phone"];
const BANK_KEYS = ["bankId", "bankName", "accountNumber", "iban", "swiftCode"];
const DOC_KEYS = ["documentTypeId", "typeName", "number", "issueDate", "expiryDate", "attachmentId"];

// ---- record <-> form ---------------------------------------------------------------------------

export function emptyParty(kind) {
  return {
    name: "", contactPerson: "", phone: "", email: "", website: "", salesPerson: "",
    billingAddress: "", shippingAddress: "", address: "",
    status: kind === "vendor" ? "Compliant" : "Active",
    vatStatus: "unregistered", trn: "", tradeLicenseNo: "",
    creditLimit: "", paymentTerms: DEFAULT_TERMS[kind], creditDays: String(termsToDays(DEFAULT_TERMS[kind])),
    contacts: [], bankAccounts: [], documents: [],
  };
}

const id = (v) => (v && typeof v === "object" ? v._id || "" : v || "");

// An API customer / vendor -> form fields. Records saved before the master data existed have no
// vat / credit block; their TRN and payment terms are read from the older fields.
export function partyToForm(kind, record) {
  const r = record || {};
  const base = emptyParty(kind);
  const trn = r.vat?.trn || (kind === "vendor" ? r.trnNO : r.trnNumber) || "";
  const terms = r.paymentTerms || base.paymentTerms;
  return {
    ...base,
    name: (kind === "vendor" ? r.vendorName : r.customerName) || "",
    contactPerson: r.contactPerson || "", phone: r.phone || "", email: r.email || "", website: r.website || "",
    salesPerson: r.salesPerson || "",
    billingAddress: r.billingAddress || "", shippingAddress: r.shippingAddress || "", address: r.address || "",
    status: r.status || base.status,
    vatStatus: r.vat?.status || (trn ? "registered" : "unregistered"),
    trn, tradeLicenseNo: r.vat?.tradeLicenseNo || "",
    creditLimit: r.creditLimit ? String(r.creditLimit) : "",
    paymentTerms: terms,
    creditDays: String(r.credit?.days ?? termsToDays(terms)),
    contacts: (r.contacts || []).map((c) => ({ name: c.name || "", designation: c.designation || "", email: c.email || "", phone: c.phone || "", isPrimary: Boolean(c.isPrimary) })),
    bankAccounts: (r.bankAccounts || []).map((b) => ({
      bankId: id(b.bankId), bankName: b.bankName || "", accountNumber: b.accountNumber || "", iban: b.iban || "", swiftCode: b.swiftCode || "", isPrimary: Boolean(b.isPrimary),
    })),
    documents: (r.documents || []).map((d, i) => ({
      key: String(d._id || `saved-${i}`), documentTypeId: id(d.documentTypeId), typeName: d.typeName || "", number: d.number || "",
      issueDate: toDay(d.issueDate), expiryDate: toDay(d.expiryDate), attachmentId: id(d.attachmentId), fileName: d.fileName || "",
      isVerified: Boolean(d.isVerified), pending: false,
    })),
  };
}

// The form fields -> the body the customer / vendor API takes (blank rows are dropped).
export function formToPayload(kind, form) {
  const trimmed = (v) => String(v ?? "").trim();
  const noTrn = form.vatStatus === "unregistered";
  const days = trimmed(form.creditDays);
  const body = {
    contactPerson: trimmed(form.contactPerson), phone: trimmed(form.phone), email: trimmed(form.email), website: trimmed(form.website),
    status: form.status,
    vat: { status: form.vatStatus, trn: noTrn ? "" : normalizeTrn(form.trn), tradeLicenseNo: trimmed(form.tradeLicenseNo) },
    paymentTerms: form.paymentTerms,
    ...(days !== "" ? { credit: { days: Number(days) } } : {}),
    contacts: form.contacts.filter((c) => !rowIsBlank(c, CONTACT_KEYS)).map((c) => ({ name: trimmed(c.name), designation: trimmed(c.designation), email: trimmed(c.email), phone: trimmed(c.phone), isPrimary: Boolean(c.isPrimary) })),
    bankAccounts: form.bankAccounts.filter((b) => !rowIsBlank(b, BANK_KEYS)).map((b) => ({
      bankId: b.bankId || null, bankName: b.bankId ? "" : trimmed(b.bankName), accountNumber: trimmed(b.accountNumber), iban: normalizeIban(b.iban), swiftCode: trimmed(b.swiftCode).toUpperCase(), isPrimary: Boolean(b.isPrimary),
    })),
    documents: form.documents.filter((d) => !rowIsBlank(d, DOC_KEYS)).map((d) => ({
      documentTypeId: d.documentTypeId || null, typeName: d.documentTypeId ? "" : trimmed(d.typeName), number: trimmed(d.number),
      issueDate: d.issueDate || "", expiryDate: d.expiryDate || "", attachmentId: d.attachmentId || null, fileName: d.fileName || "", isVerified: Boolean(d.isVerified),
    })),
  };
  if (kind === "vendor") return { vendorName: trimmed(form.name), address: trimmed(form.address), ...body };
  return {
    customerName: trimmed(form.name), billingAddress: trimmed(form.billingAddress), shippingAddress: trimmed(form.shippingAddress),
    salesPerson: trimmed(form.salesPerson) || null, creditLimit: Number(form.creditLimit) || 0, ...body,
  };
}

// ---- validation --------------------------------------------------------------------------------

// Errors by field path ("name", "vat.trn", "bankAccounts.1.iban", "documents.0.number"), the same
// rules the server applies. `documentTypes` is the master list (each has requiresExpiry, minLength,
// maxLength); `strict` also reports the fields that are only mandatory on save.
export function validateParty(kind, form, { documentTypes = [], strict = true } = {}) {
  const e = {};
  const noun = kind === "vendor" ? "Vendor" : "Customer";
  if (strict && blank(form.name)) e.name = `${noun} name is required`;
  if (strict && blank(form.contactPerson)) e.contactPerson = "Contact person is required";
  if (!blank(form.email) && !isEmail(form.email)) e.email = "Enter a valid email address";
  if (!blank(form.phone) && !isPhone(form.phone)) e.phone = "Enter a valid phone number, for example +971 50 123 4567";
  if (!blank(form.website) && !isWebsite(form.website)) e.website = "Enter a website such as www.example.ae";
  if (strict) {
    if (kind === "vendor" && blank(form.address)) e.address = "Address is required";
    if (kind === "customer" && blank(form.billingAddress)) e.billingAddress = "Billing address is required";
  }

  // VAT
  const trn = normalizeTrn(form.trn);
  if (TRN_REQUIRED_FOR.includes(form.vatStatus)) {
    if (!trn) { if (strict) e["vat.trn"] = "Enter the 15-digit TRN"; }
    else if (!isValidTrn(trn)) e["vat.trn"] = `A UAE TRN is exactly 15 digits (${trn.length} entered)`;
  } else if (form.vatStatus === "exempt" && trn && !isValidTrn(trn)) {
    e["vat.trn"] = `A UAE TRN is exactly 15 digits (${trn.length} entered)`;
  }

  // credit
  if (kind === "customer" && !blank(form.creditLimit)) {
    const n = Number(form.creditLimit);
    if (!Number.isFinite(n) || n < 0) e.creditLimit = "Credit limit must be zero or more";
  }
  if (!blank(form.creditDays)) {
    const n = Number(form.creditDays);
    if (!Number.isInteger(n) || n < 0 || n > MAX_CREDIT_DAYS) e["credit.days"] = `Credit days is a whole number from 0 to ${MAX_CREDIT_DAYS}`;
  }

  // contacts
  form.contacts.forEach((c, i) => {
    if (rowIsBlank(c, CONTACT_KEYS)) return;
    if (blank(c.name)) e[`contacts.${i}.name`] = "Enter the contact's name";
    if (!blank(c.email) && !isEmail(c.email)) e[`contacts.${i}.email`] = "Enter a valid email address";
    if (!blank(c.phone) && !isPhone(c.phone)) e[`contacts.${i}.phone`] = "Enter a valid phone number";
  });

  // bank accounts
  form.bankAccounts.forEach((b, i) => {
    if (rowIsBlank(b, BANK_KEYS)) return;
    const acct = String(b.accountNumber || "").replace(/\s+/g, "");
    if (!b.bankId && blank(b.bankName)) e[`bankAccounts.${i}.bankId`] = "Choose the bank";
    if (!acct && blank(b.iban)) e[`bankAccounts.${i}.accountNumber`] = "Enter the account number or the IBAN";
    else if (acct && !/^[A-Za-z0-9-]{4,34}$/.test(acct)) e[`bankAccounts.${i}.accountNumber`] = "An account number has 4 to 34 letters, digits or dashes";
    if (!blank(b.iban) && !isValidIban(b.iban)) e[`bankAccounts.${i}.iban`] = "That IBAN is not valid. Check it for a typing mistake.";
    if (!blank(b.swiftCode) && !isValidSwift(b.swiftCode)) e[`bankAccounts.${i}.swiftCode`] = "A SWIFT / BIC code has 8 or 11 characters";
  });

  // documents
  const types = new Map(documentTypes.map((t) => [String(t._id), t]));
  form.documents.forEach((d, i) => {
    if (rowIsBlank(d, DOC_KEYS)) return;
    const t = d.documentTypeId ? types.get(String(d.documentTypeId)) : null;
    const num = String(d.number || "").trim();
    if (!d.documentTypeId && blank(d.typeName)) e[`documents.${i}.documentTypeId`] = "Choose the document type";
    if (t?.minLength && num.length < t.minLength) e[`documents.${i}.number`] = num ? `The number needs at least ${t.minLength} characters` : "Enter the document number";
    else if (t?.maxLength && num.length > t.maxLength) e[`documents.${i}.number`] = `The number can have at most ${t.maxLength} characters`;
    if (!blank(d.issueDate) && !isRealDay(d.issueDate)) e[`documents.${i}.issueDate`] = "Enter a valid issue date";
    if (!blank(d.expiryDate) && !isRealDay(d.expiryDate)) e[`documents.${i}.expiryDate`] = "Enter a valid expiry date";
    else if (t?.requiresExpiry && blank(d.expiryDate)) e[`documents.${i}.expiryDate`] = "This document type needs an expiry date";
    if (isRealDay(d.issueDate) && isRealDay(d.expiryDate) && dayMs(d.expiryDate) <= dayMs(d.issueDate)) e[`documents.${i}.expiryDate`] = "The expiry date must be after the issue date";
  });
  return e;
}

// Which section a field path belongs to, to flag the tab and jump to it.
export function sectionOf(path) {
  if (path === "vat.trn" || path.startsWith("vat.")) return "vat";
  if (path === "creditLimit" || path.startsWith("credit.") || path === "paymentTerms") return "credit";
  if (path.startsWith("contacts.")) return "contacts";
  if (path.startsWith("bankAccounts.")) return "bank";
  if (path.startsWith("documents.")) return "documents";
  return "basic";
}
export function firstSectionWithErrors(errors) {
  const found = new Set(Object.keys(errors).map(sectionOf));
  return SECTIONS.find((s) => found.has(s.id))?.id || null;
}
export function errorCountBySection(errors) {
  const counts = {};
  for (const path of Object.keys(errors)) counts[sectionOf(path)] = (counts[sectionOf(path)] || 0) + 1;
  return counts;
}

// A server refusal -> the field it is about (errors keyed like validateParty's), or null for a general message.
export function fieldForServerError(err) {
  const code = err?.code;
  if (["DUPLICATE_TRN", "INVALID_TRN", "TRN_REQUIRED", "TRN_NOT_ALLOWED"].includes(code)) return "vat.trn";
  if (code === "NAME_REQUIRED" || code === "DUPLICATE_ACCOUNT") return "name";
  if (code === "INVALID_CREDIT_DAYS") return "credit.days";
  return null;
}
