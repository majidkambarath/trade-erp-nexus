import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const render_ = (ui, initialEntries) => render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);

const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

const m = vi.hoisted(() => ({
  board: vi.fn(), jcList: vi.fn(), jcGet: vi.fn(), jcCreate: vi.fn(), jcStaff: vi.fn(), jcAssignees: vi.fn(), jcRecordApproval: vi.fn(), jcActivity: vi.fn(),
  vList: vi.fn(), vCreate: vi.fn(), vFind: vi.fn(), vUpdate: vi.fn(), vGet: vi.fn(), vJobs: vi.fn(), vCatalogue: vi.fn(), vActivity: vi.fn(),
  customers: vi.fn(), vendors: vi.fn(), apiGet: vi.fn(), createCustomer: vi.fn(),
  clList: vi.fn(), clGet: vi.fn(), clCreate: vi.fn(), clSubmit: vi.fn(), clSurvey: vi.fn(), clDecide: vi.fn(), clRaise: vi.fn(), clAgeing: vi.fn(), clActivity: vi.fn(),
  jcAnalysis: vi.fn(), jcCheckIn: vi.fn(), jcComebacks: vi.fn(), jcShortages: vi.fn(), jcRaisePO: vi.fn(), jcInspection: vi.fn(), jcSendEstimate: vi.fn(),
  sendSettings: vi.fn(), documentSend: vi.fn(),
  setupBays: vi.fn(), setupServices: vi.fn(), setupCreateBay: vi.fn(),
}));

