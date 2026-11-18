import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn(), axiosGet: vi.fn(), curList: vi.fn(), curRate: vi.fn() }));
vi.mock("../../../lib/bankingApi", () => ({ vouchers: { create: m.create, list: vi.fn(), get: vi.fn(), update: vi.fn(), remove: vi.fn() }, banking: { options: m.options, cheques: vi.fn() } }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: {}, ApiError: class extends Error {} }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.axiosGet } }));
vi.mock("../../../lib/currencyApi", () => ({ currencies: { list: m.curList, rate: m.curRate } }));

import { PartyVoucherForm } from "../PartyVouchers";

const CFG = { voucherType: "receipt", title: "Receipt vouchers", one: "receipt", noun: "Customer", amountLabel: "Amount received (AED)", partyPath: "/customers/customers", nameKey: "customerName", idKey: "customerId", partyField: "customerId", docType: "sales_order" };
const OPTIONS = { modes: ["cash"], cashAccounts: [{ _id: "cash", accountName: "Cash in Hand", accountCode: "CASH0001", balance: 500 }], bankAccounts: [], banks: [], cards: [] };
// one invoice in dollars (booked at 3.6725), one in dirhams
const INVOICES = [
  { _id: "u1", transactionNo: "SO-2026-0001", date: "2026-09-01", totalAmount: 3856.13, outstandingAmount: 3856.13, fx: { currency: "USD", rate: 3.6725, totalAmount: 1050, outstandingAmount: 1050 } },
  { _id: "b1", transactionNo: "SO-2026-0002", date: "2026-09-10", totalAmount: 3000, outstandingAmount: 3000 },
];
const CURRENCIES = [
  { code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2, isBase: true, isActive: true, latestRate: 1 },
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, isActive: true, latestRate: 3.6725 },
];

const box = (name) => screen.getByRole("combobox", { name });
const choose = async (name, text) => {
  fireEvent.keyDown(box(name), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(text) }));
};

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.options.mockResolvedValue(OPTIONS);
  m.curList.mockResolvedValue(CURRENCIES);
  m.curRate.mockImplementation((code, date) => Promise.resolve({ code, date, rate: 3.6725, rateDate: "2026-10-01", source: "cbuae", tolerancePercent: 5, decimals: 2 }));
  m.axiosGet.mockImplementation((url) => Promise.resolve({ data: { data: url === "/customers/customers" ? [{ _id: "c1", customerName: "Al Noor", customerId: "CUST001" }] : INVOICES } }));
  m.create.mockResolvedValue({ voucherNo: "RV-1", status: "approved" });
});

const open = async () => {
  render(<PartyVoucherForm cfg={CFG} direction="receipt" onClose={() => {}} onSaved={vi.fn()} />);
  await waitFor(() => expect(m.curList).toHaveBeenCalled());
  await choose(/^Customer/, "Al Noor");
};

describe("settling an invoice made in a foreign currency", () => {
  it("in the base currency lists only the base invoices, and says where the dollar one went", async () => {
    await open();
    await screen.findByLabelText("Amount against SO-2026-0002");
    expect(screen.queryByLabelText("Amount against SO-2026-0001")).toBeNull();
    expect(screen.getByText(/1 invoice is in USD: choose that currency above/)).toBeInTheDocument();
  });

  it("in the invoice's currency lists it with dollars open, allocates dollars and posts them", async () => {
    await open();
    await choose("Currency", "USD");
    const against = await screen.findByLabelText("Amount against SO-2026-0001");
    expect(screen.queryByLabelText("Amount against SO-2026-0002")).toBeNull();
    expect(screen.getAllByText(/USD 1,050\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/exchange gain or loss/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Amount received/), { target: { value: "500" } });
    expect(against).toHaveValue("500"); // oldest first, in dollars

    fireEvent.click(screen.getByRole("button", { name: "Post receipt" }));
    await waitFor(() => expect(m.create).toHaveBeenCalled());
    const body = m.create.mock.calls[0][0];
    expect(body.currency).toBe("USD");
    expect(body.foreignAmount).toBe(500);
    expect(body.linkedInvoices).toEqual([{ invoiceId: "u1", amount: 500, balance: 550 }]);
  });

  it("will not let more than the dollars open be set against the invoice", async () => {
    await open();
    await choose("Currency", "USD");
    const against = await screen.findByLabelText("Amount against SO-2026-0001");
    fireEvent.change(against, { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Post receipt" }));
    expect(await screen.findByText(/More than the USD 1,050\.00 open/)).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();
  });
});
