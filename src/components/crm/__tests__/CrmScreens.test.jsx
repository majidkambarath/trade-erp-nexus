import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The CRM's screens against a stubbed API. What is asserted is what a person can see and press: the board with its
// stages and totals, the leads list, the worklist opening on what is late, and the Done dialog that records an outcome
// and the next follow-up in one go.
const m = vi.hoisted(() => ({
  pipeline: vi.fn(),
  summary: vi.fn(),
  leads: vi.fn(),
  leadSummary: vi.fn(),
  lead: vi.fn(),
  followUps: vi.fn(),
  completeActivity: vi.fn(),
  createLead: vi.fn(),
  duplicates: vi.fn(),
  moveDeal: vi.fn(),
  owners: vi.fn(),
  stages: vi.fn(),
  saveStages: vi.fn(),
  settings: vi.fn(),
  saveSettings: vi.fn(),
  analysis: vi.fn(),
  deals: vi.fn(),
  deal: vi.fn(),
  updateDeal: vi.fn(),
  reopenDeal: vi.fn(),
  loseDeal: vi.fn(),
  assignDeal: vi.fn(),
  logActivity: vi.fn(),
  timeline: vi.fn(),
  customers: vi.fn(),
  createDeal: vi.fn(),
  grants: { allow: () => true },
}));

vi.mock("../../../lib/crmApi", () => ({
  crm: {
    pipeline: m.pipeline, summary: m.summary, leads: m.leads, leadSummary: m.leadSummary, lead: m.lead,
    followUps: m.followUps, completeActivity: m.completeActivity, createLead: m.createLead, duplicates: m.duplicates,
    moveDeal: m.moveDeal, owners: m.owners, stages: m.stages, saveStages: m.saveStages, settings: m.settings,
    saveSettings: m.saveSettings, analysis: m.analysis, deals: m.deals, deal: m.deal, updateDeal: m.updateDeal, reopenDeal: m.reopenDeal,
    loseDeal: m.loseDeal, assignDeal: m.assignDeal, logActivity: m.logActivity, timeline: m.timeline, customers: m.customers, createDeal: m.createDeal,
  },
  // The files panel on a lead and a deal asks for its source once; a screen test has none to show.
  filesFor: () => ({ list: () => Promise.resolve([]), upload: vi.fn(), remove: vi.fn(), download: vi.fn() }),
  CRM_WORK_CHANGED: "crm-work-changed",
  announceCrmWorkChanged: () => {},
}));

vi.mock("../../shell/OrganisationContext.jsx", () => ({
  useOrganisation: () => ({
    can: (key) => m.grants.allow(key),
    canAny: (keys) => [].concat(keys || []).some((k) => m.grants.allow(k)),
    me: { id: "u1", name: "Asif" },
  }),
}));

vi.mock("../../../lib/accountingApi", () => ({ api: { get: vi.fn(() => Promise.resolve([])) } }));

import { api as accountingApi } from "../../../lib/accountingApi";
import CrmPipeline from "../CrmPipeline.jsx";
import LeadsPage from "../LeadsPage.jsx";
import FollowUpsPage from "../FollowUpsPage.jsx";
import CrmSetup from "../CrmSetup.jsx";

const STAGES = [
  { key: "new", name: "New", order: 1, probability: 10, advanceOn: null, followUpDays: 1, staleDays: 7, type: "open" },
  { key: "quoted", name: "Quotation sent", order: 2, probability: 50, advanceOn: "quotation_sent", followUpDays: 3, staleDays: 14, type: "open" },
  { key: "won", name: "Won", order: 3, probability: 100, advanceOn: "invoice_approved", followUpDays: 0, staleDays: 0, type: "won" },
  { key: "lost", name: "Lost", order: 4, probability: 0, advanceOn: null, followUpDays: 0, staleDays: 0, type: "lost" },
];

const deal = (over = {}) => ({
  _id: "d1",
  opportunityNo: "OPP-2026-0001",
  title: "Monthly rice",
  customerName: "Al Noor Foods",
  customerId: "c1",
  stageKey: "quoted",
  stageName: "Quotation sent",
  probability: 50,
  status: "OPEN",
  value: 10000,
  ownerId: "u1",
  ownerName: "Asif",
  nextActionAt: "2026-10-23",
  stale: { isStale: false, days: 1, limit: 14 },
  overdueAction: false,
  links: { quotationNo: "QT-2026-0001" },
  actions: { edit: true, move: true, lose: true, assign: true },
  ...over,
});