vi.mock("../../../lib/garageApi", () => ({
  jobCards: {
    board: m.board, list: m.jcList, get: m.jcGet, create: m.jcCreate, update: vi.fn(), remove: vi.fn(),
    staff: m.jcStaff, assignees: m.jcAssignees, startTask: vi.fn(), completeTask: vi.fn(), sendEstimate: m.jcSendEstimate,
    recordApproval: m.jcRecordApproval, reviseEstimate: vi.fn(), createInvoice: vi.fn(), release: vi.fn(), cancel: vi.fn(),
    analysis: m.jcAnalysis, committed: vi.fn(), recordCheckIn: m.jcCheckIn, recordInspection: m.jcInspection, comebackCandidates: m.jcComebacks,
    shortages: m.jcShortages, raisePurchaseOrder: m.jcRaisePO, activity: m.jcActivity,
  },
  vehicles: { list: m.vList, find: m.vFind, get: m.vGet, activity: m.vActivity, jobs: m.vJobs, catalogue: m.vCatalogue, create: m.vCreate, update: m.vUpdate },
  partyChoices: { customers: m.customers, vendors: m.vendors, createCustomer: m.createCustomer },
  claims: {
    ageing: m.clAgeing, list: m.clList, get: m.clGet, create: m.clCreate, update: vi.fn(), remove: vi.fn(),
    submit: m.clSubmit, recordSurvey: m.clSurvey, recordApproval: m.clDecide, raiseInvoices: m.clRaise, activity: m.clActivity,
  },
  setup: {
    bays: m.setupBays, createBay: m.setupCreateBay, updateBay: vi.fn(),
    services: m.setupServices, createService: vi.fn(), updateService: vi.fn(), plan: vi.fn(),
  },
  filesFor: () => ({ list: () => Promise.resolve([]), upload: vi.fn(), remove: vi.fn(), download: vi.fn() }),
}));
vi.mock("../../../lib/accountingApi", () => ({ api: { get: m.apiGet } }));
// SendDialog's own dependencies, for the one test that opens it from "Send estimate" - its own internals
// (channel choice, attachment handling) are SendDialog.test.jsx's job, not this file's.
vi.mock("../../../lib/sendDocumentsApi", () => ({
  sendSettings: { get: m.sendSettings },
  documentSends: { send: m.documentSend, handoff: vi.fn() },
}));
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
    { name: "Waiting for approval", order: 0, cards: [{ jobCardId: "j1", jobNo: "JC-2026-0001", status: "AWAITING_APPROVAL", plate: "11111", plateCode: "A", plateEmirate: "Dubai", vehicle: "Toyota Hilux", customer: "Ali Hassan", taskName: null, taskStatus: null, due: "2026-10-20", dueState: "overdue" }] },
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
  m.jcShortages.mockResolvedValue([]);
  m.jcActivity.mockResolvedValue({ rows: [{ _id: "a1", action: "TRANSACTION_CREATED", summary: "Job card opened", username: "Imran Qureshi", at: "2026-10-28T06:00:00.000Z" }], total: 1 });
  m.vActivity.mockResolvedValue({ rows: [{ _id: "a2", action: "VEHICLE_CREATED", summary: "Vehicle added", username: "Imran Qureshi", at: "2026-10-01T06:00:00.000Z" }], total: 1 });
  m.clActivity.mockResolvedValue({ rows: [{ _id: "a3", action: "CLAIM_CREATED", summary: "Claim opened", username: "Imran Qureshi", at: "2026-10-20T06:00:00.000Z" }], total: 1 });
  m.setupBays.mockResolvedValue([]);
  m.sendSettings.mockResolvedValue({ enabled: true, shareEnabled: true, attachPdf: false, shareLinkDays: 30, defaultNote: "" });
  m.setupServices.mockResolvedValue([]);
  m.setupCreateBay.mockResolvedValue({ _id: "b1", name: "Ramp 1", active: true });
  m.customers.mockResolvedValue([{ id: "cu1", name: "Ali Hassan", code: "C1" }, { id: "ins1", name: "Orient Insurance", code: "INS1", isInsurer: true }]);
  m.vendors.mockResolvedValue([{ id: "ve1", name: "Shine Painters", code: "V1" }]);
  m.clList.mockResolvedValue([claimRow()]);
  m.clAgeing.mockResolvedValue({
    buckets: {
      "0-7": { count: 0, total: 0, rows: [] },
      "8-14": { count: 1, total: 6400, rows: [{ claimId: "cl1", claimNo: "CLM-2026-0001", insurer: "Orient Insurance", status: "SURVEYED", jobCardId: "j1", jobNo: "JC-2026-0001", days: 10, amount: 6400 }] },
      "15-30": { count: 0, total: 0, rows: [] },
      "30+": { count: 0, total: 0, rows: [] },
    },
    total: 6400, count: 1,
  });
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
    jobRows: [
      { jobCardId: "j2", jobNo: "JC-2026-0002", plate: "B 22222", vehicle: "Nissan Patrol", customer: "Sara", deliveredAt: "2026-10-23T08:00:00.000Z", total: 100, hoursSold: 1, hoursTaken: 2, onTime: false, comeback: true },
      { jobCardId: "j1", jobNo: "JC-2026-0001", plate: "A 11111", vehicle: "Toyota Hilux", customer: "Ali Hassan", deliveredAt: "2026-10-21T08:00:00.000Z", total: 700, hoursSold: 3, hoursTaken: 2, onTime: true, comeback: false },
    ],
  });
  m.apiGet.mockResolvedValue({ stocks: [
    { _id: "p1", itemId: "PART-BRAKE", itemName: "Brake pads", itemType: "goods", salesPrice: 150 },
    { _id: "s1", itemId: "LAB-BRAKE", itemName: "Labour - brake job", itemType: "service", salesPrice: 200 },
  ] });
});

