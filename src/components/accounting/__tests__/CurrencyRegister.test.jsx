import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ list: vi.fn(), register: vi.fn(), download: vi.fn() }));
vi.mock("../../../lib/currencyApi", () => ({ currencies: { list: m.list, register: m.register } }));
vi.mock("../../../utils/format", async (importOriginal) => ({ ...(await importOriginal()), downloadCSV: m.download }));

import CurrencyRegister from "../CurrencyRegister";

const LIST = [
  { code: "AED", name: "UAE Dirham", isBase: true, isActive: true },
  { code: "USD", name: "US Dollar", isActive: true, latestRate: 3.6725 },
  { code: "KWD", name: "Kuwaiti Dinar", isActive: true, latestRate: 11.95 },
];
const ROWS = [
  { _id: "v1", voucherNo: "RV-2026-0001", voucherType: "receipt", date: "2026-10-01T08:00:00Z", partyName: "Al Noor, Trading", currency: "USD", foreignAmount: 1000, exchangeRate: 3.6725, totalAmount: 3672.5, paymentMode: "cash", paymentDetails: { accountName: "Cash in Hand" }, status: "approved" },
  { _id: "v2", voucherNo: "RV-2026-0002", voucherType: "receipt", date: "2026-10-02T08:00:00Z", partyName: "Al Noor, Trading", currency: "USD", foreignAmount: 500, exchangeRate: 3.9, totalAmount: 1950, paymentMode: "cheque", paymentDetails: { chequeDetails: { chequeNumber: "100200" }, drawnOnBankName: "Mashreq" }, status: "approved", rateOverridden: true, rateOverrideReason: "Agreed with customer" },
  { _id: "v3", voucherNo: "PV-2026-0001", voucherType: "payment", date: "2026-10-03T08:00:00Z", partyName: "Gulf Mills", currency: "KWD", foreignAmount: 10.5, exchangeRate: 11.95, totalAmount: 125.48, paymentMode: "transfer", paymentDetails: { accountName: "ENBD Current", reference: "TRF-1" }, status: "approved" },
  { _id: "v4", voucherNo: "RV-2026-0003", voucherType: "receipt", date: "2026-10-04T08:00:00Z", partyName: "Al Noor, Trading", currency: "USD", foreignAmount: 40, exchangeRate: 3.6725, totalAmount: 146.9, paymentMode: "cash", paymentDetails: {}, status: "cancelled" },
];
const TOTALS = [
  { currency: "KWD", type: "payment", count: 1, foreign: 10.5, aed: 125.48, averageRate: 11.95 },
  { currency: "USD", type: "receipt", count: 2, foreign: 1500, aed: 5622.5, averageRate: 3.748333 },
];
const DATA = { rows: ROWS, totals: TOTALS, truncated: false };

const show = () => render(<MemoryRouter><CurrencyRegister /></MemoryRouter>);

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.list.mockResolvedValue(LIST);
  m.register.mockResolvedValue(DATA);
});