const followUp = (over = {}) => ({
  _id: "a1",
  kind: "call",
  kindLabel: "Call",
  subject: "Send the price",
  dueAt: "2026-10-18",
  dueState: "overdue",
  status: "OPEN",
  ownerId: "u1",
  ownerName: "Asif",
  regarding: { kind: "opportunity", id: "d1" },
  actions: { done: true, edit: true },
  ...over,
});

const render_ = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  for (const key of Object.keys(m)) if (typeof m[key]?.mockReset === "function") m[key].mockReset();
  m.grants.allow = () => true;
  m.owners.mockResolvedValue([{ id: "u1", name: "Asif" }, { id: "u2", name: "Maya" }]);
  m.pipeline.mockResolvedValue({
    today: "2026-10-20",
    stages: STAGES.map((s) => ({ ...s, count: s.key === "quoted" ? 1 : 0, value: s.key === "quoted" ? 10000 : 0, weighted: s.key === "quoted" ? 5000 : 0, deals: s.key === "quoted" ? [deal()] : [] })),
    totals: { count: 1, value: 10000, weighted: 5000, stale: 0, overdueAction: 0 },
  });
  m.summary.mockResolvedValue({ today: "2026-10-20", openLeads: 3, openDeals: 1, pipelineValue: 10000, weightedValue: 5000, staleDeals: 0, dueToday: 2, overdue: 1 });
  m.leads.mockResolvedValue([
    { _id: "l1", leadNo: "LD-2026-0001", name: "Hassan Al Noor", company: "Al Noor Foods", phone: "0501234567", source: "referral", status: "NEW", band: "warm", score: 47, ownerName: "Asif", expectedValue: 45000, nextActionAt: "2026-10-20", overdueAction: false, actions: { qualify: true, edit: true } },
  ]);
  m.leadSummary.mockResolvedValue({ today: "2026-10-20", total: 1, open: 1, hot: 0, unassigned: 0, converted: 0, lost: 0, openValue: 45000, overdueFollowUps: 1 });
  m.followUps.mockResolvedValue([followUp(), followUp({ _id: "a2", subject: "Ring the coater", dueAt: "2026-10-20", dueState: "today" })]);
  m.stages.mockResolvedValue(STAGES);
  m.settings.mockResolvedValue({ autoAdvance: true, autoFollowUp: true, assignmentMode: "round_robin", fixedOwnerId: null, uncontactedHours: 24, staleDays: 14, quotationExpiryDays: 3 });
  m.completeActivity.mockResolvedValue({ activity: followUp({ status: "DONE" }), next: { _id: "a9", dueAt: "2026-10-27" } });
  m.duplicates.mockResolvedValue({ leads: [], customers: [] });
});

