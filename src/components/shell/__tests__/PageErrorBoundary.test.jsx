import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import Layout from "../../Layout";
import PageErrorBoundary from "../PageErrorBoundary";
import { isStaleBuildError } from "../../../lib/staleBuild";

vi.mock("../../../axios/axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: { name: "Super Admin", email: "admin@test.uae" } } }),
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

// React logs every caught render error to the console; the page crashing is the point here
let consoleError;
beforeEach(() => {
  sessionStorage.clear();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

function Broken({ message = "Cannot read properties of undefined (reading 'total')" }) {
  throw new Error(message);
}

describe("PageErrorBoundary", () => {
  it("shows a plain message with a way out instead of a blank window", () => {
    render(
      <PageErrorBoundary>
        <Broken />
      </PageErrorBoundary>
    );
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Something went wrong on this page")).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
    // the technical reason is there for whoever supports the app, folded away for everyone else
    expect(within(alert).getByText("Technical details")).toBeInTheDocument();
    expect(within(alert).getByText(/reading 'total'/)).toBeInTheDocument();
  });

  it("logs the failure so it can be found afterwards", () => {
    render(
      <PageErrorBoundary>
        <Broken />
      </PageErrorBoundary>
    );
    expect(consoleError.mock.calls.some((c) => String(c[0]).includes("Page crashed:"))).toBe(true);
  });

  it("renders its children untouched when nothing is wrong", () => {
    render(
      <PageErrorBoundary>
        <p>all good</p>
      </PageErrorBoundary>
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reloads the page on the button", () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { value: { ...original, reload }, configurable: true });
    render(
      <PageErrorBoundary>
        <Broken />
      </PageErrorBoundary>
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload page" }));
    expect(reload).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, "location", { value: original, configurable: true });
  });

  it("calls a missing page file a new version, not a fault", () => {
    render(
      <PageErrorBoundary>
        <Broken message="Failed to fetch dynamically imported module: https://app/assets/Sales-abc123.js" />
      </PageErrorBoundary>
    );
    expect(screen.getByText("A newer version is available")).toBeInTheDocument();
    expect(screen.queryByText("Technical details")).toBeNull();
    expect(screen.queryByRole("link", { name: "Go to dashboard" })).toBeNull();
  });

  it("recognises the wording every browser uses for it", () => {
    for (const message of [
      "Failed to fetch dynamically imported module: x.js",
      "error loading dynamically imported module",
      "Importing a module script failed.",
      "Loading chunk 12 failed.",
    ]) {
      expect(isStaleBuildError(new Error(message))).toBe(true);
    }
    expect(isStaleBuildError(new Error("x is not a function"))).toBe(false);
    expect(isStaleBuildError(undefined)).toBe(false);
  });

  it("clears when the route changes, so the next page gets a fresh start", () => {
    const view = (key, broken) => (
      <PageErrorBoundary resetKey={key}>{broken ? <Broken /> : <p>second page</p>}</PageErrorBoundary>
    );
    const { rerender } = render(view("/first", true));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(view("/second", false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("second page")).toBeInTheDocument();
  });
});

describe("inside the shell", () => {
  const renderAt = (url) =>
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/broken" element={<Broken />} />
              <Route path="/dashboard" element={<p>dashboard page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    );

  it("keeps the rail up when a page breaks, and the next page opens normally", () => {
    renderAt("/broken");
    expect(screen.getByText("Something went wrong on this page")).toBeInTheDocument();
    const rail = screen.getByRole("navigation", { name: "Main" });
    fireEvent.click(within(rail).getAllByRole("link", { name: "Home" })[0]);
    expect(screen.queryByText("Something went wrong on this page")).toBeNull();
    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });
});
