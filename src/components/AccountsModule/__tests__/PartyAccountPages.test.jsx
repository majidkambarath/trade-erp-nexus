import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const m = vi.hoisted(() => ({
  party: vi.fn(), summary: vi.fn(), balances: vi.fn(), accounts: vi.fn(), statement: vi.fn(), ageing: vi.fn(), axiosGet: vi.fn(),
}));
vi.mock("../../../lib/partyAccountApi", () => ({
  partyAccountApi: { party: m.party, summary: m.summary, balances: m.balances, accounts: m.accounts, statement: m.statement, ageing: m.ageing },
}));
vi.mock("../../../axios/axios", () => ({ default: { get: m.axiosGet } }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));

import CustomerDetailsPage from "../Sales/CustomerDetailsPage";
import VendorDetailsPage from "../Purchase/VendorDetailsPage";
import SaleAccountsManagement from "../Sales/SaleAccountsManagement";
import PurchaseAccount from "../Purchase/PurchaseAccount";
import { downloadCSV, todayInput } from "../../../utils/format";
import { creditPosition, overdueAmount, presetRange, activePreset, lateness } from "../shared/partyAccountUtils";

// ---------- fixtures ----------

const CUSTOMER = {
  _id: "c1", customerId: "CUST2026001", customerName: "Al Noor Trading", contactPerson: "Ahmed Noor", phone: "+971501234567",
  email: "ahmed@alnoor.ae", trnNumber: "100123456700003", paymentTerms: "Net 30", creditLimit: 10000, status: "Active",
  billingAddress: "Deira, Dubai", shippingAddress: "Al Quoz, Dubai", salesPerson: "Sara Khan", minShelfLifeDays: 30,
};
const VENDOR = {
  _id: "v1", vendorId: "VEND2026001", vendorName: "Fresh Farms LLC", contactPerson: "Omar Farid", phone: "+971507654321",
  email: "omar@freshfarms.ae", trnNO: "100765432100003", paymentTerms: "Net 60", status: "Compliant", address: "Ras Al Khor, Dubai",
};
const SUMMARY = { partyId: "c1", partyName: "Al Noor Trading", balance: 2500, creditLimit: 10000, available: 7500, utilisation: 25, status: "ok", overdue: 0, paymentTerms: "Net 30", source: "ledger" };
const VENDOR_SUMMARY = { partyId: "v1", partyName: "Fresh Farms LLC", balance: 4000, overdue: 1500, paymentTerms: "Net 60", source: "ledger" };

const ROWS = [
  { _id: "e1", date: "2026-09-05T00:00:00.000Z", voucherNo: "SO-2026-0001", voucherType: "sales_order", narration: "Sales invoice", debit: 2000, credit: 0, balance: 3000 },
  { _id: "e2", date: "2026-09-20T00:00:00.000Z", voucherNo: "RV-2026-0001", voucherType: "receipt", narration: "Receipt (cash)", debit: 0, credit: 500, balance: 2500 },
];
const STATEMENT = { party: { _id: "c1", name: "Al Noor Trading", type: "Customer" }, opening: 1000, rows: ROWS, closing: 2500, totals: { debit: 2000, credit: 500 }, source: "ledger" };
const VENDOR_STATEMENT = {
  party: { _id: "v1", name: "Fresh Farms LLC", type: "Vendor" }, opening: 0, closing: 4000, totals: { debit: 0, credit: 4000 }, source: "ledger",
  rows: [{ _id: "p1", date: "2026-09-02T00:00:00.000Z", voucherNo: "PO-2026-0001", voucherType: "purchase_order", narration: "Purchase invoice", debit: 0, credit: 4000, balance: 4000 }],
};

const BUCKETS = [{ key: "current", label: "Not yet due" }, { key: "d1_30", label: "1-30 days" }, { key: "d31_60", label: "31-60 days" }, { key: "d61_90", label: "61-90 days" }, { key: "d90plus", label: "Over 90 days" }];
const AGEING = {
  type: "receivable", buckets: BUCKETS, overdue: 1500,
  rows: [
    { partyId: "other", partyName: "Someone Else", total: 999, buckets: { current: 999, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }, invoices: [{ transactionId: "tx", transactionNo: "SO-2026-0099", date: "2026-10-01", dueDate: "2026-10-31", daysPastDue: 0, daysToDue: 27, outstanding: 999 }] },
    {
      partyId: "c1", partyName: "Al Noor Trading", paymentTerms: "Net 30", total: 2000,
      buckets: { current: 500, d1_30: 0, d31_60: 1500, d61_90: 0, d90plus: 0 },
      invoices: [
        { transactionId: "t1", transactionNo: "SO-2026-0001", date: "2026-07-01", dueDate: "2026-07-31", daysPastDue: 45, total: 1500, paid: 0, outstanding: 1500 },
        { transactionId: "t2", transactionNo: "SO-2026-0007", date: "2026-09-20", dueDate: "2026-10-20", daysPastDue: 0, daysToDue: 16, total: 500, paid: 0, outstanding: 500 },
      ],
    },
  ],
};
const EMPTY_AGEING = { type: "receivable", buckets: BUCKETS, overdue: 0, rows: [], totals: {} };

