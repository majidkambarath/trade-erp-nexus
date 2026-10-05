import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  attachments: vi.fn(),
  banks: vi.fn(),
  documentTypes: vi.fn(),
  partyCreate: vi.fn(),
  partyGet: vi.fn(),
  partyUpdate: vi.fn(),
}));

vi.mock("../../../lib/accountingApi", () => ({
  accounting: { createAccount: mocks.createAccount, updateAccount: mocks.updateAccount, attachments: mocks.attachments, deleteAttachment: vi.fn() },
  uploadAttachment: vi.fn(),
  linkAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
}));
vi.mock("../../../lib/bankingApi", () => ({ banking: { banks: mocks.banks } }));
vi.mock("../../../lib/partyMasterApi", () => ({
  partyMaster: {
    documentTypes: { list: mocks.documentTypes },
    accountParty: { create: mocks.partyCreate, get: mocks.partyGet, update: mocks.partyUpdate },
  },
}));

import { AccountModal, flattenGroups } from "../ChartOfAccounts";

const GROUPS = [
  { _id: "cash", name: "Cash", prefix: "CASH", category: "ASSET", depth: 1, role: "cash" },
  { _id: "bank", name: "Bank", prefix: "BANK", category: "ASSET", depth: 1, role: "bank" },
  { _id: "fx", name: "Foreign Currency Accounts", prefix: "FXB", category: "ASSET", depth: 2, role: "bank" }, // a sub-group of Bank, not named bank
  { _id: "oldbank", name: "Bank (unmapped)", prefix: "BANK", category: "ASSET", depth: 1, role: "other" }, // the prefix alone no longer decides
  { _id: "ar", name: "Accounts Receivable", prefix: "AR", category: "ASSET", depth: 1, role: "receivable" },
  { _id: "ar-retail", name: "Retail Customers", prefix: "RTL", category: "ASSET", depth: 2, role: "receivable" },
  { _id: "ap", name: "Accounts Payable", prefix: "AP", category: "LIABILITY", depth: 1, role: "payable" },
  { _id: "opex", name: "Operating Expenses", prefix: "OPEX", category: "EXPENSE", depth: 0, role: "other" },
];
const TYPES = [{ _id: "tl", name: "Trade licence", requiresExpiry: true, minLength: 3, maxLength: 30, isActive: true }];
const BANKS = [{ _id: "b1", bankName: "Emirates NBD", bankCode: "ENBD", swiftCode: "EBILAEAD" }];

const openTab = (name) => fireEvent.mouseDown(screen.getByRole("tab", { name: new RegExp(`^${name}`) }), { button: 0 });
const chooseGroup = (text) => {
  const picker = screen.getByLabelText(/^Group/);
  fireEvent.change(picker, { target: { value: text } });
  fireEvent.keyDown(picker, { key: "Enter" });
};
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const show = (props) => render(<AccountModal groups={GROUPS} onClose={() => {}} onSaved={props?.onSaved || (() => {})} onError={props?.onError || (() => {})} {...props} />);

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.banks.mockResolvedValue(BANKS);
  mocks.documentTypes.mockResolvedValue(TYPES);
  mocks.attachments.mockResolvedValue([]);
  mocks.partyGet.mockResolvedValue({ kind: null, party: null });
});

