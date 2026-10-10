import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import Layout from "../../Layout";
import { getAccessToken, setSession } from "../../../axios/session";

vi.mock("../../../axios/axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { success: true, data: { name: "Super Admin", email: "admin@test.uae" } },
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
  signOutLocally: async () => (await import("../../../axios/session")).clearSession(),
}));

beforeAll(() => {
  // jsdom implements neither; every supported browser does. cmdk measures its list with
  // ResizeObserver, and cmdk and ModuleTabs scroll the selected item into view.
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  sessionStorage.clear();
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const renderAt = (url) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/" element={<p>login page</p>} />
          <Route element={<Layout />}>
            <Route path="*" element={<Where />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

const rail = () => screen.getByRole("navigation", { name: "Main" });

describe("rail", () => {
  it("labels every module instead of showing icons only", () => {
    renderAt("/dashboard");
    const labels = within(rail()).getAllByRole("link").map((a) => a.textContent.trim());
    expect(labels).toEqual(
      expect.arrayContaining(["Home", "Sales", "Purchase", "Inventory", "Finance", "Accounts", "Reports", "People", "Settings"])
    );
  });

  it("marks the module that owns a detail route as current", () => {
    renderAt("/stock-detail/abc123");
    const current = within(rail()).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent.trim())).toEqual(["Inventory"]);
  });

  it("does not use native title tooltips", () => {
    renderAt("/dashboard");
    for (const link of within(rail()).getAllByRole("link")) {
      expect(link).not.toHaveAttribute("title");
    }
  });
});

describe("accounts section", () => {
  it("has its own place in the rail, holding the chart of accounts, the bank and card masters, and the setup", () => {
    renderAt("/chart-of-accounts");
    const current = within(rail()).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent.trim())).toEqual(["Accounts"]);
    const tabs = screen.getByRole("navigation", { name: "Accounts" });
    expect(within(tabs).getAllByRole("link").map((a) => a.textContent)).toEqual(["Chart of accounts", "Banks", "KYC documents", "Card types", "Cards", "Opening balances", "Currencies", "Setup"]);
    expect(within(tabs).getByRole("link", { name: "Chart of accounts" })).toHaveAttribute("aria-current", "page");
  });

  it("is reachable from the command palette by the words people use", async () => {
    renderAt("/dashboard");
    act(() => { fireEvent.keyDown(window, { key: "k", ctrlKey: true }); });
    const dialog = await screen.findByRole("dialog", { name: "Go to page" });
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "liabilities" } });
    await waitFor(() => expect(within(dialog).getByRole("option", { name: /Chart of accounts/ })).toBeInTheDocument());
  });
});

