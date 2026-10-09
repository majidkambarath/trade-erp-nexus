import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// Who may do what on the VAT return, mirroring routes/reports/vatReturnRoutes.js: reports.financial reads a return
// and lists the saved ones; reports.vat saves a draft, finalises, files and deletes. The server refuses whatever the
// screen shows; these tests pin what the screen offers.
const m = vi.hoisted(() => ({ compute: vi.fn(), detail: vi.fn(), returns: vi.fn(), saveDraft: vi.fn(), finalize: vi.fn(), file: vi.fn(), removeReturn: vi.fn() }));
vi.mock("../../../lib/accountingApi", () => ({ vat: m }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import VatReturn from "../VatReturn";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

const READ = ["reports.financial"];
const PREPARE = ["reports.financial", "reports.vat"];

const at = (grants, url = "/") => {
  orgStatus = statusFor(grants);
  return render(<MemoryRouter initialEntries={[url]}><AsRole><VatReturn /></AsRole></MemoryRouter>);
};
beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); });

const b = (box, label, amount = 0, vatAmount = 0) => ({ box, label, amount, vat: vatAmount });
const RETURN = () => ({
  from: "2026-07-01", to: "2026-09-30", emirate: "Dubai", currency: "AED",
  boxes: [
    b("1a", "Standard-rated supplies in Abu Dhabi"), b("1b", "Standard-rated supplies in Dubai", 60, 3), b("1c", "Standard-rated supplies in Sharjah"), b("1d", "Standard-rated supplies in Ajman"),
    b("1e", "Standard-rated supplies in Umm Al Quwain"), b("1f", "Standard-rated supplies in Ras Al Khaimah"), b("1g", "Standard-rated supplies in Fujairah"),
    b("3", "Supplies subject to the reverse charge"), b("4", "Zero-rated supplies", 100), b("5", "Exempt supplies", 100), b("8", "Total supplies", 260, 3),
    b("9", "Standard-rated expenses", 1200, 60), b("10", "Expenses subject to the reverse charge"), b("11", "Total expenses", 1200, 60),
    b("12", "Total VAT due", 0, 3), b("13", "Recoverable input VAT", 0, 60), b("14", "Net VAT refundable", 0, -57),
  ],
  totals: { outputVat: 3, recoverableVat: 60, netPayable: -57 },
  unclassified: { count: 0, amount: 0, vat: 0, lines: [] },
  notReported: { count: 0, amount: 0 },
  notTracked: [],
  reconciliation: { rows: [{ label: "Output VAT", documents: 3, ledger: 3, difference: 0, agrees: true }] },
});
const SAVED = (status, extra = {}) => ({
  _id: "r1", periodFrom: "2026-07-01", periodTo: "2026-09-30", status, totals: { outputVat: 3, recoverableVat: 60, netPayable: -57 }, unclassifiedLines: 0,
  boxes: [{ box: "1b", label: "Standard-rated supplies in Dubai", amount: 60, vat: 3 }], ...extra,
});
const DRAFT = SAVED("DRAFT");
const FINALIZED = SAVED("FINALIZED", { _id: "r2", periodFrom: "2026-04-01", periodTo: "2026-06-30" });

describe("preparing the return (reports.vat)", () => {
  it("a person who can read the return but not prepare it sees the figures and can export them, with no Save as draft", async () => {
    m.compute.mockResolvedValue(RETURN());
    at(READ);
    await roleLoaded();
    expect(await screen.findByText("Standard-rated supplies in Dubai")).toBeInTheDocument(); // the screen is loaded
    expect(screen.getByRole("button", { name: /CSV/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save as draft" })).toBeNull();
    expect(m.saveDraft).not.toHaveBeenCalled();
  });

  it("a person who holds reports.vat can save the figures as a draft", async () => {
    m.compute.mockResolvedValue(RETURN());
    m.saveDraft.mockResolvedValue({ _id: "r1" });
    m.returns.mockResolvedValue([]);
    at(PREPARE);
    await roleLoaded();
    fireEvent.click(await screen.findByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalledTimes(1));
  });
});

describe("saved returns (reports.financial reads, reports.vat changes)", () => {
  it("without reports.vat a saved return can be looked at but not finalised, filed or deleted", async () => {
    m.returns.mockResolvedValue([DRAFT, FINALIZED]);
    at(READ, "/?tab=saved");
    await roleLoaded();
    // both rows are on the screen, and each can be viewed
    expect(await screen.findByRole("button", { name: "View return 2026-07-01 to 2026-09-30" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View return 2026-04-01 to 2026-06-30" })).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Finalised")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Finalise" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark filed" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View return 2026-07-01 to 2026-09-30" }));
    expect(await screen.findByRole("dialog", { name: /VAT return/ })).toHaveTextContent("Standard-rated supplies in Dubai");
  });

  it("with reports.vat a draft can be finalised or deleted, and a finalised return marked filed", async () => {
    m.returns.mockResolvedValue([DRAFT, FINALIZED]);
    at(PREPARE, "/?tab=saved");
    await roleLoaded();
    expect(await screen.findByRole("button", { name: "Finalise" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark filed" })).toBeInTheDocument();
  });

  it("an empty list does not tell a person who cannot prepare a return to save one", async () => {
    m.returns.mockResolvedValue([]);
    at(READ, "/?tab=saved");
    await roleLoaded();
    const empty = await screen.findByText("No saved returns");
    expect(empty.closest("div")).toHaveTextContent("No VAT return has been saved yet.");
    expect(screen.queryByText(/choose Save as draft/)).toBeNull();
  });

  it("an empty list tells a person who can prepare one how to start", async () => {
    m.returns.mockResolvedValue([]);
    at(PREPARE, "/?tab=saved");
    await roleLoaded();
    await screen.findByText("No saved returns");
    expect(screen.getByText(/choose Save as draft/)).toBeInTheDocument();
  });

  it("the documents behind the return need only reports.financial", async () => {
    m.detail.mockResolvedValue({ total: 1, page: 1, limit: 50, totals: { taxable: 200, vat: 10 }, rows: [
      { source: "invoice", docId: "d1", docNo: "SO-2026-0001", docType: "sales_order", date: "2026-09-02T08:00:00Z", direction: "output", partyName: "Al Noor", trn: "100999888700003", kinds: ["standard"], taxable: 200, vat: 10 },
    ] });
    at(READ, "/?tab=documents");
    await roleLoaded();
    const row = (await screen.findByText("SO-2026-0001")).closest("tr");
    expect(within(row).getByText("Al Noor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CSV/ })).toBeEnabled();
  });
});