describe("the group's role decides what the account form asks for", () => {
  it("the chart's groups carry their role into the picker", () => {
    const chart = { categories: [{ category: "ASSET", groups: [{ _id: "a", name: "Bank", prefix: "BANK", role: "bank", children: [{ _id: "b", name: "Sub", prefix: "SUB", children: [] }] }] }] };
    expect(flattenGroups(chart).map((g) => [g.name, g.role])).toEqual([["Bank", "bank"], ["Sub", "other"]]);
  });

  it("a bank group shows the bank details, with the SWIFT code from the bank master; so does a sub-group of it", async () => {
    show({ groupId: "bank" });
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    expect(within(dialog).getByText("Bank details")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/IBAN/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Account name/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("tab")).toBeNull();
    expect(within(dialog).getByLabelText(/SWIFT/)).toHaveValue("");
    expect(within(dialog).getByLabelText(/SWIFT/)).toBeDisabled();
  });

  it("the role, not the code prefix, makes it a bank group", async () => {
    const { unmount } = show({ groupId: "fx" });
    expect(await screen.findByText("Bank details")).toBeInTheDocument();
    unmount();
    show({ groupId: "oldbank" });
    await screen.findByRole("dialog");
    expect(screen.queryByText("Bank details")).toBeNull();
  });

  it("a cash or expense group asks for the basics only", async () => {
    const { unmount } = show({ groupId: "cash" });
    await screen.findByRole("dialog");
    expect(screen.getByLabelText(/^Account name/)).toBeInTheDocument();
    expect(screen.getByLabelText("Add documents")).toBeInTheDocument();
    expect(screen.queryByText("Bank details")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    unmount();
    show({ groupId: "opex" });
    await screen.findByRole("dialog");
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("a receivable group (or a sub-group of it) asks for the customer's details instead of an account name", async () => {
    show({ groupId: "ar-retail" });
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    expect(within(dialog).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Basic", "VAT", "Credit and terms", "Contacts", "Bank accounts", "KYC documents"]);
    expect(within(dialog).getByLabelText(/Customer name/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^Account name/)).toBeNull();
    expect(within(dialog).queryByLabelText("Add documents")).toBeNull(); // the files are the KYC documents
    expect(within(dialog).getByText('Code will start with RTL. The account is named "Customer - <name>".')).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Create customer" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Opening balance/)).toBeInTheDocument(); // still there, as for any account
    expect(mocks.documentTypes).toHaveBeenCalled();
  });

  it("a payable group asks for the vendor's details", async () => {
    show({ groupId: "ap" });
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    expect(within(dialog).getByLabelText(/Vendor name/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Address/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Billing address/)).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Create vendor" })).toBeInTheDocument();
  });

  it("picking another group changes the form", async () => {
    show({});
    await screen.findByRole("dialog");
    expect(screen.getByLabelText(/^Account name/)).toBeInTheDocument();
    chooseGroup("receiv");
    expect(await screen.findByLabelText(/Customer name/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Account name/)).toBeNull();
    chooseGroup("payable");
    expect(await screen.findByLabelText(/Vendor name/)).toBeInTheDocument();
    chooseGroup("cash");
    expect(await screen.findByLabelText(/^Account name/)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();
  });
});

describe("creating a customer or vendor from the account form", () => {
  it("validates the party before calling the server, and opens the section that needs attention", async () => {
    show({ groupId: "ar-retail" });
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Create customer" }));
    expect(await screen.findByText("Customer name is required")).toBeInTheDocument();
    expect(screen.getByText("Contact person is required")).toBeInTheDocument();
    expect(mocks.partyCreate).not.toHaveBeenCalled();

    fill(/Customer name/, "Marina Minimart");
    fill(/Contact person/, "Reem");
    fill(/Billing address/, "Dubai Marina");
    openTab("VAT");
    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "registered" } });
    fireEvent.click(screen.getByRole("button", { name: "Create customer" }));
    expect(await screen.findByText("Enter the 15-digit TRN")).toBeInTheDocument();
    expect(mocks.partyCreate).not.toHaveBeenCalled();
  });

  it("creates the customer in the chosen group, with an opening balance, and reports the new account", async () => {
    mocks.partyCreate.mockResolvedValue({ account: { _id: "acc1", accountCode: "RTL0001", accountName: "Customer - Marina Minimart" }, party: { _id: "c1" } });
    const onSaved = vi.fn();
    show({ groupId: "ar-retail", onSaved });
    await screen.findByRole("dialog");
    fill(/Customer name/, "Marina Minimart");
    fill(/Contact person/, "Reem");
    fill(/Billing address/, "Dubai Marina");
    openTab("VAT");
    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "registered" } });
    fill(/TRN/, "100777000000001");
    openTab("Credit and terms");
    fill(/Credit limit/, "25000");
    fill("Credit days", "45");
    fill(/Amount/, "1250.50");
    fireEvent.change(screen.getByLabelText("Side"), { target: { value: "debit" } });
    fill(/^Description/, "Marina branch");
    fireEvent.click(screen.getByRole("button", { name: "Create customer" }));

    await waitFor(() => expect(mocks.partyCreate).toHaveBeenCalledTimes(1));
    const body = mocks.partyCreate.mock.calls[0][0];
    expect(body).toMatchObject({
      groupId: "ar-retail", description: "Marina branch", allowDirectPosting: true, openingBalance: 1250.5, openingSide: "debit",
      party: { customerName: "Marina Minimart", contactPerson: "Reem", billingAddress: "Dubai Marina", creditLimit: 25000, paymentTerms: "Net 45", credit: { days: 45 }, vat: { status: "registered", trn: "100777000000001" } },
    });
    expect(body).not.toHaveProperty("accountName");
    expect(mocks.createAccount).not.toHaveBeenCalled(); // the ordinary account route is not used
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("RTL0001 Customer - Marina Minimart created"));
  });

  it("creates a vendor in a payable group", async () => {
    mocks.partyCreate.mockResolvedValue({ account: { _id: "acc2", accountCode: "AP0007", accountName: "Vendor - Al Ain Farms" }, party: { _id: "v1" } });
    const onSaved = vi.fn();
    show({ groupId: "ap", onSaved });
    await screen.findByRole("dialog");
    fill(/Vendor name/, "Al Ain Farms");
    fill(/Contact person/, "Khalid");
    fill(/^Address/, "Al Ain");
    fireEvent.click(screen.getByRole("button", { name: "Create vendor" }));
    await waitFor(() => expect(mocks.partyCreate).toHaveBeenCalledTimes(1));
    expect(mocks.partyCreate.mock.calls[0][0]).toMatchObject({ groupId: "ap", party: { vendorName: "Al Ain Farms", address: "Al Ain", paymentTerms: "30 days" } });
    expect(mocks.partyCreate.mock.calls[0][0].party).not.toHaveProperty("customerName");
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("AP0007 Vendor - Al Ain Farms created"));
  });

  it("shows the server's refusals on the field they are about", async () => {
    mocks.partyCreate.mockRejectedValueOnce(Object.assign(new Error('An account named "Customer - Marina Minimart" already exists'), { code: "DUPLICATE_ACCOUNT" }));
    const onError = vi.fn();
    show({ groupId: "ar", onError });
    await screen.findByRole("dialog");
    fill(/Customer name/, "Marina Minimart");
    fill(/Contact person/, "Reem");
    fill(/Billing address/, "Dubai Marina");
    fireEvent.click(screen.getByRole("button", { name: "Create customer" }));
    expect(await screen.findByText('An account named "Customer - Marina Minimart" already exists')).toBeInTheDocument();
    expect(screen.getByLabelText(/Customer name/)).toHaveAttribute("aria-invalid", "true");
    expect(onError).not.toHaveBeenCalled();
    // fixing the name clears it
    fill(/Customer name/, "Marina Minimart Two");
    expect(screen.queryByText(/already exists/)).toBeNull();

    mocks.partyCreate.mockRejectedValueOnce(Object.assign(new Error("TRN already in use by another customer"), { code: "DUPLICATE_TRN" }));
    openTab("VAT");
    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "registered" } });
    fill(/TRN/, "100777000000001");
    fireEvent.click(screen.getByRole("button", { name: "Create customer" }));
    expect(await screen.findByText("TRN already in use by another customer")).toBeInTheDocument();

    mocks.partyCreate.mockRejectedValueOnce(Object.assign(new Error("The date is in a closed period"), { code: "PERIOD_CLOSED" }));
    fireEvent.click(screen.getByRole("button", { name: "Create customer" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("The date is in a closed period"));
  });
});

