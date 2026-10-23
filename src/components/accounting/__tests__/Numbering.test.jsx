import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  voucherTypes: vi.fn(), createVoucherType: vi.fn(), updateVoucherType: vi.fn(),
  numberSeries: vi.fn(), numberRegister: vi.fn(), numberGaps: vi.fn(),
  configuration: vi.fn(), chart: vi.fn(), fiscalYears: vi.fn(), taxCodes: vi.fn(), auditLog: vi.fn(), settings: vi.fn(),
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));

import AccountingSetup from "../AccountingSetup";

const at = (url = "/accounting-setup?tab=numbering") => render(<MemoryRouter initialEntries={[url]}><AccountingSetup /></MemoryRouter>);

const TYPE = (over) => ({
  key: "SO", name: "Sales invoice", kind: "trade", postsAs: "sales_order", parentKey: null, statutory: true,
  prefix: "SO", suffix: "", separator: "-", includeYear: true, numberLength: 4,
  resetPolicy: "yearly", branchPrefix: "auto", branchPrefixes: [], method: "auto", allowReuse: false,
  isSystem: true, isActive: true, ...over,
});
const TYPES = {
  types: [
    TYPE(),
    TYPE({ key: "JV", name: "Journal", kind: "voucher", postsAs: "journal", prefix: "JV", statutory: false }),
    TYPE({ key: "YEC", name: "Year-end closing", kind: "system", postsAs: null, prefix: "YEC", statutory: false }),
  ],
  branches: [{ code: "main", name: "Head office", isHeadOffice: true }, { code: "shj", name: "Sharjah" }],
};

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.voucherTypes.mockResolvedValue(TYPES);
  m.numberSeries.mockResolvedValue([]);
  m.numberRegister.mockResolvedValue({ rows: [], total: 0, page: 1, pages: 1, summary: { issued: 0, released: 0, cancelled: 0 } });
  m.numberGaps.mockResolvedValue(null);
});

describe("voucher types", () => {
  it("lists every document type grouped, with the number it will produce", async () => {
    at();
    expect(await screen.findByText("Sales invoice")).toBeInTheDocument();
    expect(screen.getByText("SO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("JV-2026-0001")).toBeInTheDocument();
    // Grouped the way a person thinks about them. Each group's table is named for screen readers
    // ("Finance vouchers numbering"), so the heading is what a test looks the group up by.
    expect(screen.getByRole("heading", { name: "Finance vouchers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sales and purchase" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Written by the system" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Finance vouchers numbering" })).toBeInTheDocument();
    // A document that carries tax is marked, because that is what forbids re-using its number.
    expect(screen.getAllByText("Tax document").length).toBe(1);
  });

  it("draws the number as the format is changed, before anything is saved", async () => {
    at();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Sales invoice/ }));
    expect(await screen.findByTestId("number-preview")).toHaveTextContent("SO-2026-0001");

    fireEvent.change(screen.getByLabelText(/^Prefix/), { target: { value: "INV" } });
    expect(screen.getByTestId("number-preview")).toHaveTextContent("INV-2026-0001");
    fireEvent.change(screen.getByLabelText(/Counter digits/), { target: { value: "6" } });
    expect(screen.getByTestId("number-preview")).toHaveTextContent("INV-2026-000001");
    // and it says what a branch's number will look like, which is where a length limit bites
    expect(screen.getByText("SHJ-INV-2026-000001 in Sharjah")).toBeInTheDocument();
  });

  it("refuses a tax document's number that would run past sixteen characters", async () => {
    at();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Sales invoice/ }));
    fireEvent.change(await screen.findByLabelText(/Counter digits/), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/16 at most/)).toBeInTheDocument();
    expect(m.updateVoucherType).not.toHaveBeenCalled();
  });

  it("will not let a tax document re-use a deleted number, and says why", async () => {
    at();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Sales invoice/ }));
    const reuse = await screen.findByLabelText(/Give a deleted number to the next document/);
    expect(reuse).toBeDisabled();
    expect(screen.getByText(/kept for good once used/)).toBeInTheDocument();
  });
});

