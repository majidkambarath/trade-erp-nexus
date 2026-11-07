import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// The voucher read as a DOCUMENT, on its own page. The page is `InvoiceScreen` - the very screen a
// sales or purchase invoice opens on - so what is tested here is the finance half: that the right
// sheet is drawn, named and titled from the voucher itself, that Print and Download PDF carry that
// sheet, and that Back goes to the screen the voucher belongs to.

const m = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../lib/bankingApi", () => ({
  vouchers: { get: m.get, list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  banking: { options: vi.fn(), cheques: vi.fn() },
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: {}, ApiError: class extends Error {} }));
vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({
  useCompanyProfile: () => ({ companyName: "Harbour Trading", companyNameArabic: "", addressLine1: "Deira", addressLine2: "Dubai", vatNumber: "100123456700003", logo: null }),
}));

// As in PartyVouchersFx: `printMarkup` stays REAL, because the frame it appends is how the test
// reads what reached the paper. Only the rasteriser is replaced - html2canvas needs a real canvas,
// which jsdom has not got, and it is documentPdf's business rather than this page's.
const pdf = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("../../PurchaseOrder/shared/documentPdf", async (orig) => ({
  ...(await orig()),
  downloadSheetsPdf: pdf.download,
}));

let orgStatus;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import VoucherDocument from "../VoucherDocument";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";
import { resetOrgLocale } from "../../../utils/orgLocale";

const RECEIPT = {
  _id: "v1", voucherNo: "RV-2026-0001", voucherType: "receipt", status: "approved",
  date: "2026-10-08T00:00:00Z", partyName: "Al Noor", totalAmount: 100, ledgerBased: true,
  entries: [
    { accountName: "Cash in Hand", description: "Receipt from Al Noor", debitAmount: 100, creditAmount: 0 },
    { accountName: "Customer - Al Noor", debitAmount: 0, creditAmount: 100 },
  ],
  linkedInvoices: [{ invoiceId: { _id: "i1", transactionNo: "SO-2026-0042", date: "2026-09-20T00:00:00Z" }, amount: 75, balance: 0 }],
};

const Where = () => <span data-testid="where">{useLocation().pathname + useLocation().search}</span>;

const openAt = async (path) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AsRole>
        <Where />
        <Routes>
          <Route path="/:screen/:id" element={<VoucherDocument />} />
          <Route path="*" element={<span />} />
        </Routes>
      </AsRole>
    </MemoryRouter>,
  );
  await roleLoaded();
};

const sheetOnScreen = () => document.querySelector("[data-print-preview]");
const printedSheet = () => {
  const frames = document.querySelectorAll("iframe");
  return frames[frames.length - 1]?.srcdoc || "";
};

beforeEach(() => {
  orgStatus = statusFor(["finance.view", "reports.view"]);
  m.get.mockResolvedValue(RECEIPT);
});
afterEach(() => {
  resetOrgLocale();
  document.querySelectorAll("iframe").forEach((f) => f.remove());
  pdf.download.mockClear();
  m.get.mockReset();
});

