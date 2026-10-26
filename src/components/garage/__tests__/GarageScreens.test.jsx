import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor, act } from "@testing-library/react";

const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

const m = vi.hoisted(() => ({
  board: vi.fn(), jcList: vi.fn(), jcGet: vi.fn(), jcCreate: vi.fn(), jcStaff: vi.fn(), jcAssignees: vi.fn(),
  vList: vi.fn(), vCreate: vi.fn(), vFind: vi.fn(), vUpdate: vi.fn(), vGet: vi.fn(), vJobs: vi.fn(), vCatalogue: vi.fn(),
  customers: vi.fn(), vendors: vi.fn(), apiGet: vi.fn(), createCustomer: vi.fn(),
  clList: vi.fn(), clGet: vi.fn(), clCreate: vi.fn(), clSubmit: vi.fn(), clSurvey: vi.fn(), clDecide: vi.fn(), clRaise: vi.fn(),
  jcAnalysis: vi.fn(), jcCheckIn: vi.fn(), jcComebacks: vi.fn(),
  setupBays: vi.fn(), setupServices: vi.fn(), setupCreateBay: vi.fn(),
}));

vi.mock("../../../lib/garageApi", () => ({
  jobCards: {
    board: m.board, list: m.jcList, get: m.jcGet, create: m.jcCreate, update: vi.fn(), remove: vi.fn(),
    staff: m.jcStaff, assignees: m.jcAssignees, startTask: vi.fn(), completeTask: vi.fn(), sendEstimate: vi.fn(),
    recordApproval: vi.fn(), reviseEstimate: vi.fn(), createInvoice: vi.fn(), release: vi.fn(), cancel: vi.fn(),
    analysis: m.jcAnalysis, committed: vi.fn(), recordCheckIn: m.jcCheckIn, comebackCandidates: m.jcComebacks,
  },
  vehicles: { list: m.vList, find: m.vFind, get: m.vGet, activity: vi.fn(), jobs: m.vJobs, catalogue: m.vCatalogue, create: m.vCreate, update: m.vUpdate },
  partyChoices: { customers: m.customers, vendors: m.vendors, createCustomer: m.createCustomer },
  claims: {
    ageing: vi.fn(), list: m.clList, get: m.clGet, create: m.clCreate, update: vi.fn(), remove: vi.fn(),
    submit: m.clSubmit, recordSurvey: m.clSurvey, recordApproval: m.clDecide, raiseInvoices: m.clRaise,
  },
  setup: {
    bays: m.setupBays, createBay: m.setupCreateBay, updateBay: vi.fn(),
    services: m.setupServices, createService: vi.fn(), updateService: vi.fn(), plan: vi.fn(),
  },
  filesFor: () => ({ list: () => Promise.resolve([]), upload: vi.fn(), remove: vi.fn(), download: vi.fn() }),
}));
vi.mock("../../../lib/accountingApi", () => ({ api: { get: m.apiGet } }));
vi.mock("../../shell/OrganisationContext", () => ({
  useOrganisation: () => ({ can: () => true, canAny: () => true, me: { id: "u1", name: "Ravi" } }),
}));

// jsdom has no layout and no ResizeObserver, so the ring chart cannot measure itself: give it a size (the
// same stub as components/crm/__tests__/CrmWave2.test.jsx, for the same reason).
vi.mock("recharts", async (orig) => {
  const actual = await orig();
  const { cloneElement } = await import("react");
  return {
    ...actual,
    ResponsiveContainer: ({ children, height }) => cloneElement(children, { width: 320, height: typeof height === "number" ? height : 220 }),
  };
});

import GarageBoard from "../GarageBoard";
import JobCardsPage from "../JobCardsPage";
import VehiclesPage from "../VehiclesPage";
import ClaimsPage from "../ClaimsPage";
import GarageReports from "../GarageReports";
import GarageSetupPage from "../GarageSetupPage";

