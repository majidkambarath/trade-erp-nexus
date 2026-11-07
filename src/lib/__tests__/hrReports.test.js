import { describe, expect, it } from "vitest";
import {
  REPORTS, reportTabs, firstTab, reportLabel,
  gratuityCsv, payrollRegisterCsv, attendanceCsv, leaveBalancesCsv, documentsCsv,
} from "../hrReports";

const me = (...grants) => ({ grants });
const keys = (tabs) => tabs.map(([k]) => k);

describe("which reports a person is offered", () => {
  it("gives somebody who holds everything all six, in reading order", () => {
    const all = me("hr.view", "hr.payroll", "hr.confidential", "hr.attendance", "hr.leave");
    expect(keys(reportTabs(all))).toEqual(["gratuity", "payroll", "attendance", "leave", "documents", "emiratisation"]);
  });

  it("needs ALL of a report's keys, not any one of them", () => {
    // hr.payroll alone is not enough for the register: payrollController.js asserts hr.confidential
    // itself, so drawing the tab would be drawing a 403.
    expect(keys(reportTabs(me("hr.view", "hr.payroll")))).not.toContain("payroll");
    expect(keys(reportTabs(me("hr.view", "hr.payroll", "hr.confidential")))).toContain("payroll");
  });

  it("leaves Emiratisation out of an organisation it has nothing to say to", () => {
    // The bug this fixes: an Indian organisation was shown a live tab whose only content was a sentence
    // saying the report does not apply to it.
    expect(keys(reportTabs(me("hr.view"), { uae: false }))).not.toContain("emiratisation");
    expect(keys(reportTabs(me("hr.view"), { uae: true }))).toContain("emiratisation");
  });

  it("offers a muster clerk exactly the muster", () => {
    expect(keys(reportTabs(me("hr.attendance")))).toEqual(["attendance"]);
  });

  it("offers nothing to a role with no HR keys at all", () => {
    expect(reportTabs(me("sales.view"))).toEqual([]);
  });

  it("hides nothing while the grants are still loading", () => {
    // lib/permissions.js's own rule: a missing answer must never lock a working person out of a screen.
    expect(keys(reportTabs(null)).length).toBe(REPORTS.length);
    expect(keys(reportTabs({})).length).toBe(REPORTS.length);
  });
});

describe("firstTab", () => {
  it("keeps the tab asked for when it is still offered", () => {
    expect(firstTab([["a", "A"], ["b", "B"]], "b")).toBe("b");
  });

  it("falls back to the first one offered rather than an empty screen", () => {
    // The bug this fixes: the default was a fixed "gratuity", so a muster clerk - who holds
    // hr.attendance and not hr.view - landed on a tab that was never drawn.
    expect(firstTab([["attendance", "Attendance"]], "gratuity")).toBe("attendance");
    expect(firstTab([], "gratuity")).toBeNull();
  });

  it("names a report for the export's title line", () => {
    expect(reportLabel("leave")).toBe("Leave");
    expect(reportLabel("nonsense")).toBe("Report");
  });
});