describe("the voucher on its own page", () => {
  it("shows the A4 sheet on screen, which is the thing that prints", async () => {
    await openAt("/receipt-voucher/v1");
    const preview = await waitFor(() => {
      const el = sheetOnScreen();
      expect(el).not.toBeNull();
      return el;
    });
    // the same sheet the tax invoice draws: A4, the organisation's letterhead, the voucher's number
    expect(preview.innerHTML).toContain("210mm");
    expect(within(preview).getByText("Harbour Trading")).toBeInTheDocument();
    expect(within(preview).getByText("RV-2026-0001")).toBeInTheDocument();
    expect(within(preview).getByText("Received from")).toBeInTheDocument();
    // Twice on purpose: the "Invoice ref" row names it at a glance, the "Against invoice" table
    // below carries what was put against it and the balance left after.
    expect(within(preview).getAllByText("SO-2026-0042")).toHaveLength(2);
    expect(within(preview).getByText("Invoice ref")).toBeInTheDocument();
  });

  it("names the document from the voucher itself, not from the address it was opened at", async () => {
    m.get.mockResolvedValue({ ...RECEIPT, voucherType: "journal", partyName: "" });
    // opened on the receipts path, but it is a journal: the paper must say what it really is
    await openAt("/receipt-voucher/v1");
    const preview = await waitFor(() => { const el = sheetOnScreen(); expect(el).not.toBeNull(); return el; });
    expect(within(preview).getByText("Journal voucher")).toBeInTheDocument();
    expect(within(preview).queryByText("Received from")).toBeNull();
  });

  it("prints the copy on screen, through the hidden frame and never a pop-up", async () => {
    window.open = vi.fn();
    await openAt("/receipt-voucher/v1");
    await waitFor(() => expect(sheetOnScreen()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Print/ }));
    expect(window.open).not.toHaveBeenCalled();
    await waitFor(() => expect(printedSheet()).toContain("RV-2026-0001"));
    expect(printedSheet()).toContain("210mm");
    expect(printedSheet()).toContain("Dirhams");
  });

  it("downloads the PDF named after the voucher", async () => {
    await openAt("/receipt-voucher/v1");
    await waitFor(() => expect(sheetOnScreen()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Download PDF/ }));
    await waitFor(() => expect(pdf.download).toHaveBeenCalled());
    const [markups, fileName] = pdf.download.mock.calls.at(-1);
    expect(fileName).toBe("Receipt-voucher_RV-2026-0001");
    expect(markups).toHaveLength(1);
    expect(markups[0]).toContain("RV-2026-0001");
  });

  // A receipt is also the acknowledgement handed to the payer, so it is drawn as two copies and the
  // switch decides which one is shown, printed and saved - the invoice screen's own rule.
  it("offers a receipt's two copies and prints the one chosen", async () => {
    await openAt("/receipt-voucher/v1");
    await waitFor(() => expect(sheetOnScreen()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Customer copy" }));
    fireEvent.click(screen.getByRole("button", { name: /Print/ }));
    await waitFor(() => expect(printedSheet()).toContain("Customer copy"));
  });

  // The two copies are not the same sheet with a different word at the top. The customer is told
  // what the money was for; the postings behind it are ours, and stay on the copy we file.
  it("tells the customer what the money was for, and keeps the postings on the office copy", async () => {
    await openAt("/receipt-voucher/v1");
    await waitFor(() => expect(sheetOnScreen()).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /Print/ })); // Office copy is the default
    await waitFor(() => expect(printedSheet()).toContain("Office copy"));
    const office = printedSheet();
    expect(office).toContain("Debit (AED)");
    expect(office).toContain("Customer - Al Noor");
    expect(office).not.toContain("Being receipt against");
    expect(office).toContain("Approved by");

    fireEvent.click(screen.getByRole("button", { name: "Customer copy" }));
    fireEvent.click(screen.getByRole("button", { name: /Print/ }));
    await waitFor(() => expect(printedSheet()).toContain("Customer copy"));
    const customer = printedSheet();
    expect(customer).toContain("Being receipt against SO-2026-0042");
    expect(customer).not.toContain("Debit (AED)");
    expect(customer).not.toContain("Customer - Al Noor"); // the ledger account, not the party
    expect(customer).toContain("Received by");
    expect(customer).toContain("Company stamp");
    expect(customer).not.toContain("Approved by");
    // and not through the side door either: the totals panel's two sides are the same posting
    expect(office).toContain("Total debit");
    expect(customer).not.toContain("Total debit");
    expect(customer).not.toContain("Total credit");
    expect(customer).toContain("Amount (AED)"); // the one figure that concerns them

    // The invoice and its figures are named ONCE on the copy that goes out. The office copy keeps
    // the separate allocations table, which there sits beside a ledger table and says something
    // different; on the customer's it would be the same numbers twice.
    expect(office).toContain("Against invoice");
    expect(customer).not.toContain("Against invoice");
    expect(customer).toContain("Balance after"); // carried by the one table instead
    expect(customer.match(/SO-2026-0042/g)).toHaveLength(2); // the meta row, and the description
  });

  // Everything the reference voucher the owner printed carries, on the copy they hand over.
  it("prints the payer's own details, the invoice, the terms and the remarks", async () => {
    m.get.mockResolvedValue({
      ...RECEIPT,
      paymentMode: "cheque",
      paymentDetails: { chequeDetails: { chequeNumber: "455120" }, drawnOnBankName: "Emirates NBD" },
      narration: "RCVD CHEQUE DATED 09/11/2026 FOR THE INVOICE AMOUNT",
      partyId: {
        billingAddress: "M 5, West, Musaffah, Abu Dhabi, UAE",
        trnNumber: "104144306800003",
        email: "sulaiman@alkhaleej.example",
        paymentTerms: "Net 15",
      },
    });
    await openAt("/receipt-voucher/v1");
    await waitFor(() => expect(sheetOnScreen()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Customer copy" }));
    fireEvent.click(screen.getByRole("button", { name: /Print/ }));
    await waitFor(() => expect(printedSheet()).toContain("Customer copy"));

    const paper = printedSheet();
    expect(paper).toContain("M 5, West, Musaffah, Abu Dhabi, UAE");
    expect(paper).toContain("104144306800003");
    expect(paper).toContain("sulaiman@alkhaleej.example");
    expect(paper).toContain("Payment method");
    expect(paper).toContain("Cheque 455120");
    expect(paper).toContain("Emirates NBD");
    expect(paper).toContain("Invoice ref");
    expect(paper).toContain("Credit days");
    expect(paper).toContain("15");
    expect(paper).toContain("Remarks");
    expect(paper).toContain("RCVD CHEQUE DATED 09/11/2026 FOR THE INVOICE AMOUNT");
    expect(paper).toContain("Dirhams"); // the words line keeps the unit, not the code
  });

  it("goes back to the screen the voucher belongs to", async () => {
    m.get.mockResolvedValue({ ...RECEIPT, voucherType: "credit_note" });
    await openAt("/debit-credit-notes/v1");
    await waitFor(() => expect(sheetOnScreen()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Back to list/ }));
    // the notes screen picks its tab from the query, so the way back carries it
    expect(screen.getByTestId("where")).toHaveTextContent("/debit-credit-notes?type=credit_note");
  });

  // Never an empty sheet under a letterhead: that reads as a real document that happens to be blank.
  it("says so when the voucher is gone, and offers the way back", async () => {
    m.get.mockRejectedValue(new Error("Voucher not found"));
    await openAt("/receipt-voucher/v1");
    expect(await screen.findByText(/Voucher not found/)).toBeInTheDocument();
    expect(sheetOnScreen()).toBeNull();
    expect(screen.getByRole("button", { name: /Back to vouchers/ })).toBeInTheDocument();
  });
});
