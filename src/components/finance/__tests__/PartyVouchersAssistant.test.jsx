import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), options: vi.fn(), cheques: vi.fn(), axiosGet: vi.fn(), curList: vi.fn(), curRate: vi.fn() }));
vi.mock("../../../lib/bankingApi", () => ({
  vouchers: { create: m.create, list: m.list, get: vi.fn(), update: vi.fn(), remove: vi.fn() },
  banking: { options: m.options, cheques: m.cheques },
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: {}, ApiError: class extends Error {} }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.axiosGet } }));
vi.mock("../../../lib/currencyApi", () => ({ currencies: { list: m.curList, rate: m.curRate } }));
vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: () => ({ companyName: "Harbour Trading" }) }));

import { PaymentVouchers, ReceiptVouchers } from "../PartyVouchers";
import { clearPageSessions } from "../../../lib/pageSession";

const OPTIONS = {
  modes: ["cash", "bank", "transfer"],
  cashAccounts: [{ _id: "cash", accountName: "Cash in Hand", accountCode: "CASH0001", balance: 500 }],
  bankAccounts: [{ _id: "bank1", accountName: "ENBD Current", accountCode: "BANK0001", balance: 1000 }],
  banks: [], cards: [],
};
const BILLS = [
  { _id: "i2", transactionNo: "PO-2026-0002", date: "2026-09-10", totalAmount: 3000, outstandingAmount: 3000 },
  { _id: "i1", transactionNo: "PO-2026-0001", date: "2026-09-01", totalAmount: 2000, outstandingAmount: 2000 },
];

// What the assistant's "Change details" button hands over, in the router state.
const prefill = (extra = {}) => ({
  assistantPrefill: { kind: "payment", partyId: "v1", amount: 2500, date: "2026-09-12", mode: "transfer", accountId: "bank1", reference: "TT-7781", narration: "Payment to Gulf Packaging", ...extra },
});
const page = (Screen, state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/payment-voucher", state }]}>
      <Screen />
    </MemoryRouter>
  );

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.options.mockResolvedValue(OPTIONS);
  m.list.mockResolvedValue({ rows: [], pagination: { current: 1, pages: 1, total: 0 } });
  m.curList.mockResolvedValue([{ code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2, isBase: true, isActive: true, latestRate: 1 }]);
  m.axiosGet.mockImplementation((url) =>
    Promise.resolve({ data: { data: url === "/vendors/vendors" ? [{ _id: "v1", vendorName: "Gulf Packaging", vendorId: "VEND001" }] : BILLS } })
  );
  clearPageSessions();
});

describe("the payment screen opened from a card Zarvia AI prepared", () => {
  it("opens the new payment already filled in: vendor, amount, day, how it was paid, and the reference", async () => {
    page(PaymentVouchers, prefill());
    expect(await screen.findByRole("button", { name: "Post payment" })).toBeInTheDocument();
    expect(await screen.findByLabelText(/^Amount paid/)).toHaveValue("2500");
    expect(screen.getByRole("radio", { name: "Transfer" })).toBeChecked();
    expect(await screen.findByText("Gulf Packaging")).toBeInTheDocument();
    expect(await screen.findByText("ENBD Current")).toBeInTheDocument();
    expect(screen.getByDisplayValue("TT-7781")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("12/09/2026").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Payment to Gulf Packaging")).toBeInTheDocument();
  });

  it("settles the oldest bill first, as the card said: 2,000 on the older bill, 500 on the newer", async () => {
    page(PaymentVouchers, prefill());
    const older = await screen.findByLabelText("Amount against PO-2026-0001");
    await waitFor(() => expect(older).toHaveValue("2000"));
    expect(screen.getByLabelText("Amount against PO-2026-0002")).toHaveValue("500");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("a card for another kind does not open this screen's form", async () => {
    page(ReceiptVouchers, prefill({ kind: "payment" }));
    expect(await screen.findByText("Receipt vouchers")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post receipt" })).toBeNull();
  });

  it("with no state, the screen is as it always was: the list, and no form", async () => {
    page(PaymentVouchers, undefined);
    expect(await screen.findByText("Payment vouchers")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post payment" })).toBeNull();
  });
});
