import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  list: vi.fn(), create: vi.fn(), update: vi.fn(), rates: vi.fn(), addRate: vi.fn(), settings: vi.fn(), updateSettings: vi.fn(),
}));
vi.mock("../../../lib/currencyApi", () => ({ currencies: m }));

import Currencies from "../Currencies";

const LIST = () => [
  { code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2, isBase: true, isActive: true, latestRate: 1, latestRateDate: null, rateCount: 0, used: false },
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, isBase: false, isActive: true, latestRate: 3.6725, latestRateDate: "2026-10-01", latestSource: "cbuae", rateCount: 3, used: true },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2, isBase: false, isActive: true, latestRate: null, latestRateDate: null, rateCount: 0, used: false },
  { code: "GBP", name: "Pound Sterling", symbol: "£", decimals: 2, isBase: false, isActive: false, latestRate: null, latestRateDate: null, rateCount: 0, used: false },
];
const HISTORY = [
  { _id: "r3", code: "USD", rate: 3.9, effectiveDay: "2099-01-01", source: "manual", note: "forecast", updatedAt: "2026-10-01T08:00:00Z" },
  { _id: "r2", code: "USD", rate: 3.6725, effectiveDay: "2021-06-01", source: "cbuae", note: "", updatedAt: "2021-06-01T08:00:00Z" },
  { _id: "r1", code: "USD", rate: 3.6, effectiveDay: "2020-01-01", source: "import", note: "opening load", updatedAt: "2020-01-02T08:00:00Z" },
];

const show = () => render(<MemoryRouter><Currencies /></MemoryRouter>);
const row = (name) => screen.getByRole("row", { name });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.list.mockResolvedValue(LIST());
  m.settings.mockResolvedValue({ baseCurrency: "AED", fxTolerancePercent: 5 });
  m.rates.mockResolvedValue(HISTORY);
});

