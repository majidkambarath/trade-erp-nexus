import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// Arranging a meeting, as a person does it. What is asserted is what they see and press, and above all what the screen
// tells them afterwards: a meeting that was booked but whose invitation did not go out must say so, never "sent".
const m = vi.hoisted(() => ({
  scheduleMeeting: vi.fn(),
  rescheduleMeeting: vi.fn(),
  meetingsOnDay: vi.fn(),
  contacts: vi.fn(),
  owners: vi.fn(),
  readiness: vi.fn(),
  googleStatus: vi.fn(),
}));

vi.mock("../../../lib/crmApi", () => ({
  crm: { scheduleMeeting: m.scheduleMeeting, rescheduleMeeting: m.rescheduleMeeting, meetingsOnDay: m.meetingsOnDay, contacts: m.contacts, owners: m.owners, googleStatus: m.googleStatus },
  CRM_WORK_CHANGED: "crm-work-changed",
  announceCrmWorkChanged: () => {},
}));
vi.mock("../../../lib/sendDocumentsApi", () => ({ sendSettings: { readiness: m.readiness } }));

import MeetingDialog from "../MeetingDialog.jsx";
import { formatDate } from "../../../utils/format";

const REGARDING = { kind: "lead", id: "l1" };
const open = (props = {}) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const notify = vi.fn();
  render(<MeetingDialog regarding={REGARDING} today="2026-11-03" onClose={onClose} onSaved={onSaved} notify={notify} {...props} />);
  return { onClose, onSaved, notify };
};

const booked = (over = {}) => ({
  meeting: { _id: "a1", subject: "Price review", meeting: { time: "14:30", timeRange: "14:30 - 15:00", sequence: 0, attendees: [] } },
  invite: { sent: true, provider: "resend", to: ["hassan@alnoor.test"], error: null },
  clashes: [],
  ...over,
});

const fill = async () => {
  fireEvent.change(screen.getByLabelText(/What the meeting is about/), { target: { value: "Price review" } });
  const picker = screen.getByRole("combobox", { name: /Who is coming/i });
  fireEvent.keyDown(picker, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: /Hassan Al Noor/ }));
};

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.contacts.mockResolvedValue([
    { _id: "c1", name: "Hassan Al Noor", email: "hassan@alnoor.test", party: { name: "Al Noor Foods" } },
    { _id: "c2", name: "Nobody Reachable", email: "", party: { name: "Al Noor Foods" } },
  ]);
  m.owners.mockResolvedValue([{ id: "u1", name: "Maya Khan" }]);
  m.meetingsOnDay.mockResolvedValue([]);
  m.readiness.mockResolvedValue({ ready: true });
  m.googleStatus.mockResolvedValue({ available: true, connected: false });
  m.scheduleMeeting.mockResolvedValue(booked());
});

