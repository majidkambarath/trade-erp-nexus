import { describe, it, expect } from "vitest";
import {
  cashPlan, countDifference, countRows, isCreditWarning, loadBody, loadProblem, nextStep, saleLines, saleProblem, saleSubtotal,
  statusOf, unloadBody, vanErrorText, vanItems,
} from "../vanSales";
import { slipKind, vanReceiptMarkup } from "../vanReceipt";
import { VISIT_REASONS, priceListBody, priceSourceLabel, strikeText, visitReasonLabel } from "../vanSales";

const trip = {
  status: "ON_ROUTE",
  sellable: [{ stockId: "rice", itemName: "Rice 5kg", qty: 30, salesPrice: 20 }, { stockId: "oil", itemName: "Oil", qty: 16, salesPrice: 30 }],
  damaged: [{ stockId: "rice", itemName: "Rice 5kg", qty: 1 }],
};

describe("what a trip is waiting for", () => {
  it("names the next step in plain words, and knows every status", () => {
    expect(nextStep({ status: "LOADING", loads: [] })).toBe("Load the van");
    expect(nextStep({ status: "LOADING", loads: [{}] })).toBe("Send the van out");
    expect(nextStep({ status: "UNLOADED" })).toBe("Settle the day");
    expect(statusOf("ON_ROUTE").label).toBe("On the road");
    expect(statusOf("MADE_UP").label).toBe("MADE_UP");
  });
});

describe("the load form", () => {
  it("sends only complete lines", () => {
    expect(loadBody([{ stockId: "a", qty: "5" }, { stockId: "", qty: "3" }, { stockId: "b", qty: "0" }])).toEqual({ lines: [{ stockId: "a", qty: 5 }] });
  });
  it("says what is wrong before the server has to", () => {
    expect(loadProblem([{ stockId: "", qty: "" }])).toMatch(/at least one item/);
    expect(loadProblem([{ stockId: "a", qty: "" }])).toMatch(/quantity above zero/);
    expect(loadProblem([{ stockId: "", qty: "2" }])).toMatch(/Choose an item/);
    expect(loadProblem([{ stockId: "a", qty: "1" }, { stockId: "a", qty: "2" }])).toMatch(/two lines/);
    expect(loadProblem([{ stockId: "a", qty: "1" }])).toBe("");
  });
});

describe("selling from the van", () => {
  it("prices a line at the van's list price unless a price is typed", () => {
    const lines = saleLines([{ itemId: "rice", qty: "10", price: "" }, { itemId: "oil", qty: "2", price: "28" }, { itemId: "", qty: "5" }], trip.sellable);
    expect(lines).toEqual([{ itemId: "rice", qty: 10, price: 20 }, { itemId: "oil", qty: 2, price: 28 }]);
    expect(saleSubtotal(lines)).toBe(256);
  });
  it("refuses more than is on the van, summed across lines of one item, and names the item", () => {
    const ok = saleProblem({ customerId: "c", rows: [{ itemId: "rice", qty: "30" }] }, trip.sellable);
    expect(ok).toBe("");
    expect(saleProblem({ customerId: "c", rows: [{ itemId: "rice", qty: "20" }, { itemId: "rice", qty: "11" }] }, trip.sellable)).toBe("Only 30 of Rice 5kg is on the van.");
  });
  it("wants a customer and a line", () => {
    expect(saleProblem({ customerId: "", rows: [{ itemId: "rice", qty: "1" }] }, trip.sellable)).toMatch(/customer/);
    expect(saleProblem({ customerId: "c", rows: [{ itemId: "", qty: "" }] }, trip.sellable)).toMatch(/at least one item/);
  });
  it("offers what is on the van, with how many", () => {
    expect(vanItems(trip)[0]).toMatchObject({ value: "rice", label: "Rice 5kg (30 on van)", price: 20 });
  });
});

describe("counting the van back in", () => {
  it("starts from what should be there and reads a difference the way the server does", () => {
    const rows = countRows(trip);
    const rice = rows.find((r) => r.stockId === "rice");
    expect(rice).toMatchObject({ expectedGood: 30, expectedDamaged: 1, good: "30", damaged: "1" });
    expect(countDifference(rice)).toBe(0);
    expect(countDifference({ ...rice, good: "29" })).toBe(-1);
    expect(countDifference({ ...rice, good: "31", damaged: "0" })).toBe(0); // a damaged unit is still a unit
    expect(unloadBody([{ ...rice, good: "29" }]).counts[0]).toEqual({ stockId: "rice", good: 29, damaged: 1 });
  });
});

describe("the cash at settlement", () => {
  it("is short, over or even, and always balances", () => {
    expect(cashPlan(210, 200)).toMatchObject({ short: 10, over: 0, variance: -10 });
    expect(cashPlan(210, 230)).toMatchObject({ short: 0, over: 20, variance: 20 });
    expect(cashPlan(210, 210)).toMatchObject({ short: 0, over: 0, variance: 0 });
  });
});

