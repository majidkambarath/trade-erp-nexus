import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import UsersPage from "../UsersPage";
import { OrganisationProvider } from "../../shell/OrganisationContext";

// The Users and roles screen against a stand-in for its API: who it offers a change to, which roles it offers to give, and
// above all how the permission boxes behave - ticking Approve locks View, a box the person does not hold cannot be ticked,
// and what is sent is exactly what was ticked.
const api = vi.hoisted(() => ({ users: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), roles: vi.fn(), createRole: vi.fn(), updateRole: vi.fn(), removeRole: vi.fn() }));
let status;
vi.mock("../../../lib/accessApi", () => ({ access: api }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));

const action = (key, short, implies = [], label = `${short}.`) => ({ key, action: key.split(".")[1], short, label, read: key.endsWith(".view"), implies });
const CATALOGUE = [
  { key: "sales", label: "Sales", hint: "Quotations and orders", actions: [action("sales.view", "View"), action("sales.create", "Add and edit", ["sales.view", "lookups.view"]), action("sales.approve", "Approve", ["sales.view", "inventory.view", "lookups.view"])] },
  { key: "finance", label: "Finance", hint: "Vouchers", actions: [action("finance.view", "View"), action("finance.approve", "Approve", ["finance.view", "lookups.view"])] },
  { key: "inventory", label: "Inventory", hint: "Items", actions: [action("inventory.view", "View")] },
  { key: "lookups", label: "Pick lists", hint: "", automatic: true, actions: [action("lookups.view", "Pick lists")] },
];
const role = (key, name, rank, extra = {}) => ({ key, name, rank, description: "", builtIn: true, isActive: true, permissions: ["sales.view"], people: 0, ...extra });
const ROLES = {
  catalogue: CATALOGUE,
  roles: [
    role("super_admin", "Owner", 100),
    role("admin", "Administrator", 80, { people: 1 }),
    role("manager", "Manager", 60, { permissions: ["lookups.view", "sales.approve", "sales.view", "inventory.view"], people: 1 }),
    role("viewer", "Viewer", 20, { people: 1 }),
    role("supervisor", "Sales supervisor", 55, { builtIn: false, permissions: ["sales.create", "sales.view", "lookups.view"], named: ["sales.create"], people: 1 }),
    role("empty_role", "Spare role", 30, { builtIn: false, permissions: [], named: [], people: 0 }),
  ],
};
const person = (id, name, key, rankOf, over = {}) => ({ id, name, email: `${name.toLowerCase().split(" ")[0]}@acc.test`, role: { key, name: key, rank: rankOf, builtIn: true, active: true }, branchId: "main", isActive: true, status: "active", lastLogin: null, ...over });
const USERS = [person("u-admin", "Ada Admin", "admin", 80), person("u-mgr", "Manu Manager", "manager", 60), person("u-vw", "Vera Viewer", "viewer", 20), person("u-own", "Olu Owner", "super_admin", 100)];

const baseStatus = (grants, rank = 80) => ({
  organisation: { legalName: "Acc Trading" }, subscription: { state: "active", blocked: false }, features: {},
  branches: [{ code: "main", name: "Head office", isHeadOffice: true }, { code: "shj", name: "Sharjah" }], branch: { code: "main", name: "Head office", canSwitch: true },
  me: { id: "u-admin", name: "Ada Admin", role: { key: "admin", name: "Administrator", rank }, grants },
});
const MANAGER_GRANTS = ["users.view", "users.manage", "sales.view", "sales.create", "sales.approve", "finance.view", "inventory.view", "lookups.view"];

const renderPage = (url = "/users") =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <OrganisationProvider>
          <Routes><Route path="/users" element={<UsersPage />} /></Routes>
        </OrganisationProvider>
      </MemoryRouter>
    </ThemeProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  status = baseStatus(MANAGER_GRANTS);
  api.users.mockResolvedValue(USERS);
  api.roles.mockResolvedValue(ROLES);
  api.createUser.mockImplementation(async (b) => ({ id: "n", name: b.name, role: { key: b.role } }));
  api.createRole.mockImplementation(async (b) => ({ key: b.key, name: b.name }));
  api.updateRole.mockImplementation(async (k, b) => ({ key: k, name: b.name }));
  api.updateUser.mockImplementation(async (id, b) => ({ id, name: b.name || "x" }));
  api.removeRole.mockResolvedValue({ key: "empty_role" });
});

