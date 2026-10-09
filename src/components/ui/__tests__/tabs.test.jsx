import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tabs, TabsList, TabsTrigger } from "../tabs";

// A row of tabs that does not fit scrolls sideways. A CENTRED row that overflows spills to both sides, which leaves the first
// tabs cut off and impossible to scroll to (on a phone, Settings -> Company and Branches were unreachable). jsdom has no layout,
// so this pins the cause: the list starts at its left edge and scrolls, and every tab is in it.
describe("a row of tabs on a narrow screen", () => {
  const renderTabs = () =>
    render(
      <Tabs defaultValue="a">
        <TabsList>
          {["a", "b", "c", "d", "e", "f", "g"].map((v) => <TabsTrigger key={v} value={v}>{`Tab ${v}`}</TabsTrigger>)}
        </TabsList>
      </Tabs>
    );

  it("starts at its left edge, so the first tabs can always be reached", () => {
    renderTabs();
    const list = screen.getByRole("tablist");
    expect(list.className).toMatch(/\bjustify-start\b/);
    expect(list.className).not.toMatch(/\bjustify-center\b/);
  });

  it("scrolls inside itself rather than making the page wider", () => {
    renderTabs();
    const list = screen.getByRole("tablist");
    expect(list.className).toMatch(/\boverflow-x-auto\b/);
    expect(list.className).toMatch(/\bmax-w-full\b/);
    expect(list.className).toMatch(/\bw-fit\b/);
  });

  it("holds every tab, the first included", () => {
    renderTabs();
    expect(screen.getAllByRole("tab")).toHaveLength(7);
    expect(screen.getByRole("tab", { name: "Tab a" })).toHaveAttribute("aria-selected", "true");
  });
});
