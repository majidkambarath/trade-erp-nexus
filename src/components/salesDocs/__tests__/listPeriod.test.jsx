import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import QuotationList from "../QuotationList";
import DeliveryNoteList from "../DeliveryNoteList";
import { quotations, deliveryNotes } from "../../../lib/salesDocumentsApi";
import { todayInput, formatDate } from "../../../utils/format";
import { lastDayOf } from "../../../lib/calendarDays";

// The quotation and delivery note lists: they open on this calendar month like every other list, the server pages them, and the
// "Not invoiced" worklist is never cut by a month. The tiles and the tab counts are the whole book and say so.

vi.mock("../../../lib/salesDocumentsApi", () => ({
  quotations: { list: vi.fn(), summary: vi.fn(), remove: vi.fn() },
  deliveryNotes: { list: vi.fn(), summary: vi.fn(), remove: vi.fn(), invoice: vi.fn() },
}));

const month = todayInput().slice(0, 7);
const page = (rows, { total = rows.length, current = 1, limit = 25 } = {}) => ({ rows, pagination: { current, pages: Math.max(1, Math.ceil(total / limit)), total, limit } });
const quote = (n) => ({ _id: `q${n}`, quotationNo: `QT-${n}`, status: "SENT", displayStatus: "SENT", date: `${month}-01`, validUntil: `${month}-28`, totalAmount: 100, party: { customerName: "Al Noor" }, actions: {} });
const note = (n) => ({ _id: `n${n}`, deliveryNoteNo: `DLN-${n}`, status: "DELIVERED", date: `${month}-01`, totalAmount: 100, party: { customerName: "Al Noor" }, source: {}, actions: {} });
const last = (fn) => fn.mock.calls[fn.mock.calls.length - 1][0];
const show = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const props = { onOpen: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), notify: vi.fn(), reloadKey: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  quotations.summary.mockResolvedValue({ byStatus: { SENT: { count: 7, value: 700 }, ACCEPTED: { count: 2, value: 200 } }, total: 9, winRate: 50, expiringSoon: { count: 0, value: 0 } });
  deliveryNotes.summary.mockResolvedValue({ byStatus: { DELIVERED: 5, DISPATCHED: 2 }, uninvoiced: { count: 4, value: 400 }, clock: { count: 4, pastStandard: 0, overdue: 0, dueSoon: 0 } });
});

