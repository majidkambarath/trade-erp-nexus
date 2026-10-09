import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderAs, statusFor } from "./asRole";

// What the chart of accounts offers to whom. The server refuses every write without accounts.manage; the screen only
// decides what to show, so a person who may look is not offered buttons that would answer "your role does not allow this".

const mocks = vi.hoisted(() => ({ chart: vi.fn(), restoreDefaults: vi.fn(), accountLedger: vi.fn() }));
let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));
vi.mock("../../../lib/accountingApi", () => ({
  accounting: { chart: mocks.chart, restoreDefaults: mocks.restoreDefaults, accountLedger: mocks.accountLedger, createAccount: vi.fn(), updateAccount: vi.fn(), createGroup: vi.fn(), updateGroup: vi.fn(), attachments: vi.fn(() => Promise.resolve([])), deleteAttachment: vi.fn() },
  uploadAttachment: vi.fn(), linkAttachment: vi.fn(), downloadAttachment: vi.fn(),
}));

import ChartOfAccounts from "../ChartOfAccounts";

const account = { _id: "a1", accountCode: "BANK0001", accountName: "Emirates NBD", description: "", isActive: true, isSystemAccount: false, allowDirectPosting: true, isMapped: false, hasEntries: true, documents: 0, balance: 5000, net: 5000 };
const CHART = {
  counts: { groups: 1, accounts: 1 },
  categories: [
    { category: "ASSET", total: 5000, net: 5000, ungrouped: [], groups: [{ _id: "g1", name: "Bank", prefix: "BANK", category: "ASSET", isActive: true, role: "bank", accounts: [account], children: [], total: 5000, net: 5000 }] },
    { category: "LIABILITY", total: 0, ungrouped: [], groups: [] },
    { category: "EQUITY", total: 0, ungrouped: [], groups: [] },
    { category: "INCOME", total: 0, ungrouped: [], groups: [] },
    { category: "EXPENSE", total: 0, ungrouped: [], groups: [] },
  ],
};
const EMPTY = { counts: { groups: 0, accounts: 0 }, categories: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((category) => ({ category, total: 0, ungrouped: [], groups: [] })) };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.chart.mockResolvedValue(CHART);
});

describe("chart of accounts: who may change it", () => {
  it("shows the tree but no way to create, edit or restore to someone who may only look", async () => {
    status = statusFor("accounts.view");
    await renderAs(<ChartOfAccounts />);
    expect(await screen.findByText("Emirates NBD")).toBeInTheDocument(); // the chart has loaded
    expect(screen.queryByRole("button", { name: /New account/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /New group/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Restore default accounts/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add account to Bank" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit group Bank" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Emirates NBD" })).toBeNull();
    // looking is untouched: the ledger of the account is still one tap away
    expect(screen.getByRole("button", { name: "Ledger of Emirates NBD" })).toBeInTheDocument();
  });

  it("does not offer accounts.manage through some other module's permission", async () => {
    status = statusFor("accounts.view", "finance.create", "finance.edit", "banking.manage", "settings.manage");
    await renderAs(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    expect(screen.queryByRole("button", { name: /New account/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Emirates NBD" })).toBeNull();
  });

  it("offers every action to someone who holds accounts.manage", async () => {
    status = statusFor("accounts.view", "accounts.manage");
    await renderAs(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    expect(screen.getByRole("button", { name: /New account/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New group/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restore default accounts/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add account to Bank" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit group Bank" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Emirates NBD" })).toBeInTheDocument();
  });

  it("gives an empty chart an explanation, not a prompt to create it, to someone who may only look", async () => {
    mocks.chart.mockResolvedValue(EMPTY);
    status = statusFor("accounts.view");
    await renderAs(<ChartOfAccounts />);
    expect(await screen.findByText("No accounts yet")).toBeInTheDocument();
    expect(screen.getByText(/Ask your administrator to create it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create the default chart" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create a group" })).toBeNull();
  });

  it("offers to create the first chart to someone who holds accounts.manage", async () => {
    mocks.chart.mockResolvedValue(EMPTY);
    status = statusFor("accounts.view", "accounts.manage");
    await renderAs(<ChartOfAccounts />);
    expect(await screen.findByText("No accounts yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create the default chart" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a group" })).toBeInTheDocument();
  });
});
