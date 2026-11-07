import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ hrDashboard: vi.fn() }));
vi.mock("../../../lib/hrApi", () => api);
// jsdom has no layout, so a responsive chart measures 0 x 0 and draws nothing: give it a size.
vi.mock("recharts", async (orig) => {
  const actual = await orig();
  const { cloneElement } = await import("react");
  return { ...actual, ResponsiveContainer: ({ children, height }) => cloneElement(children, { width: 600, height: typeof height === "number" ? height : 240 }) };
});

import OverviewPage from "../OverviewPage";
import { ThemeProvider } from "../../theme-provider";

const show = () => render(<ThemeProvider><MemoryRouter><OverviewPage /></MemoryRouter></ThemeProvider>);
// Intl puts a no-break space between the currency and the figure. Written as an escape rather than as
// the character itself, which the lint rule rightly refuses: it is invisible in a diff.

// What the server sends a reader who holds hr.confidential.
const full = () => ({
  currency: "AED",
  period: { month: "2026-03", from: "2026-03-01", to: "2026-03-11", months: ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"], previousMonth: "2026-02" },
  confidential: true,
  headcount: {
    active: 12, total: 14, inactive: 2, costed: 10, missingCostRate: 2,
    missing: [{ _id: "s1", name: "Ravi", staffId: "EMP-0001", designation: "Fabricator" }],
    byDepartment: [{ key: "d1", name: "Fabrication", value: 8, people: 8 }, { key: "u", name: "Unassigned", value: 4, people: 4 }],
    flow: [{ month: "2026-02", joiners: 2, leavers: 0, net: 2, headcount: 11 }, { month: "2026-03", joiners: 1, leavers: 1, net: 0, headcount: 12 }],
  },
  attendance: { counts: { present: 180, half_day: 4, absent: 12, on_leave: 6, holiday: 9, weekly_off: 30 }, worked: 184, expected: 202, rate: 91.09, hours: 1480, overtime: 12 },
  leave: { onLeaveToday: 1, pending: 3 },
  cost: {
    ran: true, thisMonth: 120000, previousMonth: 110000, changePct: 9.09, employees: 12, perEmployee: 10000,
    byMonth: [{ month: "2026-02", ran: true, gross: 110000, net: 101000, employees: 11 }, { month: "2026-03", ran: true, gross: 120000, net: 110000, employees: 12 }],
    byDepartment: [{ key: "d1", name: "Fabrication", value: 80000, people: 8 }, { key: "u", name: "Unassigned", value: 40000, people: 4 }],
  },
  labour: { hasWork: false, orders: 0, bookedCost: 0, idleCost: 0, bookedHours: 0, idleHours: 0, idleShare: null, total: 0, steps: [] },
  gratuity: { liability: 54000, month: "2026-03", employeeCount: 12, missingCount: 0 },
  emiratisation: { day: "2026-03-11", configured: true, requiredPercent: 2, finePerPosition: 9000, headcount: 12, nationals: 0, required: 1, shortfall: 1, compliant: false, monthlyExposure: 9000 },
  documents: { expired: 1, expiringSoon: 3, total: 9 },
  checklists: { onboarding: { open: 4, late: 1 }, exit: { open: 1, late: 0 } },
});

// The same answer for a reader WITHOUT hr.confidential: the divisible figures are simply absent.
const stripped = () => {
  const d = full();
  d.confidential = false;
  d.cost = { ran: true, thisMonth: 120000, previousMonth: 110000, changePct: 9.09, byMonth: d.cost.byMonth };
  d.labour = { hasWork: false, orders: 0, bookedHours: 0, idleHours: 0, idleShare: null };
  return d;
};

let errors;
beforeEach(() => {
  api.hrDashboard.mockReset();
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(errors, "the page logs no errors or React warnings").not.toHaveBeenCalled();
  errors.mockRestore();
});

describe("the HR dashboard", () => {
  it("leads with what labour costs", async () => {
    api.hrDashboard.mockResolvedValue(full());
    show();
    await waitFor(() => expect(screen.getByText("Payroll this month")).toBeInTheDocument());
    // CountUp keeps the real figure in the markup, so the test reads the number itself. It appears
    // twice on purpose - the headline card and this month's bar in the trend - so both are accepted.
    expect(screen.getAllByText(/AED 120,000/).length).toBeGreaterThan(0);
    expect(screen.getByText("Cost per employee")).toBeInTheDocument();
    expect(screen.getByText("Payroll by month")).toBeInTheDocument();
    expect(screen.getByText("Cost by department")).toBeInTheDocument();
  });

  it("says how this month compares with the last, compactly enough for a tile", async () => {
    api.hrDashboard.mockResolvedValue(full());
    show();
    // Compact on purpose: the sentence form wrapped to three lines in the tile footer and made that card
    // taller than the one beside it - which is only visible in a screenshot, not in a test like this one.
    await waitFor(() => expect(screen.getByText("+9.1%")).toBeInTheDocument());
  });

  it("gives a reader without the permission the SAME four tiles, with a dash where the money was", async () => {
    api.hrDashboard.mockResolvedValue(stripped());
    show();
    await waitFor(() => expect(screen.getByText("Payroll this month")).toBeInTheDocument());

    // The row never has a hole in it: four titles, always. Dropping cards is what left a five-column
    // grid holding three of them, and that ragged row is what made the screen look unfinished.
    for (const title of ["Payroll this month", "Cost per employee", "Active employees", "Attendance"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // The organisation-wide total is an aggregate and stays...
    expect(screen.getAllByText(/AED 120,000/).length).toBeGreaterThan(0);
    // ...the average and the per-department split do not, and come back as a dash rather than a zero.
    expect(screen.queryByText(/AED 10,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/AED 80,000/)).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    // And the panel explains itself rather than drawing an empty chart.
    expect(screen.getByText(/do not hold the permission|needs the confidential permission/i)).toBeInTheDocument();
  });

  it("is a four-across row, the house shape - never the five that left dead grid tracks", async () => {
    api.hrDashboard.mockResolvedValue(full());
    show();
    await waitFor(() => expect(screen.getByText("Payroll this month")).toBeInTheDocument());
    const row = screen.getByText("Payroll this month").closest(".grid");
    expect(row.className).toMatch(/xl:grid-cols-4/);
    expect(row.className).not.toMatch(/grid-cols-5/);
  });

  it("every tile is a way in, not only a figure", async () => {
    api.hrDashboard.mockResolvedValue(full());
    show();
    await waitFor(() => expect(screen.getByText("Active employees")).toBeInTheDocument());
    // StatCard becomes a button once it is given an onClick.
    expect(screen.getByText("Active employees").closest("button")).toBeInTheDocument();
  });

  it("sends compliance to Reports rather than carrying it twice", async () => {
    api.hrDashboard.mockResolvedValue(full());
    show();
    await waitFor(() => expect(screen.getByText("Payroll by month")).toBeInTheDocument());
    // HR Reports owns both of these in full; two panels of weight here bought nothing new.
    expect(screen.queryByText("Gratuity liability")).not.toBeInTheDocument();
    expect(screen.queryByText("Emiratisation")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/hr/reports");
  });

  it("counts are shown to everyone, because a headcount is nobody's pay", async () => {
    api.hrDashboard.mockResolvedValue(stripped());
    show();
    await waitFor(() => expect(screen.getByText("Active employees")).toBeInTheDocument());
    expect(screen.getByText("Headcount by department")).toBeInTheDocument();
    expect(screen.getByText("Attendance this month")).toBeInTheDocument();
  });

  it("says a month was not run rather than showing it as costing nothing", async () => {
    const d = full();
    d.cost = { ran: false, thisMonth: 0, previousMonth: 0, changePct: null, byMonth: [{ month: "2026-03", ran: false, gross: 0 }], perEmployee: null, byDepartment: [] };
    api.hrDashboard.mockResolvedValue(d);
    show();
    await waitFor(() => expect(screen.getByText("Not run yet")).toBeInTheDocument());
    expect(screen.getByText("No payroll run yet")).toBeInTheDocument();
  });

  it("leaves the labour panel out entirely when there is no work costed to show", async () => {
    api.hrDashboard.mockResolvedValue(full());
    show();
    await waitFor(() => expect(screen.getByText("Payroll this month")).toBeInTheDocument());
    expect(screen.queryByText(/Labour on work costed this month/)).not.toBeInTheDocument();
  });

  it("draws the labour panel, labelled as only the work that was costed, when there is some", async () => {
    const d = full();
    d.labour = { hasWork: true, orders: 3, bookedCost: 1700, idleCost: 300, bookedHours: 170, idleHours: 30, idleShare: 15, total: 2000, steps: [] };
    api.hrDashboard.mockResolvedValue(d);
    show();
    await waitFor(() => expect(screen.getByText("Labour on work costed this month")).toBeInTheDocument());
    expect(screen.getByText(/only what was booked to a process order or a job card/)).toBeInTheDocument();
    expect(screen.getByText("15.0%")).toBeInTheDocument();
  });

  it("points at what needs attention, with somewhere to go about it", async () => {
    api.hrDashboard.mockResolvedValue(full());
    show();
    await waitFor(() => expect(screen.getByText("Needs attention")).toBeInTheDocument());
    expect(screen.getByText("No cost rate").closest("a")).toHaveAttribute("href", "/hr/people");
    expect(screen.getByText("Leave to decide").closest("a")).toHaveAttribute("href", "/hr/leave");
    expect(screen.getByText("Renew documents").closest("a")).toHaveAttribute("href", "/hr/documents");
    expect(screen.getByText(/1 past their day/)).toBeInTheDocument();
  });

  // The three Emiratisation cases that used to live here have MOVED to HrReports.test.jsx, which is the
  // screen that owns those figures. They are not deleted - this page simply no longer draws them, and
  // "sends compliance to Reports rather than carrying it twice" above is what pins that.

  it("gives an organisation with nobody on the books one honest empty state, not nine", async () => {
    api.hrDashboard.mockResolvedValue({ headcount: { total: 0, active: 0 }, period: { month: "2026-03" } });
    show();
    await waitFor(() => expect(screen.getByText("No employees yet")).toBeInTheDocument());
    expect(screen.queryByText("Payroll by month")).not.toBeInTheDocument();
  });

  it("survives an older server that answers without the newer fields", async () => {
    api.hrDashboard.mockResolvedValue({ headcount: { total: 3, active: 3 }, period: { month: "2026-03" } });
    show();
    // No crash, no blank screen: the panels say what is missing.
    await waitFor(() => expect(screen.getByText("Active employees")).toBeInTheDocument());
    // The four tiles are there whatever the server sent - that is the point of not filtering them.
    expect(screen.getByText("Cost per employee")).toBeInTheDocument();
    // With no cost object at all the screen cannot tell "withheld from you" from "this server is older",
    // so it says the safer of the two rather than claiming there is no payroll.
    expect(screen.getByText("Payroll figures are hidden")).toBeInTheDocument();
    expect(screen.getByText("Nothing marked this month")).toBeInTheDocument();
  });

  it("shows the error with a way to try again, rather than an empty page", async () => {
    api.hrDashboard.mockRejectedValue(new Error("the server said no"));
    show();
    await waitFor(() => expect(screen.getByText(/the server said no/)).toBeInTheDocument());
  });
});