describe("the counter's own rules", () => {
  it("takes the year out of the number the moment the counter is set never to restart", async () => {
    at();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Journal/ }));
    expect(await screen.findByTestId("number-preview")).toHaveTextContent("JV-2026-0001");
    fireEvent.change(screen.getByLabelText(/Starts again/), { target: { value: "never" } });
    // Choosing "never" and keeping the year is refused by the server, so the form does not let a person
    // walk into it: the year comes out and the box is locked.
    expect(screen.getByTestId("number-preview")).toHaveTextContent("JV-0001");
    expect(screen.getByLabelText(/Show the year in the number/)).toBeDisabled();
    expect(screen.getByText(/not say which year/)).toBeInTheDocument();
  });

  it("saves a changed format, and puts the server's refusal on the field it belongs to", async () => {
    m.updateVoucherType.mockResolvedValue({});
    at();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Journal/ }));
    fireEvent.change(await screen.findByLabelText(/^Prefix/), { target: { value: "JNL" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(m.updateVoucherType).toHaveBeenCalledWith("JV", expect.objectContaining({ prefix: "JNL" })));

    m.updateVoucherType.mockRejectedValue(Object.assign(new Error("That prefix is already in use."), { details: { field: "prefix" } }));
    fireEvent.click(await screen.findByRole("button", { name: /Edit Journal/ }));
    fireEvent.change(await screen.findByLabelText(/^Prefix/), { target: { value: "XX" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("That prefix is already in use.")).toBeInTheDocument();
  });

  it("adds a variant of an existing type, and offers no system series as its parent", async () => {
    m.createVoucherType.mockResolvedValue({});
    at();
    fireEvent.click(await screen.findByRole("button", { name: /New voucher type/ }));
    // Nobody enters a year-end closing entry by hand, so it cannot be a parent.
    const parent = await screen.findByLabelText(/A variant of/);
    expect(within(parent).queryByText("Year-end closing")).toBeNull();
    expect(within(parent).getByText("Journal")).toBeInTheDocument();

    fireEvent.change(parent, { target: { value: "JV" } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: "pcv" } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Petty cash" } });
    fireEvent.change(screen.getByLabelText(/^Prefix/), { target: { value: "pcv" } });
    fireEvent.click(screen.getByRole("button", { name: "Add voucher type" }));
    await waitFor(() => expect(m.createVoucherType).toHaveBeenCalledWith(expect.objectContaining({ key: "PCV", parentKey: "JV", prefix: "PCV", name: "Petty cash" })));
  });
});

describe("counters, deleted numbers and gaps", () => {
  it("shows where each counter stands and what it counts under", async () => {
    m.numberSeries.mockResolvedValue([{ _id: "n1", series: "SO", fiscalYear: "2026", scope: "Year 2026", branchId: "main", prefix: "SO", next: 12 }]);
    at();
    fireEvent.click(await screen.findByRole("tab", { name: "Counters" }));
    expect(await screen.findByRole("table", { name: "Number series" })).toBeInTheDocument();
    expect(screen.getByText("Year 2026")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("answers why a number is missing: what was deleted, what happened to it and why", async () => {
    m.numberRegister.mockResolvedValue({
      rows: [
        { _id: "i1", number: "SO-2026-0041", typeName: "Sales invoice", status: "cancelled", reason: "wrong customer", endedAt: "2026-10-20T09:00:00Z" },
        { _id: "i2", number: "JV-2026-0007", typeName: "Journal", status: "released", reason: "entered twice", endedAt: "2026-10-21T09:00:00Z" },
      ],
      total: 2, page: 1, pages: 1, summary: { issued: 5, released: 1, cancelled: 1 },
    });
    at();
    fireEvent.click(await screen.findByRole("tab", { name: "Deleted & gaps" }));
    expect(await screen.findByText("SO-2026-0041")).toBeInTheDocument();
    expect(screen.getByText("wrong customer")).toBeInTheDocument();
    expect(screen.getByText("Retired")).toBeInTheDocument();
    expect(screen.getByText("Handed back")).toBeInTheDocument();
  });

  it("reports on one series whether its sequence is unbroken, and names each hole", async () => {
    m.numberGaps.mockResolvedValue({
      series: "SO", name: "Sales invoice",
      scopes: [
        { branchId: "main", label: "2026", scope: "Year 2026", counter: 3, issued: 2, continuous: false, gaps: [{ seq: 2, code: "CANCELLED", reason: "wrong customer" }], rows: [] },
        { branchId: "shj", label: "2026", scope: "Year 2026", counter: 1, issued: 1, continuous: true, gaps: [], rows: [] },
      ],
    });
    at();
    fireEvent.click(await screen.findByRole("tab", { name: "Deleted & gaps" }));
    fireEvent.change(await screen.findByLabelText(/Document type/), { target: { value: "SO" } });
    expect(await screen.findByText("1 gap")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("wrong customer")).toBeInTheDocument();
    expect(screen.getByText("Unbroken")).toBeInTheDocument();
  });
});
