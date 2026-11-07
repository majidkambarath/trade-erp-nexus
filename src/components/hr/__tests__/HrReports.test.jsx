// HRMS > Reports: the compliance panels this module keeps - gratuity and Emiratisation.
//
// These cases came OFF the dashboard. That screen used to draw both of these as well, which was two
// panels of weight spent on figures this page already owned in full; removing them from there would have
// deleted the only frontend coverage the Emiratisation rules had, because this page had no test at all.
// So the coverage moved to where the behaviour lives, which is here.
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  gratuity: { preview: vi.fn(), accruals: vi.fn(), accrue: vi.fn(), reverse: vi.fn() },
  emiratisation: vi.fn(),
  payroll: { runs: vi.fn(), payslips: vi.fn() },
  hrReports: { attendance: vi.fn(), leaveBalances: vi.fn() },
  employeeDocuments: { expiring: vi.fn() },
}));
vi.mock("../../../lib/hrApi", () => api);

// A permission-aware Can, because two of the defects fixed here ARE permission mistakes: the real Can
// resolves a list through canAny, so an AND is two nested Can, and a test that always renders children
// cannot tell a correct nesting from the single gate that drew a button answering 403.
// `held: null` means "hold everything", which is how the cases written before this behaved.
const grants = vi.hoisted(() => ({ held: null }));
vi.mock("../../shell/Can.jsx", () => ({
  default: ({ permission, children, fallback = null }) => {
    if (!grants.held) return children;
    const keys = [].concat(permission || []);
    return keys.some((k) => grants.held.includes(k)) ? children : fallback;
  },
}));

// The organisation's own clock, fixed to a month that cannot be the real UTC month - which is what makes
// the "opens on the organisation's month" case a proof rather than a coincidence.
vi.mock("../../../utils/orgLocale", async (orig) => ({ ...(await orig()), today: () => "2027-03-01" }));

// The country rule behind the Emiratisation tab.
const country = vi.hoisted(() => ({ uae: true }));
vi.mock("../../../lib/taxTerms", async (orig) => ({ ...(await orig()), isUae: () => country.uae }));

import ReportsPage from "../ReportsPage";
import { ThemeProvider } from "../../theme-provider";

const show = () => render(<ThemeProvider><MemoryRouter><ReportsPage /></MemoryRouter></ThemeProvider>);
// fireEvent, not element.click(): a bare click triggers a React state update outside act(), which React
// reports through console.error - and the afterEach below (rightly) fails a test that logs one.
const openTab = async (name) => {
  const tab = await screen.findByRole("tab", { name });
  fireEvent.click(tab);
  return tab;
};

const PREVIEW = { month: "2026-10", day: "2026-10-31", cumulativeLiability: 88340.73, previousCumulative: 80000, amount: 8340.73, employeeCount: 12, missingCount: 0, employees: [], missing: [] };

let errors;
beforeEach(() => {
  grants.held = null;
  country.uae = true;
  api.emiratisation.mockReset();
  api.payroll.runs.mockReset().mockResolvedValue([]);
  api.payroll.payslips.mockReset().mockResolvedValue([]);
  api.hrReports.attendance.mockReset().mockResolvedValue({ from: "2027-03-01", to: "2027-03-31", days: 31, employees: [], totals: { employees: 0, marked: 0, rate: null, hours: 0, overtime: 0, worked: 0, expected: 0 }, neverMarked: [] });
  api.hrReports.leaveBalances.mockReset().mockResolvedValue({ day: "2027-03-01", rows: [], missing: [], totals: { accrued: 0, consumed: 0, available: 0, employees: 0 } });
  api.employeeDocuments.expiring.mockReset().mockResolvedValue({ asOf: "2027-03-01", withinDays: 60, rows: [], summary: { expired: 0, expiringSoon: 0, total: 0 } });
  api.gratuity.preview.mockReset().mockResolvedValue(PREVIEW);
  api.gratuity.accruals.mockReset().mockResolvedValue([]);
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(errors, "the page logs no errors or React warnings").not.toHaveBeenCalled();
  errors.mockRestore();
});