describe("module tabs", () => {
  it("shows the active module's pages with the current one marked", () => {
    renderAt("/payment-voucher");
    const tabs = screen.getByRole("navigation", { name: "Finance" });
    const links = within(tabs).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      "Receipts", "Payments", "Journal", "Contra", "Expenses", "Notes", "Cheques", "Cash & bank", "Reconcile", "Ledger",
    ]);
    expect(within(tabs).getByRole("link", { name: "Payments" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the list tab current on its detail page", () => {
    renderAt("/debit-accounts/vendor/v1");
    const tabs = screen.getByRole("navigation", { name: "Purchase" });
    expect(within(tabs).getByRole("link", { name: "Payables" })).toHaveAttribute("aria-current", "page");
  });

  it("is omitted for single-page modules", () => {
    // (Home has two pages now - the Dashboard and Approvals - so Settings is the module with one)
    renderAt("/settings");
    expect(screen.queryByRole("navigation", { name: "Settings" })).toBeNull();
  });

  it("Home is the Dashboard and Approvals", () => {
    renderAt("/dashboard");
    const tabs = screen.getByRole("navigation", { name: "Home" });
    expect(within(tabs).getAllByRole("link").map((a) => a.textContent)).toEqual(["Dashboard", "Approvals"]);
  });

  it("sets a readable document title", () => {
    renderAt("/payment-voucher");
    expect(document.title).toBe("Payments · Finance · Zarvia");
  });
});

describe("command palette", () => {
  const openWithShortcut = () =>
    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });

  it("opens with Ctrl+K and finds a page by its old name", async () => {
    renderAt("/dashboard");
    openWithShortcut();
    const dialog = await screen.findByRole("dialog", { name: "Go to page" });
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "debit accounts" } });
    await waitFor(() => {
      expect(within(dialog).getByRole("option", { name: /Payables/ })).toBeInTheDocument();
    });
  });

  // "suppliers" appears only in the tab's keywords - not in its label ("Vendors") and not
  // in its URL. This failed before: keywords were passed to cmdk as a prop its default
  // filter never scores against, so every alias silently matched nothing.
  it("finds a page by a keyword that is in neither its label nor its URL", async () => {
    renderAt("/dashboard");
    openWithShortcut();
    const dialog = await screen.findByRole("dialog", { name: "Go to page" });
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "suppliers" } });
    await waitFor(() => {
      expect(within(dialog).getByRole("option", { name: /Vendors/ })).toBeInTheDocument();
    });
  });

  it("navigates to the chosen page and closes", async () => {
    renderAt("/dashboard");
    openWithShortcut();
    const dialog = await screen.findByRole("dialog", { name: "Go to page" });
    fireEvent.click(within(dialog).getByRole("option", { name: /^Payments/ }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/payment-voucher"));
    expect(screen.queryByRole("dialog", { name: "Go to page" })).toBeNull();
  });

  it("closes on Escape", async () => {
    renderAt("/dashboard");
    openWithShortcut();
    const dialog = await screen.findByRole("dialog", { name: "Go to page" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Go to page" })).toBeNull());
  });
});

describe("account menu", () => {
  it("shows the signed-in user and logs out", async () => {
    setSession({ accessToken: "token", admin: { id: "1" } });
    renderAt("/dashboard");
    const trigger = await screen.findByRole("button", { name: "Account menu for Super Admin" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const logout = await screen.findByRole("menuitem", { name: /Log out/ });
    expect(screen.getByText("admin@test.uae")).toBeInTheDocument();
    fireEvent.click(logout);
    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
    expect(getAccessToken()).toBeNull();
  });
});

// The touch shell. jsdom has no viewport, so these assert the structure and behaviour that
// the lg:hidden / lg:flex classes then reveal at the right width - not the widths themselves.
describe("bottom bar", () => {
  const bar = () => screen.getByRole("navigation", { name: "Modules" });

  it("pins four modules plus More within thumb reach", () => {
    renderAt("/dashboard");
    const labels = within(bar()).getAllByRole("link").map((a) => a.textContent.trim());
    expect(labels).toEqual(["Home", "Sales", "Purchase", "Finance"]);
    expect(within(bar()).getByRole("button", { name: /More/ })).toBeTruthy();
  });

  it("marks the module the current page belongs to", () => {
    renderAt("/receipt-voucher");
    const current = within(bar()).getByRole("link", { current: "page" });
    expect(current.textContent.trim()).toBe("Finance");
  });

  it("is hidden from the desktop breakpoint up, where the rail takes over", () => {
    renderAt("/dashboard");
    expect(bar().className).toContain("lg:hidden");
    expect(rail().className).toContain("lg:flex");
  });

  it("opens the sheet with everything that did not fit, one level deep", async () => {
    renderAt("/dashboard");
    fireEvent.click(within(bar()).getByRole("button", { name: /More/ }));
    const sheet = await screen.findByRole("dialog");
    const pages = within(sheet).getAllByRole("link").map((a) => a.textContent.trim());
    // a page from a module that is not on the bar, and the footer module
    expect(pages).toEqual(expect.arrayContaining(["Stock Items", "Chart of accounts", "Settings"]));
    // nothing from a pinned module is repeated in the sheet
    expect(pages).not.toContain("Receipts");
  });

  it("keeps the More button marked while a sheet page is the current one", () => {
    renderAt("/chart-of-accounts");
    expect(within(bar()).getByRole("button", { name: /More/ }).className).toContain("text-brand");
  });

  it("dismisses the sheet once a page is chosen", async () => {
    renderAt("/dashboard");
    fireEvent.click(within(bar()).getByRole("button", { name: /More/ }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("link", { name: "Stock Items" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("where").textContent).toBe("/stock-item-creation");
  });

  it("closes the sheet if the window grows to desktop width, so its focus trap cannot outlive it", async () => {
    renderAt("/dashboard");
    fireEvent.click(within(bar()).getByRole("button", { name: /More/ }));
    await screen.findByRole("dialog");
    act(() => {
      window.innerWidth = 1280;
      window.dispatchEvent(new Event("resize"));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("touch chrome", () => {
  it("has no hamburger: navigation is the bar, not a drawer behind a menu", () => {
    renderAt("/dashboard");
    expect(screen.queryByRole("button", { name: /open navigation/i })).toBeNull();
  });

  it("keeps the header and the tab strip clear of the notch and lets the strip scroll", () => {
    renderAt("/receipt-voucher");
    expect(document.querySelector("header").className).toContain("pt-safe");
    expect(screen.getByRole("navigation", { name: "Finance" }).className).toContain("overflow-x-auto");
  });
});
