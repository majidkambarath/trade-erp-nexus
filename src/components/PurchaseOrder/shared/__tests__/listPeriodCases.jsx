import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { AsRole, roleLoaded, statusFor } from "../../../shell/__tests__/asRole";
import { todayInput, formatDate } from "../../../../utils/format";
import { addMonths, lastDayOf } from "../../../../lib/calendarDays";

// Test support (not a test): what an order module's list page does about its PERIOD and its PAGES, shared by the four modules.
//
//   - it opens on this calendar month, says so in words, and shows only that month's documents
//   - a document of another month is one tap away ("Widen to ... all time") and an empty month says why, not "none yet"
//   - the server pages at 200: every page is read (the screens used to hold only the newest twenty)
//   - returns are read without the server's date filter (it filters on a date nothing writes) and cut to the period here
//   - search finds a document by its party's name, which the server's own search never did
//   - the pager says which rows are shown out of how many, takes a page size, and never leaves a person on an empty page
//
// Dates are built from today's date, so none of it depends on when the suite runs.
//
// @param module       "sales" | "purchase"
// @param type         the transaction type the page reads
// @param Page         the module's list page
// @param api          the mocked axios instance
// @param setStatus    points the file's mocked organisation status at this person

export function listPeriodCases(config) {
  const { module, type, api, setStatus } = config;
  const Page = config.Page; // a capitalised local, so the linter sees it used in the JSX below
  const month = todayInput().slice(0, 7);
  const inMonth = `${month}-01`;
  const lastMonthDay = `${addMonths(month, -1)}-15`;

  const raw = (id, date, over = {}) => ({
    _id: String(id), transactionNo: `DOC-${id}`, status: "DRAFT", partyId: "p1", partyName: "Acme Corp", party: { customerName: "Acme Corp", vendorName: "Acme Corp" },
    date: `${date}T00:00:00.000Z`, totalAmount: 100, createdBy: "u2", priority: "Medium", approvals: [],
    items: [{ itemId: "i1", itemCode: "ITM1", description: "Item One", qty: 2, rate: 200, vatAmount: 10, vatPercent: 5 }],
    ...over,
  });

  let calls = [];
  let summaryCalls = [];
  const inPeriodRows = (all, p) => (p.dateFilter === "CUSTOM" ? all.filter((r) => r.date >= new Date(p.startDate).toISOString() && r.date <= new Date(p.endDate).toISOString()) : all);
  // a server over `all`, as the real route behaves: the period, the search (number or the party's name), the page and its size,
  // and a summary route that counts the whole period
  const serve = (all) => {
    calls = [];
    summaryCalls = [];
    api.get.mockImplementation(async (url, cfg) => {
      const u = String(url);
      if (!u.includes("/transactions/transactions")) return { data: { data: [] } };
      const p = cfg?.params || {};
      let rows = inPeriodRows(all, p);
      if (u.endsWith("/summary")) {
        summaryCalls.push(p);
        const byStatus = {};
        rows.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
        return { data: { data: { count: rows.length, draft: byStatus.DRAFT || 0, byStatus, valueByStatus: {}, totalValue: rows.length * 100 } } };
      }
      calls.push(p);
      if (p.search) {
        const needle = String(p.search).toLowerCase();
        rows = rows.filter((r) => r.transactionNo.toLowerCase().includes(needle) || String(r.partyName).toLowerCase().includes(needle));
      }
      const limit = p.limit || 20;
      const page = p.page || 1;
      return { data: { data: rows.slice((page - 1) * limit, page * limit), pagination: { current: page, pages: Math.max(1, Math.ceil(rows.length / limit)), total: rows.length, limit } } };
    });
  };
  const pageCalls = () => calls.filter((p) => p.limit !== 1);

  const show = async (all, { grants = [`${module}.view`, `${module}.approve`], card = false } = {}) => {
    setStatus(statusFor(grants));
    serve(all);
    render(<MemoryRouter><AsRole><Page /></AsRole></MemoryRouter>);
    await roleLoaded();
    fireEvent.click(await screen.findByRole("button", { name: card ? "Card view" : "Table view" }));
  };
  const rowNumbers = () => screen.queryAllByText(/^DOC-\d+$/).map((e) => e.textContent);
  const pager = () => screen.getByRole("navigation", { name: "Pages" });
  const pick = (value) => fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value } });

  describe(`the ${module} list's period and pages (${type})`, () => {
    beforeEach(() => {
      api.get.mockReset();
    });

    it("opens on this calendar month and says so, with the days it covers", async () => {
      await show([raw(1, inMonth)]);
      expect(await screen.findByText("DOC-1")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Period" })).toHaveValue("month");
      expect(document.body).toHaveTextContent(`This month · ${formatDate(`${month}-01`)} – ${formatDate(lastDayOf(month))}`);
    });

    it("lists only that month's documents, and 'All time' brings the others back", async () => {
      await show([raw(1, inMonth), raw(2, lastMonthDay)]);
      await screen.findByText("DOC-1");
      expect(rowNumbers()).toEqual(["DOC-1"]);
      pick("all");
      expect(await screen.findByText("DOC-2")).toBeInTheDocument();
      expect(rowNumbers().sort()).toEqual(["DOC-1", "DOC-2"]);
      expect(document.body).toHaveTextContent("All time · all dates");
    });

    it("asks the server for exactly the month, one page of 25, newest first, and the cards of the month from the summary route", async () => {
      await show([raw(1, inMonth)]);
      await screen.findByText("DOC-1");
      const first = pageCalls()[0];
      expect(first).toMatchObject({ type, page: 1, limit: 25, dateFilter: "CUSTOM", sort: "date", order: "desc" });
      expect(first.startDate).toBe(`${month}-01T00:00:00.000Z`);
      expect(first.endDate).toBe(`${lastDayOf(month)}T23:59:59.999Z`);
      expect(first).not.toHaveProperty("search");
      expect(first).not.toHaveProperty("status");
      await waitFor(() => expect(summaryCalls.length).toBeGreaterThan(0));
      expect(summaryCalls[0]).toMatchObject({ type, dateFilter: "CUSTOM" });
    });

    it("reads one page at a time however many documents there are, never the whole period", async () => {
      const many = Array.from({ length: 230 }, (_, i) => raw(i + 1, inMonth));
      await show(many);
      await screen.findByText(/Showing 1 to 25 of 230/);
      expect(pageCalls().every((p) => p.limit === 25)).toBe(true);
      expect(pageCalls().map((p) => p.page)).toEqual([1]);
      fireEvent.click(within(pager()).getByRole("button", { name: "Next" }));
      await screen.findByText(/Showing 26 to 50 of 230/);
      expect(pageCalls().map((p) => p.page)).toEqual([1, 2]);
    });

    it("pages in the browser: which rows are shown out of how many, next, and a page size", async () => {
      const many = Array.from({ length: 60 }, (_, i) => raw(i + 1, inMonth));
      await show(many);
      await screen.findByText(/Showing 1 to 25 of 60/);
      fireEvent.click(within(pager()).getByRole("button", { name: "Next" }));
      expect(await screen.findByText(/Showing 26 to 50 of 60/)).toBeInTheDocument();
      fireEvent.click(within(pager()).getByRole("button", { name: "Page 3" }));
      expect(await screen.findByText(/Showing 51 to 60 of 60/)).toBeInTheDocument();
      expect(within(pager()).getByRole("button", { name: "Next" })).toBeDisabled();
      // a bigger page goes back to the first page, whole
      fireEvent.change(within(pager()).getByRole("combobox", { name: "Rows per page" }), { target: { value: "50" } });
      expect(await screen.findByText(/Showing 1 to 50 of 60/)).toBeInTheDocument();
    });

    it("a search goes back to the first page and cannot leave a person on a page that no longer exists", async () => {
      const many = Array.from({ length: 60 }, (_, i) => raw(i + 1, inMonth, i < 3 ? { partyName: "Zed Traders", party: { customerName: "Zed Traders", vendorName: "Zed Traders" } } : {}));
      await show(many);
      await screen.findByText(/Showing 1 to 25 of 60/);
      fireEvent.click(within(pager()).getByRole("button", { name: "Page 3" }));
      await screen.findByText(/Showing 51 to 60 of 60/);
      // by the PARTY'S NAME (the server looks the party up)
      fireEvent.change(screen.getByPlaceholderText(/^Search by/), { target: { value: "zed" } });
      expect(await screen.findByText(/Showing 1 to 3 of 3/)).toBeInTheDocument();
      expect(pageCalls().at(-1)).toMatchObject({ search: "zed", page: 1 });
      await waitFor(() => expect(rowNumbers().sort()).toEqual(["DOC-1", "DOC-2", "DOC-3"]));
      expect(within(pager()).queryByRole("button", { name: "Next" })).toBeNull(); // one page: no page buttons
    });

    it("an empty month says it is the month that is empty, and offers the way out", async () => {
      await show([raw(1, lastMonthDay)]);
      expect(await screen.findByText(/^No .* in this month$/)).toBeInTheDocument();
      expect(screen.queryByText(/yet$/)).toBeNull();
      expect(rowNumbers()).toEqual([]);
      fireEvent.click(screen.getByRole("button", { name: "All time" }));
      expect(await screen.findByText("DOC-1")).toBeInTheDocument();
    });

    it("a search that matches nothing says so and clears with one tap, without touching the period", async () => {
      await show([raw(1, inMonth), raw(2, inMonth)]);
      await screen.findByText("DOC-1");
      fireEvent.change(screen.getByPlaceholderText(/^Search by/), { target: { value: "no such thing" } });
      expect(await screen.findByText(/^No .* match$/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Clear the search and filters" }));
      await waitFor(() => expect(rowNumbers().sort()).toEqual(["DOC-1", "DOC-2"]));
      expect(screen.getByRole("combobox", { name: "Period" })).toHaveValue("month");
    });

    it("a custom range with the end before the start is explained and the list keeps the last period", async () => {
      await show([raw(1, inMonth)]);
      await screen.findByText("DOC-1");
      pick("custom");
      // an end date alone is "up to": the 1st is inside it
      fireEvent.change(screen.getByLabelText("To"), { target: { value: `${month}-15` } });
      await waitFor(() => expect(document.body).toHaveTextContent(`up to ${formatDate(`${month}-15`)}`));
      // a start after that end cannot be asked for: it is explained and the list keeps the range it had
      fireEvent.change(screen.getByLabelText("From"), { target: { value: `${month}-20` } });
      expect(await screen.findByRole("alert")).toHaveTextContent("The end date is before the start date.");
      expect(rowNumbers()).toEqual(["DOC-1"]);
    });

    it("a selection is dropped when the period changes, so a bulk action only ever acts on what is on screen", async () => {
      await show([raw(1, inMonth), raw(2, lastMonthDay)], { grants: [`${module}.view`, `${module}.delete`] });
      const row = (await screen.findByText("DOC-1")).closest("tr");
      fireEvent.click(within(row).getByRole("checkbox"));
      expect(await screen.findByRole("button", { name: /^export( selected)?$/i })).toBeInTheDocument();
      pick("all");
      await screen.findByText("DOC-2");
      expect(screen.queryByRole("button", { name: /^export( selected)?$/i })).toBeNull();
    });
  });
}
