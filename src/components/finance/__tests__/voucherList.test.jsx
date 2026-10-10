import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// The list every finance voucher screen shares (receipts, payments, journal, contra, expense, notes): it opens on this
// calendar month, says so, is paged by the server, and an empty page is never what the person is left looking at.
const m = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../../../lib/bankingApi", () => ({ vouchers: { list: m.list, get: vi.fn() }, banking: { options: vi.fn() } }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { postableAccounts: vi.fn() }, ApiError: class extends Error {} }));

import { ListBody, ListToolbar, useVoucherList } from "../shared";
import { todayInput, formatDate } from "../../../utils/format";
import { addMonths, lastDayOf } from "../../../lib/calendarDays";

const month = todayInput().slice(0, 7);
const lastMonth = addMonths(month, -1);

function Harness() {
  const list = useVoucherList("receipt");
  return (
    <>
      <ListToolbar filters={list.filters} set={list.set} />
      <button type="button" onClick={list.reload}>Reload</button>
      <ListBody list={list} emptyTitle="No receipt vouchers" emptyText="Record the first one with New receipt.">
        <ul>{list.rows.map((r) => <li key={r._id}>{r.voucherNo}</li>)}</ul>
      </ListBody>
    </>
  );
}

const voucher = (n) => ({ _id: `v${n}`, voucherNo: `RV-${n}`, voucherType: "receipt", status: "approved", date: `${month}-01`, totalAmount: 10 });
// a server over `all`: pages at the request's limit, as the real route does
const serve = (all) =>
  m.list.mockImplementation(async (p) => {
    const limit = p.limit || 20;
    const page = p.page || 1;
    return { rows: all.slice((page - 1) * limit, page * limit), pagination: { current: page, pages: Math.max(1, Math.ceil(all.length / limit)), total: all.length, limit } };
  });
const last = () => m.list.mock.calls[m.list.mock.calls.length - 1][0];
const pick = (value) => fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value } });
const pager = () => screen.getByRole("navigation", { name: "Pages" });

beforeEach(() => {
  m.list.mockReset();
});

describe("the voucher list's period", () => {
  it("opens on this calendar month: the server is asked for its first and last day, and the line says so", async () => {
    serve([voucher(1)]);
    render(<Harness />);
    await screen.findByText("RV-1");
    expect(m.list.mock.calls[0][0]).toMatchObject({ voucherType: "receipt", dateFrom: `${month}-01`, dateTo: lastDayOf(month), page: 1, limit: 25 });
    expect(screen.getByRole("combobox", { name: "Period" })).toHaveValue("month");
    expect(document.body).toHaveTextContent(`This month · ${formatDate(`${month}-01`)} – ${formatDate(lastDayOf(month))} · 1 voucher`);
  });

  it("last month, a custom range and all time each ask for exactly their days", async () => {
    serve([voucher(1)]);
    render(<Harness />);
    await screen.findByText("RV-1");
    pick("lastMonth");
    await waitFor(() => expect(last()).toMatchObject({ dateFrom: `${lastMonth}-01`, dateTo: lastDayOf(lastMonth) }));
    pick("custom");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: `${lastMonth}-05` } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: `${lastMonth}-09` } });
    await waitFor(() => expect(last()).toMatchObject({ dateFrom: `${lastMonth}-05`, dateTo: `${lastMonth}-09` }));
    pick("all");
    await waitFor(() => expect(last().dateFrom).toBeUndefined());
    expect(last().dateTo).toBeUndefined();
    expect(document.body).toHaveTextContent("All time · all dates");
  });

  it("an empty month says it is the month, not that there are none, and 'All time' is one tap away", async () => {
    m.list.mockImplementation(async (p) => ({ rows: p.dateFrom ? [] : [voucher(9)], pagination: { current: 1, pages: 1, total: p.dateFrom ? 0 : 1, limit: 25 } }));
    render(<Harness />);
    expect(await screen.findByText("No receipt vouchers in this month")).toBeInTheDocument();
    expect(screen.queryByText("Record the first one with New receipt.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All time" }));
    expect(await screen.findByText("RV-9")).toBeInTheDocument();
  });

  it("with nothing in all time it is the first-one message", async () => {
    serve([]);
    render(<Harness />);
    await screen.findByText("No receipt vouchers in this month");
    pick("all");
    expect(await screen.findByText("No receipt vouchers")).toBeInTheDocument();
    expect(screen.getByText("Record the first one with New receipt.")).toBeInTheDocument();
  });

  it("a search that finds nothing says so and clears with one tap", async () => {
    m.list.mockImplementation(async (p) => ({ rows: p.search ? [] : [voucher(1)], pagination: { current: 1, pages: 1, total: p.search ? 0 : 1, limit: 25 } }));
    render(<Harness />);
    await screen.findByText("RV-1");
    fireEvent.change(screen.getByLabelText("Search vouchers"), { target: { value: "zzz" } });
    expect(await screen.findByText("No receipt vouchers match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear the search and filters" }));
    expect(await screen.findByText("RV-1")).toBeInTheDocument();
  });
});

describe("the voucher list's pages", () => {
  const sixty = Array.from({ length: 60 }, (_, i) => voucher(i + 1));

  it("says which rows are shown out of how many, and goes to the next page the server pages", async () => {
    serve(sixty);
    render(<Harness />);
    await screen.findByText("RV-1");
    expect(screen.getByText("Showing 1 to 25 of 60 vouchers")).toBeInTheDocument();
    fireEvent.click(within(pager()).getByRole("button", { name: "Next" }));
    await screen.findByText("RV-26");
    expect(last()).toMatchObject({ page: 2, limit: 25 });
    expect(screen.getByText("Showing 26 to 50 of 60 vouchers")).toBeInTheDocument();
  });

  it("a page size goes back to the first page; a new period does too, with ONE request, not two", async () => {
    serve(sixty);
    render(<Harness />);
    await screen.findByText("RV-1");
    fireEvent.click(within(pager()).getByRole("button", { name: "Page 3" }));
    await screen.findByText("RV-51");
    fireEvent.change(within(pager()).getByRole("combobox", { name: "Rows per page" }), { target: { value: "50" } });
    await waitFor(() => expect(last()).toMatchObject({ page: 1, limit: 50 }));
    fireEvent.click(within(pager()).getByRole("button", { name: "Next" }));
    await screen.findByText("RV-51");
    const before = m.list.mock.calls.length;
    pick("year");
    await waitFor(() => expect(last()).toMatchObject({ page: 1, dateFrom: `${month.slice(0, 4)}-01-01` }));
    expect(m.list.mock.calls.length - before).toBe(1);
  });

  it("when the last row of the last page is deleted the list lands on the last page there is, not on an empty one", async () => {
    // 26 rows at 25 a page: page 2 holds one. It is deleted, so the server has 25 and answers page 2 with nothing.
    serve(Array.from({ length: 26 }, (_, i) => voucher(i + 1)));
    render(<Harness />);
    await screen.findByText("RV-1");
    fireEvent.click(within(pager()).getByRole("button", { name: "Next" }));
    await screen.findByText("RV-26");
    serve(Array.from({ length: 25 }, (_, i) => voucher(i + 1)));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    // it asked for page 2, got nothing back, and went to page 1 by itself
    expect(await screen.findByText("RV-1")).toBeInTheDocument();
    expect(last()).toMatchObject({ page: 1 });
    expect(screen.getByText("Showing 1 to 25 of 25 vouchers")).toBeInTheDocument();
    expect(screen.queryByText("No receipt vouchers in this month")).toBeNull();
    expect(within(pager()).queryByRole("button", { name: "Next" })).toBeNull();
  });
});