describe("editing a customer or vendor account", () => {
  const account = { _id: "acc1", accountCode: "RTL0001", accountName: "Customer - Marina Minimart", groupId: "ar-retail", description: "", isActive: true, allowDirectPosting: true };
  const customer = {
    _id: "c1", customerName: "Marina Minimart", contactPerson: "Reem", phone: "+971501112222", billingAddress: "Dubai Marina", status: "Active", creditLimit: 25000, paymentTerms: "Net 45",
    vat: { status: "registered", trn: "100777000000001", tradeLicenseNo: "TL-5" }, credit: { days: 45 },
    contacts: [{ name: "Huda", isPrimary: true }], documents: [{ _id: "d1", typeName: "Trade licence", number: "CN-1", expiryDate: "2030-01-01T00:00:00.000Z" }],
  };

  it("loads the party behind the account into the same sections", async () => {
    mocks.partyGet.mockResolvedValue({ kind: "customer", party: customer });
    show({ account });
    const dialog = await screen.findByRole("dialog", { name: "Edit RTL0001" });
    expect(await within(dialog).findByLabelText(/Customer name/)).toHaveValue("Marina Minimart");
    expect(mocks.partyGet).toHaveBeenCalledWith("acc1");
    expect(within(dialog).queryByLabelText(/^Account name/)).toBeNull();
    expect(within(dialog).queryByText(/Opening balance/)).toBeNull(); // not editable after creation
    expect(within(dialog).getByLabelText("Phone")).toHaveValue("+971501112222");
    openTab("VAT");
    expect(screen.getByLabelText(/TRN/)).toHaveValue("100777000000001");
    expect(screen.getByLabelText("Trade licence number")).toHaveValue("TL-5");
    openTab("Credit and terms");
    expect(screen.getByLabelText(/Credit limit/)).toHaveValue(25000);
    expect(screen.getByLabelText("Credit days")).toHaveValue(45);
    openTab("Contacts");
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Huda");
    openTab("KYC documents");
    expect(screen.getByLabelText(/^Number/)).toHaveValue("CN-1");
  });

  it("saves the party and the account's own settings together", async () => {
    mocks.partyGet.mockResolvedValue({ kind: "customer", party: customer });
    mocks.partyUpdate.mockResolvedValue({ account: {}, party: {} });
    const onSaved = vi.fn();
    show({ account, onSaved });
    await screen.findByLabelText(/Customer name/);
    fill("Phone", "+971509998888");
    fill(/Customer name/, "Marina Minimart LLC");
    fireEvent.click(screen.getByLabelText(/^Active/));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.partyUpdate).toHaveBeenCalledTimes(1));
    const [id, body] = mocks.partyUpdate.mock.calls[0];
    expect(id).toBe("acc1");
    expect(body).toMatchObject({
      groupId: "ar-retail", allowDirectPosting: true, isActive: false,
      party: { customerName: "Marina Minimart LLC", phone: "+971509998888", creditLimit: 25000, vat: { status: "registered", trn: "100777000000001" } },
    });
    expect(mocks.updateAccount).not.toHaveBeenCalled();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("RTL0001 updated"));
  });

  it("offers only groups of its own kind to move the account to", async () => {
    mocks.partyGet.mockResolvedValue({ kind: "customer", party: customer });
    show({ account });
    await screen.findByLabelText(/Customer name/);
    const picker = screen.getByLabelText(/^Group/);
    fireEvent.change(picker, { target: { value: "a" } });
    const options = [...document.querySelectorAll(".search-select__option")].map((o) => o.textContent);
    expect(options.some((t) => t.startsWith("Accounts Receivable"))).toBe(true);
    expect(options.some((t) => t.startsWith("Retail Customers"))).toBe(true);
    expect(options.some((t) => t.startsWith("Accounts Payable"))).toBe(false);
    expect(options.some((t) => t.startsWith("Cash"))).toBe(false);
  });

  it("an account in a receivable group that has no customer behind it is edited as an ordinary account", async () => {
    mocks.partyGet.mockResolvedValue({ kind: "customer", party: null });
    mocks.updateAccount.mockResolvedValue({});
    const onSaved = vi.fn();
    show({ account: { ...account, accountName: "Staff Advances", accountCode: "RTL0009" }, onSaved });
    expect(await screen.findByLabelText(/^Account name/)).toHaveValue("Staff Advances");
    expect(screen.queryByRole("tab")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.updateAccount).toHaveBeenCalledTimes(1));
    expect(mocks.updateAccount.mock.calls[0][1]).toMatchObject({ accountName: "Staff Advances", groupId: "ar-retail" });
    expect(mocks.partyUpdate).not.toHaveBeenCalled();
  });

  it("does not look for a party behind an account of any other kind", async () => {
    show({ account: { ...account, groupId: "cash", accountName: "Petty Cash", accountCode: "CASH0002" } });
    expect(await screen.findByLabelText(/^Account name/)).toHaveValue("Petty Cash");
    expect(mocks.partyGet).not.toHaveBeenCalled();
  });

  it("does not offer to save when the customer could not be loaded, and tries again on request", async () => {
    mocks.partyGet.mockRejectedValueOnce(new Error("Network down"));
    show({ account });
    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.queryByLabelText(/^Account name/)).toBeNull(); // saving it as a plain account could rename it
    mocks.partyGet.mockResolvedValue({ kind: "customer", party: customer });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText(/Customer name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("holds the save until the party has loaded", async () => {
    let release;
    mocks.partyGet.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    show({ account });
    expect(await screen.findByRole("status")).toHaveTextContent("Loading the customer's details");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    release({ kind: "customer", party: customer });
    expect(await screen.findByLabelText(/Customer name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });
});