const boardData = {
  counts: { jobs: 3, awaitingApproval: 1, inProgress: 1, ready: 1, deliveredNotInvoiced: 0, overdue: 1, dueToday: 1, dueTomorrow: 0, doneToday: 0 },
  columns: [
    { name: "Waiting for approval", order: 0, cards: [{ jobCardId: "j1", jobNo: "JC-2026-0001", status: "AWAITING_APPROVAL", plate: "A 11111", vehicle: "Toyota Hilux", customer: "Ali Hassan", taskName: null, taskStatus: null, due: "2026-10-20", dueState: "overdue" }] },
    { name: "Replace brake pads", order: 11, cards: [{ jobCardId: "j2", jobNo: "JC-2026-0002", status: "IN_PROGRESS", plate: "B 22222", vehicle: "Nissan Patrol", customer: "Sara", taskId: "t1", taskName: "Replace brake pads", taskStatus: "READY", who: "Raj", due: "2026-10-26", dueState: "today" }] },
  ],
  mine: [{ jobCardId: "j2", taskId: "t1", jobNo: "JC-2026-0002", plate: "B 22222", vehicle: "Nissan Patrol", taskName: "Replace brake pads", taskStatus: "READY", dueState: "today" }],
  overdue: [], dueToday: [], dueTomorrow: [],
};

const jobCardRow = (over = {}) => ({
  _id: "j1", jobNo: "JC-2026-0001", status: "AWAITING_APPROVAL", invoiceStatus: "NONE",
  vehicle: { plateNumber: "A 11111", make: "Toyota", model: "Hilux" }, customer: { name: "Ali Hassan" },
  receivedAt: "2026-10-20T08:00:00.000Z", promisedAt: null, estimate: { total: 500 }, ...over,
});

const jobCardFull = (over = {}) => ({
  _id: "j1", jobNo: "JC-2026-0001", status: "AWAITING_APPROVAL", invoiceStatus: "NONE",
  vehicle: { plateNumber: "A 11111", make: "Toyota", model: "Hilux" }, customer: { name: "Ali Hassan" },
  receivedAt: "2026-10-20T08:00:00.000Z", promisedAt: null, odometerIn: 85000,
  complaints: [{ _id: "c1", concern: "Brakes squeaking", cause: "" }],
  lines: [{ _id: "l1", kind: "part", description: "Brake pads", lineTotal: 157.5, approved: true }],
  tasks: [{ _id: "t1", stage: 1, name: "Replace brake pads", mode: "in_house", status: "READY", staffName: "Raj", actions: { start: true, complete: false } }],
  invoices: [], delivery: {}, warranty: {}, notes: "", checkIn: {},
  totals: { total: 157.5 },
  actions: { edit: false, delete: false, checkIn: true, sendEstimate: false, recordApproval: true, reviseEstimate: true, createInvoice: false, release: false, cancel: true },
  ...over,
});

const claimRow = (over = {}) => ({
  _id: "cl1", claimNo: "CLM-2026-0001", status: "SURVEYED", insurer: { name: "Orient Insurance" }, policyNo: "POL-998877",
  accidentDate: "2026-10-01T00:00:00.000Z", approval: {}, ...over,
});
const claimFull = (over = {}) => ({
  _id: "cl1", claimNo: "CLM-2026-0001", status: "SURVEYED", insurer: { name: "Orient Insurance" }, policyNo: "POL-998877",
  survey: { surveyorName: "Ahmed Saeed", company: "Crawford UAE" }, approval: {}, deductions: {}, invoices: [], notes: "",
  actions: { edit: false, delete: false, submit: false, recordSurvey: false, recordApproval: true, raiseInvoices: false },
  ...over,
});

