import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderAs, statusFor } from "./asRole";

// Accounting setup: who is offered what. Posting map, fiscal years, tax codes and the ledger-posting switch need
// accounts.manage; closing and reopening a year is its own permission, accounts.close. The server refuses the rest.

const m = vi.hoisted(() => ({
  configuration: vi.fn(), chart: vi.fn(), saveMappings: vi.fn(), setPosting: vi.fn(),
  fiscalYears: vi.fn(), createFiscalYear: vi.fn(), closeFiscalYear: vi.fn(), reopenFiscalYear: vi.fn(), numberSeries: vi.fn(),
  taxCodes: vi.fn(), createTaxCode: vi.fn(), updateTaxCode: vi.fn(), auditLog: vi.fn(),
}));
let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));

import AccountingSetup from "../AccountingSetup";

const at = (url) => renderAs(<MemoryRouter initialEntries={[url]}><AccountingSetup /></MemoryRouter>);
beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

const CHART = {
  counts: { groups: 1, accounts: 1 },
  categories: [
    { category: "ASSET", total: 0, ungrouped: [], groups: [] },
    { category: "LIABILITY", total: 0, ungrouped: [], groups: [{ _id: "g2", name: "Tax Payable", category: "LIABILITY", accounts: [{ _id: "acc-output", accountCode: "TAXL0001", accountName: "Output VAT", isActive: true }], children: [] }] },
    { category: "EQUITY", total: 0, ungrouped: [], groups: [] }, { category: "INCOME", total: 0, ungrouped: [], groups: [] }, { category: "EXPENSE", total: 0, ungrouped: [], groups: [] },
  ],
};
const cfgRow = (over) => ({ configKey: "vat-sales", displayName: "VAT on sales", accountCategory: "LIABILITY", targetKind: "account", parentConfigKey: "sales-group", isActive: true, targetGroup: null, targetAccount: { _id: "acc-output", accountName: "Output VAT", accountCode: "TAXL0001" }, ...over });

describe("posting accounts", () => {
  beforeEach(() => {
    m.chart.mockResolvedValue(CHART);
    m.configuration.mockResolvedValue({ ledgerPostingEnabled: false, accountConfiguration: [cfgRow()] });
  });

  it("shows what each event posts to, but no picker, no Save and no posting switch, to someone who may only look", async () => {
    status = statusFor("accounts.view");
    await at("/accounting-setup?tab=posting");
    expect(await screen.findByText(/1 of 1 accounts mapped/)).toBeInTheDocument(); // the map has loaded
    expect(screen.getByText("VAT on sales")).toBeInTheDocument();
    expect(screen.getByText("Output VAT")).toBeInTheDocument(); // what it posts to, as words
    expect(screen.queryByLabelText("Account for VAT on sales")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save mappings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Switch on" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Switch off" })).toBeNull();
  });

  it("offers the pickers, Save and the posting switch to someone who holds accounts.manage", async () => {
    status = statusFor("accounts.view", "accounts.manage");
    await at("/accounting-setup?tab=posting");
    expect(await screen.findByText(/1 of 1 accounts mapped/)).toBeInTheDocument();
    expect(screen.getByLabelText("Account for VAT on sales")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save mappings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch on" })).toBeInTheDocument();
  });

  it("offers the switch to turn posting off, and only to someone who holds accounts.manage", async () => {
    m.configuration.mockResolvedValue({ ledgerPostingEnabled: true, accountConfiguration: [cfgRow()] });
    status = statusFor("accounts.view");
    const { unmount } = await at("/accounting-setup?tab=posting");
    await screen.findByText(/1 of 1 accounts mapped/);
    expect(screen.queryByRole("button", { name: "Switch off" })).toBeNull();
    unmount();

    status = statusFor("accounts.view", "accounts.manage");
    await at("/accounting-setup?tab=posting");
    expect(await screen.findByRole("button", { name: "Switch off" })).toBeInTheDocument();
  });
});

