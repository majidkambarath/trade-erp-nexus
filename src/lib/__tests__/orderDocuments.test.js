import { describe, it, expect } from "vitest";
import {
  allowOrderActions, allowReceiptActions, orderStatusLabel, receiptStatusLabel, progressTone, receiptInvoiceBlocker,
  receiveRows, validateReceive, receivePayload, newOrderForm, newReceiptForm, RECEIPT_TABS, ORDER_TABS,
} from "../orderDocuments";

const grants = (...g) => ({ grants: g });

describe("allowOrderActions", () => {
  const actions = { edit: true, delete: false, confirm: true, receive: true, invoice: true };

  it("narrows what the order's state allows to what the role holds, in the order's own module", () => {
    const sales = allowOrderActions(actions, grants("sales.view", "sales.edit", "sales.approve"), "sales");
    expect(sales).toMatchObject({ edit: true, confirm: true, delete: false, invoice: true, receive: false });
    const purchase = allowOrderActions(actions, grants("purchase.view", "purchase.create"), "purchase");
    expect(purchase).toMatchObject({ edit: false, confirm: false, receive: true, invoice: false });
  });

  it("a sales grant never opens a purchase order", () => {
    const out = allowOrderActions({ confirm: true }, grants("sales.approve"), "purchase");
    expect(out.confirm).toBe(false);
  });

  it("a state that does not allow an action stays off whatever the role holds", () => {
    expect(allowOrderActions({ confirm: false }, grants("sales.approve"), "sales").confirm).toBe(false);
  });

  it("with no grants list yet (the status is loading) the server's state decides", () => {
    expect(allowOrderActions({ confirm: true }, null, "sales").confirm).toBe(true);
  });
});

describe("allowReceiptActions", () => {
  it("edit, receive, cancel, invoice and delete each need their own purchase permission", () => {
    const all = { edit: true, receive: true, cancel: true, invoice: true, delete: true };
    expect(allowReceiptActions(all, grants("purchase.edit"))).toEqual({ edit: true, receive: false, cancel: false, invoice: false, delete: false });
    expect(allowReceiptActions(all, grants("purchase.approve"))).toEqual({ edit: false, receive: true, cancel: true, invoice: true, delete: false });
    expect(allowReceiptActions(all, grants("purchase.delete")).delete).toBe(true);
  });
});

describe("words", () => {
  it("labels states and passes an unknown one through", () => {
    expect(orderStatusLabel("CONFIRMED")).toBe("Confirmed");
    expect(receiptStatusLabel("RECEIVED")).toBe("Received");
    expect(orderStatusLabel("ODD")).toBe("ODD");
    expect(receiptStatusLabel(undefined)).toBe("");
  });

  it("the tabs start with All and send the status the server knows", () => {
    expect(ORDER_TABS[0]).toEqual(["", "All"]);
    expect(RECEIPT_TABS.map(([v]) => v)).toEqual(["", "DRAFT", "RECEIVED", "UNINVOICED", "CANCELLED"]);
  });

  it("progress reads as a tone", () => {
    expect(progressTone("Invoiced")).toBe("success");
    expect(progressTone("Partly invoiced")).toBe("info");
    expect(progressTone("Fully received")).toBe("info");
    expect(progressTone("Partly received")).toBe("warning");
    expect(progressTone("Not started")).toBe("neutral");
  });
});

describe("receiptInvoiceBlocker", () => {
  const r = (over = {}) => ({ receiptNo: "GRN-1", partyId: "v1", actions: { invoice: true }, ...over });

  it("is null for received goods of one vendor", () => {
    expect(receiptInvoiceBlocker([r(), r({ receiptNo: "GRN-2" })])).toBeNull();
  });
  it("asks for a choice when nothing is chosen", () => {
    expect(receiptInvoiceBlocker([])).toMatch(/choose/i);
  });
  it("refuses two vendors on one invoice", () => {
    expect(receiptInvoiceBlocker([r(), r({ partyId: "v2" })])).toMatch(/different vendors/i);
  });
  it("names the receipt that cannot be invoiced", () => {
    expect(receiptInvoiceBlocker([r(), r({ receiptNo: "GRN-9", actions: { invoice: false } })])).toBe("GRN-9 cannot be invoiced from here");
  });
});