beforeEach(() => {
  for (const f of Object.keys(m)) m[f].mockReset();
  m.board.mockResolvedValue(boardData);
  m.jcList.mockResolvedValue([jobCardRow()]);
  m.jcGet.mockResolvedValue(jobCardFull());
  m.jcStaff.mockResolvedValue([{ id: "s1", name: "Raj", designation: "Technician" }]);
  m.jcAssignees.mockResolvedValue([{ id: "u1", name: "Ravi" }]);
  m.vList.mockResolvedValue([{ _id: "v1", plateNumber: "A 11111", make: "Toyota", model: "Hilux", year: 2019, colour: "White", chassisNo: "", odometer: 85000, status: "active" }]);
  m.vGet.mockResolvedValue({ _id: "v1", plateNumber: "A 11111", make: "Toyota", model: "Hilux", year: 2019, colour: "White", chassisNo: "", odometer: 85000, status: "active", serviceDue: {} });
  m.vJobs.mockResolvedValue([]);
  m.vCatalogue.mockResolvedValue({ makes: [], modelsByMake: {} });
  m.jcComebacks.mockResolvedValue([]);
  m.setupBays.mockResolvedValue([]);
  m.setupServices.mockResolvedValue([]);
  m.setupCreateBay.mockResolvedValue({ _id: "b1", name: "Ramp 1", active: true });
  m.customers.mockResolvedValue([{ id: "cu1", name: "Ali Hassan", code: "C1" }, { id: "ins1", name: "Orient Insurance", code: "INS1", isInsurer: true }]);
  m.vendors.mockResolvedValue([{ id: "ve1", name: "Shine Painters", code: "V1" }]);
  m.clList.mockResolvedValue([claimRow()]);
  m.clGet.mockResolvedValue(claimFull());
  m.jcAnalysis.mockResolvedValue({
    period: { from: null, to: null },
    jobs: {
      delivered: 2, revenue: { part: 400, labour: 400, sublet: 0, consumable: 0, total: 800 },
      avgInvoice: 400, avgTurnaroundHours: 24, withPromise: 2, onTime: 1, onTimePct: 50,
      comebacks: 1, comebackPct: 50, hoursSold: 4, hoursTaken: 4, efficiencyPct: 100,
      avgHoursPerJob: 2, effectiveLabourRate: 100,
    },
    people: [{ key: "in_house:s1", label: "Raj", done: 2, hoursSold: 4, hoursTaken: 4, efficiencyPct: 100, waitHours: 1 }],
  });
  m.apiGet.mockResolvedValue({ stocks: [
    { _id: "p1", itemId: "PART-BRAKE", itemName: "Brake pads", itemType: "goods", salesPrice: 150 },
    { _id: "s1", itemId: "LAB-BRAKE", itemName: "Labour - brake job", itemType: "service", salesPrice: 200 },
  ] });
});

