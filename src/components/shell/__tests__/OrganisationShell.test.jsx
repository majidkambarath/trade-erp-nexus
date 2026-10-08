import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import Layout from "../../Layout";
import { BLOCKED_EVENT } from "../../../lib/organisation";
import { getSelectedBranch, setSelectedBranch } from "../../../axios/session";

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
  setSelectedBranch(null);
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

describe("working in a branch", () => {
  const branches = [
    { code: "main", name: "Head office", isHeadOffice: true },
    { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false },
  ];

  it("names the head office for an organisation with one branch, and offers no choice", async () => {
    status = { ...base(), branches: [branches[0]], branch: { code: "main", name: "Head office", isHeadOffice: true, canSwitch: false } };
    renderAt("/sales-order");
    await screen.findByText("Acme Trading LLC");
    expect(await screen.findByText("Head office")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change branch/ })).toBeNull();
  });

  it("lets a head-office user choose a branch, remembers it for the tab and starts the page afresh", async () => {
    status = { ...base(), branches, branch: { code: "main", name: "Head office", isHeadOffice: true, canSwitch: true } };
    renderAt("/sales-order");
    const trigger = await screen.findByRole("button", { name: /Branch: All branches/ });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Sharjah Warehouse/ }));
    expect(getSelectedBranch()).toBe("shj");
    expect(await screen.findByRole("button", { name: /Branch: Sharjah Warehouse/ })).toBeInTheDocument();
  });

  it("names a branch user's own branch and offers no choice", async () => {
    status = { ...base(), branches, branch: { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false, canSwitch: false } };
    renderAt("/sales-order");
    expect(await screen.findByText("Sharjah Warehouse")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change branch/ })).toBeNull();
  });

  it("forgets a remembered branch the person can no longer choose", async () => {
    setSelectedBranch("gone");
    status = { ...base(), branches, branch: { code: "main", name: "Head office", isHeadOffice: true, canSwitch: true } };
    renderAt("/sales-order");
    await screen.findByRole("button", { name: /Branch: All branches/ });
    await waitFor(() => expect(getSelectedBranch()).toBeNull());
  });
});

describe("what the person's role may open", () => {
  const SALES = { role: { key: "sales", name: "Sales executive", rank: 40 }, grants: ["sales.view", "sales.create", "sales.send", "inventory.view", "lookups.view", "reports.view"] };

  it("offers a sales executive their sales pages and no Finance", async () => {
    status = { ...base(), me: SALES };
    renderAt("/sales-order");
    expect(await screen.findByRole("link", { name: "Quotations" })).toBeInTheDocument();
    expect(screen.getByText("the page itself")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("link", { name: /Finance/ })).toBeNull());
    expect(screen.queryByRole("link", { name: "Receivables" })).toBeNull();
  });

  it("says plainly, in place of the page, when a typed address is one their role does not include, and offers a way out", async () => {
    status = { ...base(), me: SALES };
    renderAt("/chart-of-accounts");
    expect(await screen.findByText("You do not have access to this page")).toBeInTheDocument();
    expect(screen.getByText(/Your role \(Sales executive\) does not include it/)).toBeInTheDocument();
    expect(screen.queryByText("the page itself")).toBeNull();
    const out = screen.getByRole("link", { name: /Go to a page you can open/ });
    expect(out.getAttribute("href")).toBeTruthy();
  });

  it("opens a page the role does hold, and the plan message wins when the plan is the reason", async () => {
    status = { ...base(), me: SALES };
    renderAt("/e-invoicing"); // sales.view opens it, but this plan has no e-invoicing
    expect(await screen.findByText("E-invoicing is not included in your plan")).toBeInTheDocument();
  });

  it("gives a person who holds nothing the pages open to everyone, and still a way out", async () => {
    status = { ...base(), me: { role: { key: "lead", name: "Lead" }, grants: [] } };
    renderAt("/dashboard");
    expect(await screen.findByText("You do not have access to this page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to a page you can open/ }).getAttribute("href")).toBe("/settings");
  });

  it("hides nothing when the status carries no role, and the page opens", async () => {
    renderAt("/chart-of-accounts");
    expect(await screen.findByText("the page itself")).toBeInTheDocument();
  });
});
