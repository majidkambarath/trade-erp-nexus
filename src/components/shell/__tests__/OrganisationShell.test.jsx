import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import Layout from "../../Layout";
import { BLOCKED_EVENT } from "../../../lib/organisation";

// The shell as an organisation sees it: its own name in the bar, only the screens its plan includes, a notice before
// the subscription ends, and one page that says why when it has ended. What the status route answers is set per test.
let status;
vi.mock("../../../axios/axios", () => ({
  default: {
    get: vi.fn((url) =>
      url === "/organisation/status"
        ? status instanceof Error
          ? Promise.reject(status)
          : Promise.resolve({ data: { success: true, data: status } })
        : Promise.resolve({ data: { success: true, data: { name: "Super Admin", email: "admin@test.uae" } } })
    ),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
  signOutLocally: async () => (await import("../../../axios/session")).clearSession(),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const active = { state: "active", blocked: false, canRead: true, canWrite: true, endsAt: null, daysLeft: null };
const base = () => ({
  organisation: { code: "acme", legalName: "Acme Trading LLC", baseCurrency: "AED", planName: "Standard" },
  subscription: { ...active },
  features: { quotations: true, deliveryNotes: true, einvoicing: false, banking: false, reconciliation: false },
});

beforeEach(() => {
  sessionStorage.clear();
  status = base();
});

const renderAt = (url) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/" element={<p>login page</p>} />
          <Route element={<Layout />}>
            <Route path="*" element={<p>the page itself</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

describe("the organisation in the shell", () => {
  it("names the organisation in the top bar", async () => {
    renderAt("/sales-order");
    expect(await screen.findByText("Acme Trading LLC")).toBeInTheDocument();
  });

  it("offers only the screens the plan includes", async () => {
    renderAt("/sales-order");
    await screen.findByText("Acme Trading LLC");
    // the Sales module's tabs sit above the page: Quotations is in the plan, e-Invoicing (another module) is not
    expect(await screen.findByRole("link", { name: "Quotations" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("link", { name: /e-Invoicing/ })).toBeNull());
    expect(screen.queryByRole("link", { name: "Cheques" })).toBeNull();
  });

  it("shows nothing as hidden when the status cannot be loaded", async () => {
    status = new Error("network");
    renderAt("/sales-order");
    expect(await screen.findByRole("link", { name: "Quotations" })).toBeInTheDocument();
    expect(screen.getByText("the page itself")).toBeInTheDocument();
  });

  it("says so, in place of the page, when a screen is not in the plan", async () => {
    renderAt("/e-invoicing");
    expect(await screen.findByText("E-invoicing is not included in your plan")).toBeInTheDocument();
    expect(screen.queryByText("the page itself")).toBeNull();
  });

  it("warns when the subscription is about to end, and still shows the page", async () => {
    status.subscription = { ...active, endsAt: new Date(Date.now() + 5 * 86400000).toISOString(), daysLeft: 5 };
    renderAt("/sales-order");
    expect(await screen.findByText(/Your subscription ends in \d+ days?\./)).toBeInTheDocument();
    expect(screen.getByText("the page itself")).toBeInTheDocument();
  });

  it("replaces the whole app with one page that says why when the subscription has ended", async () => {
    status.subscription = { state: "expired", blocked: true, canRead: false, canWrite: false, endsAt: "2026-10-10T23:59:59.999Z", reason: "The subscription ended on 2026-10-10." };
    status.support = { contact: "help@zarvia.example" };
    renderAt("/sales-order");
    expect(await screen.findByRole("heading", { name: "Your subscription has ended" })).toBeInTheDocument();
    expect(screen.getByText("It ended on 10 Oct 2026.")).toBeInTheDocument();
    expect(screen.getByText("help@zarvia.example")).toBeInTheDocument();
    expect(screen.queryByText("the page itself")).toBeNull();
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
  });

  it("blocks at once when any request is refused as blocked", async () => {
    renderAt("/sales-order");
    await screen.findByText("the page itself");
    window.dispatchEvent(new CustomEvent(BLOCKED_EVENT, { detail: { state: "suspended", message: "This organisation has been suspended.", contact: null } }));
    expect(await screen.findByRole("heading", { name: "This account is suspended" })).toBeInTheDocument();
    expect(screen.getByText(/contact your account manager/)).toBeInTheDocument();
  });

  it("lets a renewed organisation look again without signing out", async () => {
    status.subscription = { state: "expired", blocked: true, canRead: false, canWrite: false, endsAt: "2026-10-10T23:59:59.999Z", reason: "ended" };
    renderAt("/sales-order");
    await screen.findByRole("heading", { name: "Your subscription has ended" });
    status = base(); // renewed
    fireEvent.click(screen.getByRole("button", { name: /Check again/ }));
    expect(await screen.findByText("the page itself")).toBeInTheDocument();
  });
});
