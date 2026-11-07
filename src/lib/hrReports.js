// HRMS > Reports: which reports a person is offered, and what each one exports. No React and no requests,
// so every rule here is a test.
//
// WHY A CATALOGUE RATHER THAN A FIXED TAB LIST. The six reports do NOT share one gate - the muster answers
// to hr.attendance, the leave register to hr.leave, the payroll register to hr.payroll AND hr.confidential
// (payrollController.js asserts the second itself), and Emiratisation has nothing to say outside the UAE.
// A fixed list drew a tab the server would refuse, which is how this screen came to show an Emiratisation
// tab to an Indian organisation and an "Accrue" button to somebody with no finance permission. The house
// rule is hidden, never disabled.

import { can } from "./permissions";

/**
 * Every report this screen can show, in reading order: what the books should already be carrying, then
 * what was paid, then who was here, then what they are owed, then what expires, then the quota.
 *
 * `needs` is ALL of - not any of - because these are different kinds of permission, not alternatives.
 * `uaeOnly` is a country rule, not a sold feature: nobody buys Emiratisation, it simply does not apply,
 * the same reason the VAT return screen is hidden rather than refused (emiratisationService.js says so).
 */
// A LABEL IS SHORT ON PURPOSE. PillTabs stops scrolling at `sm` (sm:overflow-visible), so from tablet
// width up the whole strip has to FIT: the fuller names - "Gratuity liability", "Payroll register",
// "Documents expiring" - came to 833px against an 820px pane and bled, which the mobile sweep caught.
// Each report's full name is still on its panel heading and in its exported file's title line.
export const REPORTS = [
  { key: "gratuity", label: "Gratuity", needs: ["hr.view"] },
  { key: "payroll", label: "Payroll", needs: ["hr.payroll", "hr.confidential"] },
  { key: "attendance", label: "Attendance", needs: ["hr.attendance"] },
  { key: "leave", label: "Leave", needs: ["hr.leave"] },
  { key: "documents", label: "Documents", needs: ["hr.view"] },
  { key: "emiratisation", label: "Emiratisation", needs: ["hr.view"], uaeOnly: true },
];

/**
 * The tabs to draw, as PillTabs' own [value, label] pairs.
 *
 * While the grants are not known `can` answers true for everything (lib/permissions.js's own rule: a
 * missing answer must never lock a working person out of a screen), so a page still loading offers every
 * report and settles as the status arrives. The server refuses whatever it should either way.
 */
export const reportTabs = (me, { uae = true } = {}) =>
  REPORTS.filter((r) => (!r.uaeOnly || uae) && r.needs.every((key) => can(me, key))).map((r) => [r.key, r.label]);

/**
 * Which tab to open on: the one asked for if it is still there, else the first one offered, else null.
 *
 * Needed because the default cannot be a fixed "gratuity": a muster clerk holds hr.attendance and not
 * hr.view, so that person would have landed on a tab that is not drawn and seen an empty screen.
 */
export const firstTab = (tabs, preferred) => {
  const keys = (tabs || []).map(([key]) => key);
  if (preferred && keys.includes(preferred)) return preferred;
  return keys[0] || null;
};

/** The label a key carries, for the export's own title line. */
export const reportLabel = (key) => REPORTS.find((r) => r.key === key)?.label || "Report";

// ---------------------------------------------------------------------------------------------------
// What each report exports. Each returns { headers, rows } - the shape lib/hrDashboard.js dashboardCsv
// already uses, handed to downloadCSV with a reportPreamble naming the company and the day.
//
// ONE RULE RUNS THROUGH ALL OF THEM: a figure that is not known exports as an EMPTY CELL, never 0. A
// gratuity the server withheld, an attendance rate for a month nobody marked, a leave balance for an
// employee with no joining date - each is unknown, and a zero in a spreadsheet is a claim. This is the
// same decision costTrendRows made for a month with no payroll run.
// ---------------------------------------------------------------------------------------------------

/** A number, or an empty cell when there is nothing to report. 0 is a real answer and survives. */
const cell = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? "" : Number(n));
const pct = (n) => (n === null || n === undefined ? "" : Math.round(Number(n) * 10) / 10);

/**
 * The gratuity liability. Per employee for a reader who holds hr.confidential; for anyone else the server
 * has already stripped the names and pay away (complianceController.js forReader), so what is left is the
 * aggregate - and the export says so rather than producing a file of empty columns.
 */