describe("the garage board", () => {
  it("shows the counts, the workshop's health ring, where every job is, and my own work", async () => {
    render(<GarageBoard />);
    const tiles = await screen.findByRole("list", { name: "Where the work stands" });
    expect(within(tiles).getByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.getByText("The workshop's health")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Waiting for approval" })).toBeInTheDocument();
    expect(screen.getByText("My work")).toBeInTheDocument();
    expect(screen.getAllByText("JC-2026-0002").length).toBeGreaterThan(0);
  });

  it("opens a job card from the board and shows its complaints, lines and tasks", async () => {
    render(<GarageBoard />);
    await screen.findByRole("list", { name: "Where the work stands" });
    fireEvent.click(screen.getByRole("button", { name: /JC-2026-0001: Toyota Hilux/ }));
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Brakes squeaking")).toBeInTheDocument();
    expect(within(dialog).getByText("Brake pads")).toBeInTheDocument();
    expect(within(dialog).getByText(/Replace brake pads/)).toBeInTheDocument();
    // actions.recordApproval is true, so the button is offered
    expect(within(dialog).getByRole("button", { name: "Record decision" })).toBeInTheDocument();
  });
});

describe("job cards list", () => {
  it("lists job cards and opens the New job card form", async () => {
    render(<JobCardsPage />);
    expect(await screen.findByText("JC-2026-0001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New job card/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("New job card")).toBeInTheDocument();
    // the vehicle and customer pickers both loaded without crashing
    await waitFor(() => expect(m.vList).toHaveBeenCalled());
    await waitFor(() => expect(m.customers).toHaveBeenCalled());
  });

  it("choosing a part or labour item fills in its price from the item master", async () => {
    render(<JobCardsPage />);
    fireEvent.click(screen.getByRole("button", { name: /New job card/ }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(m.apiGet).toHaveBeenCalled());

    fireEvent.click(within(dialog).getByRole("button", { name: /Add line/ }));
    const boxes = within(dialog).getAllByRole("combobox");
    const itemBox = boxes[boxes.length - 1]; // the line just added, last in the form
    fireEvent.focus(itemBox);
    fireEvent.keyDown(itemBox, { key: "ArrowDown", keyCode: 40 });
    fireEvent.click(await screen.findByText(/Brake pads/));

    const priceInput = within(dialog).getByLabelText("Price");
    await waitFor(() => expect(priceInput).toHaveValue("150"));
  });

  it("the customer field can create a new customer in place, with no separate screen", async () => {
    m.createCustomer.mockResolvedValue({ id: "cu9", name: "Majid Khan", code: "CUST2026099", active: true });
    render(<JobCardsPage />);
    fireEvent.click(screen.getByRole("button", { name: /New job card/ }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("combobox", { name: "Customer" });

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown", keyCode: 40 });
    fireEvent.change(input, { target: { value: "Majid Khan" } });
    await wait(50);
    const createOption = screen.getByRole("option", { name: 'Add "Majid Khan"' });
    fireEvent.mouseDown(createOption);
    fireEvent.mouseUp(createOption);
    fireEvent.click(createOption);

    await waitFor(() => expect(m.createCustomer).toHaveBeenCalledWith("Majid Khan"));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Majid Khan")).toBeInTheDocument());
  });

  it("an insurance job with no claim yet offers to open one, with the insurer picker narrowed to insurers", async () => {
    m.jcGet.mockResolvedValue(jobCardFull({ jobType: "insurance", claimId: null }));
    render(<JobCardsPage />);
    fireEvent.click(await screen.findByText("JC-2026-0001"));
    let dialog = await screen.findByRole("dialog");
    const openButton = within(dialog).getByRole("button", { name: "Open insurance claim" });
    fireEvent.click(openButton);
    const dialogs = await screen.findAllByRole("dialog");
    const claimDialog = dialogs.find((d) => within(d).queryByText("Open an insurance claim"));
    expect(claimDialog).toBeTruthy();
    await waitFor(() => expect(m.customers).toHaveBeenCalled());
  });

  it("an insurance job that already has a claim offers to view it instead", async () => {
    m.jcGet.mockResolvedValue(jobCardFull({ jobType: "insurance", claimId: "cl1" }));
    render(<JobCardsPage />);
    fireEvent.click(await screen.findByText("JC-2026-0001"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "View claim" }));
    await waitFor(() => expect(m.clGet).toHaveBeenCalledWith("cl1"));
    const dialogs = await screen.findAllByRole("dialog");
    expect(dialogs.some((d) => within(d).queryByText(/Orient Insurance/))).toBe(true);
  });

  it("records the walk-around: items present, a damage point, and condition notes", async () => {
    m.jcCheckIn.mockResolvedValue(jobCardFull({ checkIn: { itemsPresent: ["Spare wheel"], damagePoints: [{ panel: "Front bumper", kind: "scratch", notes: "" }], notes: "" } }));
    render(<JobCardsPage />);
    fireEvent.click(await screen.findByText("JC-2026-0001"));
    const cardDialog = await screen.findByRole("dialog");
    fireEvent.click(within(cardDialog).getByRole("button", { name: "Check-in" }));
    const dialogs = await screen.findAllByRole("dialog");
    const checkInDialog = dialogs.find((d) => within(d).queryByText("The walk-around"));
    expect(checkInDialog).toBeTruthy();

    fireEvent.click(within(checkInDialog).getByLabelText("Spare wheel"));
    fireEvent.click(within(checkInDialog).getByRole("button", { name: /Add a mark/ }));
    fireEvent.change(within(checkInDialog).getByLabelText("Panel"), { target: { value: "Front bumper" } });
    fireEvent.click(within(checkInDialog).getByRole("button", { name: "Save check-in" }));

    await waitFor(() => expect(m.jcCheckIn).toHaveBeenCalledWith("j1", expect.objectContaining({ itemsPresent: ["Spare wheel"] })));
    const body = m.jcCheckIn.mock.calls[0][1];
    expect(body.damagePoints).toEqual([{ panel: "Front bumper", kind: "scratch", notes: "" }]);
  });
});

describe("claims list", () => {
  it("lists claims and opens one, offering the action its own status allows", async () => {
    render(<ClaimsPage />);
    expect(await screen.findByText("CLM-2026-0001")).toBeInTheDocument();
    fireEvent.click(screen.getByText("CLM-2026-0001"));
    await waitFor(() => expect(m.clGet).toHaveBeenCalledWith("cl1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Ahmed Saeed/)).toBeInTheDocument();
    // actions.recordApproval is true on the fixture
    expect(within(dialog).getByRole("button", { name: "Record decision" })).toBeInTheDocument();
  });
});

describe("vehicles list", () => {
  it("lists vehicles and opens the New vehicle form", async () => {
    render(<VehiclesPage />);
    expect(await screen.findByText("A 11111")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New vehicle/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("New vehicle")).toBeInTheDocument();
  });

  it("typing a registration expiry date actually reaches the form (not an onChange event object)", async () => {
    m.vUpdate.mockResolvedValue({ _id: "v1", plateNumber: "A 11111" });
    render(<VehiclesPage />);
    fireEvent.click(await screen.findByText("A 11111"));
    // Opening a row opens its service history first (VehicleView); Edit opens the ordinary form on top of it.
    const view = await screen.findByRole("dialog");
    fireEvent.click(within(view).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: /Edit/ });

    const dateBox = within(dialog).getByPlaceholderText("DD/MM/YYYY");
    fireEvent.change(dateBox, { target: { value: "28/10/2026" } });
    fireEvent.blur(dateBox);
    // The visible box shows the date back, which it could not if onChange had set the form field to an
    // event object instead of the plain ISO string (DateInput's own `show()` would fail to format one).
    expect(dateBox).toHaveValue("28/10/2026");

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.vUpdate).toHaveBeenCalled());
    expect(m.vUpdate.mock.calls[0][1].registrationExpiry).toBe("2026-10-28");
  });

  it("opening a vehicle shows its job history - the reason a workshop buys this", async () => {
    m.vJobs.mockResolvedValue([
      { _id: "j1", jobNo: "JC-2026-0001", status: "CLOSED", estimate: { total: 350 }, receivedAt: "2026-09-01T08:00:00.000Z" },
      { _id: "j2", jobNo: "JC-2026-0002", status: "IN_PROGRESS", estimate: { total: 120 }, receivedAt: "2026-10-20T08:00:00.000Z", comebackOf: "j1" },
    ]);
    render(<VehiclesPage />);
    fireEvent.click(await screen.findByText("A 11111"));
    const view = await screen.findByRole("dialog");
    await waitFor(() => expect(m.vJobs).toHaveBeenCalledWith("v1"));
    expect(within(view).getByText("JC-2026-0001")).toBeInTheDocument();
    expect(within(view).getByText("JC-2026-0002")).toBeInTheDocument();
    expect(within(view).getByText("Comeback")).toBeInTheDocument();
  });
});

describe("garage setup", () => {
  it("adds a bay to the list", async () => {
    render(<GarageSetupPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Bays" }));
    await waitFor(() => expect(m.setupBays).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /New bay/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: "Ramp 1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.setupCreateBay).toHaveBeenCalled());
    expect(m.setupCreateBay.mock.calls[0][0].name).toBe("Ramp 1");
  });
});

describe("reports", () => {
  it("reads the workshop's own numbers and draws the revenue and technician panels", async () => {
    render(<GarageReports />);
    expect(await screen.findByText("Reports")).toBeInTheDocument();
    await waitFor(() => expect(m.jcAnalysis).toHaveBeenCalled());
    expect(screen.getByText("Revenue by stream")).toBeInTheDocument();
    expect(screen.getByText("Hours taken, by technician")).toBeInTheDocument();
    expect(screen.getByText("The shop's own figures")).toBeInTheDocument();
    expect(screen.getAllByText("Raj").length).toBeGreaterThan(0);
  });
});
