// The calendar. As with the board, a real pointer drag cannot be simulated in jsdom (no layout), so the move is
// driven through the day's own date field - which ends in the same `reschedule` a drag ends in.
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import { clearPageSessions, pageSession } from "../../../lib/pageSession";
import { formatDate } from "../../../utils/format";

const m = vi.hoisted(() => ({ calendar: vi.fn(), updateActivity: vi.fn(), grants: { allow: () => true } }));
vi.mock("../../../lib/crmApi", () => ({ crm: { calendar: m.calendar, updateActivity: m.updateActivity }, CRM_WORK_CHANGED: "crm-work-changed", announceCrmWorkChanged: () => {} }));
vi.mock("../../shell/OrganisationContext.jsx", () => ({
  useOrganisation: () => ({ can: (k) => m.grants.allow(k), canAny: (ks) => [].concat(ks || []).some((k) => m.grants.allow(k)), me: { id: "u1", name: "Asif" } }),
}));

const CrmCalendar = (await import("../CrmCalendar.jsx")).default;

const TODAY = "2026-10-20";
const feed = () => ({
  today: TODAY, from: "2026-09-28", to: "2026-11-01",
  items: [
    { id: "a1", type: "activity", day: "2026-10-20", title: "Ring about the rice", sub: "Call", kind: "call", status: "OPEN", overdue: false, movable: true, ownerName: "Asif" },
    { id: "a2", type: "activity", day: "2026-10-14", title: "Chase the contract", sub: "Call", kind: "call", status: "OPEN", overdue: true, movable: true },
    { id: "a3", type: "activity", day: "2026-10-20", title: "Met at the fair", sub: "Note", kind: "note", status: "DONE", overdue: false, movable: false },
    { id: "d1", type: "deal", day: "2026-10-20", title: "Rice contract", sub: "Al Noor", value: 90000, status: "OPEN", overdue: false, movable: false },
    { id: "l1", type: "lead", day: "2026-10-20", title: "Priya Nair", sub: "Nair Metal", status: "NEW", overdue: false, movable: false },
  ],
});

const show = () => render(<MemoryRouter><CrmCalendar /></MemoryRouter>);
// Both the grid and the agenda name an item, so the agenda is found by its heading.
const agenda = async () => (await screen.findByRole("heading", { name: /Tuesday 20 October/ })).closest("section, div[class*=rounded]");

beforeEach(() => {
  clearPageSessions();
  pageSession("crm-calendar").set("month", "2026-10");
  pageSession("crm-calendar").set("day", TODAY);
  m.calendar.mockReset();
  m.updateActivity.mockReset();
  m.grants.allow = () => true;
  m.calendar.mockResolvedValue(feed());
  m.updateActivity.mockResolvedValue({});
});

describe("the calendar", () => {
  it("asks for the whole grid the month occupies, not just the month", async () => {
    show();
    await screen.findByRole("heading", { name: "October 2026" });
    // 1 Oct 2026 is a Thursday, so a Monday-first grid starts on 28 Sep and ends on 1 Nov.
    expect(m.calendar).toHaveBeenCalledWith({ from: "2026-09-28", to: "2026-11-01" });
  });

  it("opens on today and lists what is on it - follow-ups and deals, but not enquiries until asked", async () => {
    show();
    await screen.findByRole("heading", { name: "October 2026" });
    expect(await screen.findByText("20 October", { exact: false, selector: "h2, h3, [class*=font-semibold]" })).toBeTruthy();
    const day = await agenda();
    expect(within(day).getByText("Ring about the rice")).toBeInTheDocument();
    expect(within(day).getByText("Rice contract")).toBeInTheDocument();
    expect(within(day).getByText("Met at the fair")).toBeInTheDocument();
    // Enquiries are the noisiest layer, so it starts OFF: the month reads clean.
    expect(within(day).queryByText("Priya Nair")).toBeNull();
  });

  it("an enquiry appears once its layer is switched on, and goes again when it is switched off", async () => {
    show();
    const toggle = await screen.findByRole("button", { name: "Enquiries" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(within(await agenda()).getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enquiries" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Enquiries" }));
    expect(within(await agenda()).queryByText("Priya Nair")).toBeNull();
  });

  it("steps to the next month and reads that grid", async () => {
    show();
    await screen.findByRole("heading", { name: "October 2026" });
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await screen.findByRole("heading", { name: "November 2026" });
    await waitFor(() => expect(m.calendar).toHaveBeenLastCalledWith({ from: "2026-10-26", to: "2026-12-06" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await screen.findByRole("heading", { name: "October 2026" });
  });
});

describe("moving a follow-up", () => {
  const dateField = async (title) => within(await agenda()).getByLabelText(`New day for ${title}`);
  const typeDay = (field, iso) => {
    fireEvent.change(field, { target: { value: formatDate(iso) } });
    fireEvent.blur(field);
  };

  it("asks the server for the new day and says so", async () => {
    show();
    typeDay(await dateField("Ring about the rice"), "2026-10-28");
    await waitFor(() => expect(m.updateActivity).toHaveBeenCalledWith("a1", { dueAt: "2026-10-28" }));
    await waitFor(() => expect(screen.getByText(`Ring about the rice is now due ${formatDate("2026-10-28")}`)).toBeInTheDocument());
  });

  it("refuses to move one into the past, and does not even ask the server", async () => {
    show();
    typeDay(await dateField("Ring about the rice"), "2026-10-10");
    expect(await screen.findByText("A follow-up cannot be moved into the past.")).toBeInTheDocument();
    expect(m.updateActivity).not.toHaveBeenCalled();
  });

  it("only an OPEN follow-up can be moved: a finished one, a deal and an enquiry have no date field", async () => {
    show();
    const day = await agenda();
    expect(within(day).queryByLabelText("New day for Met at the fair")).toBeNull();
    expect(within(day).queryByLabelText("New day for Rice contract")).toBeNull();
    expect(within(day).getByLabelText("New day for Ring about the rice")).toBeInTheDocument();
  });

  it("tells the person when the server refuses, rather than silently doing nothing", async () => {
    m.updateActivity.mockRejectedValue(new Error("A follow-up that is done cannot be changed"));
    show();
    typeDay(await dateField("Ring about the rice"), "2026-10-28");
    expect(await screen.findByText("A follow-up that is done cannot be changed")).toBeInTheDocument();
  });

  it("somebody who may only look sees the calendar and nothing to change it with", async () => {
    m.grants.allow = (key) => key === "crm.view";
    show();
    const day = await agenda();
    expect(within(day).getByText("Ring about the rice")).toBeInTheDocument();
    expect(within(day).queryByLabelText("New day for Ring about the rice")).toBeNull();
    expect(screen.getByText(/moving things needs permission to edit/)).toBeInTheDocument();
  });
});
