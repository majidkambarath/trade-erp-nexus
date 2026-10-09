import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const m = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), get: vi.fn(), options: vi.fn(), cheques: vi.fn(), axiosGet: vi.fn(), curList: vi.fn(), curRate: vi.fn() }));
vi.mock("../../../lib/bankingApi", () => ({
  vouchers: { create: m.create, list: m.list, get: m.get, update: vi.fn(), remove: vi.fn() },
  banking: { options: m.options, cheques: m.cheques },
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: {}, ApiError: class extends Error {} }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.axiosGet } }));
vi.mock("../../../lib/currencyApi", () => ({ currencies: { list: m.curList, rate: m.curRate } }));

import { PartyVoucherForm, ReceiptVouchers } from "../PartyVouchers";
import ChequeRegister from "../../banking/ChequeRegister";
import { convertToBaseCents } from "../../../lib/currencyForms";
import { resetOrgLocale, setOrgLocale } from "../../../utils/orgLocale";

const box = (name) => screen.getByRole("combobox", { name });
const choose = async (name, text) => {
  fireEvent.keyDown(box(name), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(text) }));
};

const CFG = { voucherType: "receipt", title: "Receipt vouchers", one: "receipt", noun: "Customer", amountLabel: "Amount received (AED)", partyPath: "/customers/customers", nameKey: "customerName", idKey: "customerId", partyField: "customerId", docType: "sales_order" };
const OPTIONS = {
  modes: ["cash", "bank", "transfer", "cheque", "card"],
  cashAccounts: [{ _id: "cash", accountName: "Cash in Hand", accountCode: "CASH0001", balance: 500 }],
  bankAccounts: [{ _id: "bank1", accountName: "ENBD Current", accountCode: "BANK0001", balance: 1000 }],
  banks: [], cards: [],
};
const INVOICES = [
  { _id: "i1", transactionNo: "SO-2026-0001", date: "2026-09-01", totalAmount: 2000, outstandingAmount: 2000 },
  { _id: "i2", transactionNo: "SO-2026-0002", date: "2026-09-10", totalAmount: 3000, outstandingAmount: 3000 },
];
const CURRENCIES = [
  { code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2, isBase: true, isActive: true, latestRate: 1 },
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, isActive: true, latestRate: 3.6725 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD", decimals: 3, isActive: true, latestRate: 11.95 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2, isActive: true, latestRate: null }, // on, but no rate
  { code: "GBP", name: "Pound Sterling", symbol: "£", decimals: 2, isActive: false, latestRate: 4.6 }, // has a rate, but off
];
const RATES = { USD: 3.6725, KWD: 11.95 };
const rateFor = (code, date) => Promise.resolve({ code, date, rate: date === "2026-09-01" ? 3.65 : RATES[code], rateDate: "2026-10-01", source: "cbuae", tolerancePercent: 5, decimals: code === "KWD" ? 3 : 2 });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.options.mockResolvedValue(OPTIONS);
  m.curList.mockResolvedValue(CURRENCIES);
  m.curRate.mockImplementation(rateFor);
  m.axiosGet.mockImplementation((url) => Promise.resolve({ data: { data: url === "/customers/customers" ? [{ _id: "c1", customerName: "Al Noor", customerId: "CUST001" }] : INVOICES } }));
});

afterEach(() => resetOrgLocale());

const form = async ({ party = true } = {}) => {
  const onSaved = vi.fn();
  render(<PartyVoucherForm cfg={CFG} direction="receipt" onClose={() => {}} onSaved={onSaved} />);
  await waitFor(() => expect(m.options).toHaveBeenCalled());
  await waitFor(() => expect(m.curList).toHaveBeenCalled());
  if (party) {
    await choose(/^Customer/, "Al Noor");
    await screen.findByLabelText("Amount against SO-2026-0001");
  }
  return onSaved;
};
const useUsd = async () => {
  await choose("Currency", "USD");
  await waitFor(() => expect(screen.getByLabelText(/Exchange rate/)).toHaveValue("3.6725"));
};
const amountBox = () => screen.getByLabelText(/^Amount received/);
const post = () => fireEvent.click(screen.getByRole("button", { name: "Post receipt" }));

