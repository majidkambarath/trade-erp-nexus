import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, configure } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// A half-finished "add staff member" survives leaving the page and coming back, and is thrown away by closing the form or by
// editing someone. It used to do nothing at all: the draft store was written with arrow functions that had no `this`, so every
// save threw and was swallowed. The store is module state, so each test gets the module afresh (vi.resetModules) - and within a
// test, "leaving the page" is unmounting while keeping that same module.
const m = vi.hoisted(() => ({ get: vi.fn(), status: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));

configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 40000 });

const ROWS = [
  { _id: "s1", name: "Hana Hasan", designation: "Accountant", contactNo: "0501112233", idNo: "784-1990-1234567-1", joiningDate: "2025-01-05T00:00:00.000Z", status: "Active" },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AUTOSAVE_MS = 2000;

let mods;
const load = async () => {
  if (mods) return mods;
  const { OrganisationProvider, useOrganisation } = await import("../../shell/OrganisationContext");
  const Staff = (await import("../staff")).default;
  mods = { OrganisationProvider, useOrganisation, Staff };
  return mods;
};
const mount = async () => {
  const { OrganisationProvider, useOrganisation, Staff } = await load();
  function Known() {
    const { me } = useOrganisation();
    return me ? <span data-testid="known" /> : null;
  }
  const view = render(<MemoryRouter><OrganisationProvider><Known /><Staff /></OrganisationProvider></MemoryRouter>);
  await screen.findByTestId("known");
  await screen.findByText("Hana Hasan");
  return view;
};
const leave = (view) => view.unmount(); // navigating to another page: the component goes, the module (and its draft store) stays
const openAdd = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Add Staff Member/ }));
  await screen.findByText("Add New Staff Member");
};
const type = (name, value) => fireEvent.change(document.querySelector(`[name="${name}"]`), { target: { name, value } });
const field = (name) => document.querySelector(`[name="${name}"]`);

beforeEach(() => {
  vi.resetModules();
  mods = null;
  m.get.mockImplementation(() => Promise.resolve({ data: { data: { staff: ROWS } } }));
  m.status.mockImplementation(() => Promise.resolve({
    organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: {},
    me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants: ["staff.view", "staff.manage"] },
  }));
});
afterEach(() => cleanup());

describe("a half-finished staff member", () => {
  it("is kept when the person leaves the page and comes back, and Add picks it up", async () => {
    let view = await mount();
    await openAdd();
    type("name", "Noor Nasser");
    type("designation", "Manager");
    expect((await screen.findAllByText(/Draft saved/, {}, { timeout: AUTOSAVE_MS * 3 })).length).toBeGreaterThan(0);

    leave(view);
    view = await mount();
    await openAdd();
    expect(field("name")).toHaveValue("Noor Nasser");
    expect(field("designation")).toHaveValue("Manager");
    expect(screen.getByText(/Draft saved/)).toBeInTheDocument(); // and says so
    expect(screen.getByText("Changes saved automatically")).toBeInTheDocument();
  });

  it("keeps the text only: the status a blank form starts with is not something typed", async () => {
    const view = await mount();
    await openAdd();
    type("contactNo", "0509998877");
    await screen.findAllByText(/Draft saved/, {}, { timeout: AUTOSAVE_MS * 3 });
    leave(view);
    await mount();
    await openAdd();
    expect(field("contactNo")).toHaveValue("0509998877");
    expect(field("name")).toHaveValue("");
    expect(field("status")).toHaveValue("Active");
  });

  it("is not made out of an empty form, however long it stays open", async () => {
    let view = await mount();
    await openAdd();
    await sleep(AUTOSAVE_MS + 700);
    expect(screen.queryByText(/Draft saved/)).toBeNull();
    expect(screen.queryByText("Changes saved automatically")).toBeNull();
    leave(view);
    view = await mount();
    await openAdd();
    expect(field("name")).toHaveValue("");
    expect(screen.queryByText(/Draft saved/)).toBeNull();
  });

  it("is thrown away by closing the form", async () => {
    let view = await mount();
    await openAdd();
    type("name", "Noor Nasser");
    await screen.findAllByText(/Draft saved/, {}, { timeout: AUTOSAVE_MS * 3 });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Add New Staff Member")).toBeNull();

    leave(view);
    view = await mount();
    await openAdd();
    expect(field("name")).toHaveValue("");
    expect(screen.queryByText(/Draft saved/)).toBeNull();
  });

  it("never becomes the record being edited: editing someone leaves no draft of them behind", async () => {
    let view = await mount();
    fireEvent.click(screen.getAllByTitle("Edit staff")[0]);
    await screen.findByText("Edit Staff Member");
    expect(field("name")).toHaveValue("Hana Hasan");
    type("name", "Hana Hasan-Khan");
    await sleep(AUTOSAVE_MS + 700); // longer than the autosave delay
    expect(screen.queryByText(/Draft saved/)).toBeNull(); // an edit is not a draft...

    leave(view); // ...so leaving in the middle of one keeps nothing
    view = await mount();
    await openAdd();
    expect(field("name")).toHaveValue("");
    expect(field("designation")).toHaveValue("");
    expect(screen.queryByText(/Draft saved/)).toBeNull();
  });

  it("is dropped when someone starts editing, and a new Add starts blank", async () => {
    let view = await mount();
    await openAdd();
    type("name", "Noor Nasser");
    await screen.findAllByText(/Draft saved/, {}, { timeout: AUTOSAVE_MS * 3 });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await sleep(50);
    fireEvent.click(screen.getAllByTitle("Edit staff")[0]);
    await screen.findByText("Edit Staff Member");
    leave(view);
    view = await mount();
    await openAdd();
    expect(field("name")).toHaveValue("");
  });
});