describe("what a refusal says", () => {
  it("uses the server's numbers for a van stock shortage and a plain sentence for the rest", () => {
    expect(vanErrorText({ code: "VAN_STOCK_SHORT", details: { short: [{ available: 4, wanted: 6 }] } })).toBe("Only 4 of that is on the van; this sells 6.");
    expect(vanErrorText({ code: "TRIP_NOT_SELLING" })).toMatch(/not out on the road/);
    expect(vanErrorText({ code: "SOMETHING_ELSE", message: "the server said so" })).toBe("the server said so");
    expect(vanErrorText(null)).toBe("");
    expect(isCreditWarning({ code: "RISK_WARNING_ACKNOWLEDGEMENT_REQUIRED" })).toBe(true);
  });
});

describe("which slip a sale needs", () => {
  it("is simplified in the UAE unless a registered buyer takes more than AED 10,000; elsewhere a tax invoice is always full", () => {
    expect(slipKind({ taxInvoice: false })).toBe("invoice");
    expect(slipKind({ taxInvoice: true, customerTrn: "", total: 50000 })).toBe("simplified");
    expect(slipKind({ taxInvoice: true, customerTrn: "100123456700003", total: 10000 })).toBe("simplified");
    expect(slipKind({ taxInvoice: true, customerTrn: "100123456700003", total: 10000.01 })).toBe("full");
    expect(slipKind({ taxInvoice: true, uae: false, total: 5 })).toBe("full");
  });
  it("a full one shows the tax on each line", () => {
    const invoice = { transactionNo: "SO-1", totalAmount: 21000, items: [{ description: "Rice", qty: 1000, price: 20, vatPercent: 5, vatAmount: 1000, lineTotal: 21000 }] };
    expect(vanReceiptMarkup({ company: {}, invoice, customerName: "x", customerTrn: "100", taxInvoice: true })).toContain("VAT 5% 1,000.00");
    expect(vanReceiptMarkup({ company: {}, invoice, customerName: "x", customerTrn: "", taxInvoice: true })).not.toContain("VAT 5%");
  });
});

describe("phase 2 words and forms", () => {
  it("names the reasons, the price's source and the strike rate", () => {
    expect(VISIT_REASONS.map(([k]) => k)).toEqual(["closed", "no_money", "has_stock", "refused", "not_reached", "other"]);
    expect(visitReasonLabel("has_stock")).toBe("Still has stock");
    expect(priceSourceLabel({ source: "customer", listName: "Al Noor deal" })).toBe("Al Noor deal");
    expect(priceSourceLabel({ source: "item" })).toBe("List price");
    expect(strikeText(66.7)).toBe("66.7%");
    expect(strikeText(null)).toBe("–");
  });
  it("a price list form sends complete lines and the customers' ids", () => {
    const body = priceListBody({ name: " Deal ", customers: [{ id: "c1" }], lines: [{ stockId: "a", price: "17", minQty: "" }, { stockId: "", price: "1", minQty: "1" }, { stockId: "b", price: "", minQty: "1" }] });
    expect(body).toEqual({ name: "Deal", validFrom: "", validTo: "", customerIds: ["c1"], lines: [{ stockId: "a", price: 17, minQty: 1 }] });
  });
});

describe("the slip printed on the road", () => {
  const invoice = {
    transactionNo: "SO-2026-0001", date: "2026-11-17T00:00:00.000Z", totalAmount: 210,
    items: [{ description: "Rice <5kg>", qty: 10, price: 20, vatAmount: 10, lineTotal: 210 }],
  };
  it("says tax invoice or invoice by the seller's registration, with the customer, the lines and the balance", () => {
    const html = vanReceiptMarkup({ company: { companyName: "Gulf Foods", vatNumber: "100123456700003" }, invoice, customerName: "Al Noor", customerTrn: "100999", tripNo: "VTR-1", paid: 100, taxInvoice: true });
    expect(html).toContain("TAX INVOICE");
    expect(html).toContain("Gulf Foods");
    expect(html).toContain("SO-2026-0001");
    expect(html).toContain("Al Noor");
    expect(html).toContain("210.00");
    expect(html).toContain("Balance due");
    expect(html).toContain("110.00");
    expect(vanReceiptMarkup({ company: {}, invoice, customerName: "x", taxInvoice: false })).toContain(">INVOICE<");
  });
  it("escapes what a person typed", () => {
    const html = vanReceiptMarkup({ company: { companyName: "<script>alert(1)</script>" }, invoice, customerName: "x" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("Rice &lt;5kg&gt;");
  });
  it("prints no balance line for a credit sale's nothing-received case beyond the total", () => {
    const html = vanReceiptMarkup({ company: {}, invoice, customerName: "x", paid: 0 });
    expect(html).not.toContain("Balance due");
  });
});
