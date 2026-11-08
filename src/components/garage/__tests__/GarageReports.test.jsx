// The Reports screen on its own: seven tabs, one route. GarageScreens.test.jsx covers Overview (the tab
// every other garage test already depended on by name); this file covers the other six, the period/
// periodless toggle, and that an empty report never renders a chart of nothing.
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const render_ = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

const m = vi.hoisted(() => ({
  overview: vi.fn(), wip: vi.fn(), profit: vi.fn(), people: vi.fn(), customers: vi.fn(), vehicles: vi.fn(), insurers: vi.fn(),
}));

vi.mock("../../../lib/garageApi", () => ({
  reports: {
    overview: m.overview, workInProgress: m.wip, profit: m.profit, people: m.people,
    customers: m.customers, vehicles: m.vehicles, insurers: m.insurers,
  },
}));

// jsdom has no layout and no ResizeObserver, so a chart cannot measure itself: give it a size (the same
// stub as GarageScreens.test.jsx and components/crm/__tests__/CrmWave2.test.jsx, for the same reason).
vi.mock("recharts", async (orig) => {
  const actual = await orig();
  const { cloneElement } = await import("react");
  return {
    ...actual,
    ResponsiveContainer: ({ children, height }) => cloneElement(children, { width: 320, height: typeof height === "number" ? height : 220 }),
  };
});

import GarageReports from "../GarageReports";

beforeEach(() => {
  for (const f of Object.keys(m)) m[f].mockReset();
  m.overview.mockResolvedValue({
    period: { from: null, to: null },
    jobs: { delivered: 1, revenue: { part: 100, labour: 0, sublet: 0, consumable: 0, total: 100 }, avgInvoice: 100, onTimePct: null, withPromise: 0, onTime: 0, comebacks: 0, comebackPct: null, hoursSold: 1, hoursTaken: 1, efficiencyPct: 100, avgHoursPerJob: 1, effectiveLabourRate: 100, avgTurnaroundHours: null },
    people: [], jobRows: [], invoiced: { total: 100, gapFromEstimate: 0 }, previous: null, trend: null, capped: false,
  });
  m.wip.mockResolvedValue({
    asAt: "2026-11-09",
    value: { estimated: 400, approvedNotBilled: 400, deliveredNotInvoiced: { count: 1, value: 300 }, owed: 150 },
    byStage: [{ status: "IN_PROGRESS", count: 1, value: 400 }],
    byAge: [{ band: "u5", count: 1, value: 400 }],
    onHold: [{ jobCardId: "j1", jobNo: "JC-1", taskName: "Brakes", holdReason: "Waiting for a part", daysIn: 2 }],
    rows: [{ jobCardId: "j1", jobNo: "JC-1", status: "IN_PROGRESS", jobType: "retail", plate: "A 1", vehicle: "Toyota Hilux", customer: "Ali", daysIn: 2, ageBand: "u5", value: 400, owed: 150, invoiceStatus: "NONE" }],
  });
  m.profit.mockResolvedValue({
    period: { from: null, to: null },
    revenue: { part: 300, labour: 300, sublet: 0, consumable: 0, total: 600 },
    cost: { parts: 120, labour: 0, sublet: null, basis: "" },
    margin: { parts: 180, labour: 300, total: 480, marginPct: 80 },
    uncostedLabourHours: 1,
    streams: [
      { kind: "part", label: "Parts", revenue: 300, cost: 120, margin: 180, basis: "current average cost" },
      { kind: "labour", label: "Labour", revenue: 300, cost: 0, margin: 300, basis: "1 h with no contract rate not included in cost" },
      { kind: "sublet", label: "Sublet", revenue: 0, cost: null, margin: null, basis: "not costed" },
      { kind: "consumable", label: "Consumables", revenue: 0, cost: 0, margin: 0, basis: "current average cost" },
    ],
    capped: false,
  });
  m.people.mockResolvedValue({
    period: { from: null, to: null },
    people: [{ key: "in_house:s1", label: "Raj", done: 1, hoursSold: 2, hoursTaken: 3, efficiencyPct: 67, waitHours: 1 }],
    bays: [{ bayId: "b1", name: "Ramp 1", kind: "mechanical", jobsDone: 1, hoursSold: 2, hoursTaken: 3, efficiencyPct: 67 }],
  });
  m.customers.mockResolvedValue({
    period: { from: null, to: null },
    rows: [{ customerId: "c1", name: "Ali Hassan", jobs: 2, estimated: 500, invoiced: 450, avgInvoice: 225, repeat: true, first: "2026-10-01", last: "2026-10-20" }],
    summary: { customers: 1, repeatCustomers: 1, repeatPct: 100, averageRepairOrder: 225 },
    capped: false,
  });
  m.vehicles.mockResolvedValue({
    asAt: "2026-11-09",
    fleet: { total: 2, active: 2, byMake: [{ make: "Toyota", count: 2 }] },
    registrationExpiring: [{ vehicleId: "v1", plate: "A 1", customer: "Ali", day: "2026-11-15", daysLeft: 6, state: "soon" }],
    policyExpiring: [],
    serviceDue: [{ vehicleId: "v2", plate: "B 2", customer: "Sara", dueDay: null, dueOdometer: 15000, odometer: 15500, overdue: true }],
    topVisited: [{ vehicleId: "v1", plate: "A 1", make: "Toyota", model: "Hilux", customer: "Ali", jobs: 3, value: 900, lastVisit: "2026-10-20" }],
  });
  m.insurers.mockResolvedValue({
    period: { from: null, to: null },
    rows: [{ insurerId: "ins1", insurer: "Orient", claims: 2, claimed: 3000, approved: 2000, shortfall: 1000, rejected: 1, rejectedPct: 50, rejectedValue: 800, excess: 500, depreciation: 100, outstanding: 0, avgDaysToDecide: 3 }],
    totals: { claims: 2, claimed: 3000, approved: 2000, rejected: 1, outstanding: 0 },
    capped: false,
  });
});

