import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// Cost centres: the setup tab, the payloads that carry a centre, and the order grid's column.
const m = vi.hoisted(() => ({ costCentres: vi.fn(), createCostCentre: vi.fn(), updateCostCentre: vi.fn(), removeCostCentre: vi.fn() }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));
vi.mock("../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ canAny: () => true, can: () => true }) }));
vi.mock("../../shell/Can", () => ({ default: ({ children }) => <>{children}</> }));

import CostCentres from "../setup/CostCentres";
import { journalPayload, journalRowsFromVoucher } from "../../../lib/voucherForms";
import { buildPayload, columnsFor, VARIANTS } from "../../OrderEntry/variants";

const A = { _id: "a1", code: "SHOP1", name: "Deira shop", isActive: true };
const OFF = { _id: "o1", code: "OLD", name: "Closed branch", isActive: false };

describe("the Cost centres tab", () => {
  beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

  it("lists the centres with their state, and says what to do when there are none", async () => {
    m.costCentres.mockResolvedValue([A, OFF]);
    render(<CostCentres notify={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Cost centres" });
    expect(within(table).getByText("Deira shop")).toBeInTheDocument();
    expect(within(table).getByText("Switched off")).toBeInTheDocument();
  });

  it("creates one with an upper-case code checked before it is sent, and reads the server's duplicate answer onto the field", async () => {
    m.costCentres.mockResolvedValue([]);
    m.createCostCentre.mockRejectedValueOnce(Object.assign(new Error("exists"), { code: "COST_CENTRE_EXISTS" }));
    const notify = vi.fn();
    render(<CostCentres notify={notify} />);
    fireEvent.click(await screen.findByRole("button", { name: /new cost centre/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create cost centre" }));
    expect(within(dialog).getByText("1 to 12 letters, digits, - or _")).toBeInTheDocument();
    expect(m.createCostCentre).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: "SHOP1" } });
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Deira shop" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create cost centre" }));
    expect(await within(dialog).findByText("A cost centre with this code or name already exists")).toBeInTheDocument();
    m.createCostCentre.mockResolvedValueOnce(A);
    fireEvent.click(within(dialog).getByRole("button", { name: "Create cost centre" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Deira shop created"));
    expect(m.createCostCentre).toHaveBeenLastCalledWith({ code: "SHOP1", name: "Deira shop", parentId: null, notes: "", isActive: true });
  });
});

describe("what a journal sends", () => {
  it("carries the journal's centre and a line's own, and nothing when none is chosen", () => {
    const rows = [{ accountId: "x", debit: "10", credit: "", narration: "", costCentreId: "b1" }, { accountId: "y", debit: "", credit: "10", narration: "" }];
    const body = journalPayload({ date: "2026-11-19", rows, costCentreId: "a1" });
    expect(body.costCentreId).toBe("a1");
    expect(body.lines[0].costCentreId).toBe("b1");
    expect(body.lines[1]).not.toHaveProperty("costCentreId");
    expect(journalPayload({ date: "2026-11-19", rows })).not.toHaveProperty("costCentreId");
    expect(journalRowsFromVoucher({ entries: [{ accountId: "x", debitAmount: 5, costCentreId: "b1" }] })[0].costCentreId).toBe("b1");
  });
});

describe("the order form's cost centre", () => {
  it("adds a Cost centre column after the tax code only once the organisation has a centre, and never to a document that does not post", () => {
    const keys = (o) => columnsFor(VARIANTS.sales, o).map((c) => c.key);
    expect(keys({})).not.toContain("costCentreId");
    const withCentres = keys({ centres: true });
    expect(withCentres.indexOf("costCentreId")).toBe(withCentres.indexOf("taxCodeId") + 1);
    expect(columnsFor(VARIANTS.quotation, { centres: true }).map((c) => c.key)).not.toContain("costCentreId");
  });

  it("sends the document's centre when the form holds one, a blank one on an edit to clear it, and a line's own centre", () => {
    const row = { ...VARIANTS.sales.rowTemplate(), itemId: "i1", qty: "2", salesPrice: "10", costCentreId: "b1" };
    const f = { partyId: "c1", date: "2026-11-19", status: "DRAFT", items: [row], costCentreId: "a1" };
    const body = buildPayload(VARIANTS.sales, f, [row], new Map());
    expect(body.costCentreId).toBe("a1");
    expect(body.items[0].costCentreId).toBe("b1");
    expect(buildPayload(VARIANTS.sales, { ...f, costCentreId: "" }, [row], new Map()).costCentreId).toBe("");
    const { costCentreId: _none, ...plain } = f;
    expect(buildPayload(VARIANTS.sales, plain, [{ ...row, costCentreId: "" }], new Map())).not.toHaveProperty("costCentreId");
  });
});
