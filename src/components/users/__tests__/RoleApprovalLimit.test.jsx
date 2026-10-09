import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import UsersPage from "../UsersPage";
import { OrganisationProvider } from "../../shell/OrganisationContext";

// A role that can approve may carry an approval limit: the largest document its people may approve (empty = no limit). The role
// editor asks for it only for a role that holds an Approve, sends it as a number (or null), shows the server's refusal under the
// field it names, and the roles list says what each approving role may approve. The server enforces all of it
// (services/__tests__/approvalsHttp.test.js); a person who has a limit cannot hand out a bigger one, or none.
const api = vi.hoisted(() => ({ users: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), roles: vi.fn(), createRole: vi.fn(), updateRole: vi.fn(), removeRole: vi.fn() }));
let status;
vi.mock("../../../lib/accessApi", () => ({ access: api }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));

const action = (key, short, implies = [], label = `${short}.`) => ({ key, action: key.split(".")[1], short, label, read: key.endsWith(".view"), implies });
const CATALOGUE = [
  { key: "sales", label: "Sales", hint: "Quotations and orders", actions: [action("sales.view", "View"), action("sales.create", "Add", ["sales.view", "lookups.view"]), action("sales.approve", "Approve", ["sales.view", "inventory.view", "lookups.view"])] },
  { key: "finance", label: "Finance", hint: "Vouchers", actions: [action("finance.view", "View"), action("finance.approve", "Approve", ["finance.view", "lookups.view"])] },
  { key: "inventory", label: "Inventory", hint: "Items", actions: [action("inventory.view", "View")] },
  { key: "lookups", label: "Pick lists", hint: "", automatic: true, actions: [action("lookups.view", "Pick lists")] },
];
const role = (key, name, rank, extra = {}) => ({ key, name, rank, description: "", builtIn: true, isActive: true, approvalLimit: null, permissions: ["sales.view"], people: 0, ...extra });
const ROLES = {
  catalogue: CATALOGUE,
  roles: [
    role("admin", "Administrator", 80, { permissions: ["sales.view", "sales.approve", "inventory.view", "lookups.view"] }),
    role("manager", "Manager", 60, { permissions: ["lookups.view", "sales.approve", "sales.view", "inventory.view"] }),
    role("viewer", "Viewer", 20),
    role("clerk", "Order clerk", 40, { builtIn: false, permissions: ["sales.create", "sales.view", "lookups.view"], named: ["sales.create"], people: 1 }),
    role("supervisor", "Sales supervisor", 55, { builtIn: false, permissions: ["sales.approve", "sales.view", "inventory.view", "lookups.view"], named: ["sales.approve"], approvalLimit: 5000, people: 1 }),
    role("lead", "Sales lead", 56, { builtIn: false, permissions: ["sales.approve", "sales.view", "inventory.view", "lookups.view"], named: ["sales.approve"], approvalLimit: null, people: 0 }),
  ],
};

const GRANTS = ["users.view", "users.manage", "sales.view", "sales.create", "sales.approve", "finance.view", "inventory.view", "lookups.view"];
const baseStatus = (limit = null) => ({
  organisation: { legalName: "Acc Trading", baseCurrency: "AED" }, subscription: { state: "active", blocked: false }, features: {},
  branches: [{ code: "main", name: "Head office", isHeadOffice: true }], branch: { code: "main", name: "Head office", canSwitch: false },
  me: { id: "u-admin", name: "Ada Admin", role: { key: "admin", name: "Administrator", rank: 80, approvalLimit: limit }, grants: GRANTS },
});

const renderRoles = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/users?tab=roles"]}>
        <OrganisationProvider>
          <Routes><Route path="/users" element={<UsersPage />} /></Routes>
        </OrganisationProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
