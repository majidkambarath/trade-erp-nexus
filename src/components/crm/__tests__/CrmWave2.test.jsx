// Wave 2's three screens: the dashboard a person lands on, the people, and the log.
// As in CrmScreens.test.jsx, these assert only what a person can see and press.
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  dashboard: vi.fn(),
  contacts: vi.fn(),
  contact: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  removeContact: vi.fn(),
  activities: vi.fn(),
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

const CrmDashboard = (await import("../CrmDashboard.jsx")).default;
const ContactsPage = (await import("../ContactsPage.jsx")).default;
const CommunicationsPage = (await import("../CommunicationsPage.jsx")).default;

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
  for (const key of Object.keys(m)) if (typeof m[key]?.mockReset === "function") m[key].mockReset();
  m.grants.allow = () => true;
  m.owners.mockResolvedValue([{ id: "u1", name: "Asif" }]);
  m.contacts.mockResolvedValue([person()]);
  m.contact.mockResolvedValue({ ...person(), timeline: [logged()], party: { kind: "customer", id: "c1", name: "Al Noor Foods" } });
  m.activities.mockResolvedValue([logged()]);
  m.dashboard.mockResolvedValue({
    today: "2026-10-20", openLeads: 4, openDeals: 3, pipelineValue: 96500, weightedValue: 59450, staleDeals: 1, dueToday: 2, overdue: 1,
    late: [logged({ _id: "a2", subject: "Send the price", status: "OPEN", dueState: "overdue" })],
    mine: [logged({ _id: "a3", subject: "Visit the Deira branch", status: "OPEN", dueState: "today" })],
    moved: [{ dealId: "op1", opportunityNo: "OPP-2026-0001", title: "Monthly rice", customerName: "Al Noor Foods", event: "quotation_sent", eventLabel: "Quotation sent", from: "qualified", to: "quoted", stageName: "Quotation sent", docNo: "QT-2026-0007", at: "2026-10-19T09:00:00.000Z" }],
    topDeals: [{ _id: "op1", title: "Monthly rice", customerName: "Al Noor Foods", stageName: "Quotation sent", probability: 50, value: 48500, weighted: 24250 }],
    funnel: [{ key: "quoted", name: "Quotation sent", count: 2, value: 68500, weighted: 34250 }],
  });
});

describe("the CRM dashboard", () => {
  it("says what is late, what is mine, and what the documents moved by themselves", async () => {
    render_(<CrmDashboard />);
    await screen.findByRole("heading", { name: "CRM" });

    const late = await screen.findByRole("table", { name: "Late follow-ups" });
    expect(within(late).getByText("Send the price")).toBeInTheDocument();

    const mine = screen.getByRole("table", { name: "My follow-ups" });
    expect(within(mine).getByText("Visit the Deira branch")).toBeInTheDocument();

    // The point of the module: the deal moved, and the document that did it is named.
    const moved = screen.getByRole("table", { name: "Moved by itself" });
    expect(within(moved).getAllByText(/Quotation sent/).length).toBeGreaterThan(0);
    expect(within(moved).getByText(/QT-2026-0007/)).toBeInTheDocument();
    expect(within(moved).getByRole("link", { name: "Monthly rice" })).toHaveAttribute("href", "/crm/pipeline?deal=op1");
  });

  it("says plainly when nothing has moved, rather than showing an empty table", async () => {
    m.dashboard.mockResolvedValue({
      today: "2026-10-20", openLeads: 0, openDeals: 0, pipelineValue: 0, weightedValue: 0, staleDeals: 0, dueToday: 0, overdue: 0,
      late: [], mine: [], moved: [], topDeals: [], funnel: [],
    });
    render_(<CrmDashboard />);
    expect(await screen.findByText("Nothing has moved this week")).toBeInTheDocument();

    expect(screen.getByText("Every follow-up is either done or still has time.")).toBeInTheDocument();
    expect(screen.getByText("When a deal moves, the next follow-up appears here by itself.")).toBeInTheDocument();
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
    expect(body).toMatchObject({ name: "Fatima Noor", phone: "0501110000" });
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
