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

const act = (action, short, label) => ({ action, short, label: label || `${short} things` });
const CATALOG = {
  plans: [
    { code: "trial", name: "Trial", trialDays: 14, features: { quotations: true }, modules: { sales: true, inventory: true, finance: true, reports: true }, limits: { users: 3, branches: 1, documentsPerMonth: 200 } },
    { code: "standard", name: "Standard", features: { quotations: true, banking: true }, modules: { sales: true, inventory: true, finance: true, reports: true }, limits: { users: 10, branches: 3, documentsPerMonth: 2000 } },
  ],
  groups: [{ key: "trade", label: "Buying, selling and stock" }, { key: "money", label: "Money and books" }],
  modules: [
    { key: "sales", label: "Sales", hint: "Sales documents and customers", group: "trade", sections: [{ feature: "quotations" }, "Orders", "Invoices"], actions: [act("view", "View", "See sales documents"), act("create", "Add"), act("approve", "Approve")], alwaysOn: [] },
    { key: "inventory", label: "Inventory", hint: "Items and stock", group: "trade", sections: ["Stock items", { feature: "production" }], actions: [act("view", "View"), act("adjust", "Adjust stock")], alwaysOn: [] },
    { key: "finance", label: "Finance", hint: "Vouchers", group: "money", sections: ["Receipts", { feature: "banking" }], actions: [act("view", "View"), act("create", "Add")], alwaysOn: [] },
    { key: "reports", label: "Reports", hint: "The dashboard and reports", group: "money", sections: ["Dashboard", { feature: "einvoicing" }], actions: [act("view", "View"), act("financial", "Financial reports")], alwaysOn: ["view"] },
  ],
  features: [
    { key: "quotations", label: "Quotations", hint: "Price offers that become orders", module: "sales", optIn: false, onlyIn: null },
    { key: "production", label: "Production", hint: "Materials and expenses moved into a product's cost", module: "inventory", optIn: true, onlyIn: null },
    { key: "banking", label: "Banks, cards and cheques", hint: "Bank and card masters and cheques", module: "finance", optIn: false, onlyIn: null },
    { key: "einvoicing", label: "E-invoicing", hint: "Electronic tax invoices", module: "reports", optIn: false, onlyIn: ["AE"] },
  ],
  // what each ready-made role holds in each module: the panel says who gets what is sold
  roles: [
    { key: "super_admin", name: "Owner", rank: 100, modules: { sales: ["view", "create", "approve"], inventory: ["view", "adjust"], finance: ["view", "create"], reports: ["view", "financial"] } },
    { key: "viewer", name: "Viewer", rank: 20, modules: { sales: ["view"], inventory: ["view"], reports: ["view"] } },
    { key: "storekeeper", name: "Storekeeper", rank: 40, modules: { inventory: ["view", "adjust"], sales: ["view"] } },
  ],
  limits: ["users", "branches", "documentsPerMonth"],
  currencies: [{ code: "AED", name: "UAE Dirham" }, { code: "SAR", name: "Saudi Riyal" }, { code: "INR", name: "Indian Rupee" }],
  unsupportedCurrencies: ["KWD"],
  timezones: ["Asia/Dubai", "Asia/Riyadh", "Asia/Kolkata"],
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

  it("chooses the modules while creating, and sends only what differs from the plan", async () => {
    signIn();
    api.createOrganisation.mockResolvedValue({
      organisation: { ...ORG, legalName: "Barakat Trading LLC", code: "barakat" },
      provisioning: { complete: true, steps: { chart: { state: "done" } } },
      firstAdmin: { id: "1", email: "owner@barakat.example", type: "super_admin" },
    });
    renderConsole("/platform/new");
    await screen.findByRole("heading", { name: "New organisation" });
    expect(await screen.findByText("Everything the plan includes.")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("switch", { name: "Finance" }));
    expect(screen.getByRole("switch", { name: "Finance" })).toHaveAttribute("aria-checked", "false");
    // the line above the list says what this customer is getting instead, before anything is sent
    expect(await screen.findByText("Different from the plan: Finance.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Legal name/), { target: { value: "Barakat Trading LLC" } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Owner Two" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "owner@barakat.example" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "a-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create organisation" }));

    await waitFor(() => expect(api.createOrganisation).toHaveBeenCalledTimes(1));
    // Sales and Reports were left alone, so the organisation carries nothing about them
    expect(api.createOrganisation.mock.calls[0][0].moduleOverrides).toEqual({ finance: false });
    expect(api.createOrganisation.mock.calls[0][0].featureOverrides).toBeUndefined();
  });

  it("groups the modules, and opens one to show its parts inside it: Production under Inventory", async () => {
    signIn();
    api.createOrganisation.mockResolvedValue({
      organisation: { ...ORG, legalName: "Brivox Production", code: "brivox" },
      provisioning: { complete: true, steps: {} },
      firstAdmin: { id: "1", email: "owner@brivox.example", type: "super_admin" },
    });
    renderConsole("/platform/new");
    await screen.findByRole("heading", { name: "New organisation" });
    expect(await screen.findByRole("heading", { name: "Buying, selling and stock" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Money and books" })).toBeInTheDocument();
    // nothing is open until asked, and the part is not a loose switch on the page
    expect(screen.queryByRole("switch", { name: "Production" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Inventory details" }));
    const production = screen.getByRole("switch", { name: "Production" });
    expect(production).toHaveAttribute("aria-checked", "false"); // in no plan: switched on one customer at a time
    expect(screen.getByText("Optional extra")).toBeInTheDocument();
    fireEvent.click(production);
    expect(production).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Different from the plan: Production.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Legal name/), { target: { value: "Brivox Production" } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Owner Three" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "owner@brivox.example" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "a-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create organisation" }));
    await waitFor(() => expect(api.createOrganisation).toHaveBeenCalledTimes(1));
    // a part is a feature override, and only the one that differs from the plan is sent
    expect(api.createOrganisation.mock.calls[0][0].featureOverrides).toEqual({ production: true });
    expect(api.createOrganisation.mock.calls[0][0].moduleOverrides).toBeUndefined();
  });

  it("says who gets a module, from the ready-made roles, and nobody when it is switched off", async () => {
    signIn();
    renderConsole("/platform/new");
    await screen.findByRole("heading", { name: "New organisation" });
    fireEvent.click(await screen.findByRole("button", { name: "Sales details" }));
    const sales = screen.getByRole("switch", { name: "Sales" }).closest("li");
    const reach = () => within(sales).getAllByRole("term").map((t, i) => `${t.textContent}: ${within(sales).getAllByRole("definition")[i].textContent}`);
    expect(reach()).toEqual(["Owner: Full access", "Storekeeper: View only", "Viewer: View only"]);
    // selling Sales as far as looking only cuts every role down to that, exactly as the server does
    fireEvent.click(within(sales).getByRole("button", { name: "Sales: view only" }));
    expect(reach()).toEqual(["Owner: Full access", "Storekeeper: Full access", "Viewer: Full access"]);
    fireEvent.click(screen.getByRole("switch", { name: "Sales" }));
    expect(within(sales).getByText(/Nobody: Sales is not included/)).toBeInTheDocument();
  });

  it("sets the time zone and currency from the country, for India as for every other country", async () => {
    signIn();
    api.createOrganisation.mockResolvedValue({
      organisation: { ...ORG, legalName: "Kerala Spices Pvt Ltd", code: "kerala", country: "IN" },
      provisioning: { complete: true, steps: {} },
      firstAdmin: { id: "1", email: "owner@kerala.example", type: "super_admin" },
    });
    renderConsole("/platform/new");
    await screen.findByRole("heading", { name: "New organisation" });
    const pick = async (name, text) => {
      fireEvent.keyDown(screen.getByRole("combobox", { name }), { key: "ArrowDown" });
      fireEvent.click(await screen.findByRole("option", { name: new RegExp(text) }));
    };
    await pick(/Country/, "^India");
    // the zone is the one India uses, by the name the server accepts, and the clock there is shown beside it
    expect(await screen.findByText(/Set from India\. It is .* there now \(UTC\+05:30\)\./)).toBeInTheDocument();
    expect(screen.getByText("Asia/Kolkata")).toBeInTheDocument();
    expect(screen.getByText(/INR/)).toBeInTheDocument();
    // VAT return and e-invoicing are the UAE's own: the form says so instead of offering them
    fireEvent.click(screen.getByRole("button", { name: "Reports details" }));
    expect(screen.getByRole("switch", { name: "E-invoicing" })).toBeDisabled();
    expect(screen.getByText(/Only for organisations in United Arab Emirates, so it is not available in India\./)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Legal name/), { target: { value: "Kerala Spices Pvt Ltd" } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Owner Four" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "owner@kerala.example" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "a-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create organisation" }));
    await waitFor(() => expect(api.createOrganisation).toHaveBeenCalledTimes(1));
    expect(api.createOrganisation.mock.calls[0][0]).toMatchObject({ country: "IN", baseCurrency: "INR", timezone: "Asia/Kolkata" });
  });

  it("puts the country that was typed first, so typing India and pressing Enter chooses India", async () => {
    signIn();
    renderConsole("/platform/new");
    await screen.findByRole("heading", { name: "New organisation" });
    const box = screen.getByRole("combobox", { name: /Country/ });
    fireEvent.change(box, { target: { value: "india" } });
    // the list is alphabetical, and "British Indian Ocean Territory" contains the word: it must not come first
    const options = within(await screen.findByRole("listbox")).getAllByRole("option"); // the Plan box has native options too
    expect(options[0]).toHaveTextContent(/^India/);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(await screen.findByText(/Set from India\./)).toBeInTheDocument();
    expect(screen.getByText("Asia/Kolkata")).toBeInTheDocument();
  });

  it("does not let a country whose time zones the books cannot use be created, and says why", async () => {
    signIn();
    renderConsole("/platform/new");
    await screen.findByRole("heading", { name: "New organisation" });
    fireEvent.keyDown(screen.getByRole("combobox", { name: /Country/ }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: /United States/ }));
    expect(await screen.findByText(/United States cannot be set up yet: its time zones are west of UTC/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create organisation" }));
    expect(api.createOrganisation).not.toHaveBeenCalled();
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

  it("sells a module in part, switches one off, and sends only what changed", async () => {
    signIn();
    renderConsole("/platform/organisations/acme?tab=plan");
    await screen.findByRole("heading", { name: "Modules" });
    // Finance is not bought at all: one switch
    fireEvent.click(screen.getByRole("switch", { name: "Finance" }));
    expect(screen.getByRole("switch", { name: "Finance" })).toHaveAttribute("aria-checked", "false");
    // Reports is sold as far as looking only, which is the rarer answer and lives inside the module
    fireEvent.click(screen.getByRole("button", { name: "Reports details" }));
    const reports = screen.getByRole("switch", { name: "Reports" }).closest("li");
    const view = within(reports).getByRole("checkbox", { name: /View/ });
    expect(view).toBeChecked();
    expect(view).toBeDisabled(); // the server puts it back whatever is ticked, so the tick cannot pretend otherwise
    expect(within(reports).getByText("(always on)")).toBeInTheDocument();
    fireEvent.click(within(reports).getByRole("checkbox", { name: "Financial reports" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.updateOrganisation).toHaveBeenCalledTimes(1));
    // Sales was not touched, so it is not in the body; Reports keeps only what the plan can never take away
    expect(api.updateOrganisation).toHaveBeenCalledWith("acme", { moduleOverrides: { finance: false, reports: ["view"] } });
  });

  it("sends only the parts that changed, as an override or a reset, in the same save as a module", async () => {
    signIn();
    renderConsole("/platform/organisations/acme?tab=plan");
    await screen.findByRole("heading", { name: "Modules" });
    // e-invoicing is stored as overridden on: put it back to the plan (a reset), then Quotations off (an override)
    fireEvent.click(screen.getByRole("button", { name: "Reports details" }));
    fireEvent.click(screen.getByRole("button", { name: "E-invoicing: follow the plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Sales details" }));
    expect(screen.getByRole("switch", { name: "Quotations" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("switch", { name: "Quotations" }));
    expect(screen.getByRole("switch", { name: "Quotations" })).toHaveAttribute("aria-checked", "false");
    // Finance too, so one Save carries a module and a part together
    fireEvent.click(screen.getByRole("switch", { name: "Finance" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.updateOrganisation).toHaveBeenCalledTimes(1));
    expect(api.updateOrganisation).toHaveBeenCalledWith("acme", { moduleOverrides: { finance: false }, featureOverrides: { quotations: false }, resetFeatures: ["einvoicing"] });
  });

  it("switching a part back to what the plan says stores nothing for it", async () => {
    signIn();
    renderConsole("/platform/organisations/acme?tab=plan");
    await screen.findByRole("heading", { name: "Modules" });
    fireEvent.click(screen.getByRole("button", { name: "Sales details" }));
    // nothing to save, so no save bar
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Quotations" })); // off: differs from the plan
    expect(screen.getByRole("region", { name: "Unsaved changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    fireEvent.click(screen.getByRole("switch", { name: "Quotations" })); // on again: the plan's own answer
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(api.updateOrganisation).not.toHaveBeenCalled();
  });

  it("offers to discard what was changed and not yet saved", async () => {
    signIn();
    renderConsole("/platform/organisations/acme?tab=plan");
    await screen.findByRole("heading", { name: "Modules" });
    const finance = screen.getByRole("switch", { name: "Finance" });
    expect(finance).toHaveAttribute("aria-checked", "true");
    fireEvent.click(finance);
    expect(finance).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("switch", { name: "Finance" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("region", { name: "Unsaved changes" })).toBeNull();
    expect(api.updateOrganisation).not.toHaveBeenCalled();
  });

  it("does not offer the UAE's own features to an organisation elsewhere", async () => {
    signIn();
    api.organisation.mockResolvedValue(detail({ organisation: { country: "IN", baseCurrency: "INR", timezone: "Asia/Kolkata", featureOverrides: {} } }));
    renderConsole("/platform/organisations/acme?tab=plan");
    await screen.findByRole("heading", { name: "Modules" });
    fireEvent.click(screen.getByRole("button", { name: "Reports details" }));
    expect(screen.getByRole("switch", { name: "E-invoicing" })).toBeDisabled();
    expect(screen.getByText(/not available in India/)).toBeInTheDocument();
  });

  it("draws the features on their own when an older server sends no module catalogue", async () => {
    signIn();
    const { modules, groups, roles, ...older } = CATALOG; // eslint-disable-line no-unused-vars
    api.catalog.mockResolvedValue({ ...older, features: older.features.map(({ module, hint, ...f }) => f) }); // eslint-disable-line no-unused-vars
    renderConsole("/platform/organisations/acme?tab=plan");
    expect(await screen.findByRole("heading", { name: "More features" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Quotations" })).toHaveAttribute("aria-checked", "true");
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


  it("changes an organisation's time zone, and only when it really changed", async () => {
    signIn();
    // Brivox: an Indian organisation whose books were made on Dubai time
    api.organisation.mockResolvedValue(detail({ organisation: { legalName: "Brivox Production", code: "brivox", country: "IN", baseCurrency: "INR", timezone: "Asia/Dubai" } }));
    renderConsole("/platform/organisations/brivox?tab=company");
    await screen.findByRole("heading", { name: "Country, currency and time zone" });
    // the country and the currency are stated, and cannot be edited here
    expect(screen.getByLabelText("Country")).toBeDisabled();
    expect(screen.getByLabelText("Base currency")).toHaveValue("INR");
    const save = screen.getByRole("button", { name: "Save time zone" });
    expect(save).toBeDisabled(); // nothing has changed yet

    const box = screen.getByRole("combobox", { name: /Time zone/ });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: /Asia\/Kolkata/ }));
    expect(screen.getByText(/It is .* there now \(UTC\+05:30\)\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save time zone" }));
    await waitFor(() => expect(api.updateOrganisation).toHaveBeenCalledTimes(1));
    expect(api.updateOrganisation).toHaveBeenCalledWith("brivox", { timezone: "Asia/Kolkata" });
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