describe("choosing a currency", () => {
  it("offers no choice until a foreign currency is on and has a rate", async () => {
    m.curList.mockResolvedValue([CURRENCIES[0], CURRENCIES[3], CURRENCIES[4]]); // AED, Euro without a rate, Pound that is off
    await form({ party: false });
    expect(screen.queryByRole("combobox", { name: "Currency" })).toBeNull();
    expect(screen.getByLabelText(/^Amount received \(AED\)/)).toBeInTheDocument();
  });

  it("names the organisation's own base currency in the amount label, not a fixed one", async () => {
    setOrgLocale({ currency: "GBP" });
    m.curList.mockResolvedValue([{ code: "GBP", name: "Pound Sterling", symbol: "£", decimals: 2, isBase: true, isActive: true, latestRate: 1 }]);
    await form({ party: false });
    expect(screen.getByLabelText(/^Amount received \(GBP\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/\(AED\)/)).toBeNull();
  });

  it("falls back to the organisation's currency while the currency list says nothing", async () => {
    setOrgLocale({ currency: "GBP" });
    m.curList.mockResolvedValue([]);
    await form({ party: false });
    expect(screen.getByLabelText(/^Amount received \(GBP\)/)).toBeInTheDocument();
  });

  it("offers AED first, then only active currencies that have a rate", async () => {
    await form({ party: false });
    fireEvent.keyDown(box("Currency"), { key: "ArrowDown" });
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent.slice(0, 3))).toEqual(["AED", "KWD", "USD"]);
    expect(screen.queryByRole("option", { name: /Euro/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /Pound/ })).toBeNull();
  });

  it("looks up the rate for the voucher's date, and shows the amount in the foreign currency and its AED equivalent", async () => {
    await form();
    await useUsd();
    expect(m.curRate).toHaveBeenCalledWith("USD", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(screen.getByLabelText(/^Amount received \(USD\)/)).toBeInTheDocument();
    expect(screen.getByText(/Rate on file for \d\d\/\d\d\/\d{4}: 3\.6725, from 01\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByLabelText("Equivalent in AED")).toHaveValue("0.00");

    fireEvent.change(amountBox(), { target: { value: "1000" } });
    expect(screen.getByLabelText("Equivalent in AED")).toHaveValue("3,672.50");
    expect(screen.getByLabelText("Equivalent in AED")).toHaveAttribute("readonly");
    expect(screen.getByText("USD 1,000.00 at this rate")).toBeInTheDocument();
  });

  it("follows the rate as it is edited, live, to the cent", async () => {
    await form();
    await useUsd();
    fireEvent.change(amountBox(), { target: { value: "1000.5" } });
    expect(screen.getByLabelText("Equivalent in AED")).toHaveValue("3,674.34"); // 3674.33625
    fireEvent.change(screen.getByLabelText(/Exchange rate/), { target: { value: "3.7" } });
    expect(screen.getByLabelText("Equivalent in AED")).toHaveValue("3,701.85");
  });

  it("takes only as many decimals as the currency has", async () => {
    await form();
    await useUsd();
    fireEvent.change(amountBox(), { target: { value: "10.55" } });
    fireEvent.change(amountBox(), { target: { value: "10.555" } }); // a third decimal is not accepted for dollars
    expect(amountBox()).toHaveValue("10.55");
    await choose("Currency", "KWD");
    await waitFor(() => expect(screen.getByLabelText(/Exchange rate/)).toHaveValue("11.95"));
    expect(amountBox()).toHaveValue(""); // a different currency starts the amount over
    fireEvent.change(amountBox(), { target: { value: "10.555" } });
    expect(amountBox()).toHaveValue("10.555");
    expect(screen.getByLabelText("Equivalent in AED")).toHaveValue("126.13"); // 10.555 x 11.95 = 126.13225
  });

  it("refreshes the rate when the date changes", async () => {
    await form();
    await useUsd();
    fireEvent.change(screen.getByLabelText(/Exchange rate/), { target: { value: "3.7" } });
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: "01/09/2026" } });
    await waitFor(() => expect(m.curRate).toHaveBeenLastCalledWith("USD", "2026-09-01"));
    await waitFor(() => expect(screen.getByLabelText(/Exchange rate/)).toHaveValue("3.65"));
  });

  it("goes back to AED with nothing foreign left", async () => {
    m.create.mockResolvedValue({ voucherNo: "RV-2026-0001" });
    await form();
    await useUsd();
    await choose("Currency", "AED");
    expect(screen.queryByRole("region", { name: "Foreign currency" })).toBeNull();
    expect(screen.getByLabelText(/^Amount received \(AED\)/)).toHaveValue("");
    fireEvent.change(amountBox(), { target: { value: "100" } });
    post();
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    const body = m.create.mock.calls[0][0];
    expect(body).toMatchObject({ voucherType: "receipt", totalAmount: 100 });
    for (const k of ["currency", "foreignAmount", "exchangeRate", "rateOverrideReason"]) expect(body).not.toHaveProperty(k);
  });
});