describe("HR Reports", () => {
  it("opens on the gratuity liability the books should already be carrying", async () => {
    api.emiratisation.mockResolvedValue(null);
    show();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Gratuity/i })).toBeInTheDocument());
    expect(api.gratuity.preview).toHaveBeenCalled();
  });

  it("says what Emiratisation costs per month if nothing changes", async () => {
    api.emiratisation.mockResolvedValue({
      day: "2026-11-07", configured: true, requiredPercent: 2, finePerPosition: 9000,
      headcount: 12, nationals: 0, required: 1, shortfall: 1, compliant: false, monthlyExposure: 9000,
    });
    show();
    await openTab(/Emiratisation/i);
    await waitFor(() => expect(screen.getByText(/Short by 1/)).toBeInTheDocument());
    // The reason the tracker earns its place: one month's fine pays for the software many times over.
    expect(screen.getByText(/9,000/)).toBeInTheDocument();
  });

  it("says the quota is being met rather than showing an exposure of nothing", async () => {
    api.emiratisation.mockResolvedValue({
      day: "2026-11-07", configured: true, requiredPercent: 2, finePerPosition: 9000,
      headcount: 12, nationals: 2, required: 1, shortfall: 0, compliant: true, monthlyExposure: 0,
    });
    show();
    await openTab(/Emiratisation/i);
    await waitFor(() => expect(screen.getByText("Meeting the quota")).toBeInTheDocument());
    expect(screen.queryByText(/Short by/)).not.toBeInTheDocument();
  });

  it("sends somebody to Setup when the quota and the fine were never set", async () => {
    api.emiratisation.mockResolvedValue({ day: "2026-11-07", configured: false });
    show();
    await openTab(/Emiratisation/i);
    await waitFor(() => expect(screen.getByText(/have not been set up yet/)).toBeInTheDocument());
  });

  it("says plainly that it does not apply outside the UAE, rather than drawing an empty tracker", async () => {
    api.emiratisation.mockResolvedValue(null);
    show();
    await openTab(/Emiratisation/i);
    await waitFor(() => expect(screen.getByText(/applies to UAE organisations only/)).toBeInTheDocument());
  });
});

// The four defects this screen shipped with. Each case fails against the code as it was.
describe("HR Reports: what was wrong", () => {
  it("opens on the ORGANISATION's month, not the UTC one", async () => {
    api.emiratisation.mockResolvedValue(null);
    show();
    // today() is fixed to 2027-03-01 above, a month the real clock cannot be in. The old code read
    // new Date().toISOString().slice(0, 7), so in Dubai - four hours ahead of UTC - the first four hours
    // of every month previewed the month that had just ended.
    await waitFor(() => expect(api.gratuity.preview).toHaveBeenCalledWith("2027-03"));
  });

  it("shows an error when the accrual history cannot be read, and NEVER 'No accrual run yet'", async () => {
    api.emiratisation.mockResolvedValue(null);
    api.gratuity.accruals.mockRejectedValue(new Error("the server said no"));
    show();
    await waitFor(() => expect(screen.getByText(/the server said no/)).toBeInTheDocument());
    // The defect: a failed read fell through to the empty state and told the reader that nothing had
    // ever been accrued - a server error reading as a reassurance, on a compliance report.
    expect(screen.queryByText("No accrual run yet")).not.toBeInTheDocument();
  });

  it("still says so plainly when there genuinely is no accrual yet", async () => {
    api.emiratisation.mockResolvedValue(null);
    api.gratuity.accruals.mockResolvedValue([]);
    show();
    await waitFor(() => expect(screen.getByText("No accrual run yet")).toBeInTheDocument());
  });

  it("hides Accrue from somebody the server would refuse for want of finance.create", async () => {
    api.emiratisation.mockResolvedValue(null);
    grants.held = ["hr.view", "hr.confidential"]; // pay, but no finance keys
    show();
    await waitFor(() => expect(screen.getByText("What the books should already be carrying")).toBeInTheDocument());
    // complianceController.js asserts finance.create on top of hr.confidential, so one gate drew a
    // button that answered 403.
    expect(screen.queryByRole("button", { name: /Accrue this month/i })).not.toBeInTheDocument();
  });

  it("offers Accrue to somebody who holds both keys", async () => {
    api.emiratisation.mockResolvedValue(null);
    grants.held = ["hr.view", "hr.confidential", "finance.create"];
    show();
    await waitFor(() => expect(screen.getByRole("button", { name: /Accrue this month/i })).toBeInTheDocument());
  });

  it("leaves the Emiratisation tab out of an organisation outside the UAE", async () => {
    country.uae = false;
    show();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Gratuity/i })).toBeInTheDocument());
    // The defect: an Indian organisation was shown a live tab whose only content was a sentence saying
    // the report did not apply to it.
    expect(screen.queryByRole("tab", { name: /Emiratisation/i })).not.toBeInTheDocument();
    expect(api.emiratisation).not.toHaveBeenCalled();
  });
});

