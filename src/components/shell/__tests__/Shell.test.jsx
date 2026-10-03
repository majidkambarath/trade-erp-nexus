import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import Layout from "../../Layout";

vi.mock("../../../axios/axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { success: true, data: { name: "Super Admin", email: "admin@test.uae" } },
    }),
  },
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
      expect.arrayContaining(["Home", "Sales", "Purchase", "Inventory", "Finance", "Reports", "People", "Settings"])
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

describe("module tabs", () => {
  it("shows the active module's pages with the current one marked", () => {
    renderAt("/payment-voucher");
    const tabs = screen.getByRole("navigation", { name: "Finance" });
    const links = within(tabs).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      "Receipts", "Payments", "Journal", "Contra", "Expenses", "Ledger", "Accounts",
    ]);
    expect(within(tabs).getByRole("link", { name: "Payments" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the list tab current on its detail page", () => {
    renderAt("/debit-accounts/vendor/v1");
    const tabs = screen.getByRole("navigation", { name: "Purchase" });
    expect(within(tabs).getByRole("link", { name: "Payables" })).toHaveAttribute("aria-current", "page");
  });

  it("is omitted for single-page modules", () => {
    renderAt("/dashboard");
    expect(screen.queryByRole("navigation", { name: "Home" })).toBeNull();
  });

  it("sets a readable document title", () => {
    renderAt("/payment-voucher");
    expect(document.title).toBe("Payments · Finance · NH FOODS");
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
    sessionStorage.setItem("accessToken", "token");
    renderAt("/dashboard");
    const trigger = await screen.findByRole("button", { name: "Account menu for Super Admin" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const logout = await screen.findByRole("menuitem", { name: /Log out/ });
    expect(screen.getByText("admin@test.uae")).toBeInTheDocument();
    fireEvent.click(logout);
    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
    expect(sessionStorage.getItem("accessToken")).toBeNull();
  });
});