describe("receiving", () => {
  const receipt = {
    items: [
      { _id: "l1", description: "Rice", itemCode: "I1", qty: 10 },
      { _id: "l2", description: "Oil", qty: 4, receivedQty: 3, shortReason: "Leaked", batchNumber: "B7", expiryDate: "2027-01-31T00:00:00.000Z" },
    ],
  };

  it("starts every line at what was expected, or at what was already recorded", () => {
    const rows = receiveRows(receipt);
    expect(rows[0]).toMatchObject({ lineId: "l1", expected: 10, received: "10", shortReason: "" });
    expect(rows[1]).toMatchObject({ lineId: "l2", expected: 4, received: "3", shortReason: "Leaked", batchNumber: "B7", expiryDate: "2027-01-31" });
  });

  it("needs the name of the person who took the goods in", () => {
    const rows = receiveRows(receipt);
    expect(validateReceive(rows, { receivedBy: " " }).receivedBy).toMatch(/name/i);
    expect(validateReceive(rows.map((x, i) => (i === 1 ? { ...x, received: "4" } : x)), { receivedBy: "Sam" })).toBeNull();
  });

  it("more than expected is refused, and a short line must say why", () => {
    const rows = receiveRows(receipt).map((x) => ({ ...x, shortReason: "" }));
    rows[0].received = "11";
    rows[1].received = "3";
    const errors = validateReceive(rows, { receivedBy: "Sam" });
    expect(errors[0]).toMatch(/more than the 10/i);
    expect(errors[1]).toMatch(/say why 1 did not arrive/i);
  });

  it("refuses a negative or blank figure", () => {
    const rows = receiveRows(receipt);
    rows[0].received = "";
    rows[1].received = "-2";
    const errors = validateReceive(rows, { receivedBy: "Sam" });
    expect(errors[0]).toBeTruthy();
    expect(errors[1]).toBeTruthy();
  });

  it("nothing at all received is a cancelled receipt, not a received one", () => {
    const rows = receiveRows(receipt).map((x) => ({ ...x, received: "0", shortReason: "Not sent" }));
    expect(validateReceive(rows, { receivedBy: "Sam" }).none).toMatch(/cancel/i);
  });

  it("the payload carries numbers, drops the reason on a full line and keeps batch and expiry", () => {
    const rows = receiveRows(receipt);
    rows[0].shortReason = "left over from a typo";
    rows[0].batchNumber = "B1";
    rows[0].expiryDate = "2027-03-01";
    const body = receivePayload(rows, { receivedBy: " Sam ", receivedAt: "2026-10-12", vendorDeliveryNo: "VD-5", proofNote: "" });
    expect(body).toMatchObject({ receivedBy: "Sam", receivedAt: "2026-10-12", vendorDeliveryNo: "VD-5" });
    expect(body.lines[0]).toEqual({ lineId: "l1", receivedQty: 10, shortReason: "", batchNumber: "B1", expiryDate: "2027-03-01" });
    expect(body.lines[1]).toMatchObject({ lineId: "l2", receivedQty: 3, shortReason: "Leaked" });
  });
});

describe("blank forms", () => {
  it("an order is for a customer or a vendor by its kind", () => {
    expect(newOrderForm("sales").partyType).toBe("Customer");
    expect(newOrderForm("purchase").partyType).toBe("Vendor");
    expect(newOrderForm("sales").transactionNo).toBe("");
  });
  it("a receipt is from a vendor and carries the delivery details", () => {
    const f = newReceiptForm();
    expect(f).toMatchObject({ partyType: "Vendor", vendorDeliveryNo: "", vehicleNo: "", driverName: "", items: [] });
    expect(f.date).toBeTruthy();
  });
});