// ---------- helpers ----------

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}
const show = (ui, path, url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={path} element={ui} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </MemoryRouter>
  );
const showCustomer = (query = "") => show(<CustomerDetailsPage />, "/credit-accounts/customer/:customerId", `/credit-accounts/customer/c1${query}`);
const showVendor = (query = "") => show(<VendorDetailsPage />, "/debit-accounts/vendor/:vendorId", `/debit-accounts/vendor/v1${query}`);
const card = (title) => screen.getByRole("heading", { name: title, level: 3 }).closest(".shadow-card");
const openTab = (name) => fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
const statementTable = (name) => screen.getByRole("table", { name: new RegExp(`Statement of account for ${name}`) });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.party.mockImplementation((kind) => Promise.resolve(kind === "vendor" ? VENDOR : CUSTOMER));
  m.summary.mockImplementation((kind) => Promise.resolve(kind === "vendor" ? VENDOR_SUMMARY : SUMMARY));
  m.statement.mockImplementation(({ kind }) => Promise.resolve(kind === "vendor" ? VENDOR_STATEMENT : STATEMENT));
  m.ageing.mockResolvedValue(AGEING);
  downloadCSV.mockClear();
  window.print = vi.fn();
});

// ---------- customer account ----------

describe("customer account page", () => {
  it("introduces the customer with contact details, terms, TRN and the quick links", async () => {
    showCustomer();
    const title = await screen.findByRole("heading", { level: 1, name: "Al Noor Trading" });
    expect(title).toHaveClass("text-2xl");
    expect(screen.getByText("CUST2026001")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Ahmed Noor")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+971501234567" })).toHaveAttribute("href", "tel:+971501234567");
    expect(screen.getByRole("link", { name: "ahmed@alnoor.ae" })).toHaveAttribute("href", "mailto:ahmed@alnoor.ae");
    expect(screen.getAllByText("Net 30").length).toBeGreaterThan(0);
    expect(screen.getByText("100123456700003")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Receivables" })).toHaveAttribute("href", "/credit-accounts");
    expect(screen.getByRole("link", { name: "Statement of account" })).toHaveAttribute("href", "/statement?partyType=Customer&partyId=c1");
    expect(screen.getByRole("link", { name: "Receive payment" })).toHaveAttribute("href", "/receipt-voucher");
    expect(m.party).toHaveBeenCalledWith("customer", "c1");
  });

  it("shows the balance as Dr/Cr and what is left of the credit limit", async () => {
    showCustomer();
    await screen.findByRole("heading", { level: 1, name: "Al Noor Trading" });
    const balance = await waitFor(() => card("Balance"));
    expect(within(balance).getByText("2,500.00")).toBeInTheDocument();
    expect(within(balance).getByTitle("Debit balance")).toHaveTextContent("Dr");
    expect(within(balance).getByText(/Customer owes you this amount/)).toBeInTheDocument();

    const limit = card("Credit limit");
    expect(within(limit).getByText("10,000.00")).toBeInTheDocument();
    expect(within(limit).getByText("7,500.00 available")).toBeInTheDocument();
    expect(m.summary).toHaveBeenCalledWith("customer", "c1");
  });

  it("shows a customer in credit as Cr", async () => {
    m.summary.mockResolvedValue({ ...SUMMARY, balance: -300, utilisation: 0, available: 10300 });
    showCustomer();
    const balance = await waitFor(() => card("Balance"));
    expect(within(balance).getByText("300.00")).toBeInTheDocument();
    expect(within(balance).getByTitle("Credit balance")).toHaveTextContent("Cr");
    expect(within(balance).getByText(/Customer is in credit/)).toBeInTheDocument();
  });

  it.each([
    ["ok", { utilisation: 25, status: "ok", balance: 2500, available: 7500 }, "Within limit", "25.0%", "7,500.00 still available"],
    ["near", { utilisation: 85, status: "near", balance: 8500, available: 1500 }, "Near limit", "85.0%", "1,500.00 still available"],
    ["over", { utilisation: 112.5, status: "over", balance: 11250, available: -1250 }, "Over limit", "112.5%", "Over the limit by 1,250.00"],
  ])("draws credit used when %s, in words as well as colour", async (_name, patch, label, percent, note) => {
    m.summary.mockResolvedValue({ ...SUMMARY, ...patch });
    showCustomer();
    const used = await waitFor(() => card("Credit used"));
    expect(within(used).getByText(label)).toBeInTheDocument();
    expect(within(used).getByText(percent)).toBeInTheDocument();
    expect(within(used).getByText(note)).toBeInTheDocument();
    const bar = within(used).getByRole("progressbar", { name: "Credit used" });
    expect(bar).toHaveAttribute("aria-valuenow", String(Math.min(100, Math.round(patch.utilisation))));
    expect(bar).toHaveAttribute("aria-valuetext", expect.stringContaining(label.toLowerCase()));
  });

  it("has no utilisation bar for a customer without a limit", async () => {
    m.summary.mockResolvedValue({ ...SUMMARY, creditLimit: 0, available: null, utilisation: null, status: "no-limit" });
    showCustomer();
    const limit = await waitFor(() => card("Credit limit"));
    expect(within(limit).getByText("No limit")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Credit used", level: 3 })).toBeNull();
    expect(card("Payment terms")).toBeInTheDocument();
  });

  it("falls back to the party record's credit limit when the ledger has no row for the customer", async () => {
    m.summary.mockResolvedValue({ partyId: "c1", balance: 9000, source: "ledger" });
    showCustomer();
    const used = await waitFor(() => card("Credit used"));
    expect(within(used).getByText("Near limit")).toBeInTheDocument(); // 9,000 of 10,000
    expect(within(used).getByText("90.0%")).toBeInTheDocument();
  });

  it("puts a warning on the overdue amount and counts the late invoices", async () => {
    m.summary.mockResolvedValue({ ...SUMMARY, overdue: 1500 });
    showCustomer();
    const overdue = await waitFor(() => card("Overdue"));
    const value = within(overdue).getByText("1,500.00");
    expect(value).toHaveClass("text-status-warning");
    expect(within(overdue).getByText("1 invoice")).toBeInTheDocument();
  });

  it("keeps a clear overdue figure neutral", async () => {
    showCustomer();
    const overdue = await waitFor(() => card("Overdue"));
    expect(within(overdue).getByText("0.00")).not.toHaveClass("text-status-warning");
    expect(within(overdue).getByText("Nothing is overdue")).toBeInTheDocument();
  });
});