describe("allocating a foreign receipt", () => {
  it("settles the invoices in AED, oldest first, from the AED equivalent", async () => {
    await form();
    await useUsd();
    fireEvent.change(amountBox(), { target: { value: "1000" } }); // AED 3,672.50
    expect(screen.getByLabelText("Amount against SO-2026-0001")).toHaveValue("2000");
    expect(screen.getByLabelText("Amount against SO-2026-0002")).toHaveValue("1672.5");
    const invoices = within(screen.getByRole("region", { name: "Open invoices" }));
    expect(invoices.getByText(/Invoices are in AED/)).toBeInTheDocument();
    expect(invoices.getByText("Kept on account (advance from customer)").closest("tr")).toHaveTextContent("0.00");
  });

  it("refills the invoices when a new rate leaves them allocated more than the amount covers", async () => {
    await form();
    await useUsd();
    fireEvent.change(amountBox(), { target: { value: "1000" } });
    expect(screen.getByLabelText("Amount against SO-2026-0002")).toHaveValue("1672.5");
    fireEvent.change(screen.getByLabelText(/Exchange rate/), { target: { value: "3.5" } }); // AED 3,500
    await waitFor(() => expect(screen.getByLabelText("Amount against SO-2026-0002")).toHaveValue("1500"));
  });

  it("raises the foreign amount to cover an invoice allocated more than the amount", async () => {
    await form();
    await useUsd();
    fireEvent.change(amountBox(), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Amount against SO-2026-0002"), { target: { value: "3000" } });
    // 100 USD covered the first invoice's 367.25 AED; with 3,000 more on the second, AED 3,367.25 must be covered
    const raised = amountBox().value;
    expect(Number(raised)).toBeGreaterThan(100);
    expect(convertToBaseCents(raised, 3.6725)).toBeGreaterThanOrEqual(336725);
    expect(convertToBaseCents(Number(raised) - 0.01, 3.6725)).toBeLessThan(336725); // and no more than a cent of dollars too much
  });

  it("posts the currency, the foreign amount and the rate, with the AED total and allocations", async () => {
    m.create.mockResolvedValue({ voucherNo: "RV-2026-0007" });
    const onSaved = await form();
    await useUsd();
    fireEvent.change(amountBox(), { target: { value: "1000" } });
    post();
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    const body = m.create.mock.calls[0][0];
    expect(body).toMatchObject({
      voucherType: "receipt", customerId: "c1", currency: "USD", foreignAmount: 1000, exchangeRate: 3.6725, totalAmount: 3672.5,
      paymentMode: "cash",
      linkedInvoices: [{ invoiceId: "i1", amount: 2000, balance: 0 }, { invoiceId: "i2", amount: 1672.5, balance: 1327.5 }],
    });
    expect(body).not.toHaveProperty("rateOverrideReason");
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Receipt RV-2026-0007 posted"));
  });
});

describe("a rate that differs from the rate on file", () => {
  it("passes inside the tolerance with a note and no reason", async () => {
    m.create.mockResolvedValue({ voucherNo: "RV-2026-0008" });
    await form();
    await useUsd();
    fireEvent.change(amountBox(), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/Exchange rate/), { target: { value: "3.7" } });
    expect(screen.getByText(/0\.75% away from the rate on file, which is within the allowed 5%/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Reason for this rate/)).toBeNull();
    post();
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    expect(m.create.mock.calls[0][0]).toMatchObject({ exchangeRate: 3.7, totalAmount: 370 });
    expect(m.create.mock.calls[0][0]).not.toHaveProperty("rateOverrideReason");
  });

  it("warns when it is further than allowed and will not post without a reason", async () => {
    m.create.mockResolvedValue({ voucherNo: "RV-2026-0009" });
    await form();
    await useUsd();
    fireEvent.change(amountBox(), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/Exchange rate/), { target: { value: "3.9" } });
    expect(screen.getByRole("alert")).toHaveTextContent("This rate is 6.19% away from the rate on file (3.6725); up to 5% is allowed without a reason.");

    post();
    expect(await screen.findByText("This rate is 6.19% away from the rate on file. Say why it is used")).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Reason for this rate/), { target: { value: "Rate agreed with the customer" } });
    post();
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    expect(m.create.mock.calls[0][0]).toMatchObject({ currency: "USD", foreignAmount: 100, exchangeRate: 3.9, totalAmount: 390, rateOverrideReason: "Rate agreed with the customer" });
  });

  it("drops the reason when the rate comes back to the rate on file", async () => {
    await form();
    await useUsd();
    fireEvent.change(screen.getByLabelText(/Exchange rate/), { target: { value: "3.9" } });
    expect(screen.getByLabelText(/Reason for this rate/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Exchange rate/), { target: { value: "3.6725" } });
    expect(screen.queryByLabelText(/Reason for this rate/)).toBeNull();
  });
});

