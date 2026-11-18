import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ gstr1: vi.fn(), gstr3b: vi.fn() }));
vi.mock("../../../lib/accountingApi", () => ({ gst: m }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));
vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: () => ({ companyName: "Brivox" }) }));

import GstReturn from "../GstReturn";
import { downloadCSV } from "../../../utils/format";

const at = (url = "/") => render(<MemoryRouter initialEntries={[url]}><GstReturn /></MemoryRouter>);
beforeEach(() => {
  m.gstr1.mockReset();
  m.gstr3b.mockReset();
  downloadCSV.mockReset();
});

const Z = () => ({ taxable: 0, igst: 0, cgst: 0, sgst: 0 });
const GSTR1 = (over = {}) => ({
  b2b: [{ gstin: "29AAPFU0939F1ZV", party: "Far Co", docNo: "SO-2026-0002", date: "2026-11-02", docValue: 1180, placeOfSupply: "29", rate: 18, taxable: 1000, igst: 180, cgst: 0, sgst: 0 }],
  b2cl: [],
  b2cs: [{ placeOfSupply: "27", rate: 18, type: "OE", taxable: 2000, igst: 0, cgst: 180, sgst: 180 }],
  cdnr: [], cdnur: [], zeroRated: [],
  nil: { interRegistered: Z(), intraRegistered: Z(), interUnregistered: Z(), intraUnregistered: { ...Z(), taxable: 300 } },
  nonGst: { interRegistered: Z(), intraRegistered: Z(), interUnregistered: Z(), intraUnregistered: Z() },
  hsn: [{ hsnCode: "7318", rate: 18, qty: 30, taxable: 3000, igst: 180, cgst: 180, sgst: 180 }],
  hsnMissing: false,
  documentsIssued: { invoices: { count: 3, from: "SO-2026-0001", to: "SO-2026-0003" }, creditNotes: { count: 0, from: null, to: null } },
  totals: { taxable: 3000, igst: 180, cgst: 180, sgst: 180, tax: 540 },
  notReported: { withoutGstDetail: { documents: 0, taxable: 0, tax: 0 }, unclassified: { lines: 0, taxable: 0 } },
  ...over,
});

const GSTR3B = (over = {}) => ({
  outward: {
    taxable: { taxable: 3000, igst: 180, cgst: 180, sgst: 180, tax: 540 }, zeroRated: { ...Z(), tax: 0 }, nilExempt: { ...Z(), taxable: 300 },
    reverseCharge: { ...Z(), tax: 0 }, nonGst: Z(),
  },
  itc: { other: { igst: 100, cgst: 20, sgst: 20 }, reverseCharge: { igst: 0, cgst: 0, sgst: 0 }, total: { igst: 100, cgst: 20, sgst: 20 } },
  liability: { ordinary: { igst: 180, cgst: 180, sgst: 180 }, reverseCharge: { igst: 0, cgst: 0, sgst: 0 } },
  utilised: { igst: { igst: 100, cgst: 0, sgst: 0 }, cgst: { igst: 0, cgst: 20, sgst: 0 }, sgst: { igst: 0, cgst: 0, sgst: 20 } },
  payableInCash: { igst: 80, cgst: 160, sgst: 160 },
  creditCarriedForward: { igst: 0, cgst: 0, sgst: 0 },
  reconciliation: {
    rows: [
      { label: "Output CGST", documents: 180, ledger: 180, difference: 0, agrees: true },
      { label: "Output SGST", documents: 180, ledger: 180, difference: 0, agrees: true },
      { label: "Output IGST", documents: 180, ledger: 170, difference: 10, agrees: false },
    ],
    unsplit: { output: 12.5, input: 0 },
  },
  notReported: { withoutGstDetail: { documents: 0, taxable: 0, tax: 0 }, unclassified: { lines: 0, taxable: 0 } },
  ...over,
});

