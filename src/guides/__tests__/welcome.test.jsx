import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { journeysFor, JOURNEYS } from "../journeys";
import { FLOWS } from "../index";

const org = vi.hoisted(() => ({ current: null }));
vi.mock("../../components/shell/OrganisationContext", () => ({ useOrganisation: () => org.current }));
import { GuideProvider } from "../GuideProvider";

const everyone = () => true;
const mount = () => render(<MemoryRouter initialEntries={["/dashboard"]}><GuideProvider><div>app</div></GuideProvider></MemoryRouter>);

describe("journeys", () => {
  it("only name guides that exist", () => {
    for (const j of JOURNEYS) for (const id of j.guides) expect(FLOWS.some((f) => f.id === id), `${j.id}: ${id}`).toBe(true);
  });
  it("start at the first guide the person may run, and leave out a journey they cannot do at all", () => {
    const sales = journeysFor(FLOWS.filter((f) => f.permission === "sales.create"));
    expect(sales.find((j) => j.id === "sell").first).toBe("create-quotation");
    expect(sales.some((j) => j.id === "buy")).toBe(false);
    expect(journeysFor([])).toEqual([]);
  });
  it("skip a guide the plan does not include, so a journey never starts on a dead end", () => {
    const noQuotes = FLOWS.filter((f) => f.id !== "create-quotation");
    expect(journeysFor(noQuotes).find((j) => j.id === "sell").first).toBe("create-sales-order");
  });
});

describe("the welcome", () => {
  beforeEach(() => { window.localStorage.clear(); org.current = { status: { me: { id: "u1" } }, mayUse: everyone }; });

  it("asks a new person what to do first and starts the journey they pick, once", async () => {
    mount();
    await screen.findByText("Welcome! What do you want to do first?");
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(document.querySelector('[data-journey="sell"]'));
    await waitFor(() => expect(document.querySelector("[data-guide-overlay]")).toBeTruthy());
    expect(document.querySelector("[data-guide-welcome]")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("zarvia.prefs.u1")).display.guideWelcomed).toBe(true);
  });

  it("lets them say not now, and does not ask again", async () => {
    const first = mount();
    await screen.findByText("Welcome! What do you want to do first?");
    fireEvent.click(document.querySelector("[data-welcome-later]"));
    expect(document.querySelector("[data-guide-welcome]")).toBeNull();
    first.unmount();
    mount();
    await new Promise((r) => setTimeout(r, 150));
    expect(document.querySelector("[data-guide-welcome]")).toBeNull();
  });

  it("offers only what their role and plan allow", async () => {
    org.current = { status: { me: { id: "u1" } }, mayUse: (p) => p === "purchase.create" };
    mount();
    await screen.findByText("Welcome! What do you want to do first?");
    expect(document.querySelector('[data-journey="buy"]')).toBeTruthy();
    expect(document.querySelector('[data-journey="sell"]')).toBeNull();
  });

  it("never covers the screen where they must change their password first, or has nothing to offer", async () => {
    org.current = { status: { me: { id: "u1", mustChangePassword: true } }, mayUse: everyone };
    const a = mount();
    await new Promise((r) => setTimeout(r, 150));
    expect(document.querySelector("[data-guide-welcome]")).toBeNull();
    a.unmount();
    org.current = { status: { me: { id: "u1" } }, mayUse: () => false };
    mount();
    await new Promise((r) => setTimeout(r, 150));
    expect(document.querySelector("[data-guide-welcome]")).toBeNull();
  });

  it("does not welcome someone who has already finished a guide", async () => {
    window.localStorage.setItem("zarvia.prefs.u1", JSON.stringify({ display: { "guideDone.add-customer": true }, views: {} }));
    mount();
    await new Promise((r) => setTimeout(r, 150));
    expect(document.querySelector("[data-guide-welcome]")).toBeNull();
  });
});