describe("the quotation list", () => {
  it("opens on this calendar month and asks the server for exactly its days, 25 to a page", async () => {
    quotations.list.mockResolvedValue(page([quote(1)]));
    show(<QuotationList {...props} />);
    await screen.findByText("QT-1");
    expect(quotations.list.mock.calls[0][0]).toMatchObject({ dateFrom: `${month}-01`, dateTo: lastDayOf(month), page: 1, limit: 25 });
    expect(document.body).toHaveTextContent(`This month · ${formatDate(`${month}-01`)} – ${formatDate(lastDayOf(month))} · 1 quotation`);
  });

  it("says the tiles are the whole book, and shows the tab counts only while the list is all time too", async () => {
    quotations.list.mockResolvedValue(page([quote(1)]));
    show(<QuotationList {...props} />);
    await screen.findByText("QT-1");
    expect(screen.getByText("All quotations, whatever the period below")).toBeInTheDocument();
    const tabs = screen.getByRole("tablist", { name: "Quotation status" });
    expect(tabs).not.toHaveTextContent("9"); // the all-time total would disagree with this month's list
    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "all" } });
    await waitFor(() => expect(tabs).toHaveTextContent("9"));
    expect(last(quotations.list).dateFrom).toBeUndefined();
  });

  it("a tile that narrows to a status widens to all time, so what it counted is what it lists", async () => {
    quotations.list.mockResolvedValue(page([quote(1)]));
    show(<QuotationList {...props} />);
    await screen.findByText("QT-1");
    fireEvent.click(screen.getByRole("button", { name: /Accepted, not ordered/ }));
    await waitFor(() => expect(last(quotations.list)).toMatchObject({ status: "ACCEPTED" }));
    expect(last(quotations.list).dateFrom).toBeUndefined();
    expect(screen.getByRole("combobox", { name: "Period" })).toHaveValue("all");
  });

  it("pages: which rows out of how many, the next page, a page size", async () => {
    quotations.list.mockImplementation(async (p) => page(Array.from({ length: p.limit }, (_, i) => quote((p.page - 1) * p.limit + i + 1)).slice(0, Math.min(p.limit, 60 - (p.page - 1) * p.limit)), { total: 60, current: p.page, limit: p.limit }));
    show(<QuotationList {...props} />);
    await screen.findByText("QT-1");
    expect(screen.getByText("Showing 1 to 25 of 60 quotations")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: "Next" }));
    await screen.findByText("QT-26");
    expect(last(quotations.list)).toMatchObject({ page: 2, limit: 25 });
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), { target: { value: "50" } });
    await waitFor(() => expect(last(quotations.list)).toMatchObject({ page: 1, limit: 50 }));
  });

  it("a page that no longer exists falls back to the last one that does", async () => {
    // three pages of 25; the person is on page 3 when rows are deleted elsewhere, and the server (now 50 rows, two pages)
    // answers page 3 with nothing
    let total = 75;
    quotations.list.mockImplementation(async (p) => {
      const pages = Math.ceil(total / 25);
      return p.page > pages ? page([], { total, current: p.page }) : page([quote(p.page)], { total, current: p.page });
    });
    const view = show(<QuotationList {...props} />);
    await screen.findByText("QT-1");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: "Page 3" }));
    await screen.findByText("QT-3");
    total = 50;
    view.rerender(<MemoryRouter><QuotationList {...props} reloadKey={1} /></MemoryRouter>);
    // it asked for page 3, got nothing, and moved to page 2 by itself: never an empty list with pages behind it
    expect(await screen.findByText("QT-2")).toBeInTheDocument();
    expect(last(quotations.list).page).toBe(2);
    expect(screen.queryByText(/^No quotations/)).toBeNull();
  });
});

describe("the delivery note list", () => {
  it("opens on this calendar month, asks for its days and pages by the server", async () => {
    deliveryNotes.list.mockResolvedValue(page([note(1)]));
    show(<DeliveryNoteList {...props} />);
    await screen.findByText("DLN-1");
    expect(deliveryNotes.list.mock.calls[0][0]).toMatchObject({ dateFrom: `${month}-01`, dateTo: lastDayOf(month), page: 1, limit: 25 });
    expect(screen.getByText("All delivery notes, whatever the period below")).toBeInTheDocument();
  });

  it("the Not invoiced tab ignores the period: a note delivered last month is still waiting for its invoice", async () => {
    deliveryNotes.list.mockResolvedValue(page([note(1)]));
    show(<DeliveryNoteList {...props} initialStatus="UNINVOICED" />);
    await screen.findByText("DLN-1");
    const asked = deliveryNotes.list.mock.calls[0][0];
    expect(asked).toMatchObject({ status: "UNINVOICED" });
    expect(asked.dateFrom).toBeUndefined();
    expect(asked.dateTo).toBeUndefined();
    expect(screen.queryByRole("combobox", { name: "Period" })).toBeNull(); // no control that would do nothing
    expect(document.body).toHaveTextContent("every delivered note still waiting for an invoice, whatever its date");
  });

  it("an empty month names the month, and an empty Not invoiced tab says everything is invoiced", async () => {
    deliveryNotes.list.mockResolvedValue(page([]));
    show(<DeliveryNoteList {...props} />);
    expect(await screen.findByText("No delivery notes in this month")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Not invoiced/ }));
    expect(await screen.findByText("Every delivered note has been invoiced.")).toBeInTheDocument();
  });

  it("the on-the-road tile widens to all time, like the other tiles", async () => {
    deliveryNotes.list.mockResolvedValue(page([note(1)]));
    show(<DeliveryNoteList {...props} />);
    await screen.findByText("DLN-1");
    fireEvent.click(screen.getByRole("button", { name: /On the road/ }));
    await waitFor(() => expect(last(deliveryNotes.list)).toMatchObject({ status: "DISPATCHED" }));
    expect(last(deliveryNotes.list).dateFrom).toBeUndefined();
  });
});
