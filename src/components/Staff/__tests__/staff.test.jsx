import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// Staff: the employee directory. Zero tests existed for this file before - written first as a safety net for
// the list/filter/sort/delete behaviour (already correct), then extended to cover the add/edit form and its two
// file uploads, which this file is the first real exercise of in a test at all.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: api }));
const m = vi.hoisted(() => ({ grants: { allow: () => true } }));
vi.mock("../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ canAny: (k) => m.grants.allow(k), can: (k) => m.grants.allow(k) }) }));

import StaffManagement from "../staff";
import { clearPageSessions } from "../../../lib/pageSession";

const member = (n, extra = {}) => ({
  _id: `s${n}`, name: `Person ${n}`, designation: "Manager", contactNo: `05000000${n}`, idNo: `ID-${n}`,
  joiningDate: "2026-01-01T00:00:00.000Z", status: "Active", idProof: null, addressProof: null, ...extra,
});
let all = [];

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
  clearPageSessions();
  m.grants.allow = () => true;
  all = [member(1), member(2, { name: "Zed Person", designation: "Accountant", status: "Inactive" })];
  api.get.mockImplementation(async () => ({ data: { data: { staff: all } } }));
  // jsdom has no createObjectURL - the image-preview path for a newly chosen file needs it
  globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
  globalThis.URL.revokeObjectURL = vi.fn();
});

const show = () => render(<MemoryRouter><StaffManagement /></MemoryRouter>);
const searchBox = () => screen.getByRole("searchbox", { name: "Search staff" });

