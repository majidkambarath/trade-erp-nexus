import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GuideContext } from "../../../guides/guideContext";
import en from "../../../guides/i18n/en";

vi.mock("../../../axios/axios", () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: { steps: [{ id: "customer", guide: "add-customer", done: true }, { id: "vendor", guide: "add-vendor", done: false }] } } })) },
}));
import LearnPage from "../LearnPage";

const flow = (id) => ({ id, minutes: 2, steps: [] });
const ctx = (over = {}) => ({
  flows: [flow("add-customer"), flow("add-vendor"), flow("read-dashboard")],
  start: vi.fn(), done: (id) => id === "add-customer", table: en, active: null, lang: "en", setLang: vi.fn(), ...over,
});
const view = (c) => render(<GuideContext.Provider value={c}><LearnPage /></GuideContext.Provider>);

describe("Learn page", () => {
  it("lists the guides by area with progress and starts one", () => {
    const c = ctx(); view(c);
    expect(screen.getByText("1 of 3 done")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Start guide: Add a vendor/ }));
    expect(c.start).toHaveBeenCalledWith("add-vendor");
  });
  it("filters by search and says when nothing matches", () => {
    view(ctx());
    fireEvent.change(screen.getByLabelText("Search guides"), { target: { value: "zzzz" } });
    expect(screen.getByText(/No guide matches/)).toBeTruthy();
  });
  it("changes the guide language", () => {
    const c = ctx(); view(c);
    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    expect(c.setLang).toHaveBeenCalledWith("ar");
  });
  it("shows the first-steps checklist from the books, with a start only on what is not done", async () => {
    view(ctx());
    await waitFor(() => expect(screen.getByText("Your first steps")).toBeTruthy());
    const list = screen.getByText("Your first steps").closest("section");
    expect(list.querySelectorAll("button").length).toBe(1); // only the vendor step is still to do
  });
});
