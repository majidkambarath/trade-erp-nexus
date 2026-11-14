import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrderForm from "../OrderForm";
import { VARIANTS } from "../variants";
import axiosInstance from "../../../axios/axios";

// A person with no mouse has to be able to fill this form in. These are the first keyboard tests
// this form has ever had (see orderFormVariants.test.jsx for its fields and payloads, and
// LineItemsGrid's own file-header comment for the grid's full keyboard model).

vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div>Attachments panel</div>, linkPending: vi.fn(async () => []) }));

const customers = [
  { _id: "c1", customerId: "C1", customerName: "Al Noor Grocery", billingAddress: "Deira", phone: "04 1", trnNumber: "1", paymentTerms: "Net 30" },
  { _id: "c2", customerId: "C2", customerName: "Zenith Engineering", billingAddress: "Al Quoz", phone: "04 2", trnNumber: "2", paymentTerms: "Net 30" },
];
const stockItems = [{ _id: "s1", itemId: "ITM1", itemName: "Basmati 5kg", purchasePrice: 10, salesPrice: 20, currentStock: 40, taxPercent: 5 }];

const show = async (ui) => {
  const out = render(ui);
  await act(async () => {});
  return out;
};

const customerSelect = () => screen.getByRole("combobox", { name: "Customer" });
const arrowRight = (el, times = 1) => { for (let i = 0; i < times; i++) fireEvent.keyDown(el, { key: "ArrowRight" }); };

function Harness({ selected = null }) {
  const [formData, setFormData] = useState({
    transactionNo: "", partyId: "", partyType: "Customer", date: "2026-11-14",
    deliveryDate: "", refNo: "", docNo: "", serialNo: "", status: "DRAFT", discount: "0",
    notes: "", charges: [], items: [VARIANTS.sales.rowTemplate()],
  });
  return (
    <OrderForm
      variant={VARIANTS.sales} formData={formData} setFormData={setFormData} parties={customers} stockItems={stockItems}
      notify={() => {}} selected={selected} setActiveView={() => {}} resetForm={() => {}} onSuccess={() => {}}
      activeView={selected ? "edit" : "create"}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockResolvedValue({ data: { data: [] } });
});

describe("a sales invoice, with no mouse", () => {
  it("opens with the cursor already in Customer - the first real decision on a new document", async () => {
    await show(<Harness />);
    expect(document.activeElement).toBe(customerSelect());
  });

  it("does not steal focus on an edit - the person opened an existing document to look at it", async () => {
    await show(<Harness selected={{ id: "t1" }} />);
    expect(document.activeElement).not.toBe(customerSelect());
  });

  it("Enter in the Date field moves to Customer, the next field in the card", async () => {
    await show(<Harness />);
    const date = screen.getByLabelText("Date");
    date.focus();
    fireEvent.keyDown(date, { key: "Enter" });
    expect(document.activeElement).toBe(customerSelect());
  });

  it("picking a customer with Enter also moves the cursor on; a mouse click would not", async () => {
    await show(<Harness />);
    const customer = customerSelect();
    fireEvent.keyDown(customer, { key: "ArrowDown" }); // opens the list
    await act(async () => {
      fireEvent.keyDown(customer, { key: "Enter" }); // picks the highlighted option
    });
    expect(screen.getByText("Al Noor Grocery")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText("Delivery date"));
  });

  it("Alt+N adds a line and puts the cursor straight into it", async () => {
    await show(<Harness />);
    fireEvent.keyDown(window, { key: "n", altKey: true });
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 lines
    expect(document.activeElement).toBe(screen.getByLabelText("Item, row 2"));
  });

  it("Enter moves to the next editable cell in the row, skipping the read-only ones", async () => {
    await show(<Harness />);
    const item = screen.getByLabelText("Item, row 1");
    arrowRight(item, 3); // item -> description -> unit price -> qty (cost is read-only)
    expect(document.activeElement).toBe(screen.getByLabelText("Qty, row 1"));
    fireEvent.keyDown(document.activeElement, { key: "Enter" });
    expect(document.activeElement).toBe(screen.getByLabelText("Disc %, row 1")); // net and tax code are read-only/select
  });

  it("Enter on the last editable cell of the last row adds a line and moves into it", async () => {
    await show(<Harness />);
    const item = screen.getByLabelText("Item, row 1");
    arrowRight(item, 6); // item -> description -> rate -> qty -> disc % -> tax code -> VAT %
    expect(document.activeElement).toBe(screen.getByLabelText("VAT %, row 1"));
    fireEvent.keyDown(document.activeElement, { key: "Enter" });
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + the new line
    expect(document.activeElement).toBe(screen.getByLabelText("Item, row 2"));
  });

  it("the Save button is marked for Ctrl+S to find, not guessed at", async () => {
    await show(<Harness />);
    expect(screen.getByRole("button", { name: /save invoice/i })).toHaveAttribute("data-shortcut", "save");
  });
});
