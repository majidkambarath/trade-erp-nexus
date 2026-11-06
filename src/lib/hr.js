// Pure rules for the HRMS workspace's forms: no React, no axios. The server (trade ERP node/utils/hr.js and
// services/hr/contractService.js) is the authority on every figure here - this only gives the form the same
// answer BEFORE a round trip, so a mistake is caught while somebody is still looking at the field.

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** What an "Add employee" / "Edit employee" form needs before it may be sent at all. */
export function validateEmployeeForm(data) {
  const errors = {};
  if (!str(data?.name).trim()) errors.name = "Full name is required";
  if (!str(data?.designation).trim()) errors.designation = "Designation is required";
  if (!str(data?.contactNo).trim()) errors.contactNo = "Contact number is required";
  if (!str(data?.idNo).trim()) errors.idNo = "ID/Passport number is required";
  if (!data?.joiningDate) errors.joiningDate = "Joining date is required";
  return errors;
}

/** The FormData an employee create/update sends - the fields the upload middleware expects, and only those. */
export function employeeFormData(data) {
  const fd = new FormData();
  for (const field of ["name", "designation", "department", "email", "contactNo", "idNo", "status"]) {
    const v = str(data?.[field]).trim();
    if (v) fd.append(field, v);
  }
  if (data?.joiningDate) fd.append("joiningDate", data.joiningDate);
  if (data?.exitDate !== undefined) fd.append("exitDate", data.exitDate || "");
  if (data?.nationality) fd.append("nationality", str(data.nationality).trim().toUpperCase());
  // "" clears the link on an edit - sent explicitly rather than omitted, so choosing "None" again
  // actually reaches the server (an omitted field on update means "leave it as it was").
  if (data?.departmentId !== undefined) fd.append("departmentId", data.departmentId || "");
  if (data?.managerId !== undefined) fd.append("managerId", data.managerId || "");
  if (data?.idProof instanceof File) fd.append("idProof", data.idProof);
  if (data?.addressProof instanceof File) fd.append("addressProof", data.addressProof);
  return fd;
}

/**
 * Whether a contract form can be sent, mirroring the server's own validateContract (trade ERP node/utils/hr.js)
 * closely enough to catch the common mistakes before the round trip - the server still has the last word.
 */
export function validateContractForm(data) {
  const errors = {};
  if (!data?.effectiveFrom) errors.effectiveFrom = "Enter the day this contract starts";
  if (data?.effectiveTo && data.effectiveFrom && data.effectiveTo < data.effectiveFrom) {
    errors.effectiveTo = "The last day cannot be before the first day";
  }
  for (const [field, label] of [["basicPay", "Basic pay"], ["allowances", "Allowances"], ["otherMonthlyCost", "Other monthly cost"], ["costPerHour", "Cost per hour"]]) {
    if (data?.[field] === undefined || data[field] === null || data[field] === "") continue;
    const v = num(data[field]);
    if (v === null || v < 0) errors[field] = `${label} cannot be negative`;
  }
  return errors;
}

/** What a contract row's pay reads as, for a reader who holds hr.confidential - undefined fields mean the
 * server stripped them, which is the honest "hidden", never a blank that looks like zero. */
export function contractSummary(row) {
  if (!row) return null;
  const hasPay = row.hourlyCost !== undefined;
  return {
    current: !row.effectiveTo,
    from: row.effectiveFrom,
    to: row.effectiveTo || null,
    hasPay,
    hourlyCost: hasPay ? row.hourlyCost : null,
    monthlyCost: hasPay ? row.monthlyCost : null,
  };
}
