import { describe, it, expect } from "vitest";
import { dueText, periodLabel, maturityCsv, forecastRows, forecastCsv, forecastNotes, GROUPINGS, PERIOD_CHOICES } from "../chequeReports";

const slot = (r = 0, p = 0, h = 0) => ({ receipts: { amount: r, count: r ? 1 : 0 }, payments: { amount: p, count: p ? 1 : 0 }, onHold: { amount: h, count: h ? 1 : 0 }, net: r - p });
const forward = (over = {}) => ({
  openingKnown: true, opening: 1000, due: slot(240, 0), afterDue: 1240,
  periods: [{ key: "2026-10-26", label: "26 Oct - 1 Nov", from: "2026-10-26", to: "2026-11-01", ...slot(500, 0, 70), closing: 1740 }, { key: "2026-11-02", label: "2 Nov - 8 Nov", from: "2026-11-02", to: "2026-11-08", ...slot(0, 300), closing: 1440 }],
  later: slot(25), totals: { receipts: 765, payments: 300, onHold: 70, closing: 1465 }, ...over,
});

describe("the cheque reports' words and rows", () => {
  it("says how far away a cheque is", () => {
    expect([0, 1, 3, -1, -5].map(dueText)).toEqual(["today", "in 1 day", "in 3 days", "1 day overdue", "5 days overdue"]);
  });

  it("offers the four groupings and the forecast windows", () => {
    expect(GROUPINGS.map(([v]) => v)).toEqual(["bucket", "party", "bank", "month"]);
    expect(PERIOD_CHOICES.map(periodLabel)).toEqual(["4 weeks", "8 weeks", "12 weeks", "26 weeks", "3 months", "6 months", "12 months"]);
  });

  it("makes one CSV row per cheque, in the order the server gave, in words a spreadsheet reader can use", () => {
    const { headers, rows } = maturityCsv({ rows: [
      { chequeNo: "1001", direction: "receipt", partyName: "Al Noor", chequeDay: "2026-10-29", days: 3, status: "pending", amount: 500, voucherNo: "RV-1", bankName: "ENBD" },
      { chequeNo: "2002", direction: "payment", partyName: "Gulf Mills", chequeDay: "2026-11-05", days: 10, status: "deposited", amount: 300, voucherNo: "PV-1", bankName: "ENBD" },
    ] });
    expect(headers).toHaveLength(9);
    expect(rows[0]).toEqual(["1001", "We hold", "Al Noor", "2026-10-29", 3, "Pending", 500, "RV-1", "ENBD"]);
    expect(rows[1].slice(1, 6)).toEqual(["We issued", "Gulf Mills", "2026-11-05", 10, "At the bank"]);
    expect(maturityCsv(null).rows).toEqual([]);
  });

  it("flattens the forecast: already due, each period, then beyond - with the running balance", () => {
    const rows = forecastRows(forward());
    expect(rows.map((r) => r.label)).toEqual(["Already due", "26 Oct - 1 Nov", "2 Nov - 8 Nov", "Beyond this window"]);
    expect(rows.map((r) => r.closing)).toEqual([1240, 1740, 1440, 1465]);
    expect(rows[1]).toMatchObject({ receipts: 500, payments: 0, onHold: 70, net: 500 });
    expect(forecastRows(null)).toEqual([]);
  });

  it("leaves the balance column empty when the opening balance is not known, rather than a misleading number", () => {
    const known = forecastCsv(forward());
    expect(known.rows[1][5]).toBe(1740);
    const unknown = forecastCsv(forward({ openingKnown: false }));
    expect(unknown.rows.every((r) => r[5] === "")).toBe(true);
  });

  it("states the assumptions above the forecast, and warns when the figures are partial or have no opening balance", () => {
    expect(forecastNotes(forward())).toHaveLength(2);
    expect(forecastNotes(forward()).join(" ")).toMatch(/on hold.*not in it/);
    expect(forecastNotes(forward({ openingKnown: false }))[0]).toMatch(/whole organisation's/);
    expect(forecastNotes(forward({ capped: true })).join(" ")).toMatch(/partial/);
    expect(forecastNotes(null)).toEqual([]);
  });
});
