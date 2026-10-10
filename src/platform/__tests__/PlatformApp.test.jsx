import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../components/theme-provider";
import PlatformApp from "../PlatformApp";
import { clearConsoleSession, setConsoleSession } from "../platformSession";

// The developer console against a stand-in for its API: signing in, the list, creating an organisation and what is
// shown for it, and changing a feature, a limit and the status. What is SENT is the point, so each mock is inspected.
const api = vi.hoisted(() => ({
  login: vi.fn(),
  catalog: vi.fn(),
  organisations: vi.fn(),
  createOrganisation: vi.fn(),
  organisation: vi.fn(),
  updateOrganisation: vi.fn(),
  extend: vi.fn(),
  setStatus: vi.fn(),
  provision: vi.fn(),
  saveProfile: vi.fn(),
  users: vi.fn(),
  roles: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  branches: vi.fn(),
  createBranch: vi.fn(),
  updateBranch: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../platformApi", () => ({
  platform: api,
  consoleError: (e) => e?.response?.data?.message || e?.message || "Something went wrong",
  consoleErrorCode: (e) => e?.response?.data?.errorCode || null,
}));

const CATALOG = {
  plans: [
    { code: "trial", name: "Trial", trialDays: 14, features: { quotations: true }, limits: { users: 3, branches: 1, documentsPerMonth: 200 } },
    { code: "standard", name: "Standard", features: { quotations: true, banking: true }, limits: { users: 10, branches: 3, documentsPerMonth: 2000 } },
  ],
  features: [
    { key: "quotations", label: "Quotations" },
    { key: "banking", label: "Banks, cards and cheques" },
    { key: "einvoicing", label: "E-invoicing" },
  ],
  limits: ["users", "branches", "documentsPerMonth"],
  currencies: [{ code: "AED", name: "UAE Dirham" }, { code: "SAR", name: "Saudi Riyal" }],
  unsupportedCurrencies: ["KWD"],
  timezones: ["Asia/Dubai", "Asia/Riyadh"],
};

const ORG = {
  code: "acme",
  legalName: "Acme Trading LLC",
  country: "AE",
  baseCurrency: "AED",
  timezone: "Asia/Dubai",
  planCode: "standard",
  status: "active",
  featureOverrides: { einvoicing: true },
  limitOverrides: {},
  subscription: { endsAt: "2026-12-31T23:59:59.999Z", graceDays: 0, onExpiry: "block" },
  provisioning: { complete: true, steps: { chart: { state: "done" } } },
};
const detail = (over = {}) => ({
  organisation: { ...ORG, ...(over.organisation || {}) },
  features: {},
  limits: { users: 10, branches: 3, documentsPerMonth: 2000 },
  usage: { users: 2, branches: 1, documentsPerMonth: 40 },
  state: { state: "active", daysLeft: 80, onExpiry: "block" },
  room: { users: { ok: true }, branches: { ok: true }, documentsPerMonth: { ok: true } },
  profile: { legalName: "Acme Trading LLC", trn: "100123456700003", city: "Dubai", vatRegistered: true },
  ...over,
});

const renderConsole = (url = "/platform") =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        {/* mounted where the app mounts it, so its own routes are relative to /platform */}
        <Routes>
          <Route path="/platform/*" element={<PlatformApp />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

const signIn = () => setConsoleSession({ token: "t", user: { email: "dev@zarvia.test", name: "Dev" } });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  clearConsoleSession();
  api.catalog.mockResolvedValue(CATALOG);
  api.organisations.mockResolvedValue({ rows: [{ ...ORG, state: { state: "active", daysLeft: 80 }, features: {} }], total: 1 });
  api.organisation.mockResolvedValue(detail());
  api.updateOrganisation.mockResolvedValue(detail());
  api.setStatus.mockResolvedValue(detail());
  api.users.mockResolvedValue([]);
  api.roles.mockResolvedValue([]);
  api.branches.mockResolvedValue([]);
  api.audit.mockResolvedValue({ rows: [], total: 0 });
});