describe("the staff directory", () => {
  it("lists everyone, with totals in the header and on the stat cards", async () => {
    show();
    await screen.findByText("Person 1");
    expect(document.body).toHaveTextContent("2 total staff");
    expect(document.body).toHaveTextContent("2 displayed");
    const totalCard = screen.getByText("Total Staff").closest("div").parentElement;
    expect(totalCard).toHaveTextContent("2");
    const activeCard = screen.getByText("Active Staff").closest("div").parentElement;
    expect(activeCard).toHaveTextContent("1");
  });

  it("narrows by search and by each choice, and keeps them after a remount", async () => {
    const first = show();
    await screen.findByText("Person 1");
    fireEvent.change(searchBox(), { target: { value: "zed" } });
    expect(screen.queryByText("Person 1")).not.toBeInTheDocument();
    expect(screen.getByText("Zed Person")).toBeInTheDocument();
    fireEvent.change(searchBox(), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "Inactive" } });
    expect(screen.queryByText("Person 1")).not.toBeInTheDocument();
    first.unmount();

    show();
    await screen.findByText("Zed Person");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("Inactive");
    expect(screen.queryByText("Person 1")).not.toBeInTheDocument();
  });

  it("Clear filters empties the search and both choices, and is offered only while one is set", async () => {
    show();
    await screen.findByText("Person 1");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    fireEvent.change(searchBox(), { target: { value: "zed" } });
    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
    expect(searchBox()).toHaveValue("");
    expect(screen.getByText("Person 1")).toBeInTheDocument();
  });

  it("keeps the column the list is sorted by", async () => {
    const first = show();
    await screen.findByText("Person 1");
    const rows = () => screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    fireEvent.click(screen.getByRole("button", { name: /^Staff Info/ }));
    expect(rows()[0]).toContain("Person 1");
    fireEvent.click(screen.getByRole("button", { name: /^Staff Info/ })); // descending
    expect(rows()[0]).toContain("Zed Person");
    first.unmount();

    show();
    await screen.findByText("Zed Person");
    expect(screen.getByRole("columnheader", { name: /^Staff Info/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("with a search or choice set and nothing matching, offers to clear; with none set and no staff, says so", async () => {
    show();
    await screen.findByText("Person 1");
    fireEvent.change(searchBox(), { target: { value: "nobody here" } });
    expect(screen.getByText("No staff match the search or filters")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(await screen.findByText("Person 1")).toBeInTheDocument();

    all = [];
    const second = show();
    expect(await screen.findByText("No staff members found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add First Staff Member" })).toBeInTheDocument();
    second.unmount();
  });
});

describe("what someone without staff.manage may do", () => {
  beforeEach(() => { m.grants.allow = () => false; });

  it("offers no Add button, no row actions, and a different empty-state message", async () => {
    show();
    await screen.findByText("Person 1");
    expect(screen.queryByRole("button", { name: /Add Staff Member/ })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Edit staff")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Delete staff")).not.toBeInTheDocument();

    all = [];
    const second = show();
    expect(await screen.findByText("No staff records have been added yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add/ })).not.toBeInTheDocument();
    second.unmount();
  });
});

describe("deleting a staff member", () => {
  it("asks first, and the list is refreshed once it is gone", async () => {
    api.delete.mockResolvedValue({ data: { success: true } });
    show();
    await screen.findByText("Person 1");
    fireEvent.click(within(screen.getByText("Person 1").closest("tr")).getByTitle("Delete staff"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Person 1/)).toBeInTheDocument();
    all = [member(2, { name: "Zed Person" })];
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/staff/staff/s1"));
    await waitFor(() => expect(screen.queryByText("Person 1")).not.toBeInTheDocument());
  });
});

describe("adding a staff member", () => {
  const open = async () => {
    show();
    await screen.findByText("Person 1");
    fireEvent.click(screen.getByRole("button", { name: "Add Staff Member" }));
    return screen.findByRole("dialog", { name: "Add New Staff Member" });
  };

  it("refuses to submit with the required fields blank", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Staff" }));
    expect(await within(dialog).findByText("Full name is required")).toBeInTheDocument();
    expect(within(dialog).getByText("Designation is required")).toBeInTheDocument();
    expect(within(dialog).getByText("Contact number is required")).toBeInTheDocument();
    expect(within(dialog).getByText("ID/Passport number is required")).toBeInTheDocument();
    expect(within(dialog).getByText("Joining date is required")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("posts the filled-in form as multipart form data and refreshes the list", async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    const dialog = await open();
    fireEvent.change(within(dialog).getByPlaceholderText("Enter full name"), { target: { value: "New Person" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: /^Designation/ }), { target: { value: "Accountant" } });
    fireEvent.change(within(dialog).getByLabelText(/^Contact Number/), { target: { value: "0500009999" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter ID or Passport number"), { target: { value: "ID-99" } });
    fireEvent.change(within(dialog).getByLabelText(/Joining Date/), { target: { value: "2026-03-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Staff" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body, config] = api.post.mock.calls[0];
    expect(url).toBe("/staff/staff");
    expect(body instanceof FormData).toBe(true);
    expect(body.get("name")).toBe("New Person");
    expect(body.get("designation")).toBe("Accountant");
    expect(body.get("idNo")).toBe("ID-99");
    expect(body.get("contactNo")).toBe("+971500009999"); // the phone field's one compact form
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
    expect(await screen.findByText("Staff member added successfully!")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("attaches a chosen file to the submitted form, and Remove takes it back off", async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    const dialog = await open();
    const file = new File(["id-scan"], "passport.png", { type: "image/png" });
    fireEvent.change(within(dialog).getByLabelText(/Upload ID Proof/), { target: { files: [file] } });
    expect(await within(dialog).findByText("passport.png")).toBeInTheDocument();
    // no "Replace" button exists (the original's pointed at a hidden input and silently did nothing) -
    // View and Delete are offered instead, the same convention PartyRows.jsx already uses
    expect(within(dialog).getByTitle("View file")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Upload ID Proof Document/)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByTitle("Delete file"));
    expect(within(dialog).queryByText("passport.png")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Upload ID Proof/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Upload ID Proof/), { target: { files: [file] } });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter full name"), { target: { value: "New Person" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: /^Designation/ }), { target: { value: "Accountant" } });
    fireEvent.change(within(dialog).getByLabelText(/^Contact Number/), { target: { value: "0500009999" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter ID or Passport number"), { target: { value: "ID-99" } });
    fireEvent.change(within(dialog).getByLabelText(/Joining Date/), { target: { value: "2026-03-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Staff" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1].get("idProof")).toBe(file);
  });

  it("keeps the dialog open and shows the server's message when the save fails", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: "An employee with that ID already exists" } } });
    const dialog = await open();
    fireEvent.change(within(dialog).getByPlaceholderText("Enter full name"), { target: { value: "New Person" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: /^Designation/ }), { target: { value: "Accountant" } });
    fireEvent.change(within(dialog).getByLabelText(/^Contact Number/), { target: { value: "0500009999" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter ID or Passport number"), { target: { value: "ID-99" } });
    fireEvent.change(within(dialog).getByLabelText(/Joining Date/), { target: { value: "2026-03-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Staff" }));
    expect(await screen.findByText("An employee with that ID already exists")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Add New Staff Member" })).toBeInTheDocument();
  });

  it("keeps a half-filled draft across a remount, and never offers it when editing someone", async () => {
    const first = show();
    await screen.findByText("Person 1");
    fireEvent.click(screen.getByRole("button", { name: "Add Staff Member" }));
    let dialog = await screen.findByRole("dialog", { name: "Add New Staff Member" });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter full name"), { target: { value: "Draft Person" } });
    expect(await within(dialog).findByText("Changes saved automatically", {}, { timeout: 4000 })).toBeInTheDocument();
    first.unmount();

    show();
    await screen.findByText("Person 1");
    fireEvent.click(screen.getByRole("button", { name: "Add Staff Member" }));
    dialog = await screen.findByRole("dialog", { name: "Add New Staff Member" });
    expect(within(dialog).getByPlaceholderText("Enter full name")).toHaveValue("Draft Person");

    // editing someone else must never pick up the draft
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(screen.getByText("Person 1").closest("tr")).getByTitle("Edit staff"));
    dialog = await screen.findByRole("dialog", { name: "Edit Staff Member" });
    expect(within(dialog).getByPlaceholderText("Enter full name")).toHaveValue("Person 1");
  }, 10000);
});

describe("editing a staff member", () => {
  it("opens pre-filled, including an existing document's preview, and saves with PUT", async () => {
    api.put.mockResolvedValue({ data: { success: true } });
    all = [member(1, { idProof: "passport.png", idProofUrl: "https://files.example/passport.png" })];
    show();
    await screen.findByText("Person 1");
    fireEvent.click(within(screen.getByText("Person 1").closest("tr")).getByTitle("Edit staff"));
    const dialog = await screen.findByRole("dialog", { name: "Edit Staff Member" });
    expect(within(dialog).getByPlaceholderText("Enter full name")).toHaveValue("Person 1");
    expect(within(dialog).getByRole("combobox", { name: /^Designation/ })).toHaveValue("Manager");
    expect(within(dialog).getByText("passport.png")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /View file/ })).toHaveAttribute("href", "https://files.example/passport.png");

    fireEvent.change(within(dialog).getByPlaceholderText("Enter full name"), { target: { value: "Person One Updated" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Update Staff" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put.mock.calls[0][0]).toBe("/staff/staff/s1");
    expect(api.put.mock.calls[0][1].get("name")).toBe("Person One Updated");
    expect(await screen.findByText("Staff member updated successfully!")).toBeInTheDocument();
  });
});