describe("fiscal years", () => {
  const YEARS = [
    { _id: "y1", code: "2026", startDate: "2026-01-01T00:00:00Z", endDate: "2026-12-31T00:00:00Z", status: "open" },
    { _id: "y0", code: "2025", startDate: "2025-01-01T00:00:00Z", endDate: "2025-12-31T00:00:00Z", status: "closed" },
  ];
  beforeEach(() => {
    m.fiscalYears.mockResolvedValue(YEARS);
    m.numberSeries.mockResolvedValue([{ _id: "n1", series: "SO", fiscalYear: "2026", prefix: "SO", next: 12 }]);
  });

  it("lists the years and the numbering but offers no way to add, close or reopen to someone who may only look", async () => {
    status = statusFor("accounts.view");
    await at("/accounting-setup?tab=years");
    expect(await screen.findByRole("table", { name: "Fiscal years" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Number series" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New fiscal year/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Close year/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reopen/ })).toBeNull();
  });

  it("lets accounts.manage add a year but not close or reopen one", async () => {
    status = statusFor("accounts.view", "accounts.manage");
    await at("/accounting-setup?tab=years");
    await screen.findByRole("table", { name: "Fiscal years" });
    expect(screen.getByRole("button", { name: /New fiscal year/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Close year/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reopen/ })).toBeNull();
  });

  it("lets accounts.close close and reopen a year but not add one", async () => {
    status = statusFor("accounts.view", "accounts.close");
    await at("/accounting-setup?tab=years");
    await screen.findByRole("table", { name: "Fiscal years" });
    expect(screen.getByRole("button", { name: /Close year/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reopen/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New fiscal year/ })).toBeNull();
  });

  it("offers everything to someone who holds both", async () => {
    status = statusFor("accounts.view", "accounts.manage", "accounts.close");
    await at("/accounting-setup?tab=years");
    await screen.findByRole("table", { name: "Fiscal years" });
    expect(screen.getByRole("button", { name: /New fiscal year/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close year/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reopen/ })).toBeInTheDocument();
  });

  it("explains an empty list instead of prompting a reader to add a year", async () => {
    m.fiscalYears.mockResolvedValue([]);
    m.numberSeries.mockResolvedValue([]);
    status = statusFor("accounts.view");
    await at("/accounting-setup?tab=years");
    expect(await screen.findByText("No fiscal years")).toBeInTheDocument();
    expect(screen.getByText(/posting is not restricted by period/)).toBeInTheDocument();
    expect(screen.queryByText(/Add the current year/)).toBeNull();
    expect(screen.queryByRole("button", { name: /New fiscal year/ })).toBeNull();
  });
});

describe("tax codes", () => {
  beforeEach(() => m.taxCodes.mockResolvedValue([{ _id: "t1", name: "Standard 5%", kind: "standard", ratePercent: 5, isDefault: true, isActive: true, rateHistory: [] }]));

  it("lists the codes but offers no New or Edit to someone who may only look", async () => {
    status = statusFor("accounts.view");
    await at("/accounting-setup?tab=tax");
    expect(await screen.findByText("Standard 5%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New tax code/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Standard 5%" })).toBeNull();
  });

  it("offers New and Edit to someone who holds accounts.manage", async () => {
    status = statusFor("accounts.view", "accounts.manage");
    await at("/accounting-setup?tab=tax");
    expect(await screen.findByText("Standard 5%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New tax code/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Standard 5%" })).toBeInTheDocument();
  });

  it("explains an empty list instead of prompting a reader to add a code", async () => {
    m.taxCodes.mockResolvedValue([]);
    status = statusFor("accounts.view");
    await at("/accounting-setup?tab=tax");
    expect(await screen.findByText("No tax codes")).toBeInTheDocument();
    expect(screen.getByText(/Ask your administrator to add one/)).toBeInTheDocument();
    expect(screen.queryByText(/Add a standard-rated code/)).toBeNull();
    expect(screen.queryByRole("button", { name: /New tax code/ })).toBeNull();
  });
});

describe("the audit log tab", () => {
  it("is a reading screen: it has no write control to hide, and opens for someone who may only look", async () => {
    m.auditLog.mockResolvedValue({ page: 1, pages: 1, total: 1, rows: [{ _id: "l1", action: "PERIOD_CLOSED", entity: "FiscalYear", summary: "2026 closed", username: "admin@test.uae", at: "2026-10-04T10:00:00Z", before: {}, after: {} }] });
    status = statusFor("accounts.view");
    await at("/accounting-setup?tab=audit");
    expect(await screen.findByText("PERIOD_CLOSED")).toBeInTheDocument();
  });
});
