import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, configure, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The staff list's search and its two choices (status, designation) are on the page without pressing anything first - the
// panel that held them used a state with no setter, so they could never be reached - they come back when the person leaves
// the page and returns, "Clear filters" is there only while one is set, and the add-staff draft (which holds an ID number)
// still never reaches the browser's storage.
const m = vi.hoisted(() => ({ get: vi.fn(), status: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));

import { OrganisationProvider, useOrganisation } from "../../shell/OrganisationContext";
import { clearPageSessions } from "../../../lib/pageSession";
import Staff from "../staff";

configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 30000 });

const ROWS = [
  { _id: "s1", name: "Hana Hasan", designation: "Accountant", contactNo: "0501112233", idNo: "784-1990-1234567-1", joiningDate: "2025-01-05T00:00:00.000Z", status: "Active" },
  { _id: "s2", name: "Omar Odeh", designation: "Manager", contactNo: "0504445566", idNo: "784-1988-7654321-2", joiningDate: "2024-03-01T00:00:00.000Z", status: "Inactive" },
  { _id: "s3", name: "Layla Latif", designation: "Manager", contactNo: "0507778899", idNo: "784-1992-1112223-3", joiningDate: "2023-06-15T00:00:00.000Z", status: "Active" },
  { _id: "s4", name: "Tariq Tahan", designation: "Store Keeper", contactNo: "0502223344", idNo: "784-1985-9998887-4", joiningDate: "2022-02-02T00:00:00.000Z", status: "Active" },
];

function Known() {
  const { me } = useOrganisation();
  return me ? <span data-testid="known" /> : null;
}
const mount = async () => {
  const view = render(
    <MemoryRouter>
      <OrganisationProvider>
        <Known />
        <Staff />
      </OrganisationProvider>
    </MemoryRouter>
  );
  await screen.findByTestId("known");
  // the page shows a loader in place of everything until the list is in, so the search box is the sign that it is
  await screen.findByRole("searchbox", { name: "Search staff" });
  return view;
};

const search = () => screen.getByRole("searchbox", { name: "Search staff" });
const statusSelect = () => screen.getByRole("combobox", { name: "Status" });
const designationSelect = () => screen.getByRole("combobox", { name: "Designation" });
const clearButton = () => screen.queryByRole("button", { name: "Clear filters" });
// the rows of the list (heading row left out); with nobody to show the table is replaced by the empty state, so none
const shown = () => {
  const table = screen.queryByRole("table", { name: "Staff" });
  return table ? within(table).getAllByRole("row").slice(1).map((r) => r.textContent) : [];
};
const names = () => ROWS.map((r) => r.name).filter((n) => shown().some((t) => t.includes(n)));

beforeEach(() => {
  clearPageSessions();
  window.localStorage.clear();
  window.sessionStorage.clear();
  m.get.mockReset();
  m.get.mockImplementation((url) => Promise.resolve({ data: { data: url === "/staff/staff" ? { staff: ROWS } : {} } }));
  m.status.mockReset();
  m.status.mockImplementation(() =>
    Promise.resolve({
      organisation: { legalName: "Harbour Trading" },
      subscription: { state: "active", blocked: false },
      features: {},
      me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants: ["staff.view", "staff.manage"] },
    })
  );
});
afterEach(() => cleanup());

describe("the search and the two choices are on the page", () => {
  it("are showing as soon as the list is, with nothing pressed first", async () => {
    await mount();
    expect(search()).toBeVisible();
    expect(statusSelect()).toBeVisible();
    expect(designationSelect()).toBeVisible();
    // "All ..." is the first entry and means no filter
    expect(within(statusSelect()).getByRole("option", { name: "All statuses" })).toHaveValue("");
    expect(within(statusSelect()).getByRole("option", { name: "Inactive" })).toHaveValue("Inactive");
    expect(within(designationSelect()).getByRole("option", { name: "All designations" })).toHaveValue("");
    expect(within(designationSelect()).getByRole("option", { name: "Accountant" })).toHaveValue("Accountant");
    expect(clearButton()).not.toBeInTheDocument();
  });

  it("the status choice narrows the list", async () => {
    await mount();
    fireEvent.change(statusSelect(), { target: { value: "Inactive" } });
    expect(names()).toEqual(["Omar Odeh"]);
  });

  it("the designation choice narrows the list, and a designation a record carries is offered even when the form does not list it", async () => {
    await mount();
    // "Store Keeper" is not one of the six the add form offers; Tariq is on file with it, so it must be reachable
    expect(within(designationSelect()).getByRole("option", { name: "Store Keeper" })).toBeInTheDocument();
    fireEvent.change(designationSelect(), { target: { value: "Store Keeper" } });
    expect(names()).toEqual(["Tariq Tahan"]);
    fireEvent.change(designationSelect(), { target: { value: "Manager" } });
    expect(names()).toEqual(["Omar Odeh", "Layla Latif"]);
  });

  it("the search and both choices combine", async () => {
    await mount();
    fireEvent.change(designationSelect(), { target: { value: "Manager" } });
    fireEvent.change(statusSelect(), { target: { value: "Active" } });
    expect(names()).toEqual(["Layla Latif"]);
    fireEvent.change(search(), { target: { value: "omar" } });
    expect(names()).toEqual([]);
  });
});

