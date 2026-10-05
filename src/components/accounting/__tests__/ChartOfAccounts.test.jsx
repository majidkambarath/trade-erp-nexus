import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  chart: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  createGroup: vi.fn(),
  restoreDefaults: vi.fn(),
  accountLedger: vi.fn(),
  attachments: vi.fn(),
  uploadAttachment: vi.fn(),
  linkAttachment: vi.fn(),
}));

vi.mock("../../../lib/accountingApi", () => ({
  accounting: {
    chart: mocks.chart,
    createAccount: mocks.createAccount,
    updateAccount: mocks.updateAccount,
    createGroup: mocks.createGroup,
    restoreDefaults: mocks.restoreDefaults,
    updateGroup: vi.fn(),
    accountLedger: mocks.accountLedger,
    attachments: mocks.attachments,
    deleteAttachment: vi.fn(),
  },
  uploadAttachment: mocks.uploadAttachment,
  linkAttachment: mocks.linkAttachment,
  downloadAttachment: vi.fn(),
}));

import ChartOfAccounts from "../ChartOfAccounts";

const account = (over) => ({
  _id: "a1", accountCode: "BANK0001", accountName: "Emirates NBD", description: "", isActive: true, isSystemAccount: false,
  allowDirectPosting: true, isMapped: false, hasEntries: true, documents: 0, balance: 5000, net: 5000, ...over,
});
// `role` is what the server works out from the posting map (bank | receivable | payable | cash | creditCard | other)
const group = (over) => ({ _id: "g1", name: "Bank", prefix: "BANK", category: "ASSET", isActive: true, role: "bank", accounts: [account()], children: [], total: 5000, net: 5000, ...over });
const CHART = {
  counts: { groups: 3, accounts: 2 },
  categories: [
    { category: "ASSET", total: 5000, net: 5000, ungrouped: [], groups: [group({ _id: "ca", name: "Current Assets", prefix: "CA", role: "other", accounts: [], total: 5000, net: 5000, children: [group()] })] },
    { category: "LIABILITY", total: 0, ungrouped: [], groups: [] },
    { category: "EQUITY", total: 0, ungrouped: [], groups: [] },
    { category: "INCOME", total: 0, ungrouped: [], groups: [group({ _id: "gs", name: "Sales Income", prefix: "SAL", category: "INCOME", role: "other", accounts: [account({ _id: "a2", accountCode: "SAL0001", accountName: "Sales Revenue", isMapped: true, isSystemAccount: true, balance: 0, net: 0 }), account({ _id: "a3", accountCode: "SAL0002", accountName: "Old discounts", isActive: false, balance: 0, net: 0 })], total: 0 })] },
    { category: "EXPENSE", total: 0, ungrouped: [], groups: [] },
  ],
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.chart.mockResolvedValue(CHART);
  mocks.attachments.mockResolvedValue([]);
});

