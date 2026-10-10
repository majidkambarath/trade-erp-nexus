import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// The cheque register: Pending is a worklist (a cheque post-dated a year ahead is still to be presented), so it is every
// date; the other tabs open on this calendar month, by the date on the cheque, and are paged properly.
const m = vi.hoisted(() => ({ cheques: vi.fn() }));
vi.mock("../../../lib/bankingApi", () => ({ banking: { cheques: m.cheques, clearCheque: vi.fn(), bounceCheque: vi.fn(), cancelCheque: vi.fn() }, vouchers: { get: vi.fn() } }));

import ChequeRegister from "../ChequeRegister";
import { todayInput } from "../../../utils/format";
import { lastDayOf } from "../../../lib/calendarDays";

const month = todayInput().slice(0, 7);
const cheque = (n, status = "cleared") => ({ _id: `c${n}`, chequeNo: `CHQ${n}`, direction: "receipt", voucherNo: `RV-${n}`, partyName: "Al Noor", chequeDate: `${month}-02T00:00:00Z`, amount: 10, status, matured: true });
const summary = { receivable: { amount: 0, count: 0 }, payable: { amount: 0, count: 0 } };
const last = () => m.cheques.mock.calls[m.cheques.mock.calls.length - 1][0];

beforeEach(() => {
  m.cheques.mockReset();
  m.cheques.mockImplementation(async (p) => ({ rows: [cheque(p.page, p.status || "cleared")], total: 60, summary }));
});

describe("the cheque register's period", () => {
  it("Pending is every date: no from or to is sent, and no period control is offered", async () => {
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    expect(m.cheques.mock.calls[0][0]).toMatchObject({ status: "pending", page: 1 });
    expect(m.cheques.mock.calls[0][0].from).toBeUndefined();
    expect(m.cheques.mock.calls[0][0].to).toBeUndefined();
    expect(screen.queryByRole("combobox", { name: "Period" })).toBeNull();
    expect(document.body).toHaveTextContent("every cheque still to be presented or paid, whatever its date");
  });

  it("Cleared opens on this month, to the end of its last day, and 'All time' drops the dates", async () => {
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    fireEvent.click(screen.getByRole("tab", { name: "Cleared" }));
    await waitFor(() => expect(last()).toMatchObject({ status: "cleared", from: `${month}-01`, to: `${lastDayOf(month)}T23:59:59.999Z` }));
    expect(screen.getByRole("combobox", { name: "Period" })).toHaveValue("month");
    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "all" } });
    await waitFor(() => expect(last().from).toBeUndefined());
    expect(last().to).toBeUndefined();
  });

  it("says which cheques are shown out of how many, and reaches the next page", async () => {
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    expect(screen.getByText("Showing 1 to 25 of 60 cheques")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: "Next" }));
    await waitFor(() => expect(last()).toMatchObject({ page: 2, limit: 25 }));
    expect(await screen.findByText("CHQ2")).toBeInTheDocument();
  });
});