// The four reports that were promised "in a later wave" and never came.
describe("HR Reports: the reports that were missing", () => {
  it("offers all six reports to somebody who holds the keys", async () => {
    api.emiratisation.mockResolvedValue(null);
    show();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Gratuity/i })).toBeInTheDocument());
    for (const name of [/^Payroll$/i, /^Attendance$/i, /^Leave$/i, /^Documents$/i, /Emiratisation/i]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("shows who was paid what on a posted run", async () => {
    api.emiratisation.mockResolvedValue(null);
    api.payroll.runs.mockResolvedValue([{ _id: "r1", period: "2027-02", voucherNo: "PAY-2027-0001", status: "POSTED", employeeCount: 2, totalGross: 4400, totalNet: 4200 }]);
    api.payroll.payslips.mockResolvedValue([
      { _id: "p1", staffName: "Ravi Kumar", basicPay: 3000, totalEarnings: 3400, totalDeductions: 200, grossPay: 3400, netPay: 3200, proratedFactor: 1 },
      { _id: "p2", staffName: "New Starter", basicPay: 2000, totalEarnings: 1000, totalDeductions: 0, grossPay: 1000, netPay: 1000, proratedFactor: 0.5 },
    ]);
    show();
    await openTab(/^Payroll$/i);
    await waitFor(() => expect(screen.getByText("Ravi Kumar")).toBeInTheDocument());
    expect(api.payroll.payslips).toHaveBeenCalledWith("r1");
    // The part-month factor is the figure that explains a net which looks wrong against the contract.
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("tells a reader there is no run yet rather than drawing an empty register", async () => {
    api.emiratisation.mockResolvedValue(null);
    api.payroll.runs.mockResolvedValue([]);
    show();
    await openTab(/^Payroll$/i);
    await waitFor(() => expect(screen.getByText("No payroll run posted yet")).toBeInTheDocument());
  });
  it("says a month nobody marked is NOT MARKED, never 0% attendance", async () => {
    api.emiratisation.mockResolvedValue(null);
    api.hrReports.attendance.mockResolvedValue({
      from: "2027-03-01", to: "2027-03-31", days: 31, neverMarked: [{ _id: "s3", name: "Bikash Tamang", staffId: "EMP-0003" }],
      employees: [
        { _id: "s1", name: "Ravi Kumar", staffId: "EMP-0001", department: "Fabrication", present: 20, half_day: 0, on_leave: 0, absent: 2, holiday: 0, weekly_off: 8, marked: 30, unmarked: 1, hours: 160, overtime: 6, rate: 90.909, worked: 20, expected: 22 },
        { _id: "s3", name: "Bikash Tamang", staffId: "EMP-0003", department: null, present: 0, half_day: 0, on_leave: 0, absent: 0, holiday: 0, weekly_off: 0, marked: 0, unmarked: 31, hours: 0, overtime: 0, rate: null, worked: 0, expected: 0 },
      ],
      totals: { present: 20, half_day: 0, on_leave: 0, absent: 2, holiday: 0, weekly_off: 8, employees: 2, marked: 30, worked: 20, expected: 22, rate: 90.909, hours: 160, overtime: 6 },
    });
    show();
    await openTab(/^Attendance$/i);
    await waitFor(() => expect(screen.getByText("Bikash Tamang")).toBeInTheDocument());
    expect(screen.getByText("Not marked")).toBeInTheDocument();
    // Overtime has been computed since the attendance wave and displayed nowhere until now.
    expect(screen.getByText("Overtime hours")).toBeInTheDocument();
    expect(screen.getByText("1 never marked")).toBeInTheDocument();
  });

  it("lists everybody's leave balance, and names anyone it could not work out", async () => {
    api.emiratisation.mockResolvedValue(null);
    api.hrReports.leaveBalances.mockResolvedValue({
      day: "2027-03-01",
      rows: [{ _id: "s1-t1", staffId: "s1", name: "Ravi Kumar", staffCode: "EMP-0001", leaveTypeId: "t1", leaveTypeName: "Annual", accrued: 52.5, consumed: 5, available: 47.5 }],
      missing: [{ _id: "s9", name: "New Starter", staffId: "EMP-0009", reason: "NO_JOINING_DATE" }],
      totals: { accrued: 52.5, consumed: 5, available: 47.5, employees: 1 },
    });
    show();
    await openTab(/^Leave$/i);
    await waitFor(() => expect(screen.getByText("Ravi Kumar")).toBeInTheDocument());
    // Two decimals through formatNumber, and twice over - the Available cell and the Total row under it.
    expect(screen.getAllByText("47.50").length).toBeGreaterThan(0);
    expect(screen.getByText("Annual")).toBeInTheDocument();
    // Nobody is shown a balance of nothing: an employee with no joining date is named with the reason.
    expect(screen.getByText("New Starter")).toBeInTheDocument();
    expect(screen.getByText("No joining date")).toBeInTheDocument();
  });

  it("lists what expires, and says what is already expired", async () => {
    api.emiratisation.mockResolvedValue(null);
    api.employeeDocuments.expiring.mockResolvedValue({
      asOf: "2027-03-01", withinDays: 60,
      rows: [
        { documentId: "d1", partyName: "Ravi Kumar", partyCode: "EMP-0001", documentType: "Passport", number: "P123", expiryDate: "2027-02-24", status: "EXPIRED", daysLeft: -5, hasFile: true },
        { documentId: "d2", partyName: "Asha Nair", partyCode: "EMP-0002", documentType: "Visa", number: "", expiryDate: "2027-03-25", status: "EXPIRING_SOON", daysLeft: 24, hasFile: false },
      ],
      summary: { expired: 1, expiringSoon: 1, total: 2 },
    });
    show();
    await openTab(/^Documents$/i);
    await waitFor(() => expect(screen.getByText("Ravi Kumar")).toBeInTheDocument());
    expect(screen.getByText("Expired 5d ago")).toBeInTheDocument();
    expect(screen.getByText("24d left")).toBeInTheDocument();
    expect(screen.getByText("1 expired")).toBeInTheDocument();
  });
});