describe("the people", () => {
  it("offers a change only for people below the person's own rank, and marks which one is them", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "People" });
    const row = (name) => within(table).getByText(name).closest("tr");
    expect(within(row("Ada Admin")).getByText("(you)")).toBeInTheDocument();
    expect(within(row("Manu Manager")).getByRole("button", { name: /Change/ })).toBeInTheDocument();
    expect(within(row("Vera Viewer")).getByRole("button", { name: /Change/ })).toBeInTheDocument();
    expect(within(row("Olu Owner")).queryByRole("button", { name: /Change/ })).toBeNull(); // the owner outranks an administrator
  });

  it("shows no way to add or change anyone to a person who may only look", async () => {
    status = baseStatus(["users.view", "lookups.view"], 50);
    renderPage();
    await screen.findByRole("table", { name: "People" });
    expect(screen.queryByRole("button", { name: /Add a person/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Change/ })).toBeNull();
  });

  it("adds a person, offering only the roles below the person's own, and sends the role and the branch", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Add a person/ }));
    const dialog = await screen.findByRole("dialog");
    const roleSelect = within(dialog).getByLabelText(/^Role/);
    expect([...roleSelect.querySelectorAll("option")].map((o) => o.value)).toEqual(["manager", "viewer", "supervisor", "empty_role"]); // no owner, no administrator
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Noor Nasser" } });
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: "Noor@Acc.test" } });
    fireEvent.change(within(dialog).getByLabelText(/^Password/), { target: { value: "a-long-password" } });
    fireEvent.change(roleSelect, { target: { value: "supervisor" } });
    fireEvent.change(within(dialog).getByLabelText(/^Branch/), { target: { value: "shj" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add person" }));
    await waitFor(() => expect(api.createUser).toHaveBeenCalledTimes(1));
    expect(api.createUser).toHaveBeenCalledWith({ name: "Noor Nasser", email: "noor@acc.test", password: "a-long-password", role: "supervisor", branchId: "shj" });
  });

  it("will not send an incomplete person, and says what is missing", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Add a person/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Add person" }));
    expect(await screen.findByText("Enter the person's name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it("changes only what was changed", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "People" });
    fireEvent.click(within(within(table).getByText("Vera Viewer").closest("tr")).getByRole("button", { name: /Change/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Role/), { target: { value: "manager" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith("u-vw", { role: "manager" }));
  });

  it("lets a person change their own name and nothing else", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "People" });
    fireEvent.click(within(within(table).getByText("Ada Admin").closest("tr")).getByRole("button", { name: /Change/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/^Role/)).toBeDisabled();
    expect(within(dialog).getByLabelText(/^Branch/)).toBeDisabled();
    expect(within(dialog).queryByLabelText(/^Access/)).toBeNull();
  });
});

describe("the roles", () => {
  const openRoles = async () => {
    renderPage("/users?tab=roles");
    return screen.findByRole("table", { name: "Roles" });
  };

  it("lists built-in and own roles, and offers Remove only for an own role nobody holds", async () => {
    const table = await openRoles();
    const row = (name) => within(table).getByText(name).closest("tr");
    expect(within(row("Manager")).getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(within(row("Manager")).queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(within(row("Sales supervisor")).getByRole("button", { name: /Remove Sales supervisor/ })).toBeDisabled(); // a person holds it
    expect(within(row("Spare role")).getByRole("button", { name: /Remove Spare role/ })).toBeEnabled();
  });

  it("removes a role nobody holds, after asking", async () => {
    const table = await openRoles();
    fireEvent.click(within(within(table).getByText("Spare role").closest("tr")).getByRole("button", { name: /Remove Spare role/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove role" }));
    await waitFor(() => expect(api.removeRole).toHaveBeenCalledWith("empty_role"));
  });

  it("opens a built-in role read-only, with a way to copy it", async () => {
    const table = await openRoles();
    fireEvent.click(within(within(table).getByText("Manager").closest("tr")).getByRole("button", { name: "View" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Sales: Approve")).toBeDisabled();
    expect(within(dialog).getByLabelText("Sales: Approve")).toBeChecked();
    expect(within(dialog).queryByRole("button", { name: "Save role" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy as a new role" }));
    expect(await screen.findByText("New role, copied from Manager")).toBeInTheDocument();
    expect(screen.getByLabelText("Sales: Approve")).toBeChecked();
    expect(screen.getByLabelText("Sales: Approve")).toBeEnabled();
  });
});

describe("the permission boxes", () => {
  const newRole = async () => {
    renderPage("/users?tab=roles");
    fireEvent.click(await screen.findByRole("button", { name: /New role/ }));
    return screen.findByRole("dialog");
  };

  it("ticking Approve ticks and locks View, and unticking it frees View again", async () => {
    const dialog = await newRole();
    const approve = within(dialog).getByLabelText("Sales: Approve");
    const view = within(dialog).getByLabelText("Sales: View");
    expect(view).not.toBeChecked();
    fireEvent.click(approve);
    expect(view).toBeChecked();
    expect(view).toBeDisabled();
    expect(within(dialog).getByLabelText("Inventory: View")).toBeChecked(); // approving a sale checks stock
    fireEvent.click(approve);
    expect(view).not.toBeChecked();
    expect(view).toBeEnabled();
  });

  it("will not let a person tick what they do not hold", async () => {
    const dialog = await newRole();
    expect(within(dialog).getByLabelText("Finance: Approve")).toBeDisabled(); // viewing finance is held, approving it is not
    expect(within(dialog).getByLabelText("Sales: Approve")).toBeEnabled();
  });

  it("names the role from what is typed, sends only what was ticked, and shows the rank choices below the person's own", async () => {
    const dialog = await newRole();
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Night supervisor" } });
    expect(within(dialog).getByLabelText(/^Key/)).toHaveValue("night_supervisor");
    const rank = within(dialog).getByLabelText(/^Rank/);
    expect([...rank.querySelectorAll("option")].map((o) => o.value)).toEqual(["75", "60", "50", "40", "30", "20"].filter((v) => Number(v) < 80));
    fireEvent.change(rank, { target: { value: "50" } });
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));
    await waitFor(() => expect(api.createRole).toHaveBeenCalledTimes(1));
    expect(api.createRole).toHaveBeenCalledWith({ key: "night_supervisor", name: "Night supervisor", description: "", rank: 50, permissions: ["sales.approve"] });
  });

  it("will not send a role with no name", async () => {
    const dialog = await newRole();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));
    expect(await within(dialog).findByText("Give the role a name")).toBeInTheDocument();
    expect(api.createRole).not.toHaveBeenCalled();
  });

  it("shows the server's own words when it refuses", async () => {
    api.createRole.mockRejectedValueOnce(new Error("This organisation already has a role with that key"));
    const dialog = await newRole();
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Spare role" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));
    expect(await within(dialog).findByText("This organisation already has a role with that key")).toBeInTheDocument();
  });

  it("an own role opens with its ticks as they were made, and saves a change", async () => {
    renderPage("/users?tab=roles");
    const table = await screen.findByRole("table", { name: "Roles" });
    fireEvent.click(within(within(table).getByText("Sales supervisor").closest("tr")).getByRole("button", { name: /Change/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Sales: Add and edit")).toBeChecked();
    expect(within(dialog).getByLabelText("Sales: View")).toBeDisabled(); // implied, so locked
    fireEvent.click(within(dialog).getByLabelText("Sales: Approve"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save role" }));
    await waitFor(() => expect(api.updateRole).toHaveBeenCalledTimes(1));
    expect(api.updateRole).toHaveBeenCalledWith("supervisor", { name: "Sales supervisor", description: "", rank: 55, permissions: ["sales.create", "sales.approve"] });
  });

  it("All and None work on a whole module, within what the person holds", async () => {
    const dialog = await newRole();
    const sales = within(dialog).getByText("Sales").closest("section");
    fireEvent.click(within(sales).getByRole("button", { name: "All" }));
    for (const name of ["Sales: View", "Sales: Add and edit", "Sales: Approve"]) expect(within(dialog).getByLabelText(name)).toBeChecked();
    fireEvent.click(within(sales).getByRole("button", { name: "None" }));
    for (const name of ["Sales: View", "Sales: Add and edit", "Sales: Approve"]) expect(within(dialog).getByLabelText(name)).not.toBeChecked();
    const finance = within(dialog).getByText("Finance").closest("section");
    fireEvent.click(within(finance).getByRole("button", { name: "All" }));
    expect(within(dialog).getByLabelText("Finance: View")).toBeChecked();
    expect(within(dialog).getByLabelText("Finance: Approve")).not.toBeChecked(); // not held, so All does not reach it
  });
});
