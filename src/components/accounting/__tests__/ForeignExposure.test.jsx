import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const m = vi.hoisted(() => ({ exposure: vi.fn() }));
vi.mock("../../../lib/currencyApi", () => ({ currencies: { exposure: m.exposure } }));

import ForeignExposure from "../ForeignExposure";

const REPORT = {
  asOn: "2026-11-18", baseCurrency: "AED",
  rows: [
    { id: "a", number: "SO-2026-0001", date: "2026-11-01", side: "receivable", party: "Cust", currency: "USD", rateAtInvoice: 3.6725, foreignOpen: 1050, carrying: 3856.13, rateNow: 3.7, valued: 3885, difference: 28.87 },
    { id: "b", number: "PO-2026-0001", date: "2026-11-02", side: "payable", party: "Vend", currency: "USD", rateAtInvoice: 3.6725, foreignOpen: 500, carrying: 1836.25, rateNow: 3.7, valued: 1850, difference: -13.75 },
  ],
  currencies: [{ currency: "USD", rateNow: 3.7, receivable: 1050, payable: 500, net: 550, carrying: 2019.88, valued: 2035, difference: 15.12, unvalued: 0 }],
  totalDifference: 15.12,
};

beforeEach(() => { m.exposure.mockReset(); });

describe("the foreign-currency exposure panel", () => {
  it("shows each currency's net position and the unrealised difference, and each open invoice", async () => {
    m.exposure.mockResolvedValue(REPORT);
    render(<ForeignExposure asOn="" onAsOn={() => {}} />);
    const byCurrency = within(await screen.findByRole("table", { name: "Exposure by currency" }));
    expect(byCurrency.getByText("USD")).toBeInTheDocument();
    expect(byCurrency.getByText("+15.12")).toBeInTheDocument();
    expect(await screen.findByText("SO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("PO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText(/Net unrealised difference: AED \+15\.12/)).toBeInTheDocument();
    expect(m.exposure).toHaveBeenCalledWith({ asOn: undefined });
  });

  it("says so when nothing foreign is open", async () => {
    m.exposure.mockResolvedValue({ ...REPORT, rows: [], currencies: [], totalDifference: 0 });
    render(<ForeignExposure asOn="" onAsOn={() => {}} />);
    expect(await screen.findByText("No open foreign-currency invoices")).toBeInTheDocument();
  });

  it("marks a currency with no rate on the day instead of valuing it", async () => {
    m.exposure.mockResolvedValue({
      ...REPORT,
      rows: [{ ...REPORT.rows[0], rateNow: null, valued: null, difference: null }],
      currencies: [{ currency: "USD", rateNow: null, receivable: 1050, payable: 0, net: 1050, carrying: 0, valued: 0, difference: 0, unvalued: 1 }],
      totalDifference: 0,
    });
    render(<ForeignExposure asOn="2026-01-01" onAsOn={() => {}} />);
    expect(await screen.findByText("no rate")).toBeInTheDocument();
    expect(screen.getByText("1 without a rate")).toBeInTheDocument();
    expect(m.exposure).toHaveBeenCalledWith({ asOn: "2026-01-01" });
  });
});
