import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import Layout from "../../Layout";
import { BLOCKED_EVENT, BRANCH_RESET_EVENT } from "../../../lib/organisation";
import { getSelectedBranch, setSelectedBranch } from "../../../axios/session";

// The shell as an organisation sees it: its own name in the bar, only the screens its plan includes, a notice before
// the subscription ends, and one page that says why when it has ended. What the status route answers is set per test.
let status; // the status route's answer, or a function of the branch the request names (X-Branch), as the server decides it
const statusReads = []; // the branch each read of the status carried, in order (what the axios interceptor would send as X-Branch)
let putPassword = () => Promise.resolve({ data: { success: true } });
vi.mock("../../../axios/axios", () => ({
  default: {
    get: vi.fn((url) => {
      if (url !== "/organisation/status") return Promise.resolve({ data: { success: true, data: { name: "Super Admin", email: "admin@test.uae" } } });
      statusReads.push(getSelectedBranch());
      const answer = typeof status === "function" ? status(getSelectedBranch()) : status;
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ data: { success: true, data: answer } });
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    put: (...args) => putPassword(...args),
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
  statusReads.length = 0;
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
    expect(screen.getByText("It ended on 10/10/2026.")).toBeInTheDocument(); // as the person reads dates (the default is DD/MM/YYYY)
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

// A person whose role differs by branch (the server says `branch.canViewAll: false`) works in one branch at a time, so there is
// no "All branches" for them; a branch person given a role in other branches is offered exactly those branches.
describe("working in one branch at a time", () => {
  const main = { code: "main", name: "Head office", isHeadOffice: true };
  const shj = { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false };
  const dxb = { code: "dxb", name: "Dubai Depot", isHeadOffice: false };
  const menuItems = async (trigger) => {
    fireEvent.keyDown(trigger, { key: "Enter" });
    return (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
  };
  // a head-office manager who is only a viewer in Sharjah
  const headOfficeByBranch = (canViewAll) => ({ ...base(), branches: [main, shj, dxb], branch: { code: "main", name: "Head office", isHeadOffice: true, canSwitch: true, canViewAll } });

  it("does not offer All branches, and names the branch in use", async () => {
    status = headOfficeByBranch(false);
    renderAt("/sales-order");
    const trigger = await screen.findByRole("button", { name: /Branch: Head office/ });
    expect(await menuItems(trigger)).toEqual(["Head office", "Sharjah Warehouse", "Dubai Depot"]);
    expect(screen.queryByRole("menuitem", { name: /All branches/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Branch: All branches/ })).toBeNull();
  });

  it("offers All branches to the same person when their role is the same everywhere, and to an older server's answer", async () => {
    for (const canViewAll of [true, undefined]) {
      status = headOfficeByBranch(canViewAll);
      const { unmount } = renderAt("/sales-order");
      const trigger = await screen.findByRole("button", { name: /Branch: All branches/ });
      expect(await menuItems(trigger)).toEqual(["All branches", "Head office", "Sharjah Warehouse", "Dubai Depot"]);
      unmount();
    }
  });

  it("falls back to the branch the server put them in, quietly, when what was remembered is a view they no longer have", async () => {
    setSelectedBranch("all");
    status = headOfficeByBranch(false);
    renderAt("/sales-order");
    expect(await screen.findByRole("button", { name: /Branch: Head office/ })).toBeInTheDocument();
    await waitFor(() => expect(getSelectedBranch()).toBeNull());
    expect(screen.getByText("the page itself")).toBeInTheDocument(); // no error screen, no blocked page
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps a remembered branch that is one of theirs", async () => {
    setSelectedBranch("shj");
    status = headOfficeByBranch(false);
    renderAt("/sales-order");
    expect(await screen.findByRole("button", { name: /Branch: Sharjah Warehouse/ })).toBeInTheDocument();
    expect(getSelectedBranch()).toBe("shj");
  });

  it("offers a branch person exactly the branches they were given, and reads the status again with the new branch so its role applies at once", async () => {
    const OPERATOR = { id: "u-clerk", name: "Clerk", role: { key: "operator", name: "Operator", rank: 40 }, grants: ["accounts.view", "sales.view", "lookups.view"] };
    const VIEWER = { id: "u-clerk", name: "Clerk", role: { key: "viewer", name: "Viewer", rank: 20 }, grants: ["sales.view", "lookups.view"] };
    // what the server answers: the role and the branch for the one named in X-Branch (nothing named: their own, Sharjah)
    status = (named) => ({
      ...base(),
      branches: [shj, dxb],
      branch: { code: named || "shj", name: named === "dxb" ? "Dubai Depot" : "Sharjah Warehouse", isHeadOffice: false, canSwitch: true, canViewAll: false },
      me: named === "dxb" ? VIEWER : OPERATOR,
    });
    renderAt("/chart-of-accounts"); // needs accounts.view: the operator holds it in Sharjah
    expect(await screen.findByText("the page itself")).toBeInTheDocument();
    const trigger = await screen.findByRole("button", { name: /Branch: Sharjah Warehouse/ });
    expect(await menuItems(trigger)).toEqual(["Sharjah Warehouse", "Dubai Depot"]);

    const readsBefore = statusReads.length;
    fireEvent.click(screen.getByRole("menuitem", { name: /Dubai Depot/ }));
    expect(getSelectedBranch()).toBe("dxb"); // from now on every request carries X-Branch: dxb
    await waitFor(() => expect(statusReads.length).toBeGreaterThan(readsBefore));
    expect(statusReads.at(-1)).toBe("dxb"); // and the status read that followed carried it
    // the viewer role of Dubai applies now, with no reload: the page the operator could open is refused
    expect(await screen.findByText("You do not have access to this page")).toBeInTheDocument();
    expect(screen.getByText(/Your role \(Viewer\) does not include it/)).toBeInTheDocument();
    expect(screen.queryByText("the page itself")).toBeNull();
    expect(await screen.findByRole("button", { name: /Branch: Dubai Depot/ })).toBeInTheDocument();

    // and back: the operator's own role is theirs again in Sharjah
    fireEvent.keyDown(screen.getByRole("button", { name: /Branch: Dubai Depot/ }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Sharjah Warehouse/ }));
    expect(await screen.findByText("the page itself")).toBeInTheDocument();
    expect(statusReads.at(-1)).toBe("shj");
  });

  it("starts again from the person's own branch when the request layer reports that the remembered one was refused", async () => {
    // the person was given Dubai, chose it, and then lost it: every request naming it is refused, so the request layer forgets it
    // and tells the shell (axios/__tests__/branchRefusal.test.js); the shell reads the status again, without the branch
    const OPERATOR = { id: "u-clerk", name: "Clerk", role: { key: "operator", name: "Operator", rank: 40 }, grants: ["sales.view", "lookups.view"] };
    const VIEWER = { id: "u-clerk", name: "Clerk", role: { key: "viewer", name: "Viewer", rank: 20 }, grants: ["sales.view", "lookups.view"] };
    status = (named) => ({
      ...base(),
      branches: [shj, dxb],
      branch: { code: named || "shj", name: named === "dxb" ? "Dubai Depot" : "Sharjah Warehouse", isHeadOffice: false, canSwitch: true, canViewAll: false },
      me: named === "dxb" ? VIEWER : OPERATOR,
    });
    setSelectedBranch("dxb");
    renderAt("/sales-order");
    expect(await screen.findByRole("button", { name: /Branch: Dubai Depot/ })).toBeInTheDocument();

    setSelectedBranch(null); // what the interceptor does before it announces
    const before = statusReads.length;
    window.dispatchEvent(new CustomEvent(BRANCH_RESET_EVENT));
    await waitFor(() => expect(statusReads.length).toBeGreaterThan(before));
    expect(statusReads.at(-1)).toBeNull();
    expect(await screen.findByRole("button", { name: /Branch: Sharjah Warehouse/ })).toBeInTheDocument();
    expect(screen.getByText("the page itself")).toBeInTheDocument();
  });

  it("shows a plain label, not a switcher, to a branch person who was given no other branch", async () => {
    status = { ...base(), branches: [shj], branch: { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false, canSwitch: false, canViewAll: false } };
    renderAt("/sales-order");
    expect(await screen.findByText("Sharjah Warehouse")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change branch/ })).toBeNull();
  });
});

describe("what the person's role may open", () => {
  const SALES = { role: { key: "sales", name: "Sales executive", rank: 40 }, grants: ["sales.view", "sales.create", "sales.edit", "sales.send", "inventory.view", "lookups.view", "reports.view"] };

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

describe("a password someone else set", () => {
  const me = (mustChangePassword) => ({ name: "Nadia", role: { key: "sales", name: "Sales executive", rank: 40 }, grants: ["sales.view"], mustChangePassword });
  const typeInto = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const submit = () => {
    typeInto(/^Password you signed in with/, "temporary-1");
    typeInto(/^New password/, "my-own-password-1");
    typeInto(/^Confirm new password/, "my-own-password-1");
    fireEvent.click(screen.getByRole("button", { name: "Save my password" }));
  };

  beforeEach(() => {
    putPassword = () => Promise.resolve({ data: { success: true } });
  });

  it("replaces the whole app with the page that asks for a password of their own, whatever page was typed", async () => {
    status = { ...base(), me: me(true) };
    renderAt("/sales-order");
    expect(await screen.findByRole("heading", { name: "Choose your own password" })).toBeInTheDocument();
    expect(screen.getByText(/Nadia, the password you signed in with/)).toBeInTheDocument();
    expect(screen.queryByText("the page itself")).toBeNull();
    expect(screen.queryByRole("link", { name: "Quotations" })).toBeNull();
    expect(screen.queryByText("Acme Trading LLC")).toBeNull();
  });

  it("stays on that page, with the server's words, when the password is refused", async () => {
    status = { ...base(), me: me(true) };
    putPassword = () => Promise.reject({ response: { data: { message: "Current password is incorrect" } } });
    renderAt("/sales-order");
    await screen.findByRole("heading", { name: "Choose your own password" });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
    expect(screen.queryByText("the page itself")).toBeNull();
  });

  it("opens the app on the same page once the new password is saved, without signing in again", async () => {
    status = { ...base(), me: me(true) };
    putPassword = vi.fn(() => {
      status = { ...base(), me: me(false) }; // the server clears the flag when it saves
      return Promise.resolve({ data: { success: true } });
    });
    renderAt("/sales-order");
    await screen.findByRole("heading", { name: "Choose your own password" });
    submit();
    expect(await screen.findByText("the page itself")).toBeInTheDocument();
    expect(putPassword).toHaveBeenCalledWith("/profile/change-password", { currentPassword: "temporary-1", newPassword: "my-own-password-1", confirmPassword: "my-own-password-1" });
    expect(screen.queryByRole("heading", { name: "Choose your own password" })).toBeNull();
  });

  it("does not interrupt a person whose password is their own", async () => {
    status = { ...base(), me: me(false) };
    renderAt("/sales-order");
    expect(await screen.findByText("the page itself")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Choose your own password" })).toBeNull();
  });
});