describe("the garage board", () => {
  it("shows the counts, the workshop's health ring, where every job is, and my own work", async () => {
    render_(<GarageBoard />);
    const tiles = await screen.findByRole("list", { name: "Where the work stands" });
    expect(within(tiles).getByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.getByText("The workshop's health")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Waiting for approval" })).toBeInTheDocument();
    expect(screen.getByText("My work")).toBeInTheDocument();
    expect(screen.getAllByText("JC-2026-0002").length).toBeGreaterThan(0);
  });

  it("a job card on the board links to its own page, not a dialog", async () => {
    render_(<GarageBoard />);
    await screen.findByRole("list", { name: "Where the work stands" });
    const link = screen.getByRole("link", { name: /JC-2026-0001: Toyota Hilux/ });
    expect(link).toHaveAttribute("href", "/garage/job-cards?open=j1");
  });

  it("shows the full plate on a card - emirate, code and number - not just the bare number (G7)", async () => {
    render_(<GarageBoard />);
    await screen.findByRole("list", { name: "Where the work stands" });
    // j1 carries plateCode/plateEmirate; j2 (in "My work" too) carries neither and still reads its plain
    // plate - an older job card's snapshot has none of the two new fields and must not break.
    expect(screen.getByText("Dubai · A · 11111")).toBeInTheDocument();
    expect(screen.getAllByText("B 22222").length).toBeGreaterThan(0);
  });
});

describe("job cards list", () => {
  it("lists job cards and opens the New job card form", async () => {
    render_(<JobCardsPage />);
    expect(await screen.findByText("JC-2026-0001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New job card/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("New job card")).toBeInTheDocument();
    // the vehicle and customer pickers both loaded without crashing
    await waitFor(() => expect(m.vList).toHaveBeenCalled());
    await waitFor(() => expect(m.customers).toHaveBeenCalled());
  });

  it("shows a row's age in the workshop, and the status, job type, age and period filters all reach the server", async () => {
    m.jcList.mockResolvedValue([jobCardRow({ jobType: "insurance", ageBand: "b10_14" })]);
    render_(<JobCardsPage />);
    expect(await screen.findByText("JC-2026-0001")).toBeInTheDocument();
    // the register wears the same band the board does (scoped to the table: "10-14 days" is also an option
    // in the "Age in workshop" filter below)
    expect(within(screen.getByRole("table", { name: "Job cards" })).getByText("10-14 days")).toBeInTheDocument();

    // every call so far asked for this calendar month by default (usePeriodFilter's own default)
    expect(m.jcList).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "IN_PROGRESS" } });
    await waitFor(() => expect(m.jcList).toHaveBeenLastCalledWith(expect.objectContaining({ status: "IN_PROGRESS" })));

    fireEvent.change(screen.getByRole("combobox", { name: "Job type" }), { target: { value: "insurance" } });
    await waitFor(() => expect(m.jcList).toHaveBeenLastCalledWith(expect.objectContaining({ jobType: "insurance" })));

    fireEvent.change(screen.getByRole("combobox", { name: "Age in workshop" }), { target: { value: "b10_14" } });
    await waitFor(() => expect(m.jcList).toHaveBeenLastCalledWith(expect.objectContaining({ ageBand: "b10_14" })));

    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "all" } });
    await waitFor(() => expect(m.jcList).toHaveBeenLastCalledWith(expect.objectContaining({ from: undefined, to: undefined })));

    fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue(""));
    expect(screen.getByRole("combobox", { name: "Job type" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Age in workshop" })).toHaveValue("");
    // clearing filters leaves the period alone - it has its own "Widen to" affordance, not Clear filters
    expect(screen.getByRole("combobox", { name: "Period" })).toHaveValue("all");
  });

  it("choosing a part or labour item fills in its price from the item master", async () => {
    render_(<JobCardsPage />);
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
    render_(<JobCardsPage />);
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

  // A job card opens as its OWN PAGE now (?open=<id> on /garage/job-cards), not a dialog - the same
  // deep-link shape every other document screen uses (useRecordRoute). This is the one test that would
  // have caught the Plus/X import bug too, had it existed before that fix: it renders real content, not
  // a button's mere presence.
  it("opens a job card from a deep link and shows its complaints, lines and tasks on the right tabs", async () => {
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    expect(screen.getByRole("button", { name: "Job cards" })).toBeInTheDocument(); // the back link, not a close X
    // AWAITING_APPROVAL's default tab is "The estimate" - the line is there without a tab click.
    expect(screen.getByText("Brake pads")).toBeInTheDocument();
    // "The job" tab is not the default here, so its content (the complaint) is not yet shown...
    expect(screen.queryByText("Brakes squeaking")).not.toBeInTheDocument();
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "The job" }));
    await waitFor(() => expect(screen.getByText("Brakes squeaking")).toBeInTheDocument());
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /The work/ }));
    await waitFor(() => expect(screen.getByText(/Replace brake pads/)).toBeInTheDocument());
    // recordApproval is true and it is the one undecided thing on an AWAITING_APPROVAL card: the primary.
    expect(screen.getByRole("button", { name: "Record decision" })).toBeInTheDocument();
  });

  it("opens the job card's own audit trail, beside Print, not behind a status-driven action (G10)", async () => {
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    fireEvent.click(screen.getByRole("button", { name: /Audit trail/ }));
    await waitFor(() => expect(m.jcActivity).toHaveBeenCalledWith("j1"));
    const dialog = await screen.findByRole("dialog", { name: /Audit trail/ });
    expect(within(dialog).getByText("Job card opened")).toBeInTheDocument();
  });

  it("an insurance job with no claim yet offers to open one, with the insurer picker narrowed to insurers", async () => {
    m.jcGet.mockResolvedValue(jobCardFull({ jobType: "insurance", claimId: null }));
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Money" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open insurance claim" }));
    const claimDialog = await screen.findByRole("dialog", { name: /Open an insurance claim/ });
    expect(claimDialog).toBeTruthy();
    await waitFor(() => expect(m.customers).toHaveBeenCalled());
  });

  it("an insurance job that already has a claim offers to view it instead", async () => {
    m.jcGet.mockResolvedValue(jobCardFull({ jobType: "insurance", claimId: "cl1" }));
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Money" }));
    fireEvent.click(await screen.findByRole("button", { name: "View claim" }));
    await waitFor(() => expect(m.clGet).toHaveBeenCalledWith("cl1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Orient Insurance/)).toBeInTheDocument();
  });

  // Check-in is not the primary action on an AWAITING_APPROVAL card (Record decision is) - it is behind
  // "More actions", which opens the same way every other row menu in the app does (RowMenu.test.jsx).
  it("records the walk-around: items present, a damage point, and condition notes", async () => {
    m.jcCheckIn.mockResolvedValue(jobCardFull({ checkIn: { itemsPresent: ["Spare wheel"], damagePoints: [{ panel: "Front bumper", kind: "scratch", notes: "" }], notes: "" } }));
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "More actions" }).parentElement);
    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    const checkInDialog = await screen.findByRole("dialog", { name: /walk-around|check-in/i });

    fireEvent.click(within(checkInDialog).getByLabelText("Spare wheel"));
    fireEvent.click(within(checkInDialog).getByRole("button", { name: /Add a mark/ }));
    fireEvent.change(within(checkInDialog).getByLabelText("Panel"), { target: { value: "Front bumper" } });
    fireEvent.click(within(checkInDialog).getByRole("button", { name: "Save check-in" }));

    await waitFor(() => expect(m.jcCheckIn).toHaveBeenCalledWith("j1", expect.objectContaining({ itemsPresent: ["Spare wheel"] })));
    const body = m.jcCheckIn.mock.calls[0][1];
    expect(body.damagePoints).toEqual([{ panel: "Front bumper", kind: "scratch", notes: "" }]);
  });

  // The technician's own findings, with photos - what the customer actually sees on the estimate link
  // (components/send/EstimateApproval.jsx on the backend's snapshot). Shown on "The work" tab, ahead of
  // the tasks it justifies.
  it("shows what was found, and records a new finding with its condition", async () => {
    m.jcGet.mockResolvedValue(jobCardFull({ inspection: [{ _id: "insp1", item: "Front brake pads", condition: "urgent", note: "2mm left", photos: ["a1"] }] }));
    m.jcInspection.mockResolvedValue(jobCardFull({ inspection: [{ _id: "insp1", item: "Front brake pads", condition: "urgent", note: "2mm left", photos: ["a1"] }, { _id: "insp2", item: "Battery", condition: "advisory", note: "", photos: [] }] }));
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /The work/ }));
    await waitFor(() => expect(screen.getByText("Front brake pads")).toBeInTheDocument());
    expect(screen.getByText("Needs doing now")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit findings" }));
    const dialog = await screen.findByRole("dialog", { name: /What was found/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add another item/ }));
    const items = within(dialog).getAllByLabelText("Item");
    fireEvent.change(items[1], { target: { value: "Battery" } });
    const conditions = within(dialog).getAllByLabelText("Condition");
    fireEvent.change(conditions[1], { target: { value: "advisory" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save inspection" }));

    await waitFor(() => expect(m.jcInspection).toHaveBeenCalled());
    const [cardId, body] = m.jcInspection.mock.calls[0];
    expect(cardId).toBe("j1");
    expect(body.inspection).toEqual([
      { item: "Front brake pads", condition: "urgent", note: "2mm left", photos: ["a1"] },
      { item: "Battery", condition: "advisory", note: "", photos: [] },
    ]);
  });

  // The whole point of Wave 1: "Send estimate" no longer only flips a status - it opens the real send
  // dialog so the link actually leaves the building.
  it("sending the estimate flips the status AND opens the real send dialog, with no price in the descriptor", async () => {
    // Once sent, the card is AWAITING_APPROVAL - the reload after the confirm must reflect that, or the
    // descriptor guard (["AWAITING_APPROVAL","IN_PROGRESS"].includes(c.status)) would hide the dialog.
    m.jcGet
      .mockResolvedValueOnce(jobCardFull({
        status: "DRAFT", jobNo: "JC-2026-0009", customer: { name: "Ali Hassan", phone: "050 111 2222" },
        actions: { edit: true, delete: true, checkIn: true, sendEstimate: true, recordApproval: false, reviseEstimate: false, createInvoice: false, release: false, cancel: true },
      }))
      .mockResolvedValue(jobCardFull({
        status: "AWAITING_APPROVAL", jobNo: "JC-2026-0009", customer: { name: "Ali Hassan", phone: "050 111 2222" },
        actions: { edit: false, delete: false, checkIn: true, sendEstimate: false, recordApproval: true, reviseEstimate: true, createInvoice: false, release: false, cancel: true },
      }));
    m.jcSendEstimate.mockResolvedValue(jobCardFull({ status: "AWAITING_APPROVAL", jobNo: "JC-2026-0009" }));
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    fireEvent.click(screen.getByRole("button", { name: "Send estimate" }));
    const confirmDialog = await screen.findByRole("dialog", { name: /Send the estimate\?/ });
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(m.jcSendEstimate).toHaveBeenCalledWith("j1"));

    // The real send dialog opens automatically - no pre-filled email (the job card's own snapshot never
    // carries one, by design), so the advisor types it.
    const sendDialog = await screen.findByRole("dialog", { name: /send/i });
    // Settled once the channel tabs are there - sendSettings.get() is still loading right after open.
    expect(await within(sendDialog).findByRole("button", { name: /email/i })).toBeInTheDocument();
    expect(within(sendDialog).getByRole("button", { name: /whatsapp/i })).toBeInTheDocument();
    fireEvent.change(within(sendDialog).getByLabelText("To"), { target: { value: "ali@alnoor.ae" } });
    fireEvent.click(within(sendDialog).getByRole("button", { name: /send email/i }));

    await waitFor(() => expect(m.documentSend).toHaveBeenCalled());
    const [fields] = m.documentSend.mock.calls[0];
    expect(fields.docType).toBe("job_estimate");
    expect(fields.sourceId).toBe("j1");
    expect(JSON.stringify(fields)).not.toMatch(/price|lineTotal|vat/i);
  });

  it("shows a short part on the work tab and raises a purchase order for it", async () => {
    m.jcShortages.mockResolvedValue([{ itemId: "i1", itemCode: "PART-DISC", itemName: "Brake disc", needed: 2, onHand: 0, short: 2, vendorId: "ve1", vendorName: "Shine Painters", purchasePrice: 150 }]);
    m.jcRaisePO.mockResolvedValue({ jobCard: jobCardFull(), order: { _id: "po1", orderNo: "PORD-2026-0001" } });
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    await waitFor(() => expect(m.jcShortages).toHaveBeenCalledWith("j1"));
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /The work/ }));
    await waitFor(() => expect(screen.getByText(/Brake disc/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Raise purchase order" }));
    const poDialog = await screen.findByRole("dialog", { name: /Raise a purchase order/ });
    fireEvent.click(within(poDialog).getByRole("button", { name: "Raise purchase order" }));

    await waitFor(() => expect(m.jcRaisePO).toHaveBeenCalled());
    const [cardId, body] = m.jcRaisePO.mock.calls[0];
    expect(cardId).toBe("j1");
    expect(body.vendorId).toBe("ve1");
    expect(body.items).toEqual([{ itemId: "i1", qty: 2, price: 150 }]);
  });

  it("opens the Record decision dialog and records an approval", async () => {
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
    const approveDialog = await screen.findByRole("dialog", { name: /Record the decision/ });
    expect(within(approveDialog).getByText(/Brake pads/)).toBeInTheDocument();
    fireEvent.click(within(approveDialog).getByRole("button", { name: "Record approval" }));
    await waitFor(() => expect(m.jcRecordApproval).toHaveBeenCalledWith("j1", expect.objectContaining({ method: "whatsapp" })));
  });

  // Supplementary estimate is not the primary action here either (Record decision is) - same "open the
  // overflow menu first" shape as the check-in test above.
  it("opens the Supplementary estimate dialog, where a line can be added and removed", async () => {
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "More actions" }).parentElement);
    fireEvent.click(screen.getByRole("button", { name: "Supplementary estimate" }));
    const reviseDialog = await screen.findByRole("dialog", { name: /supplementary estimate/i });
    // The row's Remove button (an X icon) and "Add line" (a Plus icon) both come from jobCardDialogs.jsx,
    // which lint alone did not prove imported the icons it uses - only a real render does.
    fireEvent.click(within(reviseDialog).getByRole("button", { name: "Add line" }));
    expect(within(reviseDialog).getAllByRole("button", { name: "Remove" })).toHaveLength(2);
    fireEvent.click(within(reviseDialog).getAllByRole("button", { name: "Remove" })[1]);
    expect(within(reviseDialog).getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("opens the Raise invoice dialog for an approved, unbilled line", async () => {
    m.jcGet.mockResolvedValue(jobCardFull({
      status: "IN_PROGRESS",
      actions: { edit: false, delete: false, checkIn: true, sendEstimate: false, recordApproval: false, reviseEstimate: false, createInvoice: true, release: false, cancel: true },
    }));
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    // The one task on the fixture is READY, not settled, so createInvoice is offered but is not the
    // primary (jobPrimaryAction only leads with it once every task is DONE/SKIPPED) - it is in the menu.
    fireEvent.mouseEnter(screen.getByRole("button", { name: "More actions" }).parentElement);
    fireEvent.click(screen.getByRole("button", { name: "Raise invoice" }));
    const invoiceDialog = await screen.findByRole("dialog", { name: /invoice/i });
    expect(within(invoiceDialog).getByText(/Brake pads/)).toBeInTheDocument();
  });

  it("opens the Release vehicle dialog", async () => {
    m.jcGet.mockResolvedValue(jobCardFull({
      status: "READY",
      actions: { edit: false, delete: false, checkIn: true, sendEstimate: false, recordApproval: false, reviseEstimate: false, createInvoice: false, release: true, cancel: true },
    }));
    render_(<JobCardsPage />, ["/garage/job-cards?open=j1"]);
    await waitFor(() => expect(m.jcGet).toHaveBeenCalledWith("j1"));
    // createInvoice is false here, so release IS the primary - directly on screen, no menu to open.
    fireEvent.click(screen.getByRole("button", { name: "Release vehicle" }));
    const releaseDialog = await screen.findByRole("dialog", { name: /release/i });
    expect(within(releaseDialog).getByRole("button", { name: /release/i })).toBeInTheDocument();
  });
});
describe("claims list", () => {
  it("lists claims and opens one, offering the action its own status allows", async () => {
    render_(<ClaimsPage />);
    expect(await screen.findByText("CLM-2026-0001")).toBeInTheDocument();
    fireEvent.click(screen.getByText("CLM-2026-0001"));
    await waitFor(() => expect(m.clGet).toHaveBeenCalledWith("cl1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Ahmed Saeed/)).toBeInTheDocument();
    // actions.recordApproval is true on the fixture
    expect(within(dialog).getByRole("button", { name: "Record decision" })).toBeInTheDocument();
  });

  it("the Claims tab carries its own period, by submittedAt - widening it asks the server again with no date range", async () => {
    render_(<ClaimsPage />);
    expect(await screen.findByText("CLM-2026-0001")).toBeInTheDocument();
    expect(m.clList).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));

    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "all" } });
    await waitFor(() => expect(m.clList).toHaveBeenLastCalledWith(expect.objectContaining({ from: undefined, to: undefined })));

    // the Ageing tab has no period of its own - it is "open right now", not a dated range - so switching
    // tabs must not disturb it
    fireEvent.click(screen.getByRole("tab", { name: "Ageing" }));
    expect(await screen.findByText("8-14 days")).toBeInTheDocument();
    expect(m.clAgeing).toHaveBeenCalled();
  });

  it("the Ageing tab buckets open claims by how long they have waited, and a row opens the same claim view", async () => {
    render_(<ClaimsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Ageing" }));
    expect(await screen.findByText("8-14 days")).toBeInTheDocument();
    expect(screen.getByText(/1 open claim/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("CLM-2026-0001"));
    await waitFor(() => expect(m.clGet).toHaveBeenCalledWith("cl1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Ahmed Saeed/)).toBeInTheDocument();
  });

  it("opens the claim's own audit trail (G10)", async () => {
    render_(<ClaimsPage />);
    fireEvent.click(await screen.findByText("CLM-2026-0001"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Audit trail/ }));
    await waitFor(() => expect(m.clActivity).toHaveBeenCalledWith("cl1"));
    const trail = await screen.findByRole("dialog", { name: /Audit trail/ });
    expect(within(trail).getByText("Claim opened")).toBeInTheDocument();
  });
});

describe("vehicles list", () => {
  it("lists vehicles and opens the New vehicle form", async () => {
    render_(<VehiclesPage />);
    expect(await screen.findByText("A 11111")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New vehicle/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("New vehicle")).toBeInTheDocument();
  });

  it("typing a registration expiry date actually reaches the form (not an onChange event object)", async () => {
    m.vUpdate.mockResolvedValue({ _id: "v1", plateNumber: "A 11111" });
    render_(<VehiclesPage />);
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

  it("shows the full plate - emirate, code and number - on the list and the vehicle's own page (G7)", async () => {
    m.vList.mockResolvedValue([{ _id: "v1", plateNumber: "12345", plateCode: "A", plateEmirate: "Dubai", make: "Toyota", model: "Hilux", year: 2019, colour: "White", chassisNo: "", odometer: 85000, status: "active" }]);
    m.vGet.mockResolvedValue({ _id: "v1", plateNumber: "12345", plateCode: "A", plateEmirate: "Dubai", make: "Toyota", model: "Hilux", year: 2019, colour: "White", chassisNo: "", odometer: 85000, status: "active", serviceDue: {} });
    render_(<VehiclesPage />);
    expect(await screen.findByText("Dubai · A · 12345")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Dubai · A · 12345"));
    expect(await screen.findByRole("dialog", { name: "Dubai · A · 12345" })).toBeInTheDocument();
  });

  it("opening a vehicle shows its job history - the reason a workshop buys this", async () => {
    m.vJobs.mockResolvedValue([
      { _id: "j1", jobNo: "JC-2026-0001", status: "CLOSED", estimate: { total: 350 }, receivedAt: "2026-09-01T08:00:00.000Z" },
      { _id: "j2", jobNo: "JC-2026-0002", status: "IN_PROGRESS", estimate: { total: 120 }, receivedAt: "2026-10-20T08:00:00.000Z", comebackOf: "j1" },
    ]);
    render_(<VehiclesPage />);
    fireEvent.click(await screen.findByText("A 11111"));
    const view = await screen.findByRole("dialog");
    await waitFor(() => expect(m.vJobs).toHaveBeenCalledWith("v1"));
    expect(within(view).getByText("JC-2026-0001")).toBeInTheDocument();
    expect(within(view).getByText("JC-2026-0002")).toBeInTheDocument();
    expect(within(view).getByText("Comeback")).toBeInTheDocument();
  });

  it("opens the vehicle's own audit trail - who changed the record, not the jobs it has had (G10)", async () => {
    render_(<VehiclesPage />);
    fireEvent.click(await screen.findByText("A 11111"));
    const view = await screen.findByRole("dialog");
    fireEvent.click(within(view).getByRole("button", { name: /Audit trail/ }));
    await waitFor(() => expect(m.vActivity).toHaveBeenCalledWith("v1"));
    const trail = await screen.findByRole("dialog", { name: /Audit trail/ });
    expect(within(trail).getByText("Vehicle added")).toBeInTheDocument();
  });
});

describe("garage setup", () => {
  it("adds a bay to the list", async () => {
    render_(<GarageSetupPage />);
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
    render_(<GarageReports />);
    expect(await screen.findByText("Reports")).toBeInTheDocument();
    await waitFor(() => expect(m.jcAnalysis).toHaveBeenCalled());
    expect(screen.getByText("Revenue by stream")).toBeInTheDocument();
    expect(screen.getByText("Hours taken, by technician")).toBeInTheDocument();
    expect(screen.getByText("The shop's own figures")).toBeInTheDocument();
    expect(screen.getAllByText("Raj").length).toBeGreaterThan(0);
  });

  it("the per-job breakdown lists each delivered job, newest first, and links to it (G6)", async () => {
    render_(<GarageReports />);
    await waitFor(() => expect(m.jcAnalysis).toHaveBeenCalled());
    const panel = await screen.findByText("Jobs delivered this period");
    const rows = screen.getAllByRole("link", { name: /JC-2026-000/ });
    expect(rows).toHaveLength(2);
    // newest delivery first (J2, 23 Oct, before J1, 21 Oct) - the order jobRows is already sorted in.
    expect(within(rows[0]).getByText("JC-2026-0002")).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute("href", "/garage/job-cards?open=j2");
    expect(within(rows[0]).getByText("Late")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Comeback")).toBeInTheDocument();
    expect(within(rows[1]).getByText("JC-2026-0001")).toBeInTheDocument();
    expect(within(rows[1]).queryByText("Late")).not.toBeInTheDocument(); // onTime: true
    expect(panel).toBeInTheDocument();
  });
});