describe("what the person chose is kept when they leave the page and come back", () => {
  it("the search, both choices and the sort are still there on the next visit", async () => {
    const first = await mount();
    fireEvent.change(search(), { target: { value: "a" } });
    fireEvent.change(statusSelect(), { target: { value: "Active" } });
    fireEvent.change(designationSelect(), { target: { value: "Manager" } });
    fireEvent.click(within(screen.getByRole("table", { name: "Staff" })).getByRole("button", { name: /Joining Date/ }));
    expect(names()).toEqual(["Layla Latif"]);
    first.unmount(); // another page

    await mount();
    expect(search()).toHaveValue("a");
    expect(statusSelect()).toHaveValue("Active");
    expect(designationSelect()).toHaveValue("Manager");
    expect(names()).toEqual(["Layla Latif"]);
    // the sort too: the Joining Date heading still carries its arrow
    expect(within(screen.getByRole("table", { name: "Staff" })).getByRole("button", { name: /Joining Date/ })).toHaveTextContent("↑");
    expect(clearButton()).toBeInTheDocument();
  });

  it("a person who left nothing set comes back to the whole list", async () => {
    const first = await mount();
    first.unmount();
    await mount();
    expect(search()).toHaveValue("");
    expect(statusSelect()).toHaveValue("");
    expect(designationSelect()).toHaveValue("");
    expect(names()).toHaveLength(4);
  });

  it("is forgotten at sign-out (the page memory is emptied)", async () => {
    const first = await mount();
    fireEvent.change(search(), { target: { value: "omar" } });
    first.unmount();
    clearPageSessions();
    await mount();
    expect(search()).toHaveValue("");
  });
});

describe("Clear filters", () => {
  it("is offered only while something is set, and empties the search and both choices", async () => {
    await mount();
    expect(clearButton()).not.toBeInTheDocument();

    fireEvent.change(statusSelect(), { target: { value: "Inactive" } });
    expect(clearButton()).toBeInTheDocument();
    fireEvent.change(search(), { target: { value: "omar" } });
    fireEvent.change(designationSelect(), { target: { value: "Manager" } });

    fireEvent.click(clearButton());
    expect(search()).toHaveValue("");
    expect(statusSelect()).toHaveValue("");
    expect(designationSelect()).toHaveValue("");
    expect(clearButton()).not.toBeInTheDocument();
    expect(names()).toHaveLength(4);
  });

  it("is offered for a search alone, and the cross in the box empties only the search", async () => {
    await mount();
    fireEvent.change(statusSelect(), { target: { value: "Active" } });
    fireEvent.change(search(), { target: { value: "hana" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search()).toHaveValue("");
    expect(statusSelect()).toHaveValue("Active");
    expect(clearButton()).toBeInTheDocument();
  });
});

describe("when nothing is shown", () => {
  it("a search or choice that matches nobody says so and offers to clear it", async () => {
    await mount();
    fireEvent.change(search(), { target: { value: "zzz-nobody" } });
    expect(screen.getByText("No staff match the search or filters")).toBeInTheDocument();
    expect(screen.queryByText("No staff members found")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add First Staff Member/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(search()).toHaveValue("");
    expect(screen.queryByText("No staff match the search or filters")).not.toBeInTheDocument();
    expect(await screen.findByText("Hana Hasan")).toBeInTheDocument();
  });

  it("a directory with no staff in it still says there is none yet", async () => {
    m.get.mockImplementation(() => Promise.resolve({ data: { data: { staff: [] } } }));
    render(
      <MemoryRouter>
        <OrganisationProvider>
          <Known />
          <Staff />
        </OrganisationProvider>
      </MemoryRouter>
    );
    await screen.findByTestId("known");
    await screen.findByRole("searchbox", { name: "Search staff" });
    expect(await screen.findByText("No staff members found")).toBeInTheDocument();
    expect(screen.getByText(/adding your first staff member/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear search and filters" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add First Staff Member/ })).toBeInTheDocument();
  });
});

describe("the add-staff draft holds an ID number, so it stays out of the browser's storage", () => {
  it("typing in the form, and the draft being kept, writes nothing to localStorage or sessionStorage", async () => {
    const first = await mount();
    // the filters are remembered too: they must not reach the storage either
    fireEvent.change(search(), { target: { value: "hana" } });
    fireEvent.change(statusSelect(), { target: { value: "Active" } });

    fireEvent.click(screen.getByRole("button", { name: /Add Staff Member/ }));
    await screen.findByText("Add New Staff Member");
    const type = (name, value) => fireEvent.change(document.querySelector(`[name="${name}"]`), { target: { name, value } });
    type("name", "Noor Nasser");
    type("designation", "Manager");
    type("contactNo", "0509998877");
    type("idNo", "784-1999-5550001-9");

    // the draft really was kept (so this is not an assertion about a form that saved nothing)...
    expect((await screen.findAllByText(/Draft saved/, {}, { timeout: 6000 })).length).toBeGreaterThan(0);
    // ...and it is in memory only
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);

    // leaving the page and coming back picks the draft up from memory, still with nothing in storage
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); // closing discards it...
    first.unmount();
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
  });
});