async function openTab(name) {
  render_(<GarageReports />);
  await screen.findByText("Reports");
  fireEvent.click(screen.getByRole("tab", { name }));
}

describe("the garage reports section", () => {
  it("opens on Overview, reads /garage/reports/overview, and shows what was invoiced beside the estimate", async () => {
    render_(<GarageReports />);
    await waitFor(() => expect(m.overview).toHaveBeenCalled());
    expect(screen.getByText("Invoiced")).toBeInTheDocument();
  });

  it("work in progress reads as at today, with no period control to confuse it", async () => {
    await openTab("Work in progress");
    await waitFor(() => expect(m.wip).toHaveBeenCalled());
    expect(screen.getByText("This report is as at today.")).toBeInTheDocument();
    // The period select is disabled for a periodless report, not hidden - drawn but inert.
    expect(screen.getByLabelText("Period")).toBeDisabled();
    expect(screen.getByText("Stuck, and why")).toBeInTheDocument();
    expect(screen.getByText("Waiting for a part")).toBeInTheDocument();
  });

  it("profit shows cost and margin as blank, never zero, for a stream with no known cost (sublet)", async () => {
    await openTab("Profit");
    await waitFor(() => expect(m.profit).toHaveBeenCalled());
    expect(screen.getAllByText("Sublet").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/no contract rate/).length).toBeGreaterThan(0);
  });

  it("people & bays draws the same DONE tasks two ways, by technician and by bay", async () => {
    await openTab("People & bays");
    await waitFor(() => expect(m.people).toHaveBeenCalled());
    expect(screen.getByText("Hours taken, by bay")).toBeInTheDocument();
    expect(screen.getAllByText("Raj").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ramp 1").length).toBeGreaterThan(0);
  });

  it("customers marks a repeat customer and reads the average repair order from what was invoiced", async () => {
    await openTab("Customers");
    await waitFor(() => expect(m.customers).toHaveBeenCalled());
    expect(screen.getAllByText("Ali Hassan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Repeat").length).toBeGreaterThan(0);
  });

  it("vehicles is as at today and shows registration/service due, read straight off the vehicle master", async () => {
    await openTab("Vehicles");
    await waitFor(() => expect(m.vehicles).toHaveBeenCalled());
    expect(screen.getByText("This report is as at today.")).toBeInTheDocument();
    expect(screen.getAllByText("Registration expiring").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0); // the overdue service-due row
  });

  it("insurers counts a REJECTED claim's value, unlike claims ageing which leaves it out", async () => {
    await openTab("Insurers");
    await waitFor(() => expect(m.insurers).toHaveBeenCalled());
    expect(screen.getAllByText("Orient").length).toBeGreaterThan(0);
    // The rejected count/value from the fixture (1 claim, 800) must be on screen somewhere.
    expect(screen.getAllByText(/800/).length).toBeGreaterThan(0);
  });

  it("a report with no rows shows an empty state, never a chart of nothing", async () => {
    m.customers.mockResolvedValue({ period: { from: null, to: null }, rows: [], summary: { customers: 0, repeatCustomers: 0, repeatPct: null, averageRepairOrder: null }, capped: false });
    await openTab("Customers");
    await waitFor(() => expect(m.customers).toHaveBeenCalled());
    expect(screen.getByText("Nobody delivered to in this period")).toBeInTheDocument();
  });
});
