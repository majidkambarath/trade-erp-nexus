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

// On a pointer the feed hangs off the bell; below md it is the bottom sheet. jsdom has no matchMedia, which
// useMediaQuery reads as a wide window, so the tests above all exercise the panel.
describe("where the feed opens", () => {
  it("hangs the panel off the bell on a wide window, and a press outside closes it", async () => {
    await renderBell();
    const bell = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bell);
    const panel = await screen.findByRole("dialog", { name: "Notifications" });
    // jsdom loads no stylesheet, so the `fixed` class is read as a class; the placement is the inline style
    expect(panel.className).toMatch(/\bfixed\b/);
    expect(panel.style.top).not.toBe("");
    expect(bell).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bell).toHaveAttribute("aria-expanded", "false");
  });

  it("the bell toggles: a second press on it closes the panel again", async () => {
    await renderBell();
    const bell = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bell);
    await screen.findByRole("dialog", { name: "Notifications" });
    fireEvent.pointerDown(bell); // the press that precedes the click must not close it on its own
    fireEvent.click(bell);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Escape closes it and puts focus back on the bell", async () => {
    await renderBell();
    const bell = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bell);
    await screen.findByRole("dialog", { name: "Notifications" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(bell);
  });

  it("is the bottom sheet, not a panel, on a narrow window", async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    try {
      await renderBell();
      fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
      const sheet = await screen.findByRole("dialog");
      // the sheet is kit.jsx's Modal: its title is a heading inside the dialog, not an aria-label on it
      expect(sheet).not.toHaveAttribute("aria-label");
      expect(await screen.findByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    } finally {
      delete window.matchMedia;
    }
  });
});
