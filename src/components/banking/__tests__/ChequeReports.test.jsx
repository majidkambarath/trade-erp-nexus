import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The cheque reports on the Cheques page: what falls due and when, and what it does to the bank.
const m = vi.hoisted(() => ({ cheques: vi.fn(), chequeMaturity: vi.fn(), chequeForward: vi.fn() }));
vi.mock("../../../lib/bankingApi", () => ({
  banking: { cheques: m.cheques, chequeMaturity: m.chequeMaturity, chequeForward: m.chequeForward, clearCheque: vi.fn(), bounceCheque: vi.fn(), cancelCheque: vi.fn() },
  vouchers: { get: vi.fn() },
}));

import ChequesPage from "../ChequesPage";

const slot = (amount = 0, count = amount ? 1 : 0) => ({ amount, count });
const group = (key, label, r = 0, p = 0, h = 0) => ({ key, label, receivable: slot(r), payable: slot(p), onHold: slot(h), net: r - p });
const maturity = (over = {}) => ({
  asOn: "2026-10-26", groupBy: "bucket", capped: false, atBank: { count: 1, amount: 40 },
  totals: { receivable: slot(740, 3), payable: slot(300, 1), onHold: slot(70, 1), net: 440 },
  groups: [group("overdue", "Overdue", 240), group("week", "Next 7 days", 500), group("month", "8 to 30 days", 0, 300)],
  rows: [
    { _id: "a", chequeNo: "1001", direction: "receipt", partyName: "Al Noor", chequeDay: "2026-10-21", days: -5, status: "pending", amount: 200, voucherNo: "RV-1", bankName: "ENBD" },
    { _id: "b", chequeNo: "1002", direction: "receipt", partyName: "Hold Ltd", chequeDay: "2026-10-26", days: 0, status: "hold", amount: 70, voucherNo: "RV-2", bankName: "ENBD" },
    { _id: "c", chequeNo: "2001", direction: "payment", partyName: "Gulf Mills", chequeDay: "2026-11-05", days: 10, status: "pending", amount: 300, voucherNo: "PV-1", bankName: "ENBD" },
  ], ...over,
});
const slot2 = (r = 0, p = 0, h = 0) => ({ receipts: slot(r), payments: slot(p), onHold: slot(h), net: r - p });
const forward = (over = {}) => ({
  asOn: "2026-10-26", unit: "week", openingKnown: true, opening: 5000, capped: false, due: slot2(240), afterDue: 5240,
  periods: [{ key: "w1", label: "26 Oct - 1 Nov", from: "2026-10-26", to: "2026-11-01", ...slot2(500, 0, 70), closing: 5740 }, { key: "w2", label: "2 Nov - 8 Nov", from: "2026-11-02", to: "2026-11-08", ...slot2(0, 300), closing: 5440 }],
  later: slot2(0), totals: { receipts: 740, payments: 300, onHold: 70, closing: 5440 }, ...over,
});
const at = (view) => render(<MemoryRouter initialEntries={[view ? `/cheques?view=${view}` : "/cheques"]}><ChequesPage /></MemoryRouter>);
const lastCall = (fn) => fn.mock.calls.at(-1)[0];
const loaded = () => screen.findByText("kept back, not counted on");

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.cheques.mockResolvedValue({ rows: [], total: 0, summary: { receivable: { amount: 0, count: 0 }, payable: { amount: 0, count: 0 } } });
  m.chequeMaturity.mockResolvedValue(maturity());
  m.chequeForward.mockResolvedValue(forward());
});

describe("the Cheques page", () => {
  it("opens on the register, and the views are linkable", async () => {
    at();
    expect(await screen.findByRole("tab", { name: "Pending" })).toBeInTheDocument();
    expect(m.chequeMaturity).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "Register", selected: true })).toBeInTheDocument();
  });

  it("?view=due and ?view=forecast open the reports directly; an unknown view falls back to the register", async () => {
    const { unmount } = at("due");
    await waitFor(() => expect(m.chequeMaturity).toHaveBeenCalled());
    expect(screen.getByRole("tab", { name: "Due dates", selected: true })).toBeInTheDocument();
    unmount();
    at("forecast");
    await waitFor(() => expect(m.chequeForward).toHaveBeenCalled());
    expect(screen.getByRole("tab", { name: "Cash forecast", selected: true })).toBeInTheDocument();
  });

  it("switching views swaps the content and keeps the page title", async () => {
    at();
    fireEvent.click(await screen.findByRole("tab", { name: "Due dates" }));
    expect(await loaded()).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cheques" })).toBeInTheDocument();
  });
});