describe("the currency list", () => {
  it("shows each currency with its latest rate and date; AED is the read-only base", async () => {
    show();
    expect(await screen.findByRole("heading", { level: 1, name: "Currencies" })).toHaveClass("text-2xl");

    const aed = row(/UAE Dirham/);
    expect(within(aed).getByText("Base currency", { selector: "span" })).toBeInTheDocument();
    expect(within(aed).getByText("Base currency, always 1")).toBeInTheDocument();
    expect(within(aed).queryByRole("switch")).toBeNull();
    expect(within(aed).queryByRole("button")).toBeNull();

    const usd = row(/US Dollar/);
    expect(within(usd).getByText("3.6725")).toBeInTheDocument();
    expect(within(usd).getByText("AED per 1 USD")).toBeInTheDocument();
    expect(within(usd).getByText("01/10/2026")).toBeInTheDocument();
    expect(within(usd).getByText("Ready")).toBeInTheDocument();
    expect(within(usd).getByRole("switch", { name: "Use USD" })).toBeChecked();

    expect(within(row(/Euro/)).getByText("No rate yet")).toBeInTheDocument();
    expect(within(row(/Pound Sterling/)).getByText("Off")).toBeInTheDocument();
    expect(within(row(/Pound Sterling/)).getByRole("switch", { name: "Use GBP" })).not.toBeChecked();
  });

  it("counts what is ready and what still needs a rate", async () => {
    show();
    await screen.findByText("Ready for vouchers");
    expect(screen.getByText("Ready for vouchers").closest("div").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Need a rate").closest("div").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Switched on, but no rate yet")).toBeInTheDocument();
  });

  it("links to the register and names no control it does not have", async () => {
    show();
    expect(await screen.findByRole("link", { name: "Currency register" })).toHaveAttribute("href", "/currency-register");
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it("shows the server's refusal to load, with a way to try again", async () => {
    m.list.mockRejectedValueOnce(new Error("Network down"));
    show();
    expect(await screen.findByText("Network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("US Dollar")).toBeInTheDocument();
  });
});

describe("switching a currency on and off", () => {
  it("switches a currency on, and says a rate is still needed", async () => {
    m.update.mockResolvedValue({});
    show();
    fireEvent.click(await screen.findByRole("switch", { name: "Use GBP" }));
    await waitFor(() => expect(m.update).toHaveBeenCalledWith("GBP", { isActive: true }));
    expect(await screen.findByText("GBP switched on. Add a rate before using it on a voucher.")).toBeInTheDocument();
    await waitFor(() => expect(m.list).toHaveBeenCalledTimes(2));
  });

  it("switches one off and says what happens to the vouchers already made", async () => {
    m.update.mockResolvedValue({});
    show();
    fireEvent.click(await screen.findByRole("switch", { name: "Use USD" }));
    await waitFor(() => expect(m.update).toHaveBeenCalledWith("USD", { isActive: false }));
    expect(await screen.findByText(/USD switched off\. Vouchers already made in it are unchanged/)).toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    m.update.mockRejectedValue(new Error("Insufficient role permissions"));
    show();
    fireEvent.click(await screen.findByRole("switch", { name: "Use GBP" }));
    expect(await screen.findByText("Insufficient role permissions")).toBeInTheDocument();
  });
});

describe("adding a rate", () => {
  const open = async (code = "USD") => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: `Add rate for ${code}` }));
    return screen.findByRole("dialog", { name: `Exchange rates: ${code}` });
  };

  it("shows the rate history below the form, marking the rate in force and one still to come", async () => {
    const dialog = await open();
    const history = within(await within(dialog).findByRole("region", { name: "USD rate history" }));
    expect(history.getByRole("row", { name: /01\/06\/2021/ })).toHaveTextContent("In force");
    expect(history.getByRole("row", { name: /01\/01\/2099/ })).toHaveTextContent("Upcoming");
    expect(history.getByRole("row", { name: /01\/01\/2020/ })).not.toHaveTextContent("In force");
    expect(history.getByText("Central Bank of the UAE")).toBeInTheDocument();
    expect(history.getByText("opening load")).toBeInTheDocument();
    expect(m.rates).toHaveBeenCalledWith("USD");
  });

  it("saves the rate with its date, source and note, then refreshes the history", async () => {
    m.addRate.mockResolvedValue({ replaced: false, effectiveDay: "2026-10-05", rate: 3.67 });
    const dialog = await open();
    await within(dialog).findByRole("region", { name: "USD rate history" });
    fireEvent.change(within(dialog).getByLabelText(/Rate \(AED per 1 USD\)/), { target: { value: "3.67" } });
    fireEvent.change(within(dialog).getByLabelText(/Applies from/), { target: { value: "05/10/2026" } });
    fireEvent.change(within(dialog).getByLabelText("Source"), { target: { value: "cbuae" } });
    fireEvent.change(within(dialog).getByLabelText("Note"), { target: { value: "  morning fixing " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save rate" }));

    await waitFor(() => expect(m.addRate).toHaveBeenCalledWith("USD", { rate: 3.67, effectiveDate: "2026-10-05", source: "cbuae", note: "morning fixing" }));
    expect(await screen.findByText("USD rate saved from 05/10/2026")).toBeInTheDocument();
    await waitFor(() => expect(m.rates).toHaveBeenCalledTimes(2));
    expect(within(dialog).getByLabelText(/Rate \(AED per 1 USD\)/)).toHaveValue(""); // ready for the next one
    await waitFor(() => expect(m.list).toHaveBeenCalledTimes(2)); // the list shows the new rate
  });

  it("will not take an empty or zero rate, and never more than six decimals", async () => {
    const dialog = await open();
    const rate = within(dialog).getByLabelText(/Rate \(AED per 1 USD\)/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save rate" }));
    expect(await within(dialog).findByText("Enter a rate greater than zero")).toBeInTheDocument();
    fireEvent.change(rate, { target: { value: "0" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save rate" }));
    expect(await within(dialog).findByText("Enter a rate greater than zero")).toBeInTheDocument();
    expect(m.addRate).not.toHaveBeenCalled();

    fireEvent.change(rate, { target: { value: "3.123456" } });
    fireEvent.change(rate, { target: { value: "3.1234567" } }); // a seventh decimal is not accepted
    expect(rate).toHaveValue("3.123456");
    fireEvent.change(rate, { target: { value: "abc" } });
    expect(rate).toHaveValue("3.123456");
  });

  it("warns that a rate for a date that has one replaces it", async () => {
    m.addRate.mockResolvedValue({ replaced: true, previousRate: 3.6725, effectiveDay: "2021-06-01", rate: 3.68 });
    const dialog = await open();
    await within(dialog).findByRole("region", { name: "USD rate history" });
    fireEvent.change(within(dialog).getByLabelText(/Applies from/), { target: { value: "01/06/2021" } });
    expect(within(dialog).getByText(/A rate for this date exists \(3\.6725\)\. Saving replaces it/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Rate \(AED per 1 USD\)/), { target: { value: "3.68" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save rate" }));
    expect(await screen.findByText("USD rate for 01/06/2021 replaced (was 3.6725)")).toBeInTheDocument();
  });

  it("shows what the server refused and keeps the dialog open", async () => {
    m.addRate.mockRejectedValue(new Error("Enter a valid effective date"));
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/Rate \(AED per 1 USD\)/), { target: { value: "3.67" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save rate" }));
    expect(await within(dialog).findByText("Enter a valid effective date")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Exchange rates: USD" })).toBeInTheDocument();
  });

  it("explains a currency with no rate yet", async () => {
    m.rates.mockResolvedValue([]);
    const dialog = await open("EUR");
    expect(await within(dialog).findByText(/No rate yet\. EUR cannot be used on a voucher until one is added/)).toBeInTheDocument();
  });

  it("closes with Escape", async () => {
    const dialog = await open();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("adding a currency that is not in the list", () => {
  const open = async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Add currency/ }));
    return screen.findByRole("dialog", { name: "Add a currency" });
  };

  it("checks the code, the name and the decimals before sending", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add currency" }));
    expect(await within(dialog).findByText("Three letters, for example JOD")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the currency's name")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: "usd" } });
    expect(within(dialog).getByLabelText(/^Code/)).toHaveValue("USD"); // upper-case, letters only
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Dollar" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add currency" }));
    expect(await within(dialog).findByText("USD is already in the list")).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("creates it with its symbol and decimal places", async () => {
    m.create.mockResolvedValue({});
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: "j1od" } });
    expect(within(dialog).getByLabelText(/^Code/)).toHaveValue("JOD");
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: " Jordanian Dinar " } });
    fireEvent.change(within(dialog).getByLabelText(/^Symbol/), { target: { value: "JD" } });
    fireEvent.change(within(dialog).getByLabelText(/^Decimal places/), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add currency" }));
    await waitFor(() => expect(m.create).toHaveBeenCalledWith({ code: "JOD", name: "Jordanian Dinar", symbol: "JD", decimals: 3 }));
    expect(await screen.findByText("JOD added")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the server's refusal and keeps the dialog open", async () => {
    m.create.mockRejectedValue(new Error("Currency JOD is already in the list"));
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: "JOD" } });
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Jordanian Dinar" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add currency" }));
    expect(await within(dialog).findByText("Currency JOD is already in the list")).toBeInTheDocument();
  });
});

describe("the rate tolerance", () => {
  it("shows the allowed difference and saves a new one", async () => {
    m.updateSettings.mockResolvedValue({ baseCurrency: "AED", fxTolerancePercent: 7.5 });
    show();
    const box = await screen.findByLabelText("Allowed difference (%)");
    expect(box).toHaveValue("5");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled(); // nothing changed
    fireEvent.change(box, { target: { value: "7.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.updateSettings).toHaveBeenCalledWith({ fxTolerancePercent: 7.5 }));
    expect(await screen.findByText("Allowed difference saved")).toBeInTheDocument();
    expect(screen.getByLabelText("Allowed difference (%)")).toHaveValue("7.5");
  });

  it("refuses a value that is not a percentage", async () => {
    show();
    const box = await screen.findByLabelText("Allowed difference (%)");
    fireEvent.change(box, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/A percentage from 0 to 100/)).toBeInTheDocument();
    expect(m.updateSettings).not.toHaveBeenCalled();
  });

  it("is not shown when the setting cannot be read", async () => {
    m.settings.mockRejectedValue(new Error("403"));
    show();
    await screen.findByText("US Dollar");
    expect(screen.queryByLabelText("Allowed difference (%)")).toBeNull();
  });
});