export function gratuityCsv(preview) {
  if (!preview) return { headers: ["Figure", "Amount"], rows: [] };
  if (preview.employees?.length) {
    const headers = ["Employee", "Staff ID", "Service days", "Basic pay", "Gratuity owed"];
    const rows = preview.employees.map((e) => [e.name, e.staffId || "", cell(e.serviceDays), cell(e.basicPay), cell(e.owed)]);
    rows.push(["Total", "", "", "", cell(preview.cumulativeLiability)]);
    return { headers, rows };
  }
  return {
    headers: ["Figure", "Amount"],
    rows: [
      [`Liability as at ${preview.day || ""}`, cell(preview.cumulativeLiability)],
      ["Previous cumulative", cell(preview.previousCumulative)],
      ["Movement this month", cell(preview.amount)],
      ["Employees costed", cell(preview.employeeCount)],
      ["Cannot be costed yet", cell(preview.missingCount ?? preview.missing?.length)],
    ],
  };
}

/** Who was paid what in a run. The components are flattened to their totals: a column per component would
 * differ between runs, and a register whose columns move is not a register. */
export function payrollRegisterCsv(payslips) {
  // No "Staff ID" column: Payslip stores `staffName` and no code (payslipModel.js), so a column headed
  // Staff ID would be blank on every row for ever. A header a report cannot fill is a promise it breaks.
  const headers = ["Employee", "Basic pay", "Earnings", "Deductions", "Gross", "Net", "Prorated"];
  const list = payslips || [];
  const rows = list.map((p) => [
    p.staffName || "",
    cell(p.basicPay), cell(p.totalEarnings), cell(p.totalDeductions), cell(p.grossPay), cell(p.netPay),
    // 1 means a whole period; anything less is a joiner or a leaver mid-month, which is why it is on the
    // register at all - it explains a net that looks wrong against the contract.
    p.proratedFactor === undefined || p.proratedFactor === null ? "" : Number(p.proratedFactor),
  ]);
  const sum = (k) => list.reduce((t, p) => t + (Number(p[k]) || 0), 0);
  if (list.length) rows.push(["Total", "", cell(sum("totalEarnings")), cell(sum("totalDeductions")), cell(sum("grossPay")), cell(sum("netPay")), ""]);
  return { headers, rows };
}

/** A period's muster. `rate` is left blank for somebody nobody marked - not 0%. */
export function attendanceCsv(report) {
  const headers = ["Employee", "Staff ID", "Department", "Present", "Half day", "On leave", "Absent", "Holiday", "Weekly off", "Marked", "Unmarked", "Hours", "Overtime", "Attendance %"];
  const line = (e) => [
    e.name, e.staffId || "", e.department || "",
    cell(e.present), cell(e.half_day), cell(e.on_leave), cell(e.absent), cell(e.holiday), cell(e.weekly_off),
    cell(e.marked), cell(e.unmarked), cell(e.hours), cell(e.overtime), pct(e.rate),
  ];
  const rows = (report?.employees || []).map(line);
  const t = report?.totals;
  if (t) rows.push(["Total", "", "", cell(t.present), cell(t.half_day), cell(t.on_leave), cell(t.absent), cell(t.holiday), cell(t.weekly_off), cell(t.marked), "", cell(t.hours), cell(t.overtime), pct(t.rate)]);
  return { headers, rows };
}

/** Everybody's leave balance. An employee the server could not compute is named in `missing` and carries
 * a reason instead of a figure - the file must not read as though they have nothing owing. */
export function leaveBalancesCsv(report) {
  const headers = ["Employee", "Staff ID", "Leave type", "Accrued", "Taken", "Available"];
  const rows = (report?.rows || []).map((r) => [r.name, r.staffCode || "", r.leaveTypeName, cell(r.accrued), cell(r.consumed), cell(r.available)]);
  for (const m of report?.missing || []) {
    rows.push([m.name, m.staffId || "", m.leaveTypeName || "", "", "", m.reason === "NO_JOINING_DATE" ? "No joining date" : "No accrual rate"]);
  }
  const t = report?.totals;
  if (t && report?.rows?.length) rows.push(["Total", "", "", cell(t.accrued), cell(t.consumed), cell(t.available)]);
  return { headers, rows };
}

/** What expires, soonest first - the order the server already sorted them into. */
export function documentsCsv(report) {
  const headers = ["Employee", "Staff ID", "Document", "Number", "Expires", "Days left", "Status", "File on record"];
  const rows = (report?.rows || []).map((r) => [
    r.partyName, r.partyCode || "", r.documentType || "", r.number || "", r.expiryDate || "",
    cell(r.daysLeft), r.status === "EXPIRED" ? "Expired" : "Expiring soon", r.hasFile ? "Yes" : "No",
  ]);
  return { headers, rows };
}
