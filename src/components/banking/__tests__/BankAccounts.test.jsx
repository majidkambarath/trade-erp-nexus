import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, configure } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The way from a bank to the company's account at it. A bank is the institution; the account is a
// chart-of-accounts account under the Bank group that names it. Before this the Banks screen said
// "0 branches" and led nowhere, so somebody who had just added a bank had no way to its account.

const m = vi.hoisted(() => ({ banks: vi.fn(), bankAccounts: vi.fn(), chart: vi.fn(), status: vi.fn() }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));
vi.mock("../../../lib/bankingApi", async (o) => {
  const original = await o();
  return { ...original, banking: { ...original.banking, banks: m.banks, bankAccounts: m.bankAccounts } };
});
vi.mock("../../../lib/accountingApi", async (o) => {
  const original = await o();
  return { ...original, accounting: { ...original.accounting, chart: m.chart } };
});

import { OrganisationProvider, useOrganisation } from "../../shell/OrganisationContext";
import BankMaster from "../BankMaster";

configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 20000 });

const BANKS = [
  { _id: "k1", bankName: "RAZAL ESAF", bankCode: "RESAF", swiftCode: "", country: "IN", city: "Malappuram", branches: [], isActive: true, accounts: { total: 2, active: 2 } },
  { _id: "k2", bankName: "Emirates NBD", bankCode: "ENBD", swiftCode: "EBILAEAD", country: "AE", city: "Dubai", branches: [], isActive: true, accounts: { total: 0, active: 0 } },
];
const ACCOUNTS = {
  bank: { _id: "k1", bankName: "RAZAL ESAF", bankCode: "RESAF", swiftCode: "", isActive: true },
  accounts: [
    { _id: "a1", accountCode: "1102", accountName: "RAZAL ESAF Current", groupId: "g-bank", isActive: true, allowDirectPosting: true, balance: 12400, bank: { bankId: "k1", bankName: "RAZAL ESAF", accountNumber: "9567675315", accountNumberMasked: "•••• 5315", iban: "AE070331234567890123456", accountHolder: "Brivox", branchCode: "" } },
    { _id: "a2", accountCode: "1103", accountName: "RAZAL ESAF Savings", groupId: "g-bank", isActive: false, allowDirectPosting: true, balance: 0, bank: { bankId: "k1", bankName: "RAZAL ESAF", accountNumber: "", accountNumberMasked: "", iban: "", accountHolder: "", branchCode: "" } },
  ],
};
const CHART = { categories: [{ category: "ASSET", net: 0, groups: [{ _id: "g-bank", name: "Bank", prefix: "11", role: "bank", children: [], accounts: [] }] }] };

const statusFor = (grants) => ({
  organisation: { legalName: "Brivox Production" }, subscription: { state: "active", blocked: false }, features: { banking: true },
  me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants },
});
// Nothing is hidden while the grants are still on their way, so every "is not there" check waits for this first.
function GrantsKnown() {
  const { me } = useOrganisation();
  return me ? <span data-testid="grants-known" /> : null;
}
const renderAs = async (grants) => {
  m.status.mockImplementation(() => Promise.resolve(statusFor(grants)));
  const view = render(<MemoryRouter><OrganisationProvider><GrantsKnown /><BankMaster /></OrganisationProvider></MemoryRouter>);
  await screen.findByTestId("grants-known");
  return view;
};

const VIEW = ["banking.view", "lookups.view", "accounts.view"];
const MANAGE = [...VIEW, "banking.manage", "accounts.manage"];

beforeEach(() => {
  vi.clearAllMocks();
  m.banks.mockResolvedValue(BANKS);
  m.bankAccounts.mockResolvedValue(ACCOUNTS);
  m.chart.mockResolvedValue(CHART);
});

describe("a bank's accounts", () => {
  it("counts the accounts at each bank, and says so when there is none", async () => {
    await renderAs(VIEW);
    expect(await screen.findByRole("button", { name: /accounts at razal esaf/i })).toHaveTextContent("2 accounts");
    expect(screen.getByRole("button", { name: /accounts at emirates nbd/i })).toHaveTextContent("No account yet");
    // the branches count it replaced: it read "0 branches" on every row and led nowhere
    expect(screen.queryByText(/0 branches/i)).not.toBeInTheDocument();
  });

  it("opens the bank to its accounts, with the number masked and the balance from the chart", async () => {
    await renderAs(VIEW);
    fireEvent.click(await screen.findByRole("button", { name: /accounts at razal esaf/i }));
    const dialog = await screen.findByRole("dialog");
    expect(m.bankAccounts).toHaveBeenCalledWith("k1");
    expect(await within(dialog).findByText("RAZAL ESAF Current")).toBeInTheDocument();
    expect(within(dialog).getByText("1102")).toBeInTheDocument();
    expect(within(dialog).getByText("•••• 5315")).toBeInTheDocument();
    expect(within(dialog).getByText("AE070331234567890123456")).toBeInTheDocument();
    expect(within(dialog).getByText(/12,400/)).toBeInTheDocument();
    // an inactive account is listed too: it is part of why a bank refuses to be switched off
    expect(within(dialog).getByText("RAZAL ESAF Savings")).toBeInTheDocument();
    expect(within(dialog).getByText("Inactive")).toBeInTheDocument();
  });

  it("a bank with no account says so, and offers to add one", async () => {
    await renderAs(MANAGE);
    m.bankAccounts.mockResolvedValue({ bank: { _id: "k2", bankName: "Emirates NBD" }, accounts: [] });
    fireEvent.click(await screen.findByRole("button", { name: /accounts at emirates nbd/i }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/no account at this bank yet/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /add a bank account/i })).toBeInTheDocument();
  });

  it("adding an account opens the chart's own form with the bank already chosen", async () => {
    await renderAs(MANAGE);
    fireEvent.click(await screen.findByRole("button", { name: /accounts at razal esaf/i }));
    fireEvent.click(await screen.findByRole("button", { name: /add a bank account/i }));
    // the chart's own account form, on the Bank group - so it draws the bank details section
    const details = (await screen.findByText(/bank details/i)).closest("fieldset");
    expect(within(details).getByLabelText(/iban/i)).toBeInTheDocument();
    // the bank is filled in from where the form was opened, so nobody picks it again
    expect(await within(details).findByText("RAZAL ESAF")).toBeInTheDocument();
    expect(m.chart).toHaveBeenCalled();
  });

  it("someone who may not read the chart or the banking screens gets no way in", async () => {
    await renderAs(["lookups.view"]);
    expect(await screen.findByText("RAZAL ESAF")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accounts at razal esaf/i })).not.toBeInTheDocument();
    expect(screen.getByText("2 accounts")).toBeInTheDocument(); // still says how many, just not a way in
  });

  it("adding is accounts.manage, not banking.manage: a bank editor is not offered it", async () => {
    await renderAs([...VIEW, "banking.manage"]);
    fireEvent.click(await screen.findByRole("button", { name: /accounts at razal esaf/i }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("RAZAL ESAF Current")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /add a bank account/i })).not.toBeInTheDocument();
  });
});
