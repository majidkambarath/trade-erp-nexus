import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// Connecting a person's own Google account. What is asserted is what the panel PROMISES: it must never offer a button
// that cannot work, never claim a connection that is not there, and always say that meetings work without it.
const m = vi.hoisted(() => ({ googleStatus: vi.fn(), googleStart: vi.fn(), googleDisconnect: vi.fn() }));
vi.mock("../../../lib/crmApi", () => ({
  crm: { googleStatus: m.googleStatus, googleStart: m.googleStart, googleDisconnect: m.googleDisconnect },
  CRM_WORK_CHANGED: "crm-work-changed",
  announceCrmWorkChanged: () => {},
}));

import GoogleConnect from "../GoogleConnect.jsx";

const show = (notify = vi.fn()) => {
  render(<GoogleConnect notify={notify} />);
  return notify;
};

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.googleStatus.mockResolvedValue({ available: true, connected: false, label: "Not connected", detail: "" });
});

describe("the Google panel", () => {
  it("offers no button at all where the server has no Google app, and says meetings still work", async () => {
    m.googleStatus.mockResolvedValue({ available: false, connected: false, label: "Not connected", detail: "" });
    show();
    expect(await screen.findByText(/Not set up on this server/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect Google/ })).toBeNull();
    expect(screen.getByText(/Meetings still work without it/i)).toBeInTheDocument();
  });

  it("offers to connect, and says plainly that nobody has to", async () => {
    show();
    expect(await screen.findByRole("button", { name: "Connect Google" })).toBeInTheDocument();
    expect(screen.getByText(/You do not have to/i)).toBeInTheDocument();
    expect(screen.getByText(/paste your own Meet, Zoom or Teams link/i)).toBeInTheDocument();
  });

  it("sends the person to Google's own page", async () => {
    m.googleStart.mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=x" });
    const assign = vi.fn();
    const previous = window.location;
    delete window.location;
    window.location = { ...previous, assign };
    try {
      show();
      fireEvent.click(await screen.findByRole("button", { name: "Connect Google" }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?client_id=x"));
    } finally {
      window.location = previous;
    }
  });

  it("names the account once connected, and offers to disconnect", async () => {
    m.googleStatus.mockResolvedValue({ available: true, connected: true, label: "Connected as asif@gmail.test", detail: "", email: "asif@gmail.test" });
    show();
    expect(await screen.findByText("Connected as asif@gmail.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect Google" })).toBeNull();
    expect(screen.getByText(/moving or cancelling one changes it in your Google Calendar/i)).toBeInTheDocument();
  });

  it("shows what Google said when the connection has gone stale", async () => {
    m.googleStatus.mockResolvedValue({ available: true, connected: true, label: "Needs attention", detail: "The Google connection has expired. Connect the account again." });
    show();
    expect(await screen.findByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText(/Connect the account again/i)).toBeInTheDocument();
  });

  it("disconnects and shows the new state", async () => {
    m.googleStatus.mockResolvedValue({ available: true, connected: true, label: "Connected as asif@gmail.test", detail: "" });
    m.googleDisconnect.mockResolvedValue({ available: true, connected: false, label: "Not connected", detail: "" });
    const notify = show();
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Google was disconnected"));
    expect(await screen.findByRole("button", { name: "Connect Google" })).toBeInTheDocument();
  });

  it("says what went wrong rather than showing an empty box", async () => {
    m.googleStatus.mockRejectedValue(new Error("The server does not have this yet."));
    show();
    expect(await screen.findByText(/The server does not have this yet/)).toBeInTheDocument();
  });
});
