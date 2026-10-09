import { describe, it, expect } from "vitest";
import { busiestDay, cellOf, dailySummaryCsv, dayEndCsv, registerCsv, shiftDay } from "../dayReports";

// The small things around the daily voucher summary and the day-end cash and bank report: stepping between days,
// which day was busiest, and what each report looks like as a CSV. The sums themselves are the server's.

describe("stepping from one day to the next", () => {
  it("moves by whole days across month, year and leap-day boundaries, on the text of the day", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-10-09", -13)).toBe("2026-09-26");
    expect(shiftDay("2026-10-09", 0)).toBe("2026-10-09");
  });

  it("hands back what is not a day, unchanged", () => {
    expect(shiftDay("", 1)).toBe("");
    expect(shiftDay(undefined, 1)).toBe(undefined);
    expect(shiftDay("tomorrow", 1)).toBe("tomorrow");
  });
});

describe("the daily summary", () => {
  const DAYS = [
    { day: "2026-10-09", count: 3, unbalanced: 0, byType: { sales_order: { count: 2, amount: 1500 }, receipt: { count: 1, amount: 300 } } },
    { day: "2026-10-08", count: 3, unbalanced: 1, byType: { receipt: { count: 3, amount: 100 } } },
    { day: "2026-10-07", count: 1, unbalanced: 0, byType: { payment: { count: 1, amount: 50 } } },
  ];

  it("reads one kind on one day, or nothing", () => {
    expect(cellOf(DAYS[0], "sales_order")).toEqual({ count: 2, amount: 1500 });
    expect(cellOf(DAYS[0], "payment")).toBeNull();
    expect(cellOf(undefined, "receipt")).toBeNull();
    expect(cellOf({}, "receipt")).toBeNull();
  });

  it("finds the busiest day, the later one when two are level, and none in an empty period", () => {
    expect(busiestDay(DAYS).day).toBe("2026-10-09");
    expect(busiestDay([DAYS[2], DAYS[1]]).day).toBe("2026-10-08");
    expect(busiestDay([])).toBeNull();
    expect(busiestDay(undefined)).toBeNull();
  });

  it("is a CSV with a count and an amount for each kind, the days, and a total row", () => {
    const summary = {
      types: [{ voucherType: "sales_order", label: "Sales invoice" }, { voucherType: "receipt", label: "Receipt" }],
      days: DAYS.slice(0, 2),
      totals: { count: 6, unbalanced: 1, byType: { sales_order: { count: 2, amount: 1500 }, receipt: { count: 4, amount: 400 } } },
    };
    const { headers, rows } = dailySummaryCsv(summary, (d) => `<${d}>`);
    expect(headers).toEqual(["Date", "Vouchers", "Out of balance", "Sales invoice (count)", "Sales invoice (amount)", "Receipt (count)", "Receipt (amount)"]);
    expect(rows).toEqual([
      ["<2026-10-09>", 3, 0, 2, 1500, 1, 300],
      ["<2026-10-08>", 3, 1, "", "", 3, 100], // a kind that did not happen that day is empty, not zero
      ["Total", 6, 1, 2, 1500, 4, 400],
    ]);
    for (const r of rows) expect(r).toHaveLength(headers.length);
  });

  it("copes with an empty summary", () => {
    expect(dailySummaryCsv({ types: [], days: [], totals: { count: 0, unbalanced: 0, byType: {} } }).rows).toEqual([["Total", 0, 0]]);
    expect(dailySummaryCsv(undefined)).toEqual({ headers: ["Date", "Vouchers", "Out of balance"], rows: [] });
  });
});

describe("the day-end report as a CSV", () => {
  const REPORT = {
    accounts: [
      { accountCode: "CASH0001", accountName: "Cash in Hand", kind: "cash", opening: 5000, receipts: 100, payments: 1300, closing: 3800, vouchers: 3 },
      { accountCode: "BANK0001", accountName: "ENBD Current", kind: "bank", opening: 0, receipts: 1000, payments: 0, closing: 1000, vouchers: 1 },
    ],
    totals: {
      cash: { opening: 5000, receipts: 100, payments: 1300, closing: 3800 },
      bank: { opening: 0, receipts: 1000, payments: 0, closing: 1000 },
      all: { opening: 5000, receipts: 1100, payments: 1300, closing: 4800 },
    },
  };

  it("lists each account and then cash, bank and the whole", () => {
    const { headers, rows } = dayEndCsv(REPORT);
    expect(headers).toEqual(["Code", "Account", "Type", "Opening", "Receipts", "Payments", "Closing", "Vouchers"]);
    expect(rows[0]).toEqual(["CASH0001", "Cash in Hand", "Cash", 5000, 100, 1300, 3800, 3]);
    expect(rows[1]).toEqual(["BANK0001", "ENBD Current", "Bank", 0, 1000, 0, 1000, 1]);
    expect(rows.slice(2).map((r) => r[1])).toEqual(["Total cash", "Total bank", "Total cash and bank"]);
    expect(rows.at(-1)).toEqual(["", "Total cash and bank", "", 5000, 1100, 1300, 4800, ""]);
  });

  it("copes with nothing", () => {
    expect(dayEndCsv(undefined).rows).toEqual([]);
  });
});

describe("the day-by-day register as a CSV", () => {
  const REGISTER = {
    opening: { cash: 5000, bank: 0, all: 5000 },
    days: [
      { day: "2026-10-08", cash: { in: 100, out: 1300, closing: 3800 }, bank: { in: 1000, out: 0, closing: 1000 }, closing: 4800 },
      { day: "2026-10-09", cash: { in: 100, out: 210, closing: 3690 }, bank: { in: 0, out: 100, closing: 900 }, closing: 4590 },
    ],
  };

  it("starts with what was brought forward, then each day", () => {
    const { headers, rows } = registerCsv(REGISTER, (d) => `<${d}>`);
    expect(headers).toEqual(["Day", "Cash in", "Cash out", "Cash closing", "Bank in", "Bank out", "Bank closing", "Total closing"]);
    expect(rows[0]).toEqual(["Brought forward", "", "", 5000, "", "", 0, 5000]);
    expect(rows[1]).toEqual(["<2026-10-08>", 100, 1300, 3800, 1000, 0, 1000, 4800]);
    expect(rows).toHaveLength(3);
  });

  it("copes with nothing", () => {
    expect(registerCsv(undefined).rows).toEqual([]);
  });
});