// ---------- statement ----------

describe("statement tab", () => {
  it("lists opening, each entry with its running balance as Dr/Cr, and closing", async () => {
    showCustomer();
    const table = await waitFor(() => statementTable("Al Noor Trading"));
    expect(within(table).getByText("Opening balance").closest("tr")).toHaveTextContent("1,000.00Dr");
    const first = within(table).getByText("SO-2026-0001").closest("tr");
    expect(within(first).getByText("05/09/2026")).toBeInTheDocument();
    expect(within(first).getAllByRole("cell")[2]).toHaveTextContent("Sales invoice");
    expect(first).toHaveTextContent("2,000.00");
    expect(first).toHaveTextContent("3,000.00Dr");
    const second = within(table).getByText("RV-2026-0001").closest("tr");
    expect(within(second).getAllByRole("cell")[2]).toHaveTextContent(/^Receipt$/);
    expect(within(second).getByText("Receipt (cash)")).toBeInTheDocument();
    expect(second).toHaveTextContent("500.00");
    expect(second).toHaveTextContent("2,500.00Dr");
    const closing = within(table).getByText("Closing balance").closest("tr");
    expect(closing).toHaveTextContent("2,000.00");
    expect(closing).toHaveTextContent("2,500.00Dr");
    expect(m.statement).toHaveBeenCalledWith({ kind: "customer", partyId: "c1", from: undefined, to: undefined });
  });

  it("reads a vendor's payable balance as a credit", async () => {
    showVendor();
    const table = await waitFor(() => statementTable("Fresh Farms LLC"));
    const row = within(table).getByText("PO-2026-0001").closest("tr");
    expect(within(row).getAllByRole("cell")[2]).toHaveTextContent("Purchase invoice");
    expect(row).toHaveTextContent("4,000.00Cr");
    expect(within(table).getByText("Closing balance").closest("tr")).toHaveTextContent("4,000.00Cr");
  });

  it("asks the server again when the dates change, and the presets set them", async () => {
    showCustomer();
    await waitFor(() => statementTable("Al Noor Trading"));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    await waitFor(() => expect(m.statement).toHaveBeenLastCalledWith({ kind: "customer", partyId: "c1", from: "2026-09-01", to: undefined }));
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-30" } });
    await waitFor(() => expect(m.statement).toHaveBeenLastCalledWith({ kind: "customer", partyId: "c1", from: "2026-09-01", to: "2026-09-30" }));

    const today = todayInput();
    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    await waitFor(() => expect(m.statement).toHaveBeenLastCalledWith({ kind: "customer", partyId: "c1", from: `${today.slice(0, 8)}01`, to: today }));
    expect(screen.getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "This year" }));
    await waitFor(() => expect(m.statement).toHaveBeenLastCalledWith({ kind: "customer", partyId: "c1", from: `${today.slice(0, 4)}-01-01`, to: today }));

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(m.statement).toHaveBeenLastCalledWith({ kind: "customer", partyId: "c1", from: undefined, to: undefined }));
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  it("passes the chosen period on to the full statement page", async () => {
    showCustomer();
    await waitFor(() => statementTable("Al Noor Trading"));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    await waitFor(() => expect(screen.getByRole("link", { name: "Statement of account" })).toHaveAttribute("href", "/statement?partyType=Customer&partyId=c1&from=2026-09-01"));
  });

  it("filters by voucher type without a new request and keeps the true running balance", async () => {
    showCustomer();
    const table = await waitFor(() => statementTable("Al Noor Trading"));
    const calls = m.statement.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "receipt" } });
    expect(within(table).queryByText("SO-2026-0001")).toBeNull();
    const row = within(table).getByText("RV-2026-0001").closest("tr");
    expect(row).toHaveTextContent("2,500.00Dr"); // still the balance after that receipt, not 500.00
    expect(within(table).getByText(/Total of the 1 entry shown/)).toBeInTheDocument();
    expect(m.statement.mock.calls.length).toBe(calls);

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "all" } });
    expect(within(table).getByText("SO-2026-0001")).toBeInTheDocument();
  });

  it("exports what is shown as CSV, with opening and closing rows and Dr/Cr balances", async () => {
    showCustomer();
    await waitFor(() => statementTable("Al Noor Trading"));
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(downloadCSV).toHaveBeenCalledTimes(1);
    const [name, heads, rows] = downloadCSV.mock.calls[0];
    expect(name).toBe("statement-al-noor-trading-start-latest.csv");
    expect(heads).toEqual(["Date", "Voucher no", "Type", "Narration", "Debit", "Credit", "Balance"]);
    expect(rows[0]).toEqual(["", "Opening balance", "", "", "", "", "1,000.00 Dr"]);
    expect(rows[1]).toEqual(["05/09/2026", "SO-2026-0001", "Sales invoice", "Sales invoice", 2000, "", "3,000.00 Dr"]);
    expect(rows[2]).toEqual(["20/09/2026", "RV-2026-0001", "Receipt", "Receipt (cash)", "", 500, "2,500.00 Dr"]);
    expect(rows.at(-1)).toEqual(["", "Closing balance", "", "", 2000, 500, "2,500.00 Dr"]);
  });

  it("exports a vendor statement with Cr balances", async () => {
    showVendor();
    await waitFor(() => statementTable("Fresh Farms LLC"));
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    const rows = downloadCSV.mock.calls[0][2];
    expect(rows[1][6]).toBe("4,000.00 Cr");
    expect(rows.at(-1)[6]).toBe("4,000.00 Cr");
  });

  it("prints", async () => {
    showCustomer();
    await waitFor(() => statementTable("Al Noor Trading"));
    fireEvent.click(screen.getByRole("button", { name: /Print/ }));
    expect(window.print).toHaveBeenCalled();
  });

  it("says plainly when there are no transactions in the period", async () => {
    m.statement.mockResolvedValue({ ...STATEMENT, opening: 0, rows: [], closing: 0, totals: { debit: 0, credit: 0 } });
    showCustomer();
    expect(await screen.findByText("No transactions in this period")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("still shows the opening and closing balance when only the opening is non-zero", async () => {
    m.statement.mockResolvedValue({ ...STATEMENT, opening: 800, rows: [], closing: 800, totals: { debit: 0, credit: 0 } });
    showCustomer();
    const table = await waitFor(() => statementTable("Al Noor Trading"));
    expect(within(table).getByText("No transactions in this period")).toBeInTheDocument();
    expect(within(table).getByText("Closing balance").closest("tr")).toHaveTextContent("800.00Dr");
  });

  it("explains a statement that was built from documents because posting is off", async () => {
    m.statement.mockResolvedValue({ ...STATEMENT, source: "documents" });
    showCustomer();
    expect(await screen.findByRole("note")).toHaveTextContent(/Ledger posting is switched off/);
  });

  it("reports a failure with a retry that loads the statement", async () => {
    m.statement.mockRejectedValueOnce(new Error("Statement service is down"));
    showCustomer();
    expect(await screen.findByText("Statement service is down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => statementTable("Al Noor Trading"));
    expect(screen.queryByText("Statement service is down")).toBeNull();
  });

  it("reports a failed summary with its own retry while the statement still loads", async () => {
    m.summary.mockRejectedValueOnce(new Error("Balances are unavailable"));
    showCustomer();
    expect(await screen.findByText("Balances are unavailable")).toBeInTheDocument();
    await waitFor(() => statementTable("Al Noor Trading"));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(card("Balance")).toBeInTheDocument());
  });
});

// ---------- tabs ----------

describe("tabs", () => {
  it("opens on the statement and records the tab in the URL as it changes", async () => {
    showCustomer();
    await waitFor(() => statementTable("Al Noor Trading"));
    expect(screen.getByRole("tab", { name: "Statement" })).toHaveAttribute("aria-selected", "true");

    openTab(/Open invoices/);
    expect(await screen.findByText("SO-2026-0007")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/credit-accounts/customer/c1?tab=open");

    openTab("Details");
    expect(await screen.findByText("Deira, Dubai")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("?tab=details");

    openTab("Statement");
    await waitFor(() => statementTable("Al Noor Trading"));
    expect(screen.getByTestId("where")).toHaveTextContent("?tab=statement");
  });

  it("opens straight on the tab named in the URL", async () => {
    showVendor("?tab=open");
    expect(await screen.findByRole("tab", { name: /Open invoices/ })).toHaveAttribute("aria-selected", "true");
  });

  it("ignores a tab that does not exist", async () => {
    showCustomer("?tab=nonsense");
    expect(await screen.findByRole("tab", { name: "Statement" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("open invoices tab", () => {
  it("shows this party's unpaid invoices under their ageing buckets, with an overdue pill", async () => {
    showCustomer("?tab=open");
    const late = await screen.findByText("SO-2026-0001");
    const row = late.closest("tr");
    expect(within(row).getByText("45 days overdue")).toBeInTheDocument();
    expect(within(row).getByText("01/07/2026")).toBeInTheDocument();
    expect(within(row).getByText("31/07/2026")).toBeInTheDocument();
    expect(row).toHaveTextContent("1,500.00");
    expect(within(screen.getByText("SO-2026-0007").closest("tr")).getByText("Due in 16 days")).toBeInTheDocument();
    expect(screen.queryByText("SO-2026-0099")).toBeNull(); // another customer's invoice

    const buckets = screen.getByRole("region", { name: "Ageing buckets" });
    expect(within(buckets).getByText("Not yet due").nextSibling).toHaveTextContent("500.00");
    expect(within(buckets).getByText("31-60 days").nextSibling).toHaveTextContent("1,500.00");
    expect(within(buckets).getByText("Total outstanding").nextSibling).toHaveTextContent("2,000.00");
    expect(m.ageing).toHaveBeenCalledWith("customer");
  });

  it("asks for the payable ageing for a vendor", async () => {
    m.ageing.mockResolvedValue(EMPTY_AGEING);
    showVendor("?tab=open");
    expect(await screen.findByText("No open invoices")).toBeInTheDocument();
    expect(m.ageing).toHaveBeenCalledWith("vendor");
  });

  it("says so when everything is paid", async () => {
    m.ageing.mockResolvedValue(EMPTY_AGEING);
    showCustomer("?tab=open");
    expect(await screen.findByText("No open invoices")).toBeInTheDocument();
    expect(screen.getByText(/Every approved sales invoice for this customer is paid/)).toBeInTheDocument();
  });

  it("reports a failure with a retry", async () => {
    m.ageing.mockRejectedValueOnce(new Error("Ageing failed"));
    showCustomer("?tab=open");
    expect(await screen.findByText("Ageing failed")).toBeInTheDocument();
    m.ageing.mockResolvedValue(AGEING);
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]);
    expect(await screen.findByText("SO-2026-0001")).toBeInTheDocument();
  });
});

describe("details tab", () => {
  it("shows the customer record read-only with a way to edit it", async () => {
    showCustomer("?tab=details");
    expect(await screen.findByText("Deira, Dubai")).toBeInTheDocument();
    expect(screen.getByText("Al Quoz, Dubai")).toBeInTheDocument();
    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByText("Sara Khan")).toBeInTheDocument();
    expect(panel.getByText("30 days")).toBeInTheDocument();
    expect(panel.getByText("10,000.00")).toBeInTheDocument();
    expect(panel.getByText("100123456700003")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit on the Customers page/ })).toHaveAttribute("href", "/customer-creation");
  });

  it("shows the vendor record with its own edit page", async () => {
    showVendor("?tab=details");
    expect(await screen.findByText("Ras Al Khor, Dubai")).toBeInTheDocument();
    expect(within(screen.getByRole("tabpanel")).getByText("100765432100003")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit on the Vendors page/ })).toHaveAttribute("href", "/vendor-creation");
  });

  it("marks missing details instead of leaving gaps", async () => {
    m.party.mockResolvedValue({ ...CUSTOMER, billingAddress: null, shippingAddress: "", trnNumber: null });
    showCustomer("?tab=details");
    await screen.findByText("Billing address");
    expect(screen.getAllByText("Not provided").length).toBeGreaterThanOrEqual(3);
  });

  it("still shows the account when the party record cannot be loaded", async () => {
    m.party.mockRejectedValue(new Error("Customer not found"));
    showCustomer();
    expect(await screen.findByText("Customer not found")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Al Noor Trading" })).toBeInTheDocument(); // the name still comes with the statement
    await waitFor(() => statementTable("Al Noor Trading"));
  });
});

// ---------- vendor account ----------

describe("vendor account page", () => {
  it("shows the balance owed as a credit, overdue, open invoices and terms", async () => {
    showVendor();
    expect(await screen.findByRole("heading", { level: 1, name: "Fresh Farms LLC" })).toHaveClass("text-2xl");
    expect(screen.getByText("VEND2026001")).toBeInTheDocument();
    expect(screen.getByText("Compliant")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payables" })).toHaveAttribute("href", "/debit-accounts");
    expect(screen.getByRole("link", { name: "Statement of account" })).toHaveAttribute("href", "/statement?partyType=Vendor&partyId=v1");
    expect(screen.getByRole("link", { name: "Make payment" })).toHaveAttribute("href", "/payment-voucher");
    expect(screen.getByText("100765432100003")).toBeInTheDocument();

    const owed = await waitFor(() => card("Balance owed"));
    expect(within(owed).getByText("4,000.00")).toBeInTheDocument();
    expect(within(owed).getByTitle("Credit balance")).toHaveTextContent("Cr");
    expect(within(owed).getByText(/You owe this amount/)).toBeInTheDocument();

    const overdue = card("Overdue");
    expect(within(overdue).getByText("1,500.00")).toHaveClass("text-status-warning");
    expect(card("Payment terms")).toHaveTextContent("Net 60");
    expect(screen.queryByRole("heading", { name: "Credit limit", level: 3 })).toBeNull();
    expect(m.summary).toHaveBeenCalledWith("vendor", "v1");
  });

  it("shows a prepaid vendor as a debit balance", async () => {
    m.summary.mockResolvedValue({ ...VENDOR_SUMMARY, balance: -250, overdue: 0 });
    showVendor();
    const owed = await waitFor(() => card("Balance owed"));
    expect(within(owed).getByText("250.00")).toBeInTheDocument();
    expect(within(owed).getByTitle("Debit balance")).toHaveTextContent("Dr");
    expect(within(owed).getByText(/Paid ahead of invoices/)).toBeInTheDocument();
  });
});

// ---------- list pages ----------

const CUSTOMER_ROWS = [
  { _id: "c2", partyId: "CUST2026002", name: "Bright Mart", type: "Customer", totalInvoices: 1, balance: 0 },
  { _id: "c1", partyId: "CUST2026001", name: "Al Noor Trading", type: "Customer", totalInvoices: 3, balance: 0 },
  { _id: "c3", partyId: "CUST2026003", name: "Corner Cafe", type: "Customer", totalInvoices: 2, balance: 0 },
];
const CUSTOMER_BALANCES = {
  type: "customer",
  rows: [
    { partyId: "c1", partyName: "Al Noor Trading", balance: 9000, creditLimit: 10000, available: 1000, utilisation: 90, status: "near", overdue: 1500, paymentTerms: "Net 30" },
    { partyId: "c3", partyName: "Corner Cafe", balance: 6000, creditLimit: 5000, available: -1000, utilisation: 120, status: "over", overdue: 0, paymentTerms: "Net 30" },
  ],
  totals: { owed: 15000, advances: 0, net: 15000, overdue: 1500, overLimit: 1, nearLimit: 1 },
};
const showList = (ui, path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={ui} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </MemoryRouter>
  );

describe("receivables list", () => {
  beforeEach(() => {
    m.accounts.mockResolvedValue(CUSTOMER_ROWS);
    m.balances.mockResolvedValue(CUSTOMER_BALANCES);
  });

  it("lists customers with ledger balances as Dr/Cr, largest first, and credit used in words", async () => {
    showList(<SaleAccountsManagement />, "/credit-accounts");
    expect(await screen.findByRole("heading", { level: 1, name: "Receivables" })).toHaveClass("text-2xl");
    const table = await screen.findByRole("table", { name: /Customer balances/ });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByRole("link").textContent)).toEqual(["Al Noor Trading", "Corner Cafe", "Bright Mart"]);
    expect(rows[0]).toHaveTextContent("9,000.00Dr");
    expect(rows[0]).toHaveTextContent("Near limit");
    expect(rows[0]).toHaveTextContent("90%");
    expect(rows[0]).toHaveTextContent("1,500.00");
    expect(rows[1]).toHaveTextContent("Over limit");
    expect(within(rows[0]).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "90");
    expect(rows[2]).toHaveTextContent("0.00"); // never touched the ledger: owes nothing
    expect(m.balances).toHaveBeenCalledWith("customer");
    expect(m.accounts).toHaveBeenCalledWith("customer");
  });

  it("totals the book and counts customers near or over their limit", async () => {
    showList(<SaleAccountsManagement />, "/credit-accounts");
    await screen.findByRole("table", { name: /Customer balances/ });
    expect(card("Customers")).toHaveTextContent("3");
    expect(card("Total receivable")).toHaveTextContent("15,000.00");
    expect(within(card("Total receivable")).getByTitle("Debit balance")).toBeInTheDocument();
    expect(card("Overdue")).toHaveTextContent("1,500.00");
    expect(card("Near or over limit")).toHaveTextContent("2");
    expect(card("Near or over limit")).toHaveTextContent("1 over, 1 near the limit");
  });

  it("searches by name or ID and filters to overdue", async () => {
    showList(<SaleAccountsManagement />, "/credit-accounts");
    const table = await screen.findByRole("table", { name: /Customer balances/ });
    fireEvent.change(screen.getByLabelText(/Search customers/), { target: { value: "CUST2026002" } });
    expect(within(table).getByText("Bright Mart")).toBeInTheDocument();
    expect(within(table).queryByText("Al Noor Trading")).toBeNull();

    fireEvent.change(screen.getByLabelText(/Search customers/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Overdue" }));
    expect(within(table).getByText("Al Noor Trading")).toBeInTheDocument();
    expect(within(table).queryByText("Corner Cafe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Near or over limit" }));
    expect(within(table).getByText("Corner Cafe")).toBeInTheDocument();
    expect(within(table).queryByText("Bright Mart")).toBeNull();

    fireEvent.change(screen.getByLabelText(/Search customers/), { target: { value: "zzz" } });
    expect(await screen.findByText("No customers match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(await screen.findByText("Bright Mart")).toBeInTheDocument();
  });

  it("opens a customer's account", async () => {
    showList(<SaleAccountsManagement />, "/credit-accounts");
    fireEvent.click(await screen.findByRole("link", { name: "Al Noor Trading" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/credit-accounts/customer/c1"));
  });

  it("exports the rows shown", async () => {
    showList(<SaleAccountsManagement />, "/credit-accounts");
    await screen.findByRole("table", { name: /Customer balances/ });
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    const [name, heads, rows] = downloadCSV.mock.calls[0];
    expect(name).toBe("receivables.csv");
    expect(heads[0]).toBe("Customer ID");
    expect(rows[0]).toEqual(["CUST2026001", "Al Noor Trading", 3, "9,000.00 Dr", 10000, 90, 1500]);
  });

  it("says so when there are no customers, and offers a retry when loading fails", async () => {
    m.accounts.mockResolvedValue([]);
    const { unmount } = showList(<SaleAccountsManagement />, "/credit-accounts");
    expect(await screen.findByText("No customers yet")).toBeInTheDocument();
    unmount();

    m.accounts.mockRejectedValueOnce(new Error("List failed")).mockResolvedValue(CUSTOMER_ROWS);
    showList(<SaleAccountsManagement />, "/credit-accounts");
    expect(await screen.findByText("List failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: /Customer balances/ })).toBeInTheDocument();
  });

  it("keeps the rows when only the ledger balances fail", async () => {
    m.balances.mockRejectedValue(new Error("Ledger offline"));
    showList(<SaleAccountsManagement />, "/credit-accounts");
    expect(await screen.findByText("Ledger offline")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Al Noor Trading" })).toBeInTheDocument();
  });
});

describe("payables list", () => {
  it("lists vendors with what is owed as a credit", async () => {
    m.accounts.mockResolvedValue([
      { _id: "v1", partyId: "VEND2026001", name: "Fresh Farms LLC", type: "Vendor", totalInvoices: 2 },
      { _id: "v2", partyId: "VEND2026002", name: "Gulf Dairy", type: "Vendor", totalInvoices: 1 },
    ]);
    m.balances.mockResolvedValue({
      type: "vendor",
      rows: [{ partyId: "v1", partyName: "Fresh Farms LLC", balance: 4000, overdue: 1500, paymentTerms: "Net 60" }],
      totals: { owed: 4000, advances: 0, net: 4000, overdue: 1500 },
    });
    showList(<PurchaseAccount />, "/debit-accounts");
    expect(await screen.findByRole("heading", { level: 1, name: "Payables" })).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: /Vendor balances/ });
    const first = within(table).getByText("Fresh Farms LLC").closest("tr");
    expect(first).toHaveTextContent("4,000.00Cr");
    expect(first).toHaveTextContent("Net 60");
    expect(first).toHaveTextContent("1,500.00");
    expect(m.balances).toHaveBeenCalledWith("vendor");
    expect(card("Total payable")).toHaveTextContent("4,000.00");
    expect(within(card("Total payable")).getByTitle("Credit balance")).toBeInTheDocument();
    fireEvent.click(within(table).getByRole("link", { name: "Fresh Farms LLC" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/debit-accounts/vendor/v1"));
  });
});

// ---------- rules ----------

describe("account rules", () => {
  it("works out the credit position from the record when the ledger has no row", () => {
    expect(creditPosition({ summary: { balance: 9000 }, party: { creditLimit: 10000 } })).toMatchObject({ limit: 10000, utilisation: 90, available: 1000, status: "near" });
    expect(creditPosition({ summary: { balance: 12000 }, party: { creditLimit: 10000 } })).toMatchObject({ status: "over", available: -2000 });
    expect(creditPosition({ summary: { balance: 100 }, party: { creditLimit: 10000 } })).toMatchObject({ status: "ok" });
    expect(creditPosition({ summary: { balance: 100 }, party: { creditLimit: 0 } })).toMatchObject({ status: "no-limit", utilisation: null });
    // the server's own verdict wins when it sent one
    expect(creditPosition({ summary: { balance: 100, creditLimit: 500, utilisation: 20, available: 400, status: "ok" } })).toMatchObject({ status: "ok", utilisation: 20 });
  });

  it("takes overdue from the ledger row, else from the open invoices", () => {
    expect(overdueAmount({ summary: { overdue: 12.5 } })).toBe(12.5);
    expect(overdueAmount({ summary: {}, ageingRow: { total: 100, buckets: { current: 40 } } })).toBe(60);
    expect(overdueAmount({})).toBe(0);
  });

  it("knows which preset a range is", () => {
    const today = "2026-10-04";
    expect(presetRange("month", today)).toEqual({ from: "2026-10-01", to: today });
    expect(presetRange("year", today)).toEqual({ from: "2026-01-01", to: today });
    expect(presetRange("all", today)).toEqual({ from: "", to: "" });
    expect(activePreset({ from: "2026-10-01", to: today }, today)).toBe("month");
    expect(activePreset({ from: "", to: "" }, today)).toBe("all");
    expect(activePreset({ from: "2026-09-01", to: today }, today)).toBeUndefined();
  });

  it("describes how late an invoice is", () => {
    expect(lateness({ daysPastDue: 1 })).toEqual({ tone: "warning", text: "1 day overdue" });
    expect(lateness({ daysPastDue: 90 })).toEqual({ tone: "danger", text: "90 days overdue" });
    expect(lateness({ daysPastDue: 0, daysToDue: 5 })).toEqual({ tone: "neutral", text: "Due in 5 days" });
    expect(lateness({ daysPastDue: 0, daysToDue: 0 }).text).toBe("Due today");
    expect(lateness({ daysPastDue: 0 }).text).toBe("Not yet due");
  });
});

// ---------- the API client ----------

describe("party account API client", () => {
  let api;
  beforeEach(async () => {
    api = (await vi.importActual("../../../lib/partyAccountApi")).partyAccountApi;
    m.axiosGet.mockResolvedValue({ data: { success: true, data: { rows: [] } } });
  });

  it("reads the right party record for each kind", async () => {
    await api.party("customer", "c1");
    expect(m.axiosGet).toHaveBeenLastCalledWith("/customers/c1", { params: undefined });
    await api.party("vendor", "v1");
    expect(m.axiosGet).toHaveBeenLastCalledWith("/vendors/vendors/v1", { params: undefined });
  });

  it("asks for the ledger statement over the whole Dubai day", async () => {
    await api.statement({ kind: "vendor", partyId: "v1", from: "2026-10-01", to: "2026-10-04" });
    expect(m.axiosGet).toHaveBeenLastCalledWith("/accounting/reports/statement", {
      params: { partyId: "v1", partyType: "Vendor", from: "2026-09-30T20:00:00.000Z", to: "2026-10-04T19:59:59.999Z" },
    });
    await api.statement({ kind: "customer", partyId: "c1" });
    expect(m.axiosGet).toHaveBeenLastCalledWith("/accounting/reports/statement", { params: { partyId: "c1", partyType: "Customer", from: undefined, to: undefined } });
  });

  it("asks for balances including settled parties, and the right ageing", async () => {
    await api.balances("customer");
    expect(m.axiosGet).toHaveBeenLastCalledWith("/accounting/reports/party-balances", { params: { type: "customer", includeZero: true } });
    await api.ageing("vendor");
    expect(m.axiosGet).toHaveBeenLastCalledWith("/accounting/reports/ageing", { params: { type: "payable" } });
    await api.ageing("customer");
    expect(m.axiosGet).toHaveBeenLastCalledWith("/accounting/reports/ageing", { params: { type: "receivable" } });
    await api.accounts("customer");
    expect(m.axiosGet).toHaveBeenLastCalledWith("/ledger/credit-accounts", { params: undefined });
    await api.accounts("vendor");
    expect(m.axiosGet).toHaveBeenLastCalledWith("/ledger/debit-accounts", { params: undefined });
  });

  it("finds one party's balance row, and falls back to the statement when there is none", async () => {
    m.axiosGet.mockResolvedValueOnce({ data: { data: { rows: [{ partyId: "c9", balance: 1 }, { partyId: "c1", balance: 250, overdue: 10 }] } } });
    expect(await api.summary("customer", "c1")).toMatchObject({ balance: 250, overdue: 10, source: "ledger" });

    m.axiosGet
      .mockResolvedValueOnce({ data: { data: { rows: [] } } })
      .mockResolvedValueOnce({ data: { data: { closing: 700, source: "documents" } } });
    expect(await api.summary("customer", "c1")).toEqual({ partyId: "c1", balance: 700, source: "documents" });
  });

  it("turns a failed request into an error carrying the server's message", async () => {
    m.axiosGet.mockRejectedValue({ message: "Request failed", response: { status: 404, data: { message: "Customer not found" } } });
    await expect(api.party("customer", "nope")).rejects.toMatchObject({ message: "Customer not found", status: 404 });
  });
});