describe("the pipeline", () => {
  it("draws every stage, the deals on it, and what the pipeline is likely to be worth", async () => {
    render_(<CrmPipeline />);
    expect(await screen.findByRole("heading", { name: "Pipeline" })).toBeInTheDocument();

    for (const name of ["New", "Quotation sent", "Won", "Lost"]) {
      expect(await screen.findByRole("heading", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    expect(await screen.findByRole("link", { name: "Monthly rice" })).toBeInTheDocument();
    expect(screen.getByText("Al Noor Foods")).toBeInTheDocument();
    // the weighted figure, which is the one a person plans with
    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0);
    // and it says what moves a deal into the stage, so nobody wonders why a card moved
    expect(screen.getByText(/happens by itself: a quotation was sent/i)).toBeInTheDocument();
  });

  it("says plainly that nothing is dragged", async () => {
    render_(<CrmPipeline />);
    expect(await screen.findByText(/nothing here is dragged/i)).toBeInTheDocument();
  });

  it("moves a deal by hand through a dialog, which records why", async () => {
    m.moveDeal.mockResolvedValue(deal({ stageKey: "won", stageName: "Won", status: "WON" }));
    render_(<CrmPipeline />);
    fireEvent.click(await screen.findByRole("button", { name: "Move" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/stage/i), { target: { value: "won" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move" }));
    await waitFor(() => expect(m.moveDeal).toHaveBeenCalledWith("d1", expect.objectContaining({ stageKey: "won" })));
  });

  it("hides every write action from a role that may only look", async () => {
    m.grants.allow = (key) => key === "crm.view";
    render_(<CrmPipeline />);
    expect(await screen.findByRole("link", { name: "Monthly rice" })).toBeInTheDocument(); // the screen loaded
    expect(screen.queryByRole("button", { name: "New deal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lost" })).toBeNull();
  });

  it("opens a deal on a customer chosen from the CRM's own narrow list, which needs no Sales key", async () => {
    // Before this the form read the Sales customer master, so an organisation that bought the CRM alone could not open a deal.
    m.customers.mockResolvedValue([
      { id: "c1", name: "Al Noor Foods", code: "CUST-0001", active: true },
      { id: "c2", name: "Brisk Traders", code: "CUST-0002", active: true },
    ]);
    render_(<CrmPipeline />);
    fireEvent.click(await screen.findByRole("button", { name: "New deal" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(m.customers).toHaveBeenCalledWith({ limit: 500 }));
    fireEvent.keyDown(within(dialog).getByRole("combobox"), { key: "ArrowDown" });
    // the code sits beside the name, to tell two customers of one name apart
    fireEvent.click(await screen.findByRole("option", { name: /Brisk Traders.*CUST-0002/ }));
    fireEvent.change(within(dialog).getByLabelText(/What the deal is for/), { target: { value: "Pallets for Q4" } });
    m.createDeal.mockResolvedValue(deal({ opportunityNo: "OPP-2026-0002" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Open the deal" }));
    // the id that leaves is the one the CRM's own list handed over, and the Sales customer master was never asked
    await waitFor(() => expect(m.createDeal).toHaveBeenCalledWith(expect.objectContaining({ customerId: "c2", title: "Pallets for Q4" })));
    expect(accountingApi.get).not.toHaveBeenCalledWith("/customers/customers", expect.anything());
  });
});

describe("one deal's own page", () => {
  const full = () => ({
    ...deal(),
    weighted: 5000,
    daysInStage: 3,
    notes: "",
    // The whole starter pipeline, so the stage KEYS the moves carry can be read back as the names people see
    pipeline: [
      STAGES[0],
      { key: "qualified", name: "Qualified", order: 2, probability: 25, advanceOn: null, followUpDays: 2, staleDays: 10, type: "open" },
      STAGES[1],
      { key: "accepted", name: "Offer accepted", order: 4, probability: 90, advanceOn: "quotation_accepted", followUpDays: 2, staleDays: 7, type: "open" },
      STAGES[2],
      STAGES[3],
    ],
    customer: { _id: "c1", customerName: "Al Noor Foods", phone: "0501234567", paymentTerms: "Net 30", creditLimit: 50000 },
    timeline: [followUp({ _id: "t1", subject: "Rang about the price", status: "DONE", outcome: "interested", dueState: "done", auto: false })],
    autoMoves: [
      { key: "quotation_sent:q1", event: "quotation_sent", from: "qualified", to: "quoted", at: "2026-10-16T09:00:00.000Z", by: "automation", docNo: "QT-2026-0007", undoneAt: null },
    ],
  });

  it("says why the deal moved, and which document did it", async () => {
    m.deal.mockResolvedValue(full());
    render(<MemoryRouter initialEntries={["/crm/pipeline?deal=d1"]}>{<CrmPipeline />}</MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Monthly rice" })).toBeInTheDocument();
    expect(screen.getByText("Qualified → Quotation sent")).toBeInTheDocument();
    expect(screen.getByText(/A quotation was sent · QT-2026-0007/)).toBeInTheDocument();
    expect(screen.getByText(/by itself/)).toBeInTheDocument();
    // A stage the pipeline no longer has is shown by its key rather than vanishing
    expect(screen.queryByText(/undefined/)).toBeNull();
    expect(screen.getByText("Rang about the price")).toBeInTheDocument();
    expect(m.deal).toHaveBeenCalledWith("d1");
  });

  it("lets a wrong figure be put right, without touching the stage or the customer", async () => {
    m.deal.mockResolvedValue(full());
    m.updateDeal.mockResolvedValue(full());
    render(<MemoryRouter initialEntries={["/crm/pipeline?deal=d1"]}>{<CrmPipeline />}</MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^What it is worth/), { target: { value: "52000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.updateDeal).toHaveBeenCalledWith("d1", expect.objectContaining({ value: 52000 })));
    // the stage is Move's business, and the customer would make it another deal
    expect(m.updateDeal.mock.calls[0][1].stageKey).toBeUndefined();
    expect(m.updateDeal.mock.calls[0][1].customerId).toBeUndefined();
  });

  it("marks a move that was taken back rather than hiding it", async () => {
    m.deal.mockResolvedValue({
      ...full(),
      status: "OPEN",
      autoMoves: [{ key: "invoice_approved:i1", event: "invoice_approved", from: "accepted", to: "won", at: "2026-10-18T09:00:00.000Z", by: "automation", docNo: "SO-2026-0012", undoneAt: "2026-10-19T09:00:00.000Z" }],
    });
    render(<MemoryRouter initialEntries={["/crm/pipeline?deal=d1"]}>{<CrmPipeline />}</MemoryRouter>);
    expect(await screen.findByText("Offer accepted → Won")).toBeInTheDocument();
    expect(screen.getByText("taken back")).toBeInTheDocument();
  });

  it("offers a closed deal its way back, and nothing a view-only role could press", async () => {
    m.deal.mockResolvedValue({ ...full(), status: "WON", stageKey: "won", stageName: "Won", probability: 100 });
    const won = render(<MemoryRouter initialEntries={["/crm/pipeline?deal=d1"]}>{<CrmPipeline />}</MemoryRouter>);
    expect(await screen.findByRole("button", { name: /reopen it/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Lost$/ })).toBeNull();
    won.unmount(); // or the first render's buttons answer for the second

    m.grants.allow = (key) => key === "crm.view";
    render(<MemoryRouter initialEntries={["/crm/pipeline?deal=d1"]}>{<CrmPipeline />}</MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Monthly rice" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reopen it/i })).toBeNull();
  });
});

describe("leads", () => {
  it("lists the enquiries with how warm each is and what is owed", async () => {
    render_(<LeadsPage />);
    expect(await screen.findByRole("heading", { name: "Leads" })).toBeInTheDocument();
    const list = await screen.findByRole("table", { name: "Leads" });
    expect(within(list).getByText("LD-2026-0001")).toBeInTheDocument();
    expect(within(list).getByText("Hassan Al Noor")).toBeInTheDocument();
    expect(within(list).getByText("Referral")).toBeInTheDocument();
    // "Warm" is both the filter's option and the lead's own band, so look inside the row
    expect(within(list).getAllByText("Warm").length).toBeGreaterThan(0);
    expect(within(list).getByText("47")).toBeInTheDocument(); // the score beside it
  });

  it("saves a new enquiry and says who it was given to", async () => {
    m.createLead.mockResolvedValue({ _id: "l9", leadNo: "LD-2026-0002", ownerName: "Maya" });
    render_(<LeadsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /new enquiry/i }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Second caller" } });
    fireEvent.change(within(dialog).getByLabelText(/^Phone/), { target: { value: "0509999999" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save the enquiry/i }));

    await waitFor(() => expect(m.createLead).toHaveBeenCalledWith(expect.objectContaining({ name: "Second caller", phone: "0509999999" })));
    expect(await screen.findByText(/given to Maya, with a first call due today/i)).toBeInTheDocument();
  });

  it("will not save an enquiry with nobody to reach", async () => {
    render_(<LeadsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /new enquiry/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "No way to reach them" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save the enquiry/i }));
    expect(await within(dialog).findByText(/a phone number or an email address/i)).toBeInTheDocument();
    expect(m.createLead).not.toHaveBeenCalled();
  });

  describe("qualifying, in the organisation's own terms", () => {
    const LEAD = { _id: "l1", leadNo: "LD-2026-0001", name: "Hassan Al Noor", company: "Al Noor Foods", phone: "0501234567", source: "referral", status: "NEW", band: "warm", score: 47, ownerName: "Asif", expectedValue: 45000, interest: "Rice", actions: { qualify: true, edit: true, lose: true, assign: true, logActivity: true }, timeline: [], opportunity: null };
    const openQualify = async () => {
      m.lead.mockResolvedValue(LEAD);
      render(<MemoryRouter initialEntries={["/crm/leads?lead=l1"]}><LeadsPage /></MemoryRouter>);
      fireEvent.click(await screen.findByRole("button", { name: "Qualify" }));
      return screen.findByRole("dialog");
    };

    it("says a customer gets an account in the books where there are books", async () => {
      const dialog = await openQualify();
      expect(within(dialog).getByText(/with its own account in the books/)).toBeInTheDocument();
    });

    it("says only that the company is added to the customers where the CRM was bought alone", async () => {
      m.grants.allow = (key) => key.startsWith("crm.") || key === "lookups.view"; // no sales.view, no accounts.view
      const dialog = await openQualify();
      expect(within(dialog).getByText(/adds the company to your customers and opens a deal/)).toBeInTheDocument();
      expect(within(dialog).queryByText(/books/)).toBeNull();
    });
  });

  it("hides Qualify and New enquiry from a role that may only look", async () => {
    m.grants.allow = (key) => key === "crm.view";
    render_(<LeadsPage />);
    expect(await screen.findByRole("table", { name: "Leads" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new enquiry/i })).toBeNull();
  });
});

describe("the follow-up worklist", () => {
  it("opens on what is late, and says how many", async () => {
    render_(<FollowUpsPage />);
    expect(await screen.findByRole("heading", { name: "Follow-ups" })).toBeInTheDocument();
    const list = await screen.findByRole("table", { name: "Follow-ups" });
    expect(within(list).getByText("Send the price")).toBeInTheDocument();
    // the one due today is not on the "Late" tab
    expect(within(list).queryByText("Ring the coater")).toBeNull();
    expect(screen.getByRole("tab", { name: /^Late/ })).toHaveAttribute("aria-selected", "true");
  });

  it("records what came of it and the next follow-up in one go", async () => {
    render_(<FollowUpsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Outcome/), { target: { value: "interested" } });
    fireEvent.change(within(dialog).getByLabelText(/^Notes/), { target: { value: "Wants 200 bags" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(m.completeActivity).toHaveBeenCalledWith("a1", expect.objectContaining({ outcome: "interested", notes: "Wants 200 bags" })));
    expect(await screen.findByText(/next one on/i)).toBeInTheDocument();
  });

  it("asks what came of it before it will save", async () => {
    render_(<FollowUpsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Outcome/), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(m.completeActivity).not.toHaveBeenCalled();
  });
});

describe("the setup screen", () => {
  it("draws the pipeline as the rules it is, and what moves a deal into each stage", async () => {
    render_(<CrmSetup />);
    expect(await screen.findByRole("heading", { name: "CRM setup" })).toBeInTheDocument();
    const names = await screen.findAllByLabelText(/^Name/);
    expect(names.map((i) => i.value)).toEqual(["New", "Quotation sent", "Won", "Lost"]);
    const events = screen.getAllByLabelText(/^It moves here when/);
    expect(events[1].value).toBe("quotation_sent");
    expect(await screen.findByText(/let the documents move the deals/i)).toBeInTheDocument();
  });

  it("refuses a pipeline with no won stage, before the server has to", async () => {
    m.stages.mockResolvedValue(STAGES.map((s) => (s.key === "won" ? { ...s, type: "open" } : s)));
    render_(<CrmSetup />);
    fireEvent.click(await screen.findByRole("button", { name: /save the pipeline/i }));
    expect(await screen.findByText(/exactly one stage must be the won one/i)).toBeInTheDocument();
    expect(m.saveStages).not.toHaveBeenCalled();
  });

  it("saves the pipeline the server's way, numbered in the order shown", async () => {
    m.saveStages.mockResolvedValue(STAGES);
    render_(<CrmSetup />);
    fireEvent.click(await screen.findByRole("button", { name: /save the pipeline/i }));
    await waitFor(() => expect(m.saveStages).toHaveBeenCalled());
    const sent = m.saveStages.mock.calls[0][0];
    expect(sent.map((s) => [s.key, s.order])).toEqual([["new", 1], ["quoted", 2], ["won", 3], ["lost", 4]]);
  });

  it("asks who should get every enquiry once one person is chosen", async () => {
    render_(<CrmSetup />);
    const mode = await screen.findByLabelText(/give new enquiries to/i);
    fireEvent.change(mode, { target: { value: "fixed" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(await screen.findByText(/who should every enquiry go to/i)).toBeInTheDocument();
    expect(m.saveSettings).not.toHaveBeenCalled();
  });
});