describe("arranging a meeting", () => {
  it("opens with today, a sensible length and the invitation ticked", async () => {
    open();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // DateInput shows the person's own date format and keeps an ISO value, so the expectation is built, never spelt out
    expect(screen.getByLabelText(/Day/)).toHaveValue(formatDate("2026-11-03"));
    expect(screen.getByLabelText(/Send everybody an invitation/)).toBeChecked();
    expect(screen.getByText(/lands in their own calendar/i)).toBeInTheDocument();
  });

  it("sends the day, the time, the people and the link", async () => {
    const { onSaved } = open();
    await fill();
    fireEvent.change(screen.getByLabelText(/Starts at/), { target: { value: "14:30" } });
    fireEvent.change(screen.getByLabelText(/Joining link/), { target: { value: "https://meet.example.com/abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Arrange it" }));

    await waitFor(() => expect(m.scheduleMeeting).toHaveBeenCalledTimes(1));
    expect(m.scheduleMeeting.mock.calls[0][0]).toMatchObject({
      subject: "Price review",
      day: "2026-11-03",
      time: "14:30",
      minutes: 30,
      where: "online",
      joinUrl: "https://meet.example.com/abc",
      notify: true,
      regarding: REGARDING,
    });
    expect(m.scheduleMeeting.mock.calls[0][0].attendees).toEqual([{ kind: "contact", id: "c1" }]);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("will not send a meeting with nobody coming, or with no subject", async () => {
    open();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Arrange it" }));
    expect(await screen.findByText(/Say what the meeting is about/)).toBeInTheDocument();
    expect(screen.getByText(/Invite at least one person/)).toBeInTheDocument();
    expect(m.scheduleMeeting).not.toHaveBeenCalled();
  });

  it("refuses a link that is not a web address before it reaches the server", async () => {
    open();
    await fill();
    fireEvent.change(screen.getByLabelText(/Joining link/), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Arrange it" }));
    expect(await screen.findByText(/must start with http/i)).toBeInTheDocument();
    expect(m.scheduleMeeting).not.toHaveBeenCalled();
  });

  it("asks for a place instead of a link when the meeting is in person", async () => {
    open();
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText(/^Where/), { target: { value: "in_person" } });
    expect(screen.getByLabelText(/The place/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Joining link/)).toBeNull();
  });

  it("lets a person be taken off the list again", async () => {
    open();
    await fill();
    expect(screen.getByText("Hassan Al Noor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Do not invite Hassan Al Noor/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Do not invite/ })).toBeNull());
  });
});

describe("what the screen owes the person afterwards", () => {
  it("says the invitation went out when it did", async () => {
    const { notify } = open();
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Arrange it" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Meeting arranged, and everybody was told", undefined));
  });

  it("says plainly when the meeting was booked but the invitation was not sent", async () => {
    m.scheduleMeeting.mockResolvedValue(booked({ invite: { sent: false, provider: "smtp", to: ["x@y.test"], error: "The mailbox is full" } }));
    const { notify, onSaved } = open();
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Arrange it" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Meeting arranged, but the invitation did not go out: The mailbox is full", "error"));
    expect(onSaved).toHaveBeenCalled(); // the meeting still exists, so the screen must refresh
  });

  it("warns BEFORE saving when email is not set up at all", async () => {
    m.readiness.mockResolvedValue({ ready: false });
    open();
    expect(await screen.findByText(/no invitation will reach anybody/i)).toBeInTheDocument();
  });

  it("says nothing about email when it is set up, or while the answer is still coming", async () => {
    open();
    await screen.findByRole("dialog");
    await waitFor(() => expect(m.readiness).toHaveBeenCalled());
    expect(screen.queryByText(/no invitation will reach anybody/i)).toBeNull();
  });

  it("warns that somebody chosen has no email address", async () => {
    open();
    await screen.findByRole("dialog");
    const picker = screen.getByRole("combobox", { name: /Who is coming/i });
    fireEvent.keyDown(picker, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: /Nobody Reachable/ }));
    expect(await screen.findByText(/has no email address/i)).toBeInTheDocument();
  });

  it("warns about an overlap but still lets it be arranged", async () => {
    m.meetingsOnDay.mockResolvedValue([{ _id: "other", subject: "Morning one", meeting: { time: "14:00", timeRange: "14:00 - 15:00" } }]);
    open();
    await fill();
    fireEvent.change(screen.getByLabelText(/Starts at/), { target: { value: "14:30" } });
    expect(await screen.findByText(/overlaps "Morning one"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arrange it" })).toBeEnabled();
  });

  it("shows the server's own words when it refuses", async () => {
    m.scheduleMeeting.mockRejectedValue(Object.assign(new Error("A meeting is at least 5 minutes long"), { code: "MEETING_TOO_SHORT" }));
    open();
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Arrange it" }));
    expect(await screen.findByText(/at least 5 minutes long/)).toBeInTheDocument();
  });
});

