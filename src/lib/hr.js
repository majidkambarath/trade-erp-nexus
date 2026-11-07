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

// Calendar day/month arithmetic for the Attendance month matrix and the Leave calendar. Days are the
// organisation's own calendar days as "YYYY-MM-DD" text, so this is done on the text and never on a local
// clock - the same reasoning src/lib/dayReports.js and src/lib/crm.js each keep their own small copy of,
// rather than one module importing another's (HR has no business depending on the CRM module being present).
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

/** The day `n` days from `day`; the same text back when it is not a day. */
export function shiftDay(day, n) {
  if (!DAY.test(str(day))) return day;
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** "2026-03-14" -> "2026-03". */
export const monthKeyOf = (day) => str(day).slice(0, 7);

/** The month `n` months from `key` ("2026-01", -1 -> "2025-12"); the same text back when it is not a month. */
export function shiftMonth(key, n) {
  if (!MONTH_KEY.test(str(key))) return key;
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Every day of the month, in order, as "YYYY-MM-DD" - the Attendance matrix's own column list. */
export function daysOfMonth(key) {
  if (!MONTH_KEY.test(str(key))) return [];
  const [y, m] = key.split("-").map(Number);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${key}-${String(i + 1).padStart(2, "0")}`);
}

/** The month as a 7-wide grid of weeks, each cell `{ day, inMonth }`, Monday first - the Leave calendar's
 * own layout (leading/trailing days from the months either side fill the first and last week). */
export function monthWeeks(key) {
  const first = `${key}-01`;
  if (!MONTH_KEY.test(str(key))) return [];
  const [y, m] = key.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const total = Math.ceil((lead + new Date(Date.UTC(y, m, 0)).getUTCDate()) / 7) * 7;
  const weeks = [];
  for (let i = 0; i < total; i += 7) {
    weeks.push(Array.from({ length: 7 }, (_, j) => {
      const day = shiftDay(first, i + j - lead);
      return { day, inMonth: monthKeyOf(day) === key };
    }));
  }
  return weeks;
}

/** "2026-11" -> "November 2026". */
export function monthLabel(key) {
  if (!MONTH_KEY.test(str(key))) return str(key);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
}

/** Whether a leave request's [fromDay, toDay] range covers `day` - plain string comparison, like every other
 * calendar-day comparison in the codebase (ISO text sorts the same as the date it names). */
export const coversDay = (request, day) => Boolean(request?.fromDay) && request.fromDay <= day && day <= (request.toDay || request.fromDay);
