import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ compute: vi.fn(), detail: vi.fn(), returns: vi.fn(), saveDraft: vi.fn(), finalize: vi.fn(), file: vi.fn(), removeReturn: vi.fn() }));
vi.mock("../../../lib/accountingApi", () => ({ vat: m }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));

import VatReturn from "../VatReturn";
import { downloadCSV } from "../../../utils/format";
import { lastQuarter, quarterStart } from "../reportKit";

const at = (url = "/") => render(<MemoryRouter initialEntries={[url]}><VatReturn /></MemoryRouter>);
beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); downloadCSV.mockReset(); });

const b = (box, label, amount = 0, vatAmount = 0) => ({ box, label, amount, vat: vatAmount });
const RETURN = (over = {}) => ({
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
  notTracked: [{ box: "2", label: "Tax refunds provided to tourists" }, { box: "6", label: "Goods imported into the UAE" }, { box: "7", label: "Import adjustments" }],
  reconciliation: { rows: [{ label: "Output VAT", documents: 3, ledger: 3, difference: 0, agrees: true }, { label: "Input VAT", documents: 60, ledger: 55, difference: 5, agrees: false }] },
  ...over,
});

describe("quarter helpers", () => {
  it("find this quarter's start and the last full quarter, across a year end", () => {
    expect(quarterStart("2026-10-04")).toBe("2026-10-01");
    expect(quarterStart("2026-05-20")).toBe("2026-04-01");
    expect(lastQuarter("2026-10-04")).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(lastQuarter("2026-02-10")).toEqual({ from: "2025-10-01", to: "2025-12-31" });
    expect(lastQuarter("2026-04-01")).toEqual({ from: "2026-01-01", to: "2026-03-31" });
  });
});

describe("the return", () => {
  it("lays the boxes out as the FTA form does, with totals, net VAT, and what is not tracked yet", async () => {
    m.compute.mockResolvedValue(RETURN());
    at();
    expect(await screen.findByText("Standard-rated supplies in Dubai")).toBeInTheDocument();
    const dubai = screen.getByText("Standard-rated supplies in Dubai").closest("tr");
    expect(within(dubai).getByText("1b")).toBeInTheDocument();
    expect(within(dubai).getByText("60.00")).toBeInTheDocument();
    expect(within(screen.getByText("Net VAT refundable", { selector: "td" }).closest("tr")).getByText("-57.00")).toBeInTheDocument();
    expect(screen.getByText("Goods imported into the UAE").closest("tr")).toHaveTextContent("Not tracked yet");
    expect(screen.getByText("VAT on expenses and all other inputs")).toBeInTheDocument();
    expect(m.compute).toHaveBeenCalledWith({ from: expect.stringMatching(/^\d{4}-\d{2}-01$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it("warns about lines with no treatment and takes you to them", async () => {
    m.compute.mockResolvedValue(RETURN({ unclassified: { count: 2, amount: 80, vat: 0, lines: [{ docNo: "SO-2026-0007" }, { docNo: "SO-2026-0009" }] } }));
    m.detail.mockResolvedValue({ total: 0, page: 1, limit: 50, totals: { taxable: 0, vat: 0 }, rows: [] });
    at();
    expect(await screen.findByRole("alert")).toHaveTextContent("2 lines have VAT of 0% and no tax code");
    expect(screen.getByRole("alert")).toHaveTextContent("SO-2026-0007");
    fireEvent.click(screen.getByRole("button", { name: "Show the documents" }));
    await waitFor(() => expect(m.detail).toHaveBeenCalledWith(expect.objectContaining({ kind: "unclassified" })));
  });

  it("shows whether each VAT figure agrees with the ledger, and by how much when it does not", async () => {
    m.compute.mockResolvedValue(RETURN());
    at();
    await screen.findByText("Agrees with the ledger?");
    expect(within(screen.getByText("Output VAT", { selector: "span" }).closest("li")).getByText("Agrees")).toBeInTheDocument();
    expect(within(screen.getByText("Input VAT", { selector: "span" }).closest("li")).getByText("Differs by 5.00")).toBeInTheDocument();
  });

  it("re-queries when the period changes, and has quarter presets", async () => {
    m.compute.mockResolvedValue(RETURN());
    at();
    await screen.findByText("Standard-rated supplies in Dubai");
    fireEvent.click(screen.getByRole("button", { name: "This quarter" }));
    await waitFor(() => expect(m.compute).toHaveBeenLastCalledWith(expect.objectContaining({ from: expect.stringMatching(/^\d{4}-(01|04|07|10)-01$/) })));
  });

  it("exports the boxes, and saves the figures as a draft return", async () => {
    m.compute.mockResolvedValue(RETURN());
    m.saveDraft.mockResolvedValue({ _id: "r1" });
    m.returns.mockResolvedValue([]);
    at();
    await screen.findByText("Standard-rated supplies in Dubai");
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV.mock.calls[0][2]).toHaveLength(17);
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(String), to: expect.any(String) })));
    expect(await screen.findByText("No saved returns")).toBeInTheDocument();
  });

  it("reports a failure with a way to retry", async () => {
    m.compute.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(RETURN());
    at();
    expect(await screen.findByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Standard-rated supplies in Dubai")).toBeInTheDocument();
  });
});

describe("documents", () => {
  const DOCS = {
    total: 2, page: 1, limit: 50, totals: { taxable: 1200, vat: 60 },
    rows: [
      { source: "invoice", docId: "d1", docNo: "SO-2026-0001", docType: "sales_order", date: "2026-09-02T08:00:00Z", direction: "output", partyName: "Al Noor", trn: "100999888700003", kinds: ["standard"], taxable: 200, vat: 10 },
      { source: "invoice", docId: "d2", docNo: "SO-2026-0002", docType: "sales_order", date: "2026-09-03T08:00:00Z", direction: "output", partyName: "Cash Customer", trn: "", kinds: ["unclassified"], taxable: 30, vat: 0 },
    ],
  };
  it("lists each document with its party, TRN and treatment, and filters", async () => {
    m.detail.mockResolvedValue(DOCS);
    at("/?tab=documents");
    const row = (await screen.findByText("SO-2026-0001")).closest("tr");
    expect(within(row).getByText("Al Noor")).toBeInTheDocument();
    expect(within(row).getByText("100999888700003")).toBeInTheDocument();
    expect(within(row).getByText("Standard 5%")).toBeInTheDocument();
    expect(within(screen.getByText("SO-2026-0002").closest("tr")).getByText("No treatment")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "input" } });
    await waitFor(() => expect(m.detail).toHaveBeenLastCalledWith(expect.objectContaining({ direction: "input" })));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "noor" } });
    await waitFor(() => expect(m.detail).toHaveBeenLastCalledWith(expect.objectContaining({ search: "noor" })));
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV).toHaveBeenCalledTimes(1);
  });
});