describe("moving a meeting", () => {
  const saved = {
    _id: "a1",
    subject: "Price review",
    meeting: { time: "14:30", timeRange: "14:30 - 15:00", minutes: 30, where: "online", joinUrl: "https://meet.example.com/abc", location: "", startAt: "2026-11-03T10:30:00.000Z", attendees: [{ kind: "contact", id: "c1", name: "Hassan Al Noor" }] },
  };

  it("opens filled in, and sends only what changed", async () => {
    m.rescheduleMeeting.mockResolvedValue(booked());
    open({ activity: saved });
    expect(await screen.findByRole("heading", { name: "Move the meeting" })).toBeInTheDocument();
    expect(screen.getByLabelText(/What the meeting is about/)).toHaveValue("Price review");
    expect(screen.getByLabelText(/Starts at/)).toHaveValue("14:30");

    fireEvent.change(screen.getByLabelText(/Starts at/), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Move it" }));
    await waitFor(() => expect(m.rescheduleMeeting).toHaveBeenCalledWith("a1", { notify: true, time: "09:00" }));
    expect(m.scheduleMeeting).not.toHaveBeenCalled();
  });

  it("says it moved, and that everybody was told", async () => {
    m.rescheduleMeeting.mockResolvedValue(booked());
    const { notify } = open({ activity: saved });
    await screen.findByRole("heading", { name: "Move the meeting" });
    fireEvent.change(screen.getByLabelText(/Starts at/), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Move it" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Meeting moved, and everybody was told", undefined));
  });

  it("does not count the meeting being moved as a clash with itself", async () => {
    m.meetingsOnDay.mockResolvedValue([{ _id: "a1", subject: "Price review", meeting: { time: "14:30", timeRange: "14:30 - 15:00" } }]);
    open({ activity: saved });
    await screen.findByRole("heading", { name: "Move the meeting" });
    await waitFor(() => expect(m.meetingsOnDay).toHaveBeenCalled());
    expect(screen.queryByText(/overlaps/i)).toBeNull();
  });
});

// A Meet link made by Google is offered ONLY to somebody who has connected their own account, so the form never
// promises a link it cannot make.
describe("a Google Meet link", () => {
  it("is not offered to somebody who has not connected Google", async () => {
    open();
    await screen.findByRole("dialog");
    await waitFor(() => expect(m.googleStatus).toHaveBeenCalled());
    expect(screen.queryByLabelText(/Make a Google Meet link/i)).toBeNull();
    expect(screen.getByLabelText(/Joining link/)).toBeInTheDocument();
  });

  it("is offered once connected, and asked for only when ticked", async () => {
    m.googleStatus.mockResolvedValue({ available: true, connected: true, email: "asif@gmail.test" });
    open();
    const tick = await screen.findByLabelText(/Make a Google Meet link/i);
    expect(tick).not.toBeChecked();
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Arrange it" }));
    await waitFor(() => expect(m.scheduleMeeting).toHaveBeenCalled());
    expect(m.scheduleMeeting.mock.calls[0][0].googleMeet).toBe(false);
  });

  it("asks Google when ticked, and says so when the link was made", async () => {
    m.googleStatus.mockResolvedValue({ available: true, connected: true });
    m.scheduleMeeting.mockResolvedValue(booked({ google: { ok: true, meetLink: "https://meet.google.com/abc", error: null } }));
    const { notify } = open();
    fireEvent.click(await screen.findByLabelText(/Make a Google Meet link/i));
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Arrange it" }));
    await waitFor(() => expect(m.scheduleMeeting.mock.calls[0][0].googleMeet).toBe(true));
    // the link was made, so the toast stays the plain happy one
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Meeting arranged, and everybody was told", undefined));
  });

  it("says the meeting is still arranged when Google refuses the link", async () => {
    m.googleStatus.mockResolvedValue({ available: true, connected: true });
    m.scheduleMeeting.mockResolvedValue(booked({ google: { ok: false, error: "The Google connection has expired." } }));
    const { notify, onSaved } = open();
    fireEvent.click(await screen.findByLabelText(/Make a Google Meet link/i));
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Arrange it" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Meeting arranged.*Google could not make the link|The Google connection has expired/), "error"));
    expect(onSaved).toHaveBeenCalled(); // the meeting exists, so the screen still refreshes
  });

  it("tells the person Google will fill the link, rather than leaving the field unexplained", async () => {
    m.googleStatus.mockResolvedValue({ available: true, connected: true });
    open();
    fireEvent.click(await screen.findByLabelText(/Make a Google Meet link/i));
    expect(screen.getByText(/Google will fill it/i)).toBeInTheDocument();
  });
});
