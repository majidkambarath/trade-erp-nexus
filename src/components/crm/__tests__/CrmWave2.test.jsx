// Wave 2's three screens: the dashboard a person lands on, the people, and the log.
// As in CrmScreens.test.jsx, these assert only what a person can see and press.
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import { clearPageSessions } from "../../../lib/pageSession";

const m = vi.hoisted(() => ({
  dashboard: vi.fn(),
  contacts: vi.fn(),
  contact: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  removeContact: vi.fn(),
  activities: vi.fn(),
  analysis: vi.fn(),
  aging: vi.fn(),
  activityReport: vi.fn(),
  deals: vi.fn(),
  completeActivity: vi.fn(),
  owners: vi.fn(),
  logActivity: vi.fn(),
  grants: { allow: () => true },
}));

vi.mock("../../../lib/crmApi", () => ({
  crm: {
    dashboard: m.dashboard,
    contacts: m.contacts,
    contact: m.contact,
    createContact: m.createContact,
    updateContact: m.updateContact,
    removeContact: m.removeContact,
    activities: m.activities,
    analysis: m.analysis,
    aging: m.aging,
    activityReport: m.activityReport,
    deals: m.deals,
    completeActivity: m.completeActivity,
    owners: m.owners,
    logActivity: m.logActivity,
  },
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

// jsdom has no layout and no ResizeObserver, so a responsive chart cannot measure itself: give it a size.
// (The same stub as components/Dashborad/__tests__/businessFlow.test.jsx, for the same reason.)
vi.mock("recharts", async (orig) => {
  const actual = await orig();
  const { cloneElement } = await import("react");
  return {
    ...actual,
    ResponsiveContainer: ({ children, height }) => cloneElement(children, { width: 320, height: typeof height === "number" ? height : 220 }),
  };
});

const CrmDashboard = (await import("../CrmDashboard.jsx")).default;
const ContactsPage = (await import("../ContactsPage.jsx")).default;
const CommunicationsPage = (await import("../CommunicationsPage.jsx")).default;
const CrmReports = (await import("../CrmReports.jsx")).default;

const person = (over = {}) => ({
  _id: "p1", name: "Rajesh Kumar", designation: "Purchase Manager", email: "rajesh@alnoor.ae", phone: "0507778888",
  isPrimary: true, partyKind: "customer", partyId: "c1", partyName: "Al Noor Foods", unlinked: false, notes: "",
  actions: { edit: true, delete: true, logActivity: true }, ...over,
});

const logged = (over = {}) => ({
  _id: "a1", kind: "call", kindLabel: "Call", subject: "Rang about the rice price", status: "DONE", outcome: "interested",
  regarding: { kind: "opportunity", id: "op1" }, ownerName: "Asif Rahman", createdAt: "2026-10-18T06:30:00.000Z",
  completedAt: "2026-10-18T07:00:00.000Z", dueState: "done", auto: false, actions: { edit: false, done: false, delete: true }, ...over,
});

const render_ = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  // The Reports screen remembers which report you were on (pageSession), so one test would otherwise
  // open on the tab the test before it chose.
  clearPageSessions();
  for (const key of Object.keys(m)) if (typeof m[key]?.mockReset === "function") m[key].mockReset();
  m.grants.allow = () => true;
  m.owners.mockResolvedValue([{ id: "u1", name: "Asif" }]);
  m.contacts.mockResolvedValue([person()]);
  m.contact.mockResolvedValue({ ...person(), timeline: [logged()], party: { kind: "customer", id: "c1", name: "Al Noor Foods" } });
  m.activities.mockResolvedValue([logged()]);
  m.deals.mockResolvedValue([{ _id: "op1", opportunityNo: "OPP-2026-0001", title: "Monthly rice", customerName: "Al Noor", stageName: "Quotation sent", status: "OPEN", ownerName: "Asif", value: 48500, expectedCloseDate: "2026-11-05" }]);
  m.analysis.mockResolvedValue({
    period: { from: "2026-09-20", to: "2026-10-19", today: "2026-10-20" },
    leads: { total: 9, converted: 3, lost: 2, open: 4, conversionRate: 33.3 },
    deals: { total: 6, open: 3, won: 2, lost: 1, winRate: 66.7, wonValue: 74000, lostValue: 12000, openValue: 96500, weightedValue: 59450, averageDaysToWin: 11.5 },
    activity: { done: 18, open: 5, overdue: 1 },
    funnel: [{ key: "quoted", name: "Quotation sent", type: "open", probability: 50, count: 2, value: 68500, weighted: 34250 }],
    bySource: [{ source: "referral", label: "Referral", leads: 4, converted: 2, lost: 1, value: 96000, conversionRate: 50 }],
    byOwner: [{ ownerId: "a1", name: "Asif Rahman", leads: 5, deals: 4, won: 2, lost: 1, wonValue: 74000, activities: 12, winRate: 66.7 }],
    lostReasons: [{ reason: "price", label: "Price too high", deals: 1, value: 12000 }],
    capped: false,
  });
  m.aging.mockResolvedValue({
    today: "2026-10-20",
    bands: [{ key: "0-7", label: "Up to a week", deals: 1, value: 48500 }, { key: "31-60", label: "1 to 2 months", deals: 1, value: 28000 }],
    rows: [{ id: "op3", opportunityNo: "OPP-2026-0003", title: "Dates and nuts", customerName: "Noor", stageName: "Quotation sent", ownerName: "Maya", value: 28000, days: 47, stale: true, overdueClose: true, expectedCloseDate: "2026-10-01" }],
    oldest: 47, average: 25, stale: 1, overdueClose: 1,
  });
  m.activityReport.mockResolvedValue({
    period: { from: "2026-09-20", to: "2026-10-19", today: "2026-10-20" },
    byKind: [{ kind: "call", label: "Call", done: 9, open: 3, overdue: 1 }],
    byPerson: [{ key: "a1", name: "Asif Rahman", done: 12, open: 3, overdue: 1, total: 15 }],
    byDay: [{ day: "2026-10-18", count: 6 }],
    done: 18, open: 5, overdue: 1,
  });
  m.dashboard.mockResolvedValue({
    today: "2026-10-20", openLeads: 4, openDeals: 3, pipelineValue: 96500, weightedValue: 59450, staleDeals: 1, dueToday: 2, overdue: 1,
    late: [logged({ _id: "a2", subject: "Send the price", status: "OPEN", dueState: "overdue" })],
    mine: [logged({ _id: "a3", subject: "Visit the Deira branch", status: "OPEN", dueState: "today" })],
    moved: [{ dealId: "op1", opportunityNo: "OPP-2026-0001", title: "Monthly rice", customerName: "Al Noor Foods", event: "quotation_sent", eventLabel: "Quotation sent", from: "qualified", to: "quoted", stageName: "Quotation sent", docNo: "QT-2026-0007", at: "2026-10-19T09:00:00.000Z" }],
    topDeals: [{ _id: "op1", title: "Monthly rice", customerName: "Al Noor Foods", stageName: "Quotation sent", probability: 50, value: 48500, weighted: 24250 }],
    funnel: [{ key: "quoted", name: "Quotation sent", type: "open", count: 2, value: 68500, weighted: 34250 }],
    pulse: Array.from({ length: 14 }, (_, i) => ({ day: `2026-10-${String(7 + i).padStart(2, "0")}`, count: i % 3 })),
    leadSources: [{ key: "referral", name: "Referral", value: 4 }, { key: "walk_in", name: "Walk-in", value: 2 }],
    byOwner: [{ key: "Asif", name: "Asif", deals: 2, value: 68500, weighted: 34250 }],
    trend: [{ month: "2026-09", deals: 1, value: 40000 }, { month: "2026-10", deals: 2, value: 74000 }],
  });
});

describe("the CRM dashboard", () => {
  it("says what is late, what is mine, and what the documents moved by themselves", async () => {
    render_(<CrmDashboard />);
    await screen.findByRole("heading", { name: "CRM" });

    // The two worklists are read at a glance, so they are lists, not tables.
    expect(screen.getByText("Send the price")).toBeInTheDocument();
    expect(screen.getByText("Visit the Deira branch")).toBeInTheDocument();

    // The point of the module: the deal moved, and the document that did it is named.
    expect(screen.getByRole("link", { name: "Monthly rice" })).toHaveAttribute("href", "/crm/pipeline?deal=op1");
    expect(screen.getByText("QT-2026-0007")).toBeInTheDocument();

    // Every panel a person expects is drawn, charts included.
    for (const title of ["Where the pipeline sits", "Won, six months", "Where the enquiries come from", "Is the team working?", "Moved by itself", "Worth the most", "Who is carrying what"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("says plainly when there is nothing, rather than drawing an empty chart", async () => {
    m.dashboard.mockResolvedValue({
      today: "2026-10-20", openLeads: 0, openDeals: 0, pipelineValue: 0, weightedValue: 0, staleDeals: 0, dueToday: 0, overdue: 0,
      late: [], mine: [], moved: [], topDeals: [], byOwner: [], funnel: [], leadSources: [],
      pulse: [{ day: "2026-10-19", count: 0 }, { day: "2026-10-20", count: 0 }],
      trend: [{ month: "2026-05", deals: 0, value: 0 }, { month: "2026-06", deals: 0, value: 0 }],
    });
    render_(<CrmDashboard />);
    expect(await screen.findByText("Nothing has moved this week")).toBeInTheDocument();
    expect(screen.getByText("Every follow-up is either done or still has time.")).toBeInTheDocument();
    expect(screen.getByText("When a deal moves, the next follow-up appears here by itself.")).toBeInTheDocument();
    expect(screen.getByText("Nothing in the pipeline")).toBeInTheDocument();
    // A trend of six empty months is not a chart of zeroes; it says so.
    expect(screen.getByText("Nothing won yet")).toBeInTheDocument();
    expect(screen.getByText("No enquiries yet")).toBeInTheDocument();
    // A quiet fortnight still draws its strip and SAYS it was quiet, rather than leaving a blank.
    expect(screen.getByText("Nothing finished in the last two weeks.")).toBeInTheDocument();
  });

  it("the ring names every source, with its share, so colour is never the only way to tell them apart", async () => {
    render_(<CrmDashboard />);
    await screen.findByRole("heading", { name: "CRM" });
    expect(screen.getByText("Referral")).toBeInTheDocument();
    expect(screen.getByText("Walk-in")).toBeInTheDocument();
    expect(screen.getByText("66.7%")).toBeInTheDocument();
    expect(screen.getByText("33.3%")).toBeInTheDocument();
  });

  it("leads somewhere: the figures are the way in to the screen behind them", async () => {
    render_(<CrmDashboard />);
    await screen.findByRole("heading", { name: "CRM" });
    // A tile with somewhere to go is a button; one that is only a figure is not.
    expect(screen.getByRole("button", { name: /Open enquiries/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deals in play/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Late/ })).toBeInTheDocument();
  });
});

describe("contacts", () => {
  it("lists the people, with the company they work for", async () => {
    render_(<ContactsPage />);
    const table = await screen.findByRole("table", { name: "Contacts" });
    expect(within(table).getByRole("link", { name: "Rajesh Kumar" })).toHaveAttribute("href", "/crm/contacts?contact=p1");
    expect(within(table).getByText("Purchase Manager")).toBeInTheDocument();
    expect(within(table).getByText("Customer")).toBeInTheDocument();
  });

  it("adds a person and sends only the party that was chosen", async () => {
    m.createContact.mockResolvedValue(person({ _id: "p2" }));
    render_(<ContactsPage />);
    await screen.findByRole("table", { name: "Contacts" });
    fireEvent.click(screen.getByRole("button", { name: /New contact/ }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Fatima Noor" } });
    fireEvent.change(within(dialog).getByLabelText(/^Phone/), { target: { value: "0501110000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(m.createContact).toHaveBeenCalled());
    const body = m.createContact.mock.calls[0][0];
    expect(body).toMatchObject({ name: "Fatima Noor", phone: "+971501110000" }); // compact international form, from the phone field
    // Nobody was chosen, so both links are cleared rather than left to guess.
    expect(body.customerId).toBeNull();
    expect(body.vendorId).toBeNull();
  });

  it("opens one person's page with what has been said to them", async () => {
    render_(<ContactsPage />);
    const table = await screen.findByRole("table", { name: "Contacts" });
    fireEvent.click(within(table).getByRole("link", { name: "Rajesh Kumar" }));
    await waitFor(() => expect(m.contact).toHaveBeenCalledWith("p1"));
  });

  it("hides every write control from somebody who may only look", async () => {
    m.grants.allow = (key) => key === "crm.view";
    render_(<ContactsPage />);
    await screen.findByRole("table", { name: "Contacts" });
    expect(screen.queryByRole("button", { name: /New contact/ })).toBeNull();
    // Reading is still offered: export is not a write.
    expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument();
  });
});

describe("the communications log", () => {
  it("reads everything that happened, not only what is owed", async () => {
    render_(<CommunicationsPage />);
    const table = await screen.findByRole("table", { name: "Communications" });
    expect(within(table).getByText("Rang about the rice price")).toBeInTheDocument();
    expect(m.activities).toHaveBeenCalledWith(expect.objectContaining({ status: "all", sort: "recent" }));
  });

  it("narrows to one kind without asking the server for the worklist's question", async () => {
    render_(<CommunicationsPage />);
    await screen.findByRole("table", { name: "Communications" });
    fireEvent.click(screen.getByRole("tab", { name: "Calls" }));
    await waitFor(() => expect(m.activities).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "call", status: "all" })));
  });

  it("offers Done only on what is still open, and only to somebody who may change it", async () => {
    m.activities.mockResolvedValue([logged({ _id: "a9", subject: "Send the price", status: "OPEN", outcome: null, dueState: "overdue" })]);
    const open = render_(<CommunicationsPage />);
    await screen.findByRole("table", { name: "Communications" });
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    open.unmount(); // or the first render's buttons answer for the second

    m.grants.allow = (key) => key === "crm.view";
    render_(<CommunicationsPage />);
    await screen.findByRole("table", { name: "Communications" });
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });
});

describe("the reports", () => {
  it("opens on the pipeline and offers all seven", async () => {
    render_(<CrmReports />);
    await screen.findByRole("heading", { name: "Reports" });
    for (const name of ["Pipeline", "Lead conversion", "Win / loss", "Sales performance", "Aging", "Deals", "Communications"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
    expect(await screen.findByRole("table", { name: "Pipeline by stage" })).toBeInTheDocument();
  });

  it("reads the analysis once and shares it across the four reports that need it", async () => {
    render_(<CrmReports />);
    await screen.findByRole("table", { name: "Pipeline by stage" });
    fireEvent.click(screen.getByRole("tab", { name: "Lead conversion" }));
    expect(await screen.findByRole("table", { name: "Lead conversion by source" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Sales performance" }));
    expect(await screen.findByRole("table", { name: "Sales performance" })).toBeInTheDocument();
    // Four reports, one read: the figures cannot disagree with each other and the server is asked once.
    expect(m.analysis).toHaveBeenCalledTimes(1);
  });

  it("aging is as at today, so it never asks for a period", async () => {
    render_(<CrmReports />);
    await screen.findByRole("table", { name: "Pipeline by stage" });
    fireEvent.click(screen.getByRole("tab", { name: "Aging" }));
    expect(await screen.findByRole("table", { name: "Opportunity aging" })).toBeInTheDocument();
    expect(m.aging).toHaveBeenCalledWith();
    // The dates are drawn but disabled, and the screen says why rather than hiding them.
    expect(screen.getByText("This report is as at today.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^From/)).toBeDisabled();
  });

  it("communications reads the period and names who did the chasing", async () => {
    render_(<CrmReports />);
    await screen.findByRole("table", { name: "Pipeline by stage" });
    fireEvent.click(screen.getByRole("tab", { name: "Communications" }));
    expect(await screen.findByRole("table", { name: "Communication activity by kind" })).toBeInTheDocument();
    expect(m.activityReport).toHaveBeenCalled();
  });

  it("the deals register lists every deal and links to it", async () => {
    render_(<CrmReports />);
    await screen.findByRole("table", { name: "Pipeline by stage" });
    fireEvent.click(screen.getByRole("tab", { name: "Deals" }));
    const table = await screen.findByRole("table", { name: "Every deal" });
    expect(within(table).getByRole("link", { name: "OPP-2026-0001" })).toHaveAttribute("href", "/crm/pipeline?deal=op1");
  });
});

describe("the report charts", () => {
  const open = async (tab) => {
    render_(<CrmReports />);
    await screen.findByRole("table", { name: "Pipeline by stage" });
    if (tab !== "Pipeline") fireEvent.click(screen.getByRole("tab", { name: tab }));
  };

  it("pipeline: the bars and the ring are drawn from the same stages", async () => {
    await open("Pipeline");
    expect(screen.getByText("Where the deals stand")).toBeInTheDocument();
    expect(screen.getByText("What it is made of")).toBeInTheDocument();
  });

  it("conversion: a funnel from enquiry to won deal, where they come from, and which sources convert", async () => {
    await open("Lead conversion");
    expect(await screen.findByText("The funnel")).toBeInTheDocument();
    expect(screen.getByText("Where they come from")).toBeInTheDocument();
    expect(screen.getByText("Which sources actually convert")).toBeInTheDocument();
    // The legend is also the table: a source is named with its share, so colour is never the only way to tell them apart.
    expect(screen.getAllByText("Referral").length).toBeGreaterThan(0);
  });

  it("win / loss: won against lost, and why", async () => {
    await open("Win / loss");
    expect(await screen.findByText("Won against lost")).toBeInTheDocument();
    expect(screen.getByText("Why deals are lost")).toBeInTheDocument();
  });

  it("communications: a strip of every day of the period, and the kinds as a ring", async () => {
    await open("Communications");
    expect(await screen.findByText("Day by day")).toBeInTheDocument();
    expect(screen.getByText("How they were reached")).toBeInTheDocument();
  });

  it("says so, rather than drawing an empty ring, when nothing closed", async () => {
    m.analysis.mockResolvedValue({ ...(await m.analysis()), deals: { won: 0, lost: 0, wonValue: 0, lostValue: 0, open: 0, openValue: 0, weightedValue: 0 }, lostReasons: [] });
    await open("Win / loss");
    expect(await screen.findByText("Nothing closed in this period")).toBeInTheDocument();
  });
});