describe("saved returns", () => {
  const SAVED = (status, extra = {}) => ({
    _id: "r1", periodFrom: "2026-07-01", periodTo: "2026-09-30", status, totals: { outputVat: 3, recoverableVat: 60, netPayable: -57 }, unclassifiedLines: 0,
    boxes: [{ box: "1b", label: "Standard-rated supplies in Dubai", amount: 60, vat: 3 }, { box: "8", label: "Total supplies", amount: 60, vat: 3 }], ...extra,
  });

  it("finalises a draft after a confirmation, and offers to go ahead when lines still have no treatment", async () => {
    m.returns.mockResolvedValue([SAVED("DRAFT")]);
    m.finalize.mockRejectedValueOnce(Object.assign(new Error("1 line(s) have no tax treatment"), { code: "UNCLASSIFIED_LINES" })).mockResolvedValue({});
    at("/?tab=saved");
    fireEvent.click(await screen.findByRole("button", { name: "Finalise" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Finalise this return?" })).getByRole("button", { name: "Finalise" }));
    const again = await screen.findByRole("dialog", { name: "Finalise with lines that have no treatment?" });
    expect(again).toHaveTextContent("1 line(s) have no tax treatment");
    fireEvent.click(within(again).getByRole("button", { name: "Finalise anyway" }));
    await waitFor(() => expect(m.finalize).toHaveBeenLastCalledWith("r1", { allowUnclassified: true }));
  });

  it("marks a finalised return filed only with the FTA reference", async () => {
    m.returns.mockResolvedValue([SAVED("FINALIZED")]);
    m.file.mockResolvedValue({});
    at("/?tab=saved");
    fireEvent.click(await screen.findByRole("button", { name: "Mark filed" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark as filed" });
    expect(within(dialog).getByRole("button", { name: "Mark filed" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/FTA filing reference/), { target: { value: "FTA-998877" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark filed" }));
    await waitFor(() => expect(m.file).toHaveBeenCalledWith("r1", expect.objectContaining({ reference: "FTA-998877" })));
  });

  it("shows a filed return with its reference, and offers no further actions on it", async () => {
    m.returns.mockResolvedValue([SAVED("FILED", { filingReference: "FTA-998877", filedAt: "2026-10-28T08:00:00Z" })]);
    at("/?tab=saved");
    expect(await screen.findByText(/FTA-998877/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finalise" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /View return/ }));
    expect(await screen.findByRole("dialog", { name: /VAT return/ })).toHaveTextContent("Standard-rated supplies in Dubai");
  });

  it("deletes a draft only after asking", async () => {
    m.returns.mockResolvedValue([SAVED("DRAFT")]);
    m.removeReturn.mockResolvedValue({});
    at("/?tab=saved");
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Delete this draft?" })).getByRole("button", { name: "Delete draft" }));
    await waitFor(() => expect(m.removeReturn).toHaveBeenCalledWith("r1"));
  });
});

describe("reverse charge in the return", () => {
  // 800 received under the reverse charge: 40 assessed in box 3, the same recovered in box 10; one sale on which the customer accounts
  const RC = () => RETURN({
    boxes: RETURN().boxes.map((x) => (x.box === "3" ? b("3", "Supplies subject to the reverse charge", 800, 40) : x.box === "10" ? b("10", "Expenses subject to the reverse charge", 800, 40) : x)),
    notReported: { count: 1, amount: 100 },
    customerAccounts: { count: 1, amount: 100 },
    reconciliation: { rows: [
      { label: "Output VAT", documents: 3, ledger: 3, difference: 0, agrees: true },
      { label: "Input VAT", documents: 100, ledger: 100, difference: 0, agrees: true },
      { label: "Reverse-charge VAT (self-assessed)", documents: 40, ledger: 47, difference: -7, agrees: false },
    ] },
  });

  it("shows the third reconciliation row by its full name, and says when it differs", async () => {
    m.compute.mockResolvedValue(RC());
    at();
    await screen.findByText("Agrees with the ledger?");
    const row = screen.getByText("Reverse-charge VAT (self-assessed)", { selector: "span" }).closest("li");
    expect(within(row).getByText("Differs by 7.00")).toBeInTheDocument();
    expect(within(row).getByText(/Documents 40\.00/)).toBeInTheDocument();
    expect(within(screen.getByText("Input VAT", { selector: "span" }).closest("li")).getByText("Agrees")).toBeInTheDocument();
  });

  it("explains box 3 when it holds something, and says a sale on which the customer accounts is in no box", async () => {
    m.compute.mockResolvedValue(RC());
    at();
    await screen.findByText("Agrees with the ledger?");
    expect(screen.getByText(/Box 3 is the VAT you assess yourself on purchases under the reverse charge/)).toBeInTheDocument();
    expect(screen.getByText(/1 sale line \(100\.00 AED\) are under the reverse charge: you charge no VAT and declare none/)).toBeInTheDocument();
    expect(screen.getByText(/1 line \(100\.00 AED\) are out of scope, zero-rated or exempt purchases, or sales on which the customer accounts for the VAT/)).toBeInTheDocument();
  });

  it("says none of that when there is no reverse charge", async () => {
    m.compute.mockResolvedValue(RETURN());
    at();
    await screen.findByText("Agrees with the ledger?");
    expect(screen.queryByText(/Box 3 is the VAT you assess yourself/)).not.toBeInTheDocument();
    expect(screen.queryByText(/under the reverse charge: you charge no VAT/)).not.toBeInTheDocument();
  });

  it("shows the VAT a purchase assesses on itself under its VAT, and exports it", async () => {
    m.compute.mockResolvedValue(RC());
    m.detail.mockResolvedValue({
      total: 1, page: 1, limit: 50, totals: { taxable: 400, vat: 0 },
      rows: [{ source: "invoice", docId: "p1", date: "2026-09-02", docNo: "PO-2026-0005", direction: "input", partyName: "Gulf Mills", trn: "", kinds: ["reverse_charge"], taxable: 400, vat: 0, rcmVat: 20 }],
    });
    at("/?tab=documents");
    const row = (await screen.findByText("PO-2026-0005")).closest("tr");
    expect(within(row).getByText("20.00 self-assessed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV.mock.calls[0][1]).toContain("Self-assessed VAT (AED)");
    expect(downloadCSV.mock.calls[0][2][0].slice(-3)).toEqual([400, 0, 20]);
  });
});