describe("when there is no rate or the server refuses", () => {
  it("shows that there is no rate for the date and does not post", async () => {
    m.curRate.mockImplementation(() => Promise.reject(new Error("No USD rate on or before 04/10/2026. Add one under Currencies.")));
    await form();
    await choose("Currency", "USD");
    expect(await screen.findByText("No USD rate on or before 04/10/2026. Add one under Currencies.")).toBeInTheDocument();
    fireEvent.change(amountBox(), { target: { value: "100" } });
    post();
    await waitFor(() => expect(screen.getAllByText("No USD rate on or before 04/10/2026. Add one under Currencies.").length).toBeGreaterThan(1));
    expect(m.create).not.toHaveBeenCalled();
  });

  it("does not use the rate of an earlier date after the date changes to one with no rate", async () => {
    await form();
    await useUsd();
    m.curRate.mockImplementation(() => Promise.reject(new Error("No USD rate on or before 01/01/2020. Add one under Currencies.")));
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: "01/01/2020" } });
    expect(await screen.findByText("No USD rate on or before 01/01/2020. Add one under Currencies.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Exchange rate/)).toHaveValue("");
    fireEvent.change(amountBox(), { target: { value: "100" } });
    post();
    await waitFor(() => expect(screen.getByLabelText("Equivalent in AED")).toHaveValue("0.00"));
    expect(m.create).not.toHaveBeenCalled();
  });

  it("shows the server's refusal and stays open", async () => {
    m.create.mockRejectedValue(Object.assign(new Error("The rate 3.9 is 6.19% away from the USD rate on file (3.6725); 5% is allowed. Give a reason to use it."), { code: "RATE_OUT_OF_TOLERANCE" }));
    await form();
    await useUsd();
    fireEvent.change(amountBox(), { target: { value: "100" } });
    post();
    expect(await screen.findByText(/is 6\.19% away from the USD rate on file/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post receipt" })).toBeEnabled();
  });
});

describe("foreign vouchers in the list and in the view", () => {
  const ROWS = [
    { _id: "v1", voucherNo: "RV-2026-0001", date: "2026-10-01T08:00:00Z", partyName: "Al Noor", paymentMode: "cash", paymentDetails: { accountName: "Cash in Hand" }, totalAmount: 100, status: "approved", linkedInvoices: [] },
    { _id: "v2", voucherNo: "RV-2026-0002", date: "2026-10-02T08:00:00Z", partyName: "Al Noor", paymentMode: "cash", paymentDetails: { accountName: "Cash in Hand" }, totalAmount: 3672.5, currency: "USD", foreignAmount: 1000, exchangeRate: 3.6725, status: "approved", linkedInvoices: [] },
  ];

  it("marks a foreign voucher with its currency and shows the foreign amount under the AED one", async () => {
    m.list.mockResolvedValue({ rows: ROWS, pagination: { current: 1, pages: 1, total: 2 } });
    render(<ReceiptVouchers />);
    const usd = within(await screen.findByRole("row", { name: /RV-2026-0002/ }));
    expect(usd.getByTitle("Foreign currency")).toHaveTextContent("USD");
    expect(usd.getByText("USD 1,000.00 @ 3.6725")).toBeInTheDocument();
    expect(usd.getByText("3,672.50")).toBeInTheDocument();
    const aed = within(screen.getByRole("row", { name: /RV-2026-0001/ }));
    expect(aed.queryByTitle("Foreign currency")).toBeNull();
    expect(aed.queryByText(/@/)).toBeNull();
  });

  it("shows the conversion in the voucher view and on the printout", async () => {
    m.list.mockResolvedValue({ rows: ROWS, pagination: { current: 1, pages: 1, total: 2 } });
    m.get.mockResolvedValue({
      ...ROWS[1], voucherType: "receipt", rateDate: "2026-10-01T00:00:00Z", rateSource: "cbuae", ledgerBased: false,
      entries: [{ accountName: "Cash in Hand", debitAmount: 3672.5, creditAmount: 0 }, { accountName: "Customer Advance - Al Noor", debitAmount: 0, creditAmount: 3672.5 }],
    });
    const written = [];
    window.open = vi.fn(() => ({ document: { write: (html) => written.push(html), close: vi.fn() } }));
    render(<ReceiptVouchers />);
    fireEvent.click(await screen.findByRole("button", { name: "View RV-2026-0002" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("USD 1,000.00 @ 3.6725 = AED 3,672.50")).toBeInTheDocument();
    expect(within(dialog).getByText("Rate of 01/10/2026 (Central Bank of the UAE)")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /Print/ }));
    expect(written.join("")).toContain("USD 1,000.00 @ 3.6725 = AED 3,672.50");
  });
});

describe("the cheque register", () => {
  it("shows the foreign value of a cheque under its AED amount", async () => {
    const row = (over) => ({ _id: "c1", chequeNo: "100200", direction: "receipt", voucherNo: "RV-2026-0001", partyName: "Al Noor", chequeDate: "2026-09-01T00:00:00Z", amount: 1836.25, status: "pending", matured: true, drawnOnBankName: "Citibank", bankAccountName: "ENBD Current", ...over });
    m.cheques.mockResolvedValue({
      rows: [row({ currency: "USD", foreignAmount: 500, exchangeRate: 3.6725 }), row({ _id: "c2", chequeNo: "900900", amount: 105 })],
      total: 2, summary: { receivable: { amount: 1941.25, count: 2 }, payable: { amount: 0, count: 0 } },
    });
    render(<ChequeRegister />);
    const usd = within(await screen.findByRole("row", { name: /100200/ }));
    expect(usd.getByText("1,836.25")).toBeInTheDocument();
    expect(usd.getByText("USD 500.00 @ 3.6725")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /900900/ })).queryByText(/@/)).toBeNull();
  });
});