describe("the currency register", () => {
  it("asks for this year to date, all currencies and both directions", async () => {
    show();
    await screen.findByText("RV-2026-0001");
    const year = new Date().getFullYear();
    expect(m.register).toHaveBeenCalledWith({ from: `${year}-01-01`, to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), currency: undefined, type: undefined });
    expect(screen.getByRole("heading", { level: 1, name: "Currency register" })).toHaveClass("text-2xl");
  });

  it("lists each voucher with its foreign amount, rate and AED value", async () => {
    show();
    const first = within(await screen.findByRole("row", { name: /RV-2026-0001/ }));
    expect(first.getByText("USD 1,000.00")).toBeInTheDocument();
    expect(first.getByText("3.6725")).toBeInTheDocument();
    expect(first.getByText("3,672.50")).toBeInTheDocument();
    expect(first.getByText("01/10/2026")).toBeInTheDocument();
    expect(first.getByText("Receipt")).toBeInTheDocument();
    expect(first.getByText("Cash in Hand", { exact: false })).toBeInTheDocument();
    expect(first.getByText("Posted")).toBeInTheDocument();

    const kwd = within(screen.getByRole("row", { name: /PV-2026-0001/ }));
    expect(kwd.getByText("KWD 10.50")).toBeInTheDocument(); // dinars show their own decimals
    expect(kwd.getByText("Payment")).toBeInTheDocument();
  });

  it("marks a rate that was overridden and a voucher that was cancelled", async () => {
    show();
    const over = within(await screen.findByRole("row", { name: /RV-2026-0002/ }));
    expect(over.getByText("Override")).toHaveAttribute("title", "Agreed with customer");
    expect(within(screen.getByRole("row", { name: /RV-2026-0003/ })).getByText("Cancelled")).toBeInTheDocument();
  });

  it("totals per currency and direction, with the average rate", async () => {
    show();
    await screen.findByText("RV-2026-0001");
    const totals = screen.getByRole("table", { name: "Totals by currency and direction" });
    const usd = within(within(totals).getByRole("row", { name: /USD/ }));
    expect(usd.getByText("Received")).toBeInTheDocument();
    expect(usd.getByText("USD 1,500.00")).toBeInTheDocument();
    expect(usd.getByText("5,622.50")).toBeInTheDocument();
    expect(usd.getByText("3.748333")).toBeInTheDocument();
    const kwd = within(within(totals).getByRole("row", { name: /KWD/ }));
    expect(kwd.getByText("Paid")).toBeInTheDocument();
    expect(kwd.getByText("11.9500")).toBeInTheDocument();
  });

  it("re-reads the register when a filter changes", async () => {
    show();
    await screen.findByText("RV-2026-0001");
    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "USD" } });
    await waitFor(() => expect(m.register).toHaveBeenLastCalledWith(expect.objectContaining({ currency: "USD" })));
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "payment" } });
    await waitFor(() => expect(m.register).toHaveBeenLastCalledWith(expect.objectContaining({ currency: "USD", type: "payment" })));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "01/09/2026" } });
    await waitFor(() => expect(m.register).toHaveBeenLastCalledWith(expect.objectContaining({ from: "2026-09-01" })));
    // AED is not offered: nothing in the register is in AED
    expect(within(screen.getByLabelText("Currency")).queryByRole("option", { name: "AED" })).toBeNull();
    expect(within(screen.getByLabelText("Currency")).getAllByRole("option").map((o) => o.value)).toEqual(["", "USD", "KWD"]);
  });

  it("exports what is shown as a CSV", async () => {
    show();
    await screen.findByText("RV-2026-0001");
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(m.download).toHaveBeenCalledTimes(1);
    const [name, headers, rows] = m.download.mock.calls[0];
    expect(name).toMatch(/^currency-register-\d{4}-01-01-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(headers).toEqual(["Date", "Voucher", "Type", "Party", "Currency", "Foreign amount", "Rate", "AED amount", "Paid by", "Status"]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual(["01/10/2026", "RV-2026-0001", "Receipt", "Al Noor, Trading", "USD", "1000.00", "3.6725", "3672.50", "Cash - Cash in Hand", "Posted"]);
    expect(rows[2].slice(4, 8)).toEqual(["KWD", "10.50", "11.9500", "125.48"]);
    expect(rows[3][9]).toBe("Cancelled");
  });

  it("has nothing to export for an empty period, and says so", async () => {
    m.register.mockResolvedValue({ rows: [], totals: [], truncated: false });
    show();
    expect(await screen.findByText("No foreign-currency vouchers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeDisabled();
    expect(screen.queryByRole("table", { name: "Totals by currency and direction" })).toBeNull();
  });

  it("says when only part of a long register is shown", async () => {
    m.register.mockResolvedValue({ ...DATA, truncated: true });
    show();
    expect(await screen.findByText(/Only the first 4 vouchers are shown/)).toBeInTheDocument();
  });

  it("shows why the register could not be read, and tries again", async () => {
    m.register.mockRejectedValueOnce(new Error("Enter the from date as YYYY-MM-DD"));
    show();
    expect(await screen.findByText("Enter the from date as YYYY-MM-DD")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("RV-2026-0001")).toBeInTheDocument();
  });

  it("still works when the currency list cannot be read", async () => {
    m.list.mockRejectedValue(new Error("403"));
    show();
    expect(await screen.findByText("RV-2026-0001")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Currency")).getAllByRole("option")).toHaveLength(1); // just "All currencies"
  });

  it("links to the currencies and rates", async () => {
    show();
    expect(await screen.findByRole("link", { name: "Currencies and rates" })).toHaveAttribute("href", "/currencies");
  });
});
