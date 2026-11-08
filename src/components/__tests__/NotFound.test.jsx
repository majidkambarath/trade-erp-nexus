import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotFound from "../NotFound";
import { PRODUCT_NAME } from "../../config/product";

// The page a mistyped address lands on. It carried the retired product name and three controls that
// did not work; each of those is pinned here so none of them can come back.
const at = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>
  );

describe("the page that is not found", () => {
  it("names the product, and never the name the product used to have", () => {
    const { container } = at("/nowhere");
    expect(screen.getByText(PRODUCT_NAME)).toBeInTheDocument();
    // The whole reason this file exists: a live client was shown "Trade ERP" on a 404.
    expect(container.textContent).not.toMatch(/Trade ERP/i);
  });

  it("shows the address that was not found, so a typo can be seen", () => {
    at("/plafrom");
    expect(screen.getByText("/plafrom")).toBeInTheDocument();
  });

  it("offers the dashboard, and asks nothing about whether anyone is signed in", () => {
    at("/nowhere");
    // RequireSession decides that: signed in it lets them through, signed out it sends them to sign
    // in with ?next=/dashboard. A check made here would read "signed out" in a freshly opened tab.
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute("href", "/dashboard");
  });

  it("offers a way back", () => {
    at("/nowhere");
    expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
  });

  it("links to no page that does not exist", () => {
    const { container } = at("/nowhere");
    // "Get Help" pointed at /help-center, which the catch-all caught - the button drew this very page again.
    expect(container.querySelector('a[href="/help-center"]')).toBeNull();
    for (const a of container.querySelectorAll("a[href]")) {
      expect(a.getAttribute("href")).toBe("/dashboard");
    }
  });

  it("moves nobody on a timer", () => {
    const { container } = at("/nowhere");
    // A <meta http-equiv="refresh"> in the body reloaded the page at the sign-in screen while the
    // text promised the dashboard, taking the person away before they could read the address.
    expect(container.querySelector("meta")).toBeNull();
    expect(container.textContent).not.toMatch(/second/i);
  });

  it("paints with theme tokens, so it is readable in both themes", () => {
    const { container } = at("/nowhere");
    const markup = container.innerHTML;
    // It was white text on hard-coded greys: unreadable on the light theme.
    expect(markup).not.toMatch(/\btext-white\b|\bbg-gray-|\btext-gray-/);
    expect(markup).toMatch(/\bbg-card\b/);
  });
});
