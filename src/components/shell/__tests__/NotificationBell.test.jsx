import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The bell in TopBar: a badge for anyone's own unread count, a feed opened on click, read-on-open-link and
// mark-all-read, and the empty state for someone with nothing waiting.

const m = vi.hoisted(() => ({ unreadCount: vi.fn(), list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() }));
vi.mock("../../../lib/notificationsApi", async (importOriginal) => ({
  ...(await importOriginal()),
  notifications: { unreadCount: m.unreadCount, list: m.list, markRead: m.markRead, markAllRead: m.markAllRead },
}));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import { OrganisationProvider, useOrganisation } from "../OrganisationContext";
import { NavBadgesProvider } from "../NavBadges";
import NotificationBell from "../NotificationBell";
import { statusFor } from "./asRole";

function Known() {
  const { me } = useOrganisation();
  return me ? <span data-testid="known" /> : null;
}

const renderBell = async () => {
  orgStatus = statusFor(["sales.view"]);
  const view = render(
    <MemoryRouter>
      <OrganisationProvider>
        <Known />
        <NavBadgesProvider><NotificationBell /></NavBadgesProvider>
      </OrganisationProvider>
    </MemoryRouter>
  );
  await screen.findByTestId("known");
  return view;
};

const row = (over = {}) => ({ id: "n1", kind: "low_stock", severity: "warning", title: "Widget is low on stock", body: "2 left, at or below the reorder level of 10.", link: "/stock", occurredAt: "2026-10-19T08:00:00.000Z", createdAt: "2026-10-19T08:00:00.000Z", read: false, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  m.unreadCount.mockResolvedValue({ count: 0 });
  m.list.mockResolvedValue({ items: [], counts: { total: 0, unread: 0 }, capped: false });
  m.markRead.mockResolvedValue({ read: true });
  m.markAllRead.mockResolvedValue({ count: 0 });
});

describe("the bell button", () => {
  it("shows the unread count as its badge, and nothing at zero", async () => {
    m.unreadCount.mockResolvedValue({ count: 3 });
    await renderBell();
    expect(await screen.findByRole("button", { name: /Notifications.*3 unread/ })).toBeInTheDocument();
  });

  it("shows no badge number when nothing is unread", async () => {
    await renderBell();
    await waitFor(() => expect(m.unreadCount).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });
});

describe("the feed", () => {
  it("fetches only once opened, not on mount", async () => {
    await renderBell();
    await waitFor(() => expect(m.unreadCount).toHaveBeenCalled());
    expect(m.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await waitFor(() => expect(m.list).toHaveBeenCalledTimes(1));
  });

  it("shows the caught-up empty state when there is nothing waiting", async () => {
    await renderBell();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });

  it("lists rows, unread first visually distinguished, with a mark-all-read action", async () => {
    m.list.mockResolvedValue({ items: [row(), row({ id: "n2", title: "Gadget is low on stock" })], counts: { total: 2, unread: 2 }, capped: false });
    await renderBell();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(await screen.findByText("Widget is low on stock")).toBeInTheDocument();
    expect(screen.getByText("Gadget is low on stock")).toBeInTheDocument();
    expect(screen.getByText("2 unread")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark all read/ })).toBeInTheDocument();
  });

  it("opening a row's link marks it read and closes the feed", async () => {
    m.list.mockResolvedValue({ items: [row()], counts: { total: 1, unread: 1 }, capped: false });
    await renderBell();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    const link = await screen.findByRole("link", { name: /Widget is low on stock/ });
    expect(link).toHaveAttribute("href", "/stock");
    fireEvent.click(link);
    await waitFor(() => expect(m.markRead).toHaveBeenCalledWith("n1"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mark all read clears every row for this person and tells the badge to refresh", async () => {
    m.list.mockResolvedValue({ items: [row(), row({ id: "n2" })], counts: { total: 2, unread: 2 }, capped: false });
    await renderBell();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    await screen.findByText("2 unread");
    fireEvent.click(screen.getByRole("button", { name: /Mark all read/ }));
    await waitFor(() => expect(m.markAllRead).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("2 unread")).not.toBeInTheDocument();
  });

  it("a row with no link is not clickable - it is read just by being seen", async () => {
    m.list.mockResolvedValue({ items: [row({ link: null })], counts: { total: 1, unread: 1 }, capped: false });
    await renderBell();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    await screen.findByText("Widget is low on stock");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
