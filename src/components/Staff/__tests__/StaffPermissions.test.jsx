import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, configure } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The employee files have permissions of their own, apart from the people who sign in:
//   staff.view    sees the directory
//   staff.manage  adds, changes and deletes a record
// The server refuses the rest (403 PERMISSION_DENIED); this pins the screen's half. Every "is not there" check follows a check that the
// list has loaded AND the grants are known (nothing is hidden while they are on their way, so an earlier absence would prove nothing).
const m = vi.hoisted(() => ({ get: vi.fn(), status: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));

import { OrganisationProvider, useOrganisation } from "../../shell/OrganisationContext";
import Staff from "../staff";

configure({ asyncUtilTimeout: 8000 });

const ROWS = [
  { _id: "s1", name: "Hana Hasan", designation: "Accountant", contactNo: "0501112233", idNo: "784-1990-1234567-1", joiningDate: "2025-01-05T00:00:00.000Z", status: "Active" },
  { _id: "s2", name: "Omar Odeh", designation: "Manager", contactNo: "0504445566", idNo: "784-1988-7654321-2", joiningDate: "2024-03-01T00:00:00.000Z", status: "Active" },
];

const statusFor = (grants) => ({
  organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: {},
  me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants },
});
function GrantsKnown() {
  const { me } = useOrganisation();
  return me ? <span data-testid="grants-known" /> : null;
}
const renderAs = async (grants) => {
  m.status.mockImplementation(() => Promise.resolve(statusFor(grants)));
  render(<MemoryRouter><OrganisationProvider><GrantsKnown /><Staff /></OrganisationProvider></MemoryRouter>);
  await screen.findByTestId("grants-known");
};
const offers = (re) => screen.queryAllByRole("button").some((b) => re.test(`${b.getAttribute("title") || ""} ${b.textContent}`));

beforeEach(() => {
  vi.clearAllMocks();
  m.get.mockImplementation((url) => Promise.resolve({ data: { data: url === "/staff/staff" ? { staff: ROWS } : {} } }));
});

describe("who may change the staff records", () => {
  it("a person who can only look sees the directory and is offered no way to add, change or delete", async () => {
    await renderAs(["staff.view"]);
    expect(await screen.findByText("Hana Hasan")).toBeInTheDocument();
    expect(screen.getByText("Omar Odeh")).toBeInTheDocument();
    expect(offers(/Add Staff Member/)).toBe(false);
    expect(offers(/Edit staff/)).toBe(false);
    expect(offers(/Delete staff/)).toBe(false);
  });

  it("a person who manages the records is offered all three", async () => {
    await renderAs(["staff.view", "staff.manage"]);
    expect(await screen.findByText("Hana Hasan")).toBeInTheDocument();
    expect(offers(/Add Staff Member/)).toBe(true);
    expect(screen.getAllByTitle("Edit staff")).toHaveLength(2);
    expect(screen.getAllByTitle("Delete staff")).toHaveLength(2);
  });

  it("managing the people who sign in is not managing the employee files", async () => {
    await renderAs(["staff.view", "users.view", "users.manage"]);
    expect(await screen.findByText("Hana Hasan")).toBeInTheDocument();
    expect(offers(/Add Staff Member/)).toBe(false);
    expect(offers(/Edit staff/)).toBe(false);
  });

  it("an empty directory does not tell a reader to add the first member, but does tell a manager", async () => {
    m.get.mockImplementation(() => Promise.resolve({ data: { data: { staff: [] } } }));
    await renderAs(["staff.view"]);
    expect(await screen.findByText("No staff members found")).toBeInTheDocument();
    expect(screen.getByText("No staff records have been added yet.")).toBeInTheDocument();
    expect(offers(/Add First Staff Member/)).toBe(false);
  });

  it("and offers the manager the first-member button", async () => {
    m.get.mockImplementation(() => Promise.resolve({ data: { data: { staff: [] } } }));
    await renderAs(["staff.view", "staff.manage"]);
    expect(await screen.findByText("No staff members found")).toBeInTheDocument();
    expect(screen.getByText(/adding your first staff member/)).toBeInTheDocument();
    expect(offers(/Add First Staff Member/)).toBe(true);
  });

  it("the Add button still opens the form for a manager", async () => {
    await renderAs(["staff.view", "staff.manage"]);
    await screen.findByText("Hana Hasan");
    fireEvent.click(screen.getByRole("button", { name: /Add Staff Member/ }));
    expect(await screen.findByText("Add New Staff Member")).toBeInTheDocument();
  });
});