describe("chart of accounts", () => {
  it("shows the tree with balances, and flags posting and system accounts", async () => {
    render(<ChartOfAccounts />);
    expect(await screen.findByText("Emirates NBD")).toBeInTheDocument();
    expect(screen.getByText("BANK0001")).toBeInTheDocument();
    expect(screen.getByText("Sales Revenue")).toBeInTheDocument();
    expect(screen.getByText("Posting")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("2 accounts in 3 groups")).toBeInTheDocument();
    // the rolled-up category total appears on the summary card and on the section row
    expect(screen.getAllByText("5,000.00").length).toBeGreaterThanOrEqual(2);
    // and every balance says which side it is on
    expect(screen.getAllByTitle("Debit balance").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Dr").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a credit balance as Cr, and a nil balance with no side", async () => {
    mocks.chart.mockResolvedValue({
      ...CHART,
      categories: CHART.categories.map((c) => (c.category === "LIABILITY"
        ? { ...c, total: 300, net: -300, groups: [group({ _id: "gp", name: "Accounts Payable", prefix: "AP", category: "LIABILITY", role: "payable", total: 300, net: -300, accounts: [account({ _id: "v1", accountCode: "AP0001", accountName: "Vendor - Gulf Mills", balance: 300, net: -300 })], children: [] })] }
        : c)),
    });
    render(<ChartOfAccounts />);
    await screen.findByText("Vendor - Gulf Mills");
    expect(screen.getAllByTitle("Credit balance").length).toBeGreaterThanOrEqual(2);
    // the nil balances of the sales accounts carry no Dr / Cr
    const sales = screen.getByText("Sales Revenue").closest("div");
    expect(within(sales).queryByTitle("Debit balance")).toBeNull();
    expect(within(sales).queryByTitle("Credit balance")).toBeNull();
  });

  it("hides inactive accounts until asked, and searches by code or name", async () => {
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    expect(screen.queryByText("Old discounts")).toBeNull();
    fireEvent.click(screen.getByLabelText("Show inactive"));
    expect(screen.getByText("Old discounts")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search accounts"), { target: { value: "sal0001" } });
    expect(screen.getByText("Sales Revenue")).toBeInTheDocument();
    expect(screen.queryByText("Emirates NBD")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search accounts"), { target: { value: "zzz" } });
    expect(screen.queryByText("Sales Revenue")).toBeNull();
  });

  it("collapses a group", async () => {
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    fireEvent.click(screen.getByRole("button", { name: "Collapse Bank" }));
    expect(screen.queryByText("Emirates NBD")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand Bank" }));
    expect(screen.getByText("Emirates NBD")).toBeInTheDocument();
  });

  it("validates the new-account form before calling the server", async () => {
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    fireEvent.click(screen.getByRole("button", { name: /New account/ }));
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create account" }));
    expect(await within(dialog).findByText("Choose the group this account belongs to")).toBeInTheDocument();
    expect(within(dialog).getByText("Give the account a name")).toBeInTheDocument();
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("finds a group by typing its name or its code prefix, instead of scrolling a long list", async () => {
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    fireEvent.click(screen.getByRole("button", { name: /New account/ }));
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    expect(within(dialog).getByText("Search or choose a group…")).toBeInTheDocument();
    const picker = within(dialog).getByLabelText(/Group/);
    fireEvent.change(picker, { target: { value: "ban" } });
    fireEvent.keyDown(picker, { key: "Enter" });
    expect(await within(dialog).findByText("Code will start with BANK")).toBeInTheDocument();
    expect(dialog.querySelector(".search-select__single-value")).toHaveTextContent("Bank");
  });

  it("creates an account with an opening balance and attaches the files that were added", async () => {
    mocks.createAccount.mockResolvedValue({ _id: "new1", accountCode: "BANK0002", accountName: "ADCB" });
    mocks.uploadAttachment.mockResolvedValue({ attachmentId: "f1", fileName: "letter.pdf", fileType: "application/pdf", fileSize: 2048 });
    mocks.linkAttachment.mockResolvedValue({});
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    fireEvent.click(screen.getByRole("button", { name: "Add account to Bank" }));
    const dialog = await screen.findByRole("dialog", { name: "New account" });

    expect(dialog.querySelector(".search-select__single-value")).toHaveTextContent("Bank"); // preselected from the row
    expect(within(dialog).getByText("Code will start with BANK")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Account name/), { target: { value: "ADCB" } });
    fireEvent.change(within(dialog).getByLabelText(/Amount/), { target: { value: "2500.50" } });
    fireEvent.change(within(dialog).getByLabelText("Side"), { target: { value: "credit" } });

    const file = new File(["%PDF-1.4"], "letter.pdf", { type: "application/pdf" });
    fireEvent.change(within(dialog).getByLabelText("Add documents"), { target: { files: [file] } });
    expect(await within(dialog).findByText("letter.pdf")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mocks.createAccount).toHaveBeenCalledTimes(1));
    expect(mocks.createAccount.mock.calls[0][0]).toMatchObject({
      groupId: "g1", accountName: "ADCB", openingBalance: 2500.5, openingSide: "credit",
    });
    // the file was uploaded unlinked while typing, then linked to the new account
    await waitFor(() => expect(mocks.linkAttachment).toHaveBeenCalledWith("f1", { ownerType: "account", ownerId: "new1" }));
    expect(await screen.findByText("BANK0002 ADCB created")).toBeInTheDocument();
    expect(mocks.chart).toHaveBeenCalledTimes(2); // refreshed
  });

  it("shows a duplicate-name error on the field, not as a toast", async () => {
    const err = Object.assign(new Error('An account named "ADCB" already exists'), { code: "DUPLICATE_ACCOUNT" });
    mocks.createAccount.mockRejectedValue(err);
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    fireEvent.click(screen.getByRole("button", { name: "Add account to Bank" }));
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    fireEvent.change(within(dialog).getByLabelText(/Account name/), { target: { value: "ADCB" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create account" }));
    expect(await within(dialog).findByText('An account named "ADCB" already exists')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Account name/)).toHaveAttribute("aria-invalid", "true");
  });

  it("Escape closes the dialog; clicking outside does not lose the form", async () => {
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    fireEvent.click(screen.getByRole("button", { name: /New account/ }));
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    fireEvent.click(dialog.parentElement); // the backdrop
    expect(screen.getByRole("dialog", { name: "New account" })).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("editing opens the account's saved documents and sends only the editable fields", async () => {
    mocks.updateAccount.mockResolvedValue({});
    mocks.attachments.mockResolvedValue([{ attachmentId: "d1", fileName: "licence.pdf", fileType: "application/pdf", fileSize: 1024 }]);
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    fireEvent.click(screen.getByRole("button", { name: "Edit Emirates NBD" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit BANK0001" });
    expect(await within(dialog).findByText("licence.pdf")).toBeInTheDocument();
    expect(mocks.attachments).toHaveBeenCalledWith("account", "a1");
    expect(within(dialog).queryByText(/Opening balance/)).toBeNull(); // not editable after creation
    fireEvent.change(within(dialog).getByLabelText(/Account name/), { target: { value: "Emirates NBD Current" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.updateAccount).toHaveBeenCalledTimes(1));
    expect(mocks.updateAccount.mock.calls[0][0]).toBe("a1");
    expect(mocks.updateAccount.mock.calls[0][1]).toMatchObject({ accountName: "Emirates NBD Current", groupId: "g1" });
    expect(mocks.updateAccount.mock.calls[0][1]).not.toHaveProperty("openingBalance");
  });

  it("opens an account's ledger with its running balance", async () => {
    mocks.accountLedger.mockResolvedValue({
      opening: 0, openingNet: 0, closing: 5000, closingNet: 5000, totals: { debit: 5000, credit: 0 },
      rows: [
        { _id: "e1", date: "2026-10-01T08:00:00Z", voucherNo: "OB-BANK0001", narration: "Opening balance", debit: 5000, credit: 0, balance: 5000, net: 5000 },
        { _id: "e2", date: "2026-10-02T08:00:00Z", voucherNo: "PV-2026-0001", narration: "Paid out", debit: 0, credit: 6200, balance: -1200, net: -1200 },
      ],
    });
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    fireEvent.click(screen.getByRole("button", { name: "Ledger of Emirates NBD" }));
    const dialog = await screen.findByRole("dialog", { name: /BANK0001/ });
    expect(await within(dialog).findByText("OB-BANK0001")).toBeInTheDocument();
    expect(within(dialog).getByText("Closing balance")).toBeInTheDocument();
    // the running balance carries its side, and turns to Cr when the account is overdrawn
    const row = within(dialog).getByText("PV-2026-0001").closest("tr");
    expect(within(row).getByText("1,200.00")).toBeInTheDocument();
    expect(within(row).getByTitle("Credit balance")).toBeInTheDocument();
    expect(within(within(dialog).getByText("OB-BANK0001").closest("tr")).getByTitle("Debit balance")).toBeInTheDocument();
  });

  it("explains an empty chart and offers the first step", async () => {
    mocks.chart.mockResolvedValue({ counts: { groups: 0, accounts: 0 }, categories: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((c) => ({ category: c, total: 0, groups: [], ungrouped: [] })) });
    render(<ChartOfAccounts />);
    expect(await screen.findByText("No accounts yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create the default chart" })).toBeInTheDocument();
  });

  it("reports a load failure with a way to retry", async () => {
    mocks.chart.mockRejectedValueOnce(new Error("Network down"));
    render(<ChartOfAccounts />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
    mocks.chart.mockResolvedValue(CHART);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Emirates NBD")).toBeInTheDocument();
  });

  it("restores missing default accounts without touching anything else", async () => {
    mocks.restoreDefaults.mockResolvedValue({ groups: 1, accounts: 3 });
    render(<ChartOfAccounts />);
    await screen.findByText("Emirates NBD");
    fireEvent.click(screen.getByRole("button", { name: /Restore default accounts/ }));
    expect(await screen.findByText("Restored 1 group(s) and 3 account(s)")).toBeInTheDocument();
    expect(mocks.chart).toHaveBeenCalledTimes(2);
    mocks.restoreDefaults.mockResolvedValue({ groups: 0, accounts: 0 });
    fireEvent.click(screen.getByRole("button", { name: /Restore default accounts/ }));
    expect(await screen.findByText("Every default account is already there")).toBeInTheDocument();
  });
});
