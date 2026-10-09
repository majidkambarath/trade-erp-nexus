import { describe, it, expect } from "vitest";
import { acknowledged, canConfirm, closedNote, closedToast, money, outstanding, profitWords } from "../yearEnd";

// What the year-end screen says around the server's checks: when the button may be pressed and how a year reads.

describe("saying an amount", () => {
  it("is in the organisation's currency, with two places, and never negative (the word says which way)", () => {
    expect(money(1234.5, "AED")).toBe("AED 1,234.50");
    expect(money(-50, "AED")).toBe("AED 50.00");
    expect(money("12.345", "AED")).toBe("AED 12.35");
    expect(money(undefined, "AED")).toBe("AED 0.00");
  });

  it("calls a profit a profit, a loss a loss and nothing nothing", () => {
    expect(profitWords(500, "AED")).toBe("Profit of AED 500.00");
    expect(profitWords(-50.4, "AED")).toBe("Loss of AED 50.40");
    expect(profitWords(0, "AED")).toBe("No profit or loss");
    expect(profitWords(0.004, "AED")).toBe("No profit or loss");
  });
});

describe("when the year may be closed", () => {
  const warning = (code) => ({ code, level: "warning", title: code });
  const clean = { canClose: true, warnings: [] };

  it("needs a preview that has no blocker", () => {
    expect(canConfirm(null, [])).toBe(false);
    expect(canConfirm(undefined, [])).toBe(false);
    expect(canConfirm({ canClose: false, warnings: [] }, [])).toBe(false);
    expect(canConfirm({ canClose: false, warnings: [warning("A")] }, ["A"])).toBe(false);
    expect(canConfirm(clean, [])).toBe(true);
    expect(canConfirm(clean, new Set())).toBe(true);
  });

  it("needs every warning ticked by name, not just any tick", () => {
    const p = { canClose: true, warnings: [warning("YEAR_NOT_ENDED"), warning("BANK_NOT_RECONCILED")] };
    expect(canConfirm(p, [])).toBe(false);
    expect(canConfirm(p, ["YEAR_NOT_ENDED"])).toBe(false);
    expect(canConfirm(p, new Set(["YEAR_NOT_ENDED", "SOMETHING_ELSE"]))).toBe(false);
    expect(canConfirm(p, new Set(["YEAR_NOT_ENDED", "BANK_NOT_RECONCILED"]))).toBe(true);
    expect(outstanding(p, ["YEAR_NOT_ENDED"]).map((w) => w.code)).toEqual(["BANK_NOT_RECONCILED"]);
    expect(outstanding(undefined, [])).toEqual([]);
  });

  it("sends the ticked codes in a steady order", () => {
    expect(acknowledged(new Set(["B", "A"]))).toEqual(["A", "B"]);
    expect(acknowledged(undefined)).toEqual([]);
  });
});

describe("how a year says it was closed", () => {
  it("says nothing for an open year", () => {
    expect(closedNote({ status: "open" })).toBe("");
    expect(closedNote(undefined)).toBe("");
  });

  it("names the profit and the entry that moved it", () => {
    const year = { status: "closed", closing: { posted: true, profit: 500, voucherNo: "YEC-2026-0001", retainedAccountName: "Retained Earnings" } };
    expect(closedNote(year, "AED")).toBe("Profit of AED 500.00 moved to Retained Earnings (YEC-2026-0001)");
    expect(closedNote({ status: "closed", closing: { ...year.closing, profit: -20 } }, "AED")).toMatch(/^Loss of AED 20.00 moved/);
  });

  it("says plainly when a year was only ever locked", () => {
    expect(closedNote({ status: "closed" }, "AED")).toMatch(/Locked only.*never reached Retained Earnings.*close it again/);
    expect(closedNote({ status: "closed", closing: { posted: false } }, "AED")).toBe("Closed. There was nothing to carry over.");
  });

  it("words the toast after closing", () => {
    expect(closedToast("2026", { posted: true, profit: 500, retainedAccountName: "Retained Earnings" }, "AED")).toBe("2026 closed. Profit of AED 500.00 moved to Retained Earnings.");
    expect(closedToast("2026", { posted: false })).toBe("2026 closed");
    expect(closedToast("2026", undefined)).toBe("2026 closed");
  });
});