const rolesTable = () => screen.findByRole("table", { name: "Roles" });
const rowOf = (table, name) => within(table).getByText(name).closest("tr");
const limitField = (dialog) => within(dialog).queryByLabelText(/^Approval limit/);
const newRole = async () => {
  renderRoles();
  fireEvent.click(await screen.findByRole("button", { name: /New role/ }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Night approver" } });
  return dialog;
};
const open = async (name, button = /Change/) => {
  renderRoles();
  fireEvent.click(within(rowOf(await rolesTable(), name)).getByRole("button", { name: button }));
  return screen.findByRole("dialog");
};
// a refusal the way the real axios instance throws it: a generic message, the server's own on the response
const refusal = (message, field) => Object.assign(new Error("Request failed with status code 400"), { response: { status: 400, data: { success: false, message, errorCode: "ROLE_INVALID", details: { field } } } });

beforeEach(() => {
  vi.clearAllMocks();
  status = baseStatus();
  api.users.mockResolvedValue([]);
  api.roles.mockResolvedValue(ROLES);
  api.createRole.mockImplementation(async (b) => ({ key: b.key, name: b.name }));
  api.updateRole.mockImplementation(async (k, b) => ({ key: k, name: b.name }));
});

describe("the roles list", () => {
  it("says what each role that approves may approve, and nothing for a role that approves nothing", async () => {
    renderRoles();
    const table = await rolesTable();
    expect(within(rowOf(table, "Sales supervisor")).getByText(/Approval: Up to 5,000\.00 AED/)).toBeInTheDocument();
    expect(within(rowOf(table, "Sales lead")).getByText(/Approval: No limit/)).toBeInTheDocument();
    expect(within(rowOf(table, "Manager")).getByText(/Approval: No limit/)).toBeInTheDocument(); // a built-in role has none
    expect(within(rowOf(table, "Order clerk")).queryByText(/Approval:/)).toBeNull();
    expect(within(rowOf(table, "Viewer")).queryByText(/Approval:/)).toBeNull();
  });
});

describe("the approval limit in the role editor", () => {
  it("is asked for only once the role can approve something", async () => {
    const dialog = await newRole();
    expect(limitField(dialog)).toBeNull();
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    expect(limitField(dialog)).toBeInTheDocument();
    expect(within(dialog).getByText("The largest document someone in this role may approve. Leave empty for no limit.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    expect(limitField(dialog)).toBeNull();
  });

  it("is labelled with the organisation's currency", async () => {
    const dialog = await newRole();
    fireEvent.click(within(dialog).getByLabelText("Finance: Approve"));
    expect(within(dialog).getByLabelText("Approval limit (AED)")).toBeInTheDocument();
  });

  it("is sent as a number with the new role", async () => {
    const dialog = await newRole();
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    fireEvent.change(limitField(dialog), { target: { value: "5,000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));
    await waitFor(() => expect(api.createRole).toHaveBeenCalledTimes(1));
    expect(api.createRole.mock.calls[0][0]).toMatchObject({ key: "night_approver", permissions: ["sales.approve"], approvalLimit: 5000 });
  });

  it("is sent as null when it is left empty (no limit)", async () => {
    const dialog = await newRole();
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));
    await waitFor(() => expect(api.createRole).toHaveBeenCalledTimes(1));
    expect(api.createRole.mock.calls[0][0].approvalLimit).toBeNull();
  });

  it("is sent as null for a role that approves nothing, whatever was typed before Approve was unticked", async () => {
    const dialog = await newRole();
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    fireEvent.change(limitField(dialog), { target: { value: "800" } });
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    fireEvent.click(within(dialog).getByLabelText("Sales: Add"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));
    await waitFor(() => expect(api.createRole).toHaveBeenCalledTimes(1));
    expect(api.createRole.mock.calls[0][0]).toMatchObject({ permissions: ["sales.create"], approvalLimit: null });
  });

  it("shows a role's saved limit, and clearing it sends null (no limit)", async () => {
    const dialog = await open("Sales supervisor");
    expect(limitField(dialog)).toHaveValue("5000");
    fireEvent.change(limitField(dialog), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save role" }));
    await waitFor(() => expect(api.updateRole).toHaveBeenCalledTimes(1));
    expect(api.updateRole.mock.calls[0][0]).toBe("supervisor");
    expect(api.updateRole.mock.calls[0][1].approvalLimit).toBeNull();
  });

  it("changing the amount sends the new number", async () => {
    const dialog = await open("Sales supervisor");
    fireEvent.change(limitField(dialog), { target: { value: "7500.50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save role" }));
    await waitFor(() => expect(api.updateRole).toHaveBeenCalledTimes(1));
    expect(api.updateRole.mock.calls[0][1].approvalLimit).toBe(7500.5);
  });

  it("a copy of a role starts with the role's limit", async () => {
    renderRoles();
    const table = await rolesTable();
    fireEvent.click(within(rowOf(table, "Sales supervisor")).getByRole("button", { name: /Copy/ }));
    const dialog = await screen.findByRole("dialog");
    expect(limitField(dialog)).toHaveValue("5000");
  });

  it("will not send something that is not an amount, and says so", async () => {
    const dialog = await open("Sales supervisor");
    fireEvent.change(limitField(dialog), { target: { value: "lots" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save role" }));
    expect(await within(dialog).findByText("Enter an amount of 0 or more, or leave it empty for no limit")).toBeInTheDocument();
    expect(api.updateRole).not.toHaveBeenCalled();
  });

  it("shows the server's refusal under the field it names, in the server's words", async () => {
    api.updateRole.mockRejectedValueOnce(refusal("A limit cannot be above your own (1000)", "approvalLimit"));
    const dialog = await open("Sales supervisor");
    fireEvent.change(limitField(dialog), { target: { value: "2000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save role" }));
    const message = await within(dialog).findByText("A limit cannot be above your own (1000)");
    expect(message).toBeInTheDocument();
    expect(limitField(dialog)).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).queryByText(/Request failed with status code/)).toBeNull();
    expect(within(dialog).queryByRole("alert")).toBeNull(); // under the field, not also as a note
    // typing again takes the refusal away
    fireEvent.change(limitField(dialog), { target: { value: "900" } });
    expect(within(dialog).queryByText("A limit cannot be above your own (1000)")).toBeNull();
  });

  it("shows any other refusal as a note, in the server's words and not axios's", async () => {
    api.createRole.mockRejectedValueOnce(Object.assign(new Error("Request failed with status code 409"), { response: { status: 409, data: { message: "This organisation already has a role with that key", errorCode: "ROLE_KEY_TAKEN" } } }));
    const dialog = await newRole();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));
    expect(await within(dialog).findByText("This organisation already has a role with that key")).toBeInTheDocument();
  });

  it("shows the server's 'set a limit' refusal under the field when a person with a limit saves an approving role with none", async () => {
    api.updateRole.mockRejectedValueOnce(refusal("Set a limit: yours is 1000, and a role with no limit would be above it", "approvalLimit"));
    const dialog = await open("Sales supervisor");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save role" }));
    // the field is shown, so the refusal is under it
    expect(await within(dialog).findByText(/Set a limit: yours is 1000/)).toBeInTheDocument();
    expect(limitField(dialog)).toBeInTheDocument();
  });

  it("tells a person who has a limit of their own what it is: a role they make cannot go above it or have none", async () => {
    status = baseStatus(1000);
    const dialog = await newRole();
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    expect(within(dialog).getByText(/Your own limit is 1,000\.00 AED: a role you make cannot go above it, or have none\./)).toBeInTheDocument();
  });

  it("does not mention a cap to a person who has no limit", async () => {
    const dialog = await newRole();
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    expect(within(dialog).queryByText(/Your own limit/)).toBeNull();
  });
});

describe("a built-in role", () => {
  it("shows 'No limit' for a role that approves, and the box cannot be changed", async () => {
    const dialog = await open("Manager", "View");
    const field = within(dialog).getByLabelText("Approval limit (AED)");
    expect(field).toHaveValue("No limit");
    expect(field).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Save role" })).toBeNull();
  });

  it("shows no limit for a role that approves nothing", async () => {
    const dialog = await open("Viewer", "View");
    expect(limitField(dialog)).toBeNull();
  });

  it("copying one starts with no limit", async () => {
    const dialog = await open("Manager", "View");
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy as a new role" }));
    expect(await screen.findByText("New role, copied from Manager")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Approval limit/)).toHaveValue("");
  });
});
