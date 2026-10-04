import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  configuration: vi.fn(), chart: vi.fn(), saveMappings: vi.fn(), setPosting: vi.fn(),
  fiscalYears: vi.fn(), createFiscalYear: vi.fn(), closeFiscalYear: vi.fn(), reopenFiscalYear: vi.fn(), numberSeries: vi.fn(),
  taxCodes: vi.fn(), createTaxCode: vi.fn(), updateTaxCode: vi.fn(),
  settings: vi.fn(), saveSettings: vi.fn(), auditLog: vi.fn(),
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));

import AccountingSetup from "../AccountingSetup";

const at = (url = "/accounting-setup") => render(<MemoryRouter initialEntries={[url]}><AccountingSetup /></MemoryRouter>);
beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

const CHART = {
  counts: { groups: 2, accounts: 2 },
  categories: [
    { category: "ASSET", total: 0, ungrouped: [], groups: [{ _id: "g1", name: "Tax Receivable", category: "ASSET", accounts: [{ _id: "acc-input", accountCode: "TAXA0001", accountName: "Input VAT", isActive: true }], children: [] }] },
    { category: "LIABILITY", total: 0, ungrouped: [], groups: [{ _id: "g2", name: "Tax Payable", category: "LIABILITY", accounts: [{ _id: "acc-output", accountCode: "TAXL0001", accountName: "Output VAT", isActive: true }], children: [] }] },
    { category: "EQUITY", total: 0, ungrouped: [], groups: [] }, { category: "INCOME", total: 0, ungrouped: [], groups: [] }, { category: "EXPENSE", total: 0, ungrouped: [], groups: [] },
  ],
};
const cfgRow = (over) => ({ configKey: "vat-sales", displayName: "Output VAT", accountCategory: "LIABILITY", targetKind: "account", parentConfigKey: "sales-group", isActive: true, targetGroup: null, targetAccount: null, ...over });
const CONFIG = (rows, enabled = false) => ({ ledgerPostingEnabled: enabled, accountConfiguration: rows });

describe("posting accounts", () => {
  it("lists each business event with its account, and shows what is still unmapped", async () => {
    m.chart.mockResolvedValue(CHART);
    m.configuration.mockResolvedValue(CONFIG([
      cfgRow({ targetAccount: { _id: "acc-output" } }),
      cfgRow({ configKey: "vat-purchase", displayName: "Input VAT", accountCategory: "ASSET", parentConfigKey: "purchase-group" }),
    ]));
    at();
    expect(await screen.findByText(/1 of 2 accounts mapped/)).toBeInTheDocument();
    expect(screen.getByText(/still to map:/)).toHaveTextContent("Input VAT");
    // the chosen account is shown in its picker
    expect(screen.getByText("Output VAT", { selector: ".search-select__single-value *, .search-select__single-value" })).toBeInTheDocument();
    // pickers only offer accounts of the right category
    fireEvent.keyDown(screen.getByLabelText("Account for Input VAT"), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: /Input VAT/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Output VAT/ })).toBeNull();
    // cannot switch posting on while anything is unmapped
    expect(screen.getByRole("button", { name: "Switch on" })).toBeDisabled();
  });

  it("saves only what changed", async () => {
    m.chart.mockResolvedValue(CHART);
    m.configuration.mockResolvedValue(CONFIG([cfgRow(), cfgRow({ configKey: "vat-purchase", displayName: "Input VAT", accountCategory: "ASSET", parentConfigKey: "purchase-group", targetAccount: { _id: "acc-input" } })]));
    m.saveMappings.mockResolvedValue({});
    at();
    await screen.findByLabelText("Account for Output VAT");
    expect(screen.getByRole("button", { name: "Save mappings" })).toBeDisabled();
    // type to find the account, Enter to choose it
    const picker = screen.getByLabelText("Account for Output VAT");
    fireEvent.change(picker, { target: { value: "output" } });
    fireEvent.keyDown(picker, { key: "Enter" });
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save mappings" }));
    await waitFor(() => expect(m.saveMappings).toHaveBeenCalledWith([{ configKey: "vat-sales", targetAccount: "acc-output" }]));
    expect(await screen.findByText("1 mapping saved")).toBeInTheDocument();
  });

  it("asks before switching ledger posting on, and surfaces the server's refusal", async () => {
    m.chart.mockResolvedValue(CHART);
    m.configuration.mockResolvedValue(CONFIG([cfgRow({ targetAccount: { _id: "acc-output" } })]));
    m.setPosting.mockRejectedValue(new Error("Map these accounts first: cogs"));
    at();
    const btn = await screen.findByRole("button", { name: "Switch on" });
    fireEvent.click(btn);
    const dialog = await screen.findByRole("dialog", { name: "Switch ledger posting on?" });
    expect(within(dialog).getByText(/posted now/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch on" }));
    expect(await screen.findByText("Map these accounts first: cogs")).toBeInTheDocument();
    expect(m.setPosting).toHaveBeenCalledWith(true);
  });
});

