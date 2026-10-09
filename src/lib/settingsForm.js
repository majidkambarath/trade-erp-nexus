import { isValidIban } from "./iban";

// Pure rules for the Settings forms, kept out of the component so they are tested without rendering.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SWIFT = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

// Returns { field: message }. Pure, so it is tested without rendering.
export function validateProfile(company, bank) {
  const errors = {};
  if (!company.companyName.trim()) errors.companyName = "Enter the company name";
  if (!company.addressLine1.trim()) errors.addressLine1 = "Enter the street address";
  if (!company.city.trim()) errors.city = "Enter the city";
  if (!company.state.trim()) errors.state = "Enter the state or emirate";
  if (company.emailAddress.trim() && !EMAIL.test(company.emailAddress.trim())) errors.emailAddress = "Enter a valid email address";
  if (bank.ibanNumber.trim() && !isValidIban(bank.ibanNumber)) errors.ibanNumber = "This IBAN is not valid. Check the digits and length";
  if (bank.swiftCode.trim() && !SWIFT.test(bank.swiftCode.trim().toUpperCase())) errors.swiftCode = "A SWIFT / BIC code is 8 or 11 letters and digits";
  return errors;
}

// ---- approvals (Settings -> Business rules): who must approve what. Off until set.

/** The form's starting values from GET /accounting/settings `approvals` (the amount is kept as the text typed; "" for none). */
export const approvalsFrom = (approvals) => ({
  separateApprover: approvals?.separateApprover === true,
  secondApprovalAbove: approvals?.secondApprovalAbove === null || approvals?.secondApprovalAbove === undefined || approvals?.secondApprovalAbove === "" ? "" : String(approvals.secondApprovalAbove),
});

/**
 * The body for PUT /accounting/settings, or the reason it cannot be sent. An empty amount switches the second approver off
 * (null); anything else must be an amount of 0 or more.
 */
export function approvalsPayload(form) {
  const text = String(form?.secondApprovalAbove ?? "").replace(/,/g, "").trim();
  if (text !== "" && !/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: "Enter an amount of 0 or more, or leave it empty" };
  return { ok: true, body: { approvals: { separateApprover: form?.separateApprover === true, secondApprovalAbove: text === "" ? null : Number(text) } } };
}

export function passwordStrength(password) {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return score; // 0-4
}
export const STRENGTH = [
  { label: "Too short", bar: "bg-status-danger", width: "w-[8%]" },
  { label: "Weak", bar: "bg-status-danger", width: "w-1/4" },
  { label: "Fair", bar: "bg-status-warning", width: "w-2/4" },
  { label: "Good", bar: "bg-status-success", width: "w-3/4" },
  { label: "Strong", bar: "bg-status-success", width: "w-full" },
];

