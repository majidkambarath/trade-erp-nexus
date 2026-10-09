import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import BranchSettings from "../BranchSettings";
import { OrganisationProvider } from "../../shell/OrganisationContext";

// The Branches tab against a stand-in for its API: what it offers to whom, how the plan's feature and limit read, what is
// sent when a branch is added or changed, and the server's own words when it refuses (a branch with people in it).
const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn() }));
let status;
vi.mock("../../../lib/branchApi", () => ({ branchesApi: api }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));

const branch = (code, name, over = {}) => ({ code, name, isHeadOffice: false, isActive: true, address: { city: "Dubai", line1: "Street 1" }, phone: "", email: "", people: 0, ...over });
const ROWS = [
  branch("main", "Head office", { isHeadOffice: true, people: 4 }),
  branch("shj", "Sharjah Warehouse", { address: { city: "Sharjah", line1: "Industrial Area 3" }, phone: "06 555 0000", people: 2 }),
  branch("ajm", "Ajman Depot", { isActive: false, address: { city: "Ajman" } }),
];
const baseStatus = ({ grants = ["settings.view", "settings.manage"], multiBranch = true, limit = 10 } = {}) => ({
  organisation: { legalName: "Acc Trading" }, subscription: { state: "active", blocked: false },
  features: { multiBranch }, limits: { branches: limit }, usage: { branches: 2 }, support: { contact: "help@zarvia.test" },
  branches: [{ code: "main", name: "Head office", isHeadOffice: true }], branch: { code: "main", name: "Head office", canSwitch: false },
  me: { id: "u1", name: "Olivia", role: { key: "admin", name: "Administrator", rank: 80 }, grants },
});

const renderTab = (notify = vi.fn()) =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <OrganisationProvider>
          <BranchSettings notify={notify} />
        </OrganisationProvider>
      </MemoryRouter>
    </ThemeProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  status = baseStatus();
  api.list.mockResolvedValue(ROWS);
  api.create.mockImplementation(async (b) => branch(b.code, b.name));
  api.update.mockImplementation(async (code, b) => branch(code, b.name || "Updated"));
});

describe("the list", () => {
  it("shows every branch with its code, city, people and state; the head office is marked", async () => {
    renderTab();
    const table = await screen.findByRole("table", { name: "Branches" });
    const row = (name) => within(table).getAllByText(name)[0].closest("tr");
    expect(within(row("Head office")).getAllByText("Head office")).toHaveLength(2); // its name, and the badge
    expect(within(row("Sharjah Warehouse")).getByText("shj")).toBeInTheDocument();
    expect(within(row("Sharjah Warehouse")).getByText("Sharjah")).toBeInTheDocument();
    expect(within(row("Sharjah Warehouse")).getByText("2 people")).toBeInTheDocument();
    expect(within(row("Sharjah Warehouse")).getByText("Active")).toBeInTheDocument();
    expect(within(row("Ajman Depot")).getByText("Switched off")).toBeInTheDocument();
  });

  it("says where the plan stands, counting only the branches that are switched on", async () => {
    renderTab();
    expect(await screen.findByText("2 branches in use of 10")).toBeInTheDocument();
  });

  it("offers Change on every branch and Switch off only on a branch that is not the head office", async () => {
    renderTab();
    const table = await screen.findByRole("table", { name: "Branches" });
    const row = (name) => within(table).getAllByText(name)[0].closest("tr");
    expect(within(row("Head office")).getByRole("button", { name: "Change Head office" })).toBeInTheDocument();
    expect(within(row("Head office")).queryByRole("button", { name: /Switch/ })).toBeNull();
    expect(within(row("Sharjah Warehouse")).getByRole("button", { name: "Switch off Sharjah Warehouse" })).toBeInTheDocument();
    expect(within(row("Ajman Depot")).getByRole("button", { name: "Switch on Ajman Depot" })).toBeInTheDocument();
  });
});

describe("who may change what", () => {
  it("shows the list but no way to add or change to someone who may only look", async () => {
    status = baseStatus({ grants: ["settings.view"] });
    renderTab();
    await screen.findByRole("table", { name: "Branches" });
    expect(screen.queryByRole("button", { name: /Add a branch/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Change/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Switch/ })).toBeNull();
  });

  it("offers no Add when the plan has no more than one branch, and says so with who to ask", async () => {
    status = baseStatus({ multiBranch: false });
    renderTab();
    expect(await screen.findByText(/More than one branch is not included in your plan\. Contact help@zarvia\.test/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add a branch/ })).toBeNull();
  });

  it("offers no Add once the plan's branches are all in use", async () => {
    status = baseStatus({ limit: 2 });
    renderTab();
    expect(await screen.findByText(/Your plan allows 2 branches and all are in use/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add a branch/ })).toBeNull();
  });
});

