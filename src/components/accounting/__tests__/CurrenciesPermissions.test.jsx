import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderAs, statusFor } from "./asRole";

// Currencies: adding a currency, switching one on or off, adding a rate and the rate tolerance are accounts.manage.
// A person who may only look still reads the list, the rate history and the tolerance.

const m = vi.hoisted(() => ({
  list: vi.fn(), create: vi.fn(), update: vi.fn(), rates: vi.fn(), addRate: vi.fn(), settings: vi.fn(), updateSettings: vi.fn(),
}));
let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));
vi.mock("../../../lib/currencyApi", () => ({ currencies: m }));

import Currencies from "../Currencies";

const LIST = [
  { code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2, isBase: true, isActive: true, latestRate: 1, latestRateDate: null, rateCount: 0, used: false },
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, isBase: false, isActive: true, latestRate: 3.6725, latestRateDate: "2026-10-01", latestSource: "cbuae", rateCount: 1, used: true },
  { code: "GBP", name: "Pound Sterling", symbol: "£", decimals: 2, isBase: false, isActive: false, latestRate: null, latestRateDate: null, rateCount: 0, used: false },
];
const HISTORY = [{ _id: "r2", code: "USD", rate: 3.6725, effectiveDay: "2021-06-01", source: "cbuae", note: "", updatedAt: "2021-06-01T08:00:00Z" }];

const show = () => renderAs(<MemoryRouter><Currencies /></MemoryRouter>);
const row = (name) => screen.getByRole("row", { name });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.list.mockResolvedValue(LIST);
  m.settings.mockResolvedValue({ baseCurrency: "AED", fxTolerancePercent: 5 });
  m.rates.mockResolvedValue(HISTORY);
});

describe("currencies: who may change them", () => {
  it("shows the list, the state of each currency and the tolerance, with nothing to change, to someone who may only look", async () => {
    status = statusFor("accounts.view");
    await show();
    expect(await screen.findByText("US Dollar")).toBeInTheDocument(); // the list has loaded
    expect(await screen.findByText(/Allowed difference:/)).toHaveTextContent("5%");
    expect(screen.queryByRole("button", { name: /Add currency/ })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    // the Use column is plain words, not a switch: USD is on, GBP is off (its status pill says Off too)
    expect(within(row(/US Dollar/)).getByText("On")).toBeInTheDocument();
    expect(within(row(/Pound Sterling/)).getAllByText("Off")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Add rate for/ })).toBeNull();
    expect(screen.queryByLabelText("Allowed difference (%)")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("lets a reader open the rate history, without the form to add a rate", async () => {
    status = statusFor("accounts.view");
    await show();
    await screen.findByText("US Dollar");
    fireEvent.click(screen.getByRole("button", { name: "Rate history for USD" }));
    const dialog = await screen.findByRole("dialog", { name: "Exchange rates: USD" });
    expect(await within(dialog).findByText("3.6725")).toBeInTheDocument(); // the history has loaded
    expect(within(dialog).queryByRole("form", { name: "New USD rate" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Save rate" })).toBeNull();
    expect(within(dialog).queryByLabelText(/Applies from/)).toBeNull();
  });

  it("offers every control to someone who holds accounts.manage", async () => {
    status = statusFor("accounts.view", "accounts.manage");
    await show();
    expect(await screen.findByText("US Dollar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add currency/ })).toBeInTheDocument();
    expect(within(row(/US Dollar/)).getByRole("switch", { name: "Use USD" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Add rate for USD" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Allowed difference (%)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("shows the form to add a rate, with the history, to someone who holds accounts.manage", async () => {
    status = statusFor("accounts.view", "accounts.manage");
    await show();
    await screen.findByText("US Dollar");
    fireEvent.click(screen.getByRole("button", { name: "Add rate for USD" }));
    const dialog = await screen.findByRole("dialog", { name: "Exchange rates: USD" });
    expect(await within(dialog).findByText("3.6725")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save rate" })).toBeInTheDocument();
  });

  it("explains an empty list instead of prompting a reader to add a currency", async () => {
    m.list.mockResolvedValue([]);
    status = statusFor("accounts.view");
    await show();
    expect(await screen.findByText("No currencies yet")).toBeInTheDocument();
    expect(screen.getByText("No currency has been set up yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Add one with Add currency/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Add currency/ })).toBeNull();
  });
});