describe("signing in", () => {
  it("asks for a sign-in when there is no console session, and says why a sign-in failed", async () => {
    api.login.mockRejectedValueOnce({ response: { data: { message: "Invalid email or password" } } });
    renderConsole();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "dev@zarvia.test" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(api.organisations).not.toHaveBeenCalled();
  });

  it("opens the organisations once signed in, and signing out returns to the sign-in", async () => {
    api.login.mockResolvedValueOnce({ email: "dev@zarvia.test", name: "Dev" });
    renderConsole();
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "dev@zarvia.test" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "a-long-passphrase-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Organisations" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("the organisations", () => {
  it("lists each with its plan and where its subscription stands", async () => {
    signIn();
    renderConsole();
    expect(await screen.findByRole("link", { name: "Acme Trading LLC" })).toHaveAttribute("href", "/platform/organisations/acme");
    const table = screen.getByRole("table", { name: "Organisations" });
    expect(within(table).getByText("AE · AED")).toBeInTheDocument();
    expect(within(table).getByText("Active")).toBeInTheDocument();
  });

  it("says when there are none", async () => {
    signIn();
    api.organisations.mockResolvedValue({ rows: [], total: 0 });
    renderConsole();
    expect(await screen.findByText("No organisations yet")).toBeInTheDocument();
  });
});

describe("creating an organisation", () => {
  it("will not send an incomplete form, and says what is missing", async () => {
    signIn();
    renderConsole("/platform/new");
    await screen.findByRole("heading", { name: "New organisation" });
    fireEvent.click(await screen.findByRole("button", { name: "Create organisation" }));
    expect(await screen.findByText("Enter the organisation's legal name")).toBeInTheDocument();
    expect(screen.getByText("The first administrator needs a name")).toBeInTheDocument();
    expect(api.createOrganisation).not.toHaveBeenCalled();
  });

  it("sends the tidied form, then shows what was set up and the first administrator's password once", async () => {
    signIn();
    api.createOrganisation.mockResolvedValue({
      organisation: { ...ORG, legalName: "Gulf Fresh Foods LLC", code: "gulf-fresh" },
      provisioning: { complete: true, steps: { chart: { state: "done" }, taxCodes: { state: "done" } } },
      firstAdmin: { id: "1", email: "owner@gulffresh.example", type: "super_admin" },
    });
    renderConsole("/platform/new");
    await screen.findByRole("heading", { name: "New organisation" });
    fireEvent.change(await screen.findByLabelText(/Legal name/), { target: { value: "Gulf Fresh Foods LLC" } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Owner One" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "Owner@GulfFresh.example" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "a-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create organisation" }));

    await waitFor(() => expect(api.createOrganisation).toHaveBeenCalledTimes(1));
    expect(api.createOrganisation).toHaveBeenCalledWith({
      legalName: "Gulf Fresh Foods LLC",
      country: "AE",
      baseCurrency: "AED",
      timezone: "Asia/Dubai",
      planCode: "standard",
      firstAdmin: { name: "Owner One", email: "owner@gulffresh.example", password: "a-long-password" },
    });
    expect(await screen.findByText("Gulf Fresh Foods LLC is created")).toBeInTheDocument();
    expect(screen.getByText("a-long-password")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Gulf Fresh Foods LLC/ })).toHaveAttribute("href", "/platform/organisations/gulf-fresh");
  });

  it("says plainly when the organisation exists but its first administrator could not be made", async () => {
    signIn();
    api.createOrganisation.mockResolvedValue({
      organisation: { ...ORG, legalName: "Gulf Fresh Foods LLC", code: "gulf-fresh" },
      provisioning: { complete: true, steps: {} },
      firstAdmin: null,
      firstAdminError: "Email already exists",
    });
    renderConsole("/platform/new");
    fireEvent.change(await screen.findByLabelText(/Legal name/), { target: { value: "Gulf Fresh Foods LLC" } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Owner One" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "owner@gulffresh.example" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "a-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create organisation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("first administrator could not be created: Email already exists");
  });
});

describe("one organisation", () => {
  it("shows its state and use, and a suspension is confirmed before it is made", async () => {
    signIn();
    renderConsole("/platform/organisations/acme");
    expect(await screen.findByRole("heading", { name: "Acme Trading LLC" })).toBeInTheDocument();
    expect(screen.getByText("2 of 10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    expect(await screen.findByText("Suspend this organisation?")).toBeInTheDocument();
    expect(api.setStatus).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("acme", "suspended"));
  });

  it("offers Reopen, not Suspend, for a suspended organisation", async () => {
    signIn();
    api.organisation.mockResolvedValue(detail({ organisation: { status: "suspended" }, state: { state: "suspended" } }));
    renderConsole("/platform/organisations/acme");
    expect(await screen.findByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend" })).toBeNull();
  });

  it("sends only the features that changed, as an override or a reset", async () => {
    signIn();
    renderConsole("/platform/organisations/acme?tab=plan");
    await screen.findByRole("heading", { name: "Features" });
    // e-invoicing is overridden on; switching it back to the plan, and Quotations off, is two changes
    fireEvent.change(screen.getByLabelText("E-invoicing"), { target: { value: "default" } });
    fireEvent.change(screen.getByLabelText("Quotations"), { target: { value: "off" } });
    fireEvent.click(screen.getByRole("button", { name: "Save features" }));
    await waitFor(() => expect(api.updateOrganisation).toHaveBeenCalledTimes(1));
    expect(api.updateOrganisation).toHaveBeenCalledWith("acme", { featureOverrides: { quotations: false }, resetFeatures: ["einvoicing"] });
  });

  it("sets a limit to a number, to unlimited, or back to the plan, and refuses a bad number", async () => {
    signIn();
    renderConsole("/platform/organisations/acme?tab=plan");
    await screen.findByRole("heading", { name: "Limits" });
    fireEvent.change(screen.getByLabelText("People limit"), { target: { value: "number" } });
    const box = screen.getByLabelText("People limit number");
    fireEvent.change(box, { target: { value: "2.5" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(await screen.findByText("A limit is a whole number, 0 or more")).toBeInTheDocument();
    expect(api.updateOrganisation).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "25" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updateOrganisation).toHaveBeenCalledWith("acme", { limitOverrides: { users: 25 } }));
  });

  it("renews a subscription by days", async () => {
    signIn();
    renderConsole("/platform/organisations/acme?tab=subscription");
    fireEvent.click(await screen.findByRole("button", { name: "+ 90 days" }));
    await waitFor(() => expect(api.extend).toHaveBeenCalledWith("acme", { days: 90 }));
  });

  it("saves the subscription rules: an end date, a grace period and read-only at the end", async () => {
    signIn();
    renderConsole("/platform/organisations/acme?tab=subscription");
    await screen.findByText("After the grace period");
    fireEvent.change(screen.getByLabelText(/Grace period/), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText(/After the grace period/), { target: { value: "readonly" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updateOrganisation).toHaveBeenCalledTimes(1));
    expect(api.updateOrganisation.mock.calls[0][1]).toEqual({ subscription: { endsAt: "2026-12-31", graceDays: 7, onExpiry: "readonly" } });
  });

  it("shows the server's own words when a change is refused", async () => {
    signIn();
    api.updateOrganisation.mockRejectedValue({ response: { data: { message: "The base currency cannot be changed once the organisation is set up" } } });
    renderConsole("/platform/organisations/acme?tab=plan");
    await screen.findByRole("heading", { name: "Plan" });
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "trial" } });
    fireEvent.click(screen.getByRole("button", { name: "Change plan" }));
    // the full suite runs 160+ files at once; the default 1 s wait is too tight for this one under that load
    expect(await screen.findByText("The base currency cannot be changed once the organisation is set up", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("adds a person with a role and a branch", async () => {
    signIn();
    api.branches.mockResolvedValue([{ code: "main", name: "Head office", isHeadOffice: true, isActive: true }]);
    api.createUser.mockResolvedValue({ id: "9" });
    renderConsole("/platform/organisations/acme?tab=people");
    fireEvent.click(await screen.findByRole("button", { name: "Add a person" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Clerk One" } });
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: "clerk@acme.example" } });
    fireEvent.change(within(dialog).getByLabelText(/^Password/), { target: { value: "clerk-password-1" } });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "operator" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(api.createUser).toHaveBeenCalledTimes(1));
    expect(api.createUser).toHaveBeenCalledWith("acme", { name: "Clerk One", email: "clerk@acme.example", password: "clerk-password-1", role: "operator", branchId: "main" });
  });

  describe("roles", () => {
    const ROLES = [
      { key: "super_admin", name: "Owner", rank: 100, builtIn: true, isActive: true, people: 1 },
      { key: "accountant", name: "Accountant", rank: 50, builtIn: true, isActive: true, people: 0 },
      { key: "storekeeper", name: "Storekeeper", rank: 40, builtIn: true, isActive: true, people: 1 },
      { key: "yard_lead", name: "Yard lead", rank: 30, builtIn: false, isActive: true, people: 0 },
      { key: "retired", name: "Retired role", rank: 30, builtIn: false, isActive: false, people: 0 },
    ];
    const PEOPLE = [
      { _id: "u1", name: "Owen Owner", email: "owen@acme.example", type: "super_admin", role: { key: "super_admin", name: "Owner", rank: 100, active: true }, status: "active", isActive: true, branchId: "main" },
      { _id: "u2", name: "Sami Store", email: "sami@acme.example", type: "viewer", role: { key: "storekeeper", name: "Storekeeper", rank: 40, active: true }, status: "active", isActive: true, branchId: "main" },
    ];
    beforeEach(() => {
      signIn();
      api.roles.mockResolvedValue(ROLES);
      api.users.mockResolvedValue(PEOPLE);
      api.branches.mockResolvedValue([{ code: "main", name: "Head office", isHeadOffice: true, isActive: true }]);
      api.createUser.mockResolvedValue({ id: "9" });
      api.updateUser.mockResolvedValue({ id: "u2" });
    });
    const openChange = async (name) => {
      renderConsole("/platform/organisations/acme?tab=people");
      const row = (await screen.findByText(name)).closest("tr, li, article, div[role='row']") || screen.getByText(name).parentElement;
      fireEvent.click(within(row).getByRole("button", { name: "Change" }));
      return screen.findByRole("dialog");
    };

    it("names each person's role in words, the organisation's own and the ready-made ones alike", async () => {
      renderConsole("/platform/organisations/acme?tab=people");
      await screen.findByText("Sami Store");
      expect(screen.getAllByText("Storekeeper").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Owner").length).toBeGreaterThan(0);
    });

    it("offers the organisation's real roles in the box: ready-made, its own marked custom, and not one switched off", async () => {
      renderConsole("/platform/organisations/acme?tab=people");
      fireEvent.click(await screen.findByRole("button", { name: "Add a person" }));
      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(within(dialog).getByRole("option", { name: "Accountant" })).toBeInTheDocument());
      const labels = within(dialog).getAllByRole("option").map((o) => o.textContent);
      expect(labels).toEqual(expect.arrayContaining(["Owner", "Accountant", "Storekeeper", "Yard lead (custom)"]));
      expect(labels).not.toContain("Retired role (custom)");
      expect(labels).not.toContain("Retired role");
    });

    it("gives a new person a ready-made role by its key", async () => {
      renderConsole("/platform/organisations/acme?tab=people");
      fireEvent.click(await screen.findByRole("button", { name: "Add a person" }));
      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(within(dialog).getByRole("option", { name: "Accountant" })).toBeInTheDocument());
      fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Amal Accounts" } });
      fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: "amal@acme.example" } });
      fireEvent.change(within(dialog).getByLabelText(/^Password/), { target: { value: "amal-password-1" } });
      fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "yard_lead" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
      await waitFor(() => expect(api.createUser).toHaveBeenCalledTimes(1));
      expect(api.createUser).toHaveBeenCalledWith("acme", { name: "Amal Accounts", email: "amal@acme.example", password: "amal-password-1", role: "yard_lead", branchId: "main" });
    });

    it("changes someone's role, and sends nothing about the role when only the name changed", async () => {
      let dialog = await openChange("Sami Store");
      expect(within(dialog).getByLabelText("Role")).toHaveValue("storekeeper");
      fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Sami Stores" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateUser).toHaveBeenCalledTimes(1));
      expect(api.updateUser).toHaveBeenLastCalledWith("acme", "u2", { name: "Sami Stores" });

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      dialog = await openChange("Sami Store");
      fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "accountant" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateUser).toHaveBeenCalledTimes(2));
      expect(api.updateUser).toHaveBeenLastCalledWith("acme", "u2", { name: "Sami Store", role: "accountant" });
    });

    it("keeps showing a role the person holds even after it was switched off, and still lets a name be saved", async () => {
      api.users.mockResolvedValue([{ ...PEOPLE[1], role: { key: "retired", name: "Retired role", rank: 30, active: false }, type: "viewer" }]);
      const dialog = await openChange("Sami Store");
      expect(within(dialog).getByLabelText("Role")).toHaveValue("retired");
      fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Sami S" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateUser).toHaveBeenCalledTimes(1));
      expect(api.updateUser.mock.calls[0][2]).toEqual({ name: "Sami S" });
    });

    it("still works with the five original account types while the organisation's roles have not arrived", async () => {
      api.roles.mockRejectedValue(new Error("down"));
      renderConsole("/platform/organisations/acme?tab=people");
      fireEvent.click(await screen.findByRole("button", { name: "Add a person" }));
      const dialog = await screen.findByRole("dialog");
      const labels = within(dialog).getAllByRole("option").map((o) => o.textContent);
      expect(labels).toEqual(expect.arrayContaining(["Super administrator", "Administrator", "Manager", "Operator", "Viewer"]));
    });
  });
});
