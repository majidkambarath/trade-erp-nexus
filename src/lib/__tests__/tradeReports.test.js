import { describe, it, expect } from "vitest";
import { monthLabel, monthOfRange, monthRange, movementExport, recentMonths, registerExport, summaryExport, VIEWS } from "../tradeReports";

describe("months", () => {
  it("names a month and gives its first and last day", () => {
    expect(monthLabel("2026-03")).toBe("Mar 2026");
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("lists the months back from today, across a year end", () => {
    expect(recentMonths("2026-02-10", 4)).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
  });

  it("knows when a range is exactly one month", () => {
    expect(monthOfRange("2026-03-01", "2026-03-31")).toBe("2026-03");
    expect(monthOfRange("2026-03-01", "2026-03-30")).toBe("");
    expect(monthOfRange("2026-03-01", "2026-04-30")).toBe("");
  });
});

describe("views", () => {
  it("name the party by direction", () => {
    expect(VIEWS("sales").map((v) => v.label)).toEqual(["By customer", "By item", "Customer \u00d7 item", "Line register"]);
    expect(VIEWS("purchases")[0].label).toBe("By vendor");
  });
});

describe("exports", () => {
  const data = {
    groupBy: "party_item", monthly: true, months: ["2026-02", "2026-03"], partyLabel: "Customer",
    rows: [{ partyName: "Al Noor", partyCode: "C1", vatStatus: "registered", itemName: "Rice", itemCode: "RICE", category: "Grain", documents: 2, quantity: 26, gross: 450, returns: 60, net: 390, vat: 0, total: 390, avgPrice: 15, sharePct: 33.6, firstDate: "2026-02-10T00:00:00.000Z", lastDate: "2026-03-28T00:00:00.000Z", monthly: { "2026-02": { quantity: 30, net: 450 }, "2026-03": { quantity: -4, net: -60 } } }],
  };

  it("puts a column per month on a summary export, in step with the headers", () => {
    const [headers, rows] = summaryExport(data, "Customer");
    expect(headers.slice(0, 6)).toEqual(["Customer", "Customer code", "VAT status", "Item", "Item code", "Category"]);
    expect(headers.slice(-4)).toEqual(["Feb 2026 qty", "Feb 2026 net", "Mar 2026 qty", "Mar 2026 net"]);
    expect(rows[0]).toHaveLength(headers.length);
    expect(rows[0].slice(-4)).toEqual([30, 450, -4, -60]);
    expect(rows[0][headers.indexOf("First date")]).toBe("2026-02-10");
  });

  it("exports the register and the movement with matching widths", () => {
    const [h1, r1] = registerExport({ partyLabel: "Customer", rows: [{ date: "2026-03-28T00:00:00.000Z", documentNo: "SR-1", kind: "return", partyName: "Al Noor", itemName: "Rice", itemCode: "RICE", category: "Grain", reference: "", quantity: -4, price: 15, net: -60, vat: 0, total: -60 }] });
    expect(r1[0]).toHaveLength(h1.length);
    expect(r1[0][2]).toBe("Return");
    const [h2, r2] = movementExport({ type: "vendor", rows: [{ partyName: "Gulf Mill", partyCode: "V1", vatStatus: "registered", trn: "1", paymentTerms: "Net 30", opening: 0, invoiced: 100, returns: 0, settled: 40, other: 0, closing: 60, overdue: 0 }] }, "Vendor");
    expect(r2[0]).toHaveLength(h2.length);
    expect(h2).toContain("Paid");
  });
});