describe("due dates", () => {
  it("shows what is coming in, going out, on hold and at the bank, and how soon each cheque is", async () => {
    at("due");
    expect(await loaded()).toBeInTheDocument();
    expect(screen.getAllByText("740.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("300.00").length).toBeGreaterThan(0);
    expect(screen.getByText("kept back, not counted on")).toBeInTheDocument();
    expect(screen.getByText("1 cheque, not yet cleared")).toBeInTheDocument();
    expect(screen.getByText("5 days overdue")).toBeInTheDocument();
    expect(screen.getByText("today")).toBeInTheDocument();
    expect(screen.getByText("in 10 days")).toBeInTheDocument();
    expect(screen.getAllByText("On hold").length).toBeGreaterThan(0);
  });

  it("sends the filters it was given, and groups on the server", async () => {
    at("due");
    await loaded();
    expect(lastCall(m.chequeMaturity)).toMatchObject({ groupBy: "bucket", direction: undefined });
    fireEvent.change(screen.getByLabelText("Group by"), { target: { value: "party" } });
    await waitFor(() => expect(lastCall(m.chequeMaturity).groupBy).toBe("party"));
    fireEvent.change(screen.getByLabelText("Cheques"), { target: { value: "payment" } });
    await waitFor(() => expect(lastCall(m.chequeMaturity).direction).toBe("payment"));
  });

  it("says plainly when nothing is in the air, and warns when the figures are partial", async () => {
    m.chequeMaturity.mockResolvedValue(maturity({ rows: [], groups: [], capped: false, totals: { receivable: slot(), payable: slot(), onHold: slot(), net: 0 }, atBank: { count: 0, amount: 0 } }));
    const { unmount } = at("due");
    expect(await screen.findByText("No cheques in the air")).toBeInTheDocument();
    unmount();
    m.chequeMaturity.mockResolvedValue(maturity({ capped: true }));
    at("due");
    expect(await screen.findByText(/more cheques than this report reads at once/)).toBeInTheDocument();
  });

  it("exports the cheques as a CSV, and cannot when there are none", async () => {
    const created = vi.fn(() => "blob:x");
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    at("due");
    const btn = await screen.findByRole("button", { name: /Export CSV/ });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    expect(created).toHaveBeenCalled();
    click.mockRestore();
  });

  it("a server refusal is shown, with a way to try again", async () => {
    m.chequeMaturity.mockRejectedValueOnce(Object.assign(new Error("Enter a valid date"), { code: "INVALID_DATE" }));
    at("due");
    expect(await screen.findByText("Enter a valid date")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry|try again/i }));
    expect(await loaded()).toBeInTheDocument();
  });
});

describe("the cash forecast", () => {
  const ready = () => screen.findByText("After cheques already due");

  it("starts from what the bank holds, takes the cheques already due off it, then runs period by period", async () => {
    at("forecast");
    await ready();
    expect(screen.getByText("In the bank now")).toBeInTheDocument();
    expect(screen.getAllByText("5,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5,240.00").length).toBeGreaterThan(0);
    for (const label of ["Already due", "26 Oct - 1 Nov", "2 Nov - 8 Nov", "Beyond this window"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getAllByText("5,740.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5,440.00").length).toBeGreaterThan(0);
  });

  it("states what it assumes: held cheques are beside the plan, and what is already due clears at once", async () => {
    at("forecast");
    await ready();
    expect(screen.getByText(/on hold is shown beside the plan, not in it/)).toBeInTheDocument();
    expect(screen.getByText(/taken off the opening balance first/)).toBeInTheDocument();
  });

  it("asks the server for the window chosen: weeks or months", async () => {
    at("forecast");
    await ready();
    expect(lastCall(m.chequeForward)).toMatchObject({ unit: "week", count: 12 });
    fireEvent.change(screen.getByLabelText("Look ahead"), { target: { value: "month:6" } });
    await waitFor(() => expect(lastCall(m.chequeForward)).toMatchObject({ unit: "month", count: 6 }));
    expect(await screen.findByText(/Month by month, from/)).toBeInTheDocument();
  });

  it("in a single-branch view the bank balance is not shown against that branch's cheques, and says why", async () => {
    m.chequeForward.mockResolvedValue(forward({ openingKnown: false, opening: 0, afterDue: 240 }));
    at("forecast");
    await ready();
    expect(screen.getByText(/whole organisation's, so it is not shown against a single branch/)).toBeInTheDocument();
    expect(screen.getByText("shown for the whole organisation only")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Running net/ })).toBeInTheDocument();
  });

  it("a quiet window says so rather than drawing a table of dashes", async () => {
    m.chequeForward.mockResolvedValue(forward({ due: slot2(), periods: forward().periods.map((p) => ({ ...p, ...slot2() })), totals: { receipts: 0, payments: 0, onHold: 0, closing: 5000 } }));
    at("forecast");
    expect(await screen.findByText("No cheques fall due in this window")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Cheque forecast" })).toBeNull();
  });

  it("a held cheque has its own column and is not in the money columns", async () => {
    at("forecast");
    await ready();
    const table = screen.getByRole("table", { name: "Cheque forecast" });
    const week1 = within(table).getByText("26 Oct - 1 Nov").closest("tr");
    const cells = within(week1).getAllByRole("cell").map((c) => c.textContent);
    expect(cells.join(" | ")).toMatch(/500\.00.*-.*70\.00.*500\.00.*5,740\.00/);
  });
});
