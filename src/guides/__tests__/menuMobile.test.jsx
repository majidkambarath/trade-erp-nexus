import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../guideContext", () => ({
  useGuides: () => ({ flows: [{ id: "add-customer", steps: [{ kind: "go", to: "/x" }], minutes: 2 }], start: () => {}, done: () => false, table: null, active: null, resumable: null, resume: () => {} }),
}));
import GuideMenu from "../GuideMenu";

describe("the Guide me panel on a phone", () => {
  it("is pinned to the screen's edges below sm, so it can never run off the left side", () => {
    render(<MemoryRouter><GuideMenu /></MemoryRouter>);
    const panel = screen.getByRole("dialog", { hidden: true });
    // the button sits at the right of the phone header: an absolute 22rem panel anchored to it overflowed to x < 0
    expect(panel.className).toMatch(/\bfixed\b/);
    expect(panel.className).toMatch(/inset-x-2/);
    expect(panel.className).toMatch(/sm:absolute/);
  });
});