describe("fiscal years", () => {
  const YEARS = [{ _id: "y1", code: "2026", startDate: "2026-01-01T00:00:00Z", endDate: "2026-12-31T00:00:00Z", status: "open" }, { _id: "y0", code: "2025", startDate: "2025-01-01T00:00:00Z", endDate: "2025-12-31T00:00:00Z", status: "closed" }];
  beforeEach(() => { m.fiscalYears.mockResolvedValue(YEARS); m.numberSeries.mockResolvedValue([{ _id: "n1", series: "SO", fiscalYear: "2026", prefix: "SO", next: 12 }]); });

  it("lists years and numbering", async () => {
    at("/accounting-setup?tab=years");
    expect(await screen.findByRole("heading", { name: "Fiscal years" })).toBeInTheDocument();
    const row = (await screen.findAllByText("2026"))[0].closest("tr"); // the years table comes first
    expect(within(row).getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("closing a year names the consequence and needs confirmation", async () => {
    m.closeFiscalYear.mockResolvedValue({});
    at("/accounting-setup?tab=years");
    fireEvent.click(await screen.findByRole("button", { name: /Close year/ }));
    const dialog = await screen.findByRole("dialog", { name: "Close 2026?" });
    expect(within(dialog).getByText(/can be created, approved, edited, deleted or reversed/)).toBeInTheDocument();
    expect(m.closeFiscalYear).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close year" }));
    await waitFor(() => expect(m.closeFiscalYear).toHaveBeenCalledWith("y1"));
    expect(await screen.findByText("2026 closed")).toBeInTheDocument();
  });

  it("validates a new year and explains an overlap", async () => {
    m.createFiscalYear.mockRejectedValue(Object.assign(new Error("Fiscal year overlaps with existing year 2026"), { code: "DATE_OVERLAP" }));
    at("/accounting-setup?tab=years");
    fireEvent.click(await screen.findByRole("button", { name: /New fiscal year/ }));
    const dialog = await screen.findByRole("dialog", { name: "New fiscal year" });
    fireEvent.change(within(dialog).getByLabelText(/Ends/), { target: { value: "2000-01-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add year" }));
    expect(await within(dialog).findByText("The end date must be after the start date")).toBeInTheDocument();
    expect(m.createFiscalYear).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Ends/), { target: { value: "2026-12-31" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add year" }));
    expect(await within(dialog).findByText(/Years cannot overlap/)).toBeInTheDocument();
  });
});

describe("tax codes", () => {
  beforeEach(() => m.taxCodes.mockResolvedValue([{ _id: "t1", name: "Standard 5%", kind: "standard", ratePercent: 5, isDefault: true, isActive: true, rateHistory: [{ date: "2027-01-01T00:00:00Z", ratePercent: 6 }] }]));

  it("shows the treatment, rate and scheduled rate change", async () => {
    at("/accounting-setup?tab=tax");
    expect(await screen.findByText("Standard 5%")).toBeInTheDocument();
    expect(screen.getByText("Standard-rated")).toBeInTheDocument();
    expect(screen.getByText(/6.00% from 01\/01\/2027/)).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("refuses a standard-rated code with no rate, and sends rate changes with the code", async () => {
    m.createTaxCode.mockResolvedValue({});
    at("/accounting-setup?tab=tax");
    fireEvent.click(await screen.findByRole("button", { name: /New tax code/ }));
    const dialog = await screen.findByRole("dialog", { name: "New tax code" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create tax code" }));
    expect(await within(dialog).findByText("Give the tax code a name")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: "Phased" } });
    fireEvent.change(within(dialog).getByLabelText(/Rate \(%\)/), { target: { value: "0" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create tax code" }));
    expect(await within(dialog).findByText("A standard-rated code needs a rate above 0")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Rate \(%\)/), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add a rate change/ }));
    fireEvent.change(within(dialog).getByLabelText("From"), { target: { value: "2027-01-01" } });
    fireEvent.change(within(dialog).getByLabelText("New rate (%)"), { target: { value: "6" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create tax code" }));
    await waitFor(() => expect(m.createTaxCode).toHaveBeenCalledTimes(1));
    expect(m.createTaxCode.mock.calls[0][0]).toMatchObject({ name: "Phased", kind: "standard", ratePercent: 5, rateHistory: [{ date: "2027-01-01", ratePercent: 6 }] });
  });
});

describe("rules", () => {
  const SETTINGS = { creditControl: { mode: "off", overdueBlockDays: 0 }, returnWindowDays: 0, requireReturnLink: false, profile: { legalName: "NH Foods LLC", trn: "" } };
  beforeEach(() => { m.settings.mockResolvedValue(SETTINGS); m.saveSettings.mockResolvedValue({}); });

  it("saves credit control with the chosen mode and overdue limit", async () => {
    at("/accounting-setup?tab=rules");
    fireEvent.click(await screen.findByRole("radio", { name: /Warn/ }));
    fireEvent.change(screen.getByLabelText(/overdue by more than/), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save credit control" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ creditControl: { mode: "warn", overdueBlockDays: 30 } }));
  });

  it("saves the return rules", async () => {
    at("/accounting-setup?tab=rules");
    fireEvent.click(await screen.findByLabelText(/Every return must name its original invoice/));
    fireEvent.change(screen.getByLabelText(/Accept returns within/), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Save return rules" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ returnWindowDays: 14, requireReturnLink: true }));
  });

  it("rejects a TRN that is not 15 digits before calling the server", async () => {
    at("/accounting-setup?tab=rules");
    fireEvent.change(await screen.findByLabelText(/Tax registration number/), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Save company profile" }));
    expect(await screen.findByText("A UAE TRN is exactly 15 digits")).toBeInTheDocument();
    expect(m.saveSettings).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Tax registration number/), { target: { value: "100123456700003" } });
    fireEvent.click(screen.getByRole("button", { name: "Save company profile" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledTimes(1));
    expect(m.saveSettings.mock.calls[0][0].profile).toMatchObject({ trn: "100123456700003", legalName: "NH Foods LLC" });
  });
});

describe("audit log", () => {
  it("shows entries newest first, expands before/after, and filters", async () => {
    m.auditLog.mockResolvedValue({ page: 1, pages: 1, total: 1, rows: [{ _id: "l1", action: "PERIOD_CLOSED", entity: "FiscalYear", summary: "2026 closed", username: "admin@test.uae", at: "2026-10-04T10:00:00Z", before: { status: "open" }, after: { status: "closed" } }] });
    at("/accounting-setup?tab=audit");
    expect(await screen.findByText("PERIOD_CLOSED")).toBeInTheDocument();
    expect(screen.getByText(/admin@test.uae/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show details of PERIOD_CLOSED" }));
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "PERIOD_CLOSED" } });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    await waitFor(() => expect(m.auditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: "PERIOD_CLOSED", page: 1 })));
  });
});

describe("the page", () => {
  it("keeps the selected tab in the URL", async () => {
    m.fiscalYears.mockResolvedValue([]); m.numberSeries.mockResolvedValue([]);
    at("/accounting-setup?tab=years");
    expect(await screen.findByRole("tab", { name: "Fiscal years", selected: true })).toBeInTheDocument();
  });
});
