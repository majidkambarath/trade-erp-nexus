import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import UsersPage from "../UsersPage";
import { OrganisationProvider } from "../../shell/OrganisationContext";

// Users and roles: who has two-factor on, and the action that clears it for someone who has lost their phone. Offered only to a
// person who may manage users, only for people below their own rank, never for themselves - hidden, not disabled, otherwise.
const api = vi.hoisted(() => ({ users: vi.fn(), roles: vi.fn(), resetTwoFactor: vi.fn(), createUser: vi.fn(), updateUser: vi.fn() }));
let status;
vi.mock("../../../lib/accessApi", () => ({ access: api }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));

const role = (key, name, rank) => ({ key, name, rank, description: "", builtIn: true, isActive: true, permissions: [], people: 1 });
const person = (id, name, key, rank, over = {}) => ({ id, name, email: `${name.toLowerCase().split(" ")[0]}@acc.test`, role: { key, name: key, rank, builtIn: true, active: true }, branchId: "main", isActive: true, status: "active", lastLogin: null, twoFactorEnabled: false, ...over });
const USERS = [
  person("u-admin", "Ada Admin", "admin", 80, { twoFactorEnabled: true }),
  person("u-mgr", "Manu Manager", "manager", 60, { twoFactorEnabled: true }),
  person("u-vw", "Vera Viewer", "viewer", 20, { twoFactorEnabled: false }),
  person("u-own", "Olu Owner", "super_admin", 100, { twoFactorEnabled: true }),
];
const statusFor = (grants) => ({
  organisation: { legalName: "Acc Trading" }, subscription: { state: "active", blocked: false }, features: {},
  branches: [{ code: "main", name: "Head office", isHeadOffice: true }], branch: { code: "main", name: "Head office", canSwitch: false },
  me: { id: "u-admin", name: "Ada Admin", role: { key: "admin", name: "Administrator", rank: 80 }, grants },
});
const MANAGE = ["users.view", "users.manage", "lookups.view"];

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/users"]}>
        <OrganisationProvider><Routes><Route path="/users" element={<UsersPage />} /></Routes></OrganisationProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
const rowOf = async (name) => within(await screen.findByRole("table", { name: "People" })).getByText(name).closest("tr");

beforeEach(() => {
  vi.clearAllMocks();
  status = statusFor(MANAGE);
  api.users.mockResolvedValue(USERS);
  api.roles.mockResolvedValue({ catalogue: [], roles: [role("admin", "Administrator", 80), role("manager", "Manager", 60), role("viewer", "Viewer", 20), role("super_admin", "Owner", 100)] });
  api.resetTwoFactor.mockResolvedValue({ id: "u-mgr", twoFactorEnabled: false });
});

describe("the indicator", () => {
  it("says who has two-factor on and who has not", async () => {
    renderPage();
    expect(within(await rowOf("Manu Manager")).getByText("2FA on")).toBeInTheDocument();
    expect(within(await rowOf("Vera Viewer")).getByText("2FA off")).toBeInTheDocument();
    expect(within(await rowOf("Olu Owner")).getByText("2FA on")).toBeInTheDocument();
  });
});

describe("resetting someone's two-factor", () => {
  it("is offered for a person below the administrator's rank who has it on", async () => {
    renderPage();
    expect(within(await rowOf("Manu Manager")).getByRole("button", { name: "Reset two-factor for Manu Manager" })).toBeInTheDocument();
  });

  it("is not offered for someone who has it off, for the owner above, or for oneself", async () => {
    renderPage();
    expect(within(await rowOf("Vera Viewer")).queryByRole("button", { name: /Reset two-factor/ })).toBeNull(); // off: nothing to reset
    expect(within(await rowOf("Olu Owner")).queryByRole("button", { name: /Reset two-factor/ })).toBeNull(); // outranks the administrator
    expect(within(await rowOf("Ada Admin")).queryByRole("button", { name: /Reset two-factor/ })).toBeNull(); // oneself
  });

  it("is hidden from a person who may only look at the list", async () => {
    status = statusFor(["users.view", "lookups.view"]);
    renderPage();
    await rowOf("Manu Manager");
    await waitFor(() => expect(screen.queryByRole("button", { name: /Add a person/ })).toBeNull());
    expect(screen.queryByRole("button", { name: /Reset two-factor/ })).toBeNull();
    // the indicator itself is still there to read
    expect(within(await rowOf("Manu Manager")).getByText("2FA on")).toBeInTheDocument();
  });

  it("asks first, names the consequence, and only then clears it and reads the list again", async () => {
    renderPage();
    fireEvent.click(within(await rowOf("Manu Manager")).getByRole("button", { name: "Reset two-factor for Manu Manager" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Reset two-factor for Manu Manager?")).toBeInTheDocument();
    expect(within(dialog).getByText(/signed out everywhere/)).toBeInTheDocument();
    expect(api.resetTwoFactor).not.toHaveBeenCalled();
    const reads = api.users.mock.calls.length;
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset two-factor" }));
    await waitFor(() => expect(api.resetTwoFactor).toHaveBeenCalledWith("u-mgr"));
    await waitFor(() => expect(api.users.mock.calls.length).toBeGreaterThan(reads));
    expect(await screen.findByText("Two-factor reset for Manu Manager")).toBeInTheDocument();
  });

  it("cancelling clears nothing", async () => {
    renderPage();
    fireEvent.click(within(await rowOf("Manu Manager")).getByRole("button", { name: "Reset two-factor for Manu Manager" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.resetTwoFactor).not.toHaveBeenCalled();
  });

  it("shows the server's words when it refuses", async () => {
    api.resetTwoFactor.mockRejectedValue(Object.assign(new Error("x"), { response: { data: { message: "Two-factor is not on for that person." } } }));
    renderPage();
    fireEvent.click(within(await rowOf("Manu Manager")).getByRole("button", { name: "Reset two-factor for Manu Manager" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset two-factor" }));
    expect(await screen.findByText("Two-factor is not on for that person.")).toBeInTheDocument();
  });
});