describe("what each report exports", () => {
  it("writes a gratuity row per employee, with the total under it", () => {
    const out = gratuityCsv({
      day: "2026-10-31", cumulativeLiability: 88340.73, previousCumulative: 80000, amount: 8340.73,
      employeeCount: 2, missing: [],
      employees: [
        { name: "Ravi Kumar", staffId: "EMP-0001", serviceDays: 640, basicPay: 3000, owed: 52602.74 },
        { name: "Asha Nair", staffId: "EMP-0002", serviceDays: 400, basicPay: 2600, owed: 35737.99 },
      ],
    });
    expect(out.headers).toContain("Gratuity owed");
    expect(out.rows[0]).toEqual(["Ravi Kumar", "EMP-0001", 640, 3000, 52602.74]);
    expect(out.rows.at(-1)).toEqual(["Total", "", "", "", 88340.73]);
  });

  it("exports the aggregate for a reader the server withheld the names from", () => {
    // Without hr.confidential the preview has no `employees` at all - a file of empty name columns would
    // be worse than saying plainly what the aggregate is.
    const out = gratuityCsv({ day: "2026-10-31", cumulativeLiability: 88340.73, previousCumulative: 80000, amount: 8340.73, employeeCount: 12, missingCount: 1 });
    expect(out.headers).toEqual(["Figure", "Amount"]);
    expect(out.rows[0]).toEqual(["Liability as at 2026-10-31", 88340.73]);
    expect(out.rows.map((r) => r[0])).not.toContain("Ravi Kumar");
  });

  it("totals a payroll register, and keeps a part-month factor because it explains the net", () => {
    const out = payrollRegisterCsv([
      { staffName: "Ravi Kumar", staffCode: "EMP-0001", basicPay: 3000, totalEarnings: 3400, totalDeductions: 200, grossPay: 3400, netPay: 3200, proratedFactor: 1 },
      { staffName: "New Starter", staffCode: "EMP-0009", basicPay: 2000, totalEarnings: 1000, totalDeductions: 0, grossPay: 1000, netPay: 1000, proratedFactor: 0.5 },
    ]);
    expect(out.rows[1].at(-1)).toBe(0.5);
    expect(out.rows.at(-1)).toEqual(["Total", "", 4400, 200, 4400, 4200, ""]);
    // No Staff ID column: Payslip carries no code, and a header nothing can fill is a broken promise.
    expect(out.headers).not.toContain("Staff ID");
  });

  it("leaves an unknown attendance rate BLANK, never 0%", () => {
    // The whole reason `cell` and `pct` exist: a month nobody marked is unknown, and a 0 in a
    // spreadsheet is a claim somebody will act on.
    const out = attendanceCsv({
      employees: [
        { name: "Ravi Kumar", staffId: "EMP-0001", department: "Fabrication", present: 20, half_day: 0, on_leave: 0, absent: 2, holiday: 0, weekly_off: 8, marked: 30, unmarked: 1, hours: 160, overtime: 6, rate: 90.909 },
        { name: "Bikash Tamang", staffId: "EMP-0003", department: null, present: 0, half_day: 0, on_leave: 0, absent: 0, holiday: 0, weekly_off: 0, marked: 0, unmarked: 31, hours: 0, overtime: 0, rate: null },
      ],
      totals: { present: 20, half_day: 0, on_leave: 0, absent: 2, holiday: 0, weekly_off: 8, marked: 30, hours: 160, overtime: 6, rate: 90.909 },
    });
    expect(out.rows[0].at(-1)).toBe(90.9);
    expect(out.rows[1].at(-1)).toBe("");
    expect(out.rows[1][3]).toBe(0, "a count of nothing IS zero - only the derived rate is unknown");
    expect(out.rows.at(-1)[0]).toBe("Total");
  });

  it("names a leave balance it could not work out, instead of exporting nothing owing", () => {
    const out = leaveBalancesCsv({
      rows: [{ name: "Ravi Kumar", staffCode: "EMP-0001", leaveTypeName: "Annual", accrued: 52.5, consumed: 5, available: 47.5 }],
      missing: [{ name: "New Starter", staffId: "EMP-0009", reason: "NO_JOINING_DATE" }],
      totals: { accrued: 52.5, consumed: 5, available: 47.5 },
    });
    expect(out.rows[0]).toEqual(["Ravi Kumar", "EMP-0001", "Annual", 52.5, 5, 47.5]);
    expect(out.rows[1]).toEqual(["New Starter", "EMP-0009", "", "", "", "No joining date"]);
    expect(out.rows.at(-1)[0]).toBe("Total");
  });

  it("exports what expires, and says whether the file is on record", () => {
    const out = documentsCsv({
      rows: [
        { partyName: "Ravi Kumar", partyCode: "EMP-0001", documentType: "Passport", number: "P123", expiryDate: "2026-11-01", daysLeft: -6, status: "EXPIRED", hasFile: true },
        { partyName: "Asha Nair", partyCode: "EMP-0002", documentType: "Visa", number: "", expiryDate: "2026-12-01", daysLeft: 24, status: "EXPIRING_SOON", hasFile: false },
      ],
    });
    expect(out.rows[0]).toEqual(["Ravi Kumar", "EMP-0001", "Passport", "P123", "2026-11-01", -6, "Expired", "Yes"]);
    expect(out.rows[1].at(-1)).toBe("No");
  });

  it("every builder survives being handed nothing", () => {
    for (const build of [gratuityCsv, payrollRegisterCsv, attendanceCsv, leaveBalancesCsv, documentsCsv]) {
      const out = build(undefined);
      expect(Array.isArray(out.headers)).toBe(true);
      expect(out.rows).toEqual([]);
    }
  });
});