describe("adding a branch", () => {
  it("suggests a code from the name, and sends the code, name, address, city, phone and email", async () => {
    const notify = vi.fn();
    renderTab(notify);
    fireEvent.click(await screen.findByRole("button", { name: /Add a branch/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Dubai Showroom" } });
    expect(within(dialog).getByLabelText(/^Code/)).toHaveValue("dubai");
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: "DXB" } });
    expect(within(dialog).getByLabelText(/^Code/)).toHaveValue("dxb"); // lower-cased as typed
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Dubai Showroom 2" } });
    expect(within(dialog).getByLabelText(/^Code/)).toHaveValue("dxb"); // once typed by hand it is left alone
    fireEvent.change(within(dialog).getByLabelText(/^City/), { target: { value: "Dubai" } });
    fireEvent.change(within(dialog).getByLabelText(/^Address/), { target: { value: "Sheikh Zayed Road" } });
    fireEvent.change(within(dialog).getByLabelText(/^Phone/), { target: { value: "04 000 0000" } });
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: "dxb@acc.test" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add branch" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith({ code: "dxb", name: "Dubai Showroom 2", addressLine1: "Sheikh Zayed Road", city: "Dubai", phone: "04 000 0000", email: "dxb@acc.test" });
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Dubai Showroom 2 added"));
  });

  it("will not send a branch with no name or a bad code, and says what is wrong", async () => {
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /Add a branch/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add branch" }));
    expect(await within(dialog).findByText("Give the branch a name")).toBeInTheDocument();
    expect(within(dialog).getByText("Use 2 to 20 lower-case letters, digits or hyphens")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("shows the server's own words when it refuses", async () => {
    api.create.mockRejectedValueOnce(new Error("That branch code is already used"));
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /Add a branch/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Sharjah Two" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add branch" }));
    expect(await within(dialog).findByText("That branch code is already used")).toBeInTheDocument();
  });
});

describe("changing a branch", () => {
  it("opens with what it holds, cannot change the code, and sends only what changed", async () => {
    renderTab();
    const table = await screen.findByRole("table", { name: "Branches" });
    fireEvent.click(within(within(table).getByText("Sharjah Warehouse").closest("tr")).getByRole("button", { name: "Change Sharjah Warehouse" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/^Code/)).toBeDisabled();
    expect(within(dialog).getByLabelText(/^Address/)).toHaveValue("Industrial Area 3");
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Sharjah Depot" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("shj", { name: "Sharjah Depot" }));
  });

  it("sends nothing when nothing changed", async () => {
    renderTab();
    const table = await screen.findByRole("table", { name: "Branches" });
    fireEvent.click(within(within(table).getByText("Sharjah Warehouse").closest("tr")).getByRole("button", { name: "Change Sharjah Warehouse" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.update).not.toHaveBeenCalled();
  });
});

describe("switching a branch off and on", () => {
  it("asks first, names what it means, and switches off", async () => {
    const notify = vi.fn();
    renderTab(notify);
    const table = await screen.findByRole("table", { name: "Branches" });
    fireEvent.click(within(within(table).getByText("Sharjah Warehouse").closest("tr")).getByRole("button", { name: "Switch off Sharjah Warehouse" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Nothing is deleted/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch off" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("shj", { isActive: false }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Sharjah Warehouse is switched off"));
  });

  it("says why when people still work there (the server's words), and changes nothing", async () => {
    api.update.mockRejectedValueOnce(new Error("2 people work in this branch and would be locked out. Move them to another branch first."));
    const notify = vi.fn();
    renderTab(notify);
    const table = await screen.findByRole("table", { name: "Branches" });
    fireEvent.click(within(within(table).getByText("Sharjah Warehouse").closest("tr")).getByRole("button", { name: "Switch off Sharjah Warehouse" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Switch off" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("2 people work in this branch and would be locked out. Move them to another branch first.", "error"));
  });

  it("switches a branch back on without asking", async () => {
    const notify = vi.fn();
    renderTab(notify);
    const table = await screen.findByRole("table", { name: "Branches" });
    fireEvent.click(within(within(table).getByText("Ajman Depot").closest("tr")).getByRole("button", { name: "Switch on Ajman Depot" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("ajm", { isActive: true }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Ajman Depot is switched on"));
  });
});