describe("GSTR-1", () => {
  it("lists registered buyers invoice by invoice, unregistered ones by state, and the HSN summary", async () => {
    m.gstr1.mockResolvedValue(GSTR1());
    at();
    const b2b = (await screen.findByRole("table", { name: /B2B invoices/ }));
    expect(within(b2b).getByText("29AAPFU0939F1ZV")).toBeInTheDocument();
    expect(within(b2b).getByText("29 Karnataka")).toBeInTheDocument();
    expect(within(b2b).getByText("SO-2026-0002")).toBeInTheDocument();
    const b2cs = screen.getByRole("table", { name: /B2C small/ });
    expect(within(b2cs).getByText("27 Maharashtra")).toBeInTheDocument();
    const hsn = screen.getByRole("table", { name: /HSN/ });
    expect(within(hsn).getByText("7318")).toBeInTheDocument();
    expect(screen.getAllByText("Nothing in this period.").length).toBeGreaterThan(0); // the empty sections say so
  });

  it("says what could not be placed in a table, in words, instead of hiding it", async () => {
    m.gstr1.mockResolvedValue(GSTR1({ notReported: { withoutGstDetail: { documents: 2, taxable: 500, tax: 90 }, unclassified: { lines: 1, taxable: 40 } }, hsnMissing: true }));
    at();
    expect(await screen.findByText(/2 approved documents are not in the tables below/)).toBeInTheDocument();
    expect(screen.getByText(/1 line has no tax treatment/)).toBeInTheDocument();
    expect(screen.getByText(/Some sales have no HSN \/ SAC code/)).toBeInTheDocument();
  });

  it("exports a section as CSV with the company and period on top", async () => {
    m.gstr1.mockResolvedValue(GSTR1());
    at();
    await screen.findByRole("table", { name: /B2B invoices/ });
    fireEvent.click(screen.getAllByRole("button", { name: /CSV/ })[0]); // the first section with rows is B2B
    expect(downloadCSV).toHaveBeenCalledTimes(1);
    const [name, headers, rows, opts] = downloadCSV.mock.calls[0];
    expect(name).toMatch(/^gstr1-b2b-/);
    expect(headers).toContain("GSTIN");
    expect(rows[0]).toContain("29AAPFU0939F1ZV");
    expect(opts.preamble).toBeTruthy();
  });
});

describe("GSTR-3B", () => {
  it("shows the cash to pay, the credit used and the ledger comparison", async () => {
    m.gstr3b.mockResolvedValue(GSTR3B());
    at("/?tab=gstr3b");
    expect((await screen.findAllByText("Payable in cash")).length).toBe(2); // the tile and the row of the payment table
    expect(screen.getByText("IGST 80.00 · CGST 160.00 · SGST 160.00")).toBeInTheDocument();
    const pay = screen.getByRole("table", { name: /6.1 Payment of tax/ });
    expect(within(pay.querySelector("tbody").querySelectorAll("tr")[2]).getByText("Paid by input tax credit")).toBeInTheDocument();
    expect(within(pay).getByText("-100.00")).toBeInTheDocument();
  });

  it("flags a difference to the ledger and mentions tax posted without a component", async () => {
    m.gstr3b.mockResolvedValue(GSTR3B());
    at("/?tab=gstr3b");
    const rec = await screen.findByRole("table", { name: /Documents against the ledger/ });
    expect(within(rec).getByText("Output IGST").closest("tr")).toHaveTextContent("10.00");
    expect(screen.getByText("Differs")).toBeInTheDocument();
    expect(screen.getByText(/Tax posted as one amount/)).toHaveTextContent("output 12.50");
  });

  it("says Agrees when every account does", async () => {
    m.gstr3b.mockResolvedValue(GSTR3B({ reconciliation: { rows: [{ label: "Output CGST", documents: 1, ledger: 1, difference: 0, agrees: true }], unsplit: { output: 0, input: 0 } } }));
    at("/?tab=gstr3b");
    expect(await screen.findByText("Agrees")).toBeInTheDocument();
  });
});
