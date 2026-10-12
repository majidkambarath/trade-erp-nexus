import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "@testing-library/jest-dom";
import PayAction, { payHref } from "../PayAction";

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
const show = (ui) =>
  render(
    <MemoryRouter initialEntries={["/sales-order"]}>
      <Routes><Route path="*" element={<>{ui}<Where /></>} /></Routes>
    </MemoryRouter>
  );
const invoice = (over = {}) => ({ id: "t1", transactionNo: "SO-2026-0105", status: "APPROVED", totalAmount: 819, paidAmount: 400, outstandingAmount: 419, ...over });

describe("payHref", () => {
  it("carries the party, the invoice and what is owed", () => {
    expect(payHref({ sales: true, partyId: "c1", invoiceId: "t1", outstanding: 419 })).toBe("/receipt-voucher?party=c1&invoice=t1&amount=419");
    expect(payHref({ sales: false, partyId: "v1", invoiceId: "t9", outstanding: 52.5 })).toBe("/payment-voucher?party=v1&invoice=t9&amount=52.5");
  });
});

describe("PayAction", () => {
  it("an unpaid sales invoice offers Receive payment, which goes to the receipt screen filled in", () => {
    show(<PayAction doc={invoice()} sales partyId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Receive payment for SO-2026-0105" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/receipt-voucher?party=c1&invoice=t1&amount=419");
  });

  it("a purchase invoice offers Make payment, in the card wording too", () => {
    show(<PayAction doc={invoice({ transactionNo: "PO-2026-0071" })} partyId="v1" variant="card" />);
    fireEvent.click(screen.getByRole("button", { name: "Make payment for PO-2026-0071" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/payment-voucher?party=v1&invoice=t1&amount=419");
  });

  it("shows nothing for a paid invoice, a draft, or a row whose amounts did not arrive", () => {
    const none = (doc) => {
      const { container, unmount } = show(<PayAction doc={doc} sales partyId="c1" />);
      expect(container.querySelector("button")).toBeNull();
      unmount();
    };
    none(invoice({ paidAmount: 819, outstandingAmount: 0 }));
    none(invoice({ status: "DRAFT", paidAmount: 0, outstandingAmount: 819 }));
    none(invoice({ paidAmount: undefined, outstandingAmount: undefined }));
  });

  it("a credited invoice that still owes something offers the payment of what is left", () => {
    show(<PayAction doc={invoice({ paidAmount: 0, creditedAmount: 273, outstandingAmount: 546 })} sales partyId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /Receive payment/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("amount=546");
  });
});
