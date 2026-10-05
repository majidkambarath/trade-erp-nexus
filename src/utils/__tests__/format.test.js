import { describe, it, expect, vi, afterEach } from "vitest";
import {
  LOCALE,
  formatNumber,
  formatCurrencyAED,
  formatCurrencyCompact,
  formatQty,
  formatPercent,
  formatDateGB,
  formatDate,
  formatTime,
  formatDateTime,
  parseDate,
  setDateFormat,
  setTimeFormat,
  getDateFormat,
  toInputDate,
  todayInput,
  stampYMD,
  decimalAdd,
  decimalSub,
  decimalSum,
  decimalRound,
  lineTotals,
  weightedVatPercent,
  numberToWords,
  amountInWords,
} from "../format";

afterEach(() => {
  vi.useRealTimers();
});

describe("number grouping — international standard, never Indian", () => {
  it("groups in threes", () => {
    expect(formatNumber(100000)).toBe("100,000.00");
    expect(formatNumber(1234567.5)).toBe("1,234,567.50");
    expect(formatNumber(1000000000)).toBe("1,000,000,000.00");
  });

  // The whole point of the pinned locale: en-IN would render 12,34,567.50.
  it("does not use lakh/crore grouping", () => {
    expect(formatNumber(1234567.5)).not.toContain("12,34");
    expect(formatCurrencyAED(1234567.5)).not.toContain("12,34");
  });

  it("pins the locale rather than inheriting the browser's", () => {
    expect(LOCALE).toBe("en-GB");
    const indian = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234567.5);
    expect(indian).toBe("12,34,567.50");
    expect(formatNumber(1234567.5)).not.toBe(indian);
  });

  it("always shows exactly two decimals for money", () => {
    expect(formatNumber(1200)).toBe("1,200.00");
    expect(formatNumber(1200.5)).toBe("1,200.50");
    expect(formatNumber(0)).toBe("0.00");
  });

  it("coerces null/undefined/NaN to zero", () => {
    expect(formatNumber(null)).toBe("0.00");
    expect(formatNumber(undefined)).toBe("0.00");
    expect(formatNumber("")).toBe("0.00");
  });
});

describe("currency", () => {
  it("renders the AED code with grouped amount", () => {
    expect(formatCurrencyAED(1234567.5)).toContain("1,234,567.50");
    expect(formatCurrencyAED(1234567.5)).toContain("AED");
  });

  it("uses one compact convention (K/M/B, never mixed casing)", () => {
    expect(formatCurrencyCompact(2460000)).toBe("AED 2.46M");
    expect(formatCurrencyCompact(195000)).toBe("AED 195.0K");
    expect(formatCurrencyCompact(2900)).toBe("AED 2.9K");
    expect(formatCurrencyCompact(-2460000)).toBe("-AED 2.46M");
    expect(formatCurrencyCompact(999)).toContain("999.00");
  });
});

describe("quantities and percentages", () => {
  it("omits trailing zeros for whole quantities but still groups", () => {
    expect(formatQty(12)).toBe("12");
    expect(formatQty(12.5)).toBe("12.50");
    expect(formatQty(10000)).toBe("10,000");
  });

  it("formats percentages", () => {
    expect(formatPercent(5)).toBe("5.00%");
  });
});

describe("dates are Dubai-local, not UTC", () => {
  it("formats display dates as DD/MM/YYYY", () => {
    expect(formatDateGB("2026-03-09T10:00:00Z")).toBe("09/03/2026");
  });

  // The bug this replaces: toISOString() is UTC, so between 00:00 and 04:00 Dubai
  // time it returned yesterday and backdated vouchers.
  it("returns tomorrow's Dubai date when UTC is still on the previous day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T23:30:00Z")); // 03:30 on the 10th in Dubai
    expect(new Date().toISOString().split("T")[0]).toBe("2026-03-09"); // the old way
    expect(todayInput()).toBe("2026-03-10"); // the correct way
  });

  it("agrees with UTC during Dubai daytime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T09:00:00Z")); // 13:00 in Dubai
    expect(todayInput()).toBe("2026-03-09");
  });

  it("formats an explicit date for date inputs", () => {
    expect(toInputDate("2026-07-01T20:00:00Z")).toBe("2026-07-02");
    expect(toInputDate("not a date")).toBe("");
  });

  it("stamps document numbers as YYYYMMDD", () => {
    expect(stampYMD("2026-07-01T06:00:00Z")).toBe("20260701");
  });
});

describe("dates and times follow the person's setting", () => {
  const moment = "2026-10-04T10:05:09Z"; // 14:05:09 in Dubai
  afterEach(() => { setDateFormat("DD/MM/YYYY"); setTimeFormat("24h"); });

  it("reads DD/MM/YYYY until a person chooses otherwise, and formatDateGB is the same thing", () => {
    expect(getDateFormat()).toBe("DD/MM/YYYY");
    expect(formatDate(moment)).toBe("04/10/2026");
    expect(formatDateGB(moment)).toBe("04/10/2026");
  });

  it("offers each format", () => {
    expect(formatDate(moment, "MM/DD/YYYY")).toBe("10/04/2026");
    expect(formatDate(moment, "YYYY-MM-DD")).toBe("2026-10-04");
    expect(formatDate(moment, "DD-MM-YYYY")).toBe("04-10-2026");
    expect(formatDate(moment, "DD MMM YYYY")).toBe("04 Oct 2026");
  });

  it("uses the chosen format everywhere once set, and ignores a value it does not know", () => {
    setDateFormat("YYYY-MM-DD");
    expect(formatDate(moment)).toBe("2026-10-04");
    expect(formatDateGB(moment)).toBe("2026-10-04");
    setDateFormat("not-a-format");
    expect(getDateFormat()).toBe("YYYY-MM-DD");
  });

  it("shows the Dubai calendar day, not the UTC one", () => {
    expect(formatDate("2026-03-08T21:30:00Z")).toBe("09/03/2026"); // already the 9th in Dubai
  });

  it("formats times in 24-hour or 12-hour form, in Dubai time", () => {
    expect(formatTime(moment)).toBe("14:05:09");
    setTimeFormat("12h");
    expect(formatTime(moment)).toMatch(/^0?2:05:09 pm$/i);
    expect(formatDateTime(moment)).toMatch(/^04\/10\/2026 0?2:05 pm$/i);
    setTimeFormat("24h");
    expect(formatDateTime(moment)).toBe("04/10/2026 14:05");
  });

  it("is empty, not 'Invalid Date', for a missing or unreadable date", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("garbage")).toBe("");
    expect(formatTime(undefined)).toBe("");
    expect(formatDateTime("")).toBe("");
  });
});

describe("reading a typed date", () => {
  it("understands the chosen format, with any of / - . between the parts", () => {
    expect(parseDate("04/10/2026", "DD/MM/YYYY")).toBe("2026-10-04");
    expect(parseDate("4-10-2026", "DD-MM-YYYY")).toBe("2026-10-04");
    expect(parseDate("04.10.2026", "DD/MM/YYYY")).toBe("2026-10-04");
    expect(parseDate("10/04/2026", "MM/DD/YYYY")).toBe("2026-10-04");
    expect(parseDate("04 Oct 2026", "DD MMM YYYY")).toBe("2026-10-04");
    expect(parseDate("4 october 2026", "DD MMM YYYY")).toBe("2026-10-04");
  });
  it("always accepts an ISO date", () => {
    expect(parseDate("2026-10-04", "DD/MM/YYYY")).toBe("2026-10-04");
    expect(parseDate("2026-1-5", "MM/DD/YYYY")).toBe("2026-01-05");
  });
  it("refuses what is not a real date", () => {
    for (const bad of ["", "31/02/2026", "32/01/2026", "00/10/2026", "04/13/2026", "04/10/26", "hello", "04/10", "2026-13-01"]) {
      expect(parseDate(bad, "DD/MM/YYYY")).toBeNull();
    }
    expect(parseDate("29/02/2024", "DD/MM/YYYY")).toBe("2024-02-29"); // a leap year
    expect(parseDate("29/02/2026", "DD/MM/YYYY")).toBeNull();
  });
});

describe("decimal-safe money arithmetic", () => {
  it("avoids float drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // why these helpers exist
    expect(decimalAdd(0.1, 0.2)).toBe(0.3);
    expect(decimalSub(0.3, 0.1)).toBe(0.2);
    expect(decimalSum([0.1, 0.2, 0.3])).toBe(0.6);
  });

  it("rounds to 2dp by default", () => {
    expect(decimalRound(1234.5600000000002)).toBe(1234.56);
  });
});

describe("lineTotals matches the backend contract", () => {
  // Mirrors calculateItems() in
  // trade ERP node/services/orderPurchase/transactionService.js
  const backend = (qty, unitPrice, vatPct) => {
    const lineValue = qty * unitPrice;
    const vatAmount = (lineValue * vatPct) / 100;
    return {
      vatAmount: +vatAmount.toFixed(2),
      lineTotal: +(lineValue + vatAmount).toFixed(2),
    };
  };

  it.each([
    [10, 12.5, 5],
    [3, 99.99, 5],
    [1, 0, 5],
    [7, 33.33, 0],
    [120, 8.75, 5],
  ])("qty=%s price=%s vat=%s%%", (qty, price, vatPercent) => {
    const got = lineTotals({ qty, price, vatPercent });
    const want = backend(qty, price, vatPercent);
    expect(got.vatAmount).toBeCloseTo(want.vatAmount, 2);
    expect(got.lineTotal).toBeCloseTo(want.lineTotal, 2);
  });

  it("treats lineTotal as VAT-inclusive", () => {
    const { lineValue, vatAmount, lineTotal } = lineTotals({
      qty: 10,
      price: 100,
      vatPercent: 5,
    });
    expect(lineValue).toBe(1000);
    expect(vatAmount).toBe(50);
    expect(lineTotal).toBe(1050);
  });

  it("falls back from price to rate", () => {
    expect(lineTotals({ qty: 2, rate: 10, vatPercent: 0 }).lineTotal).toBe(20);
  });
});

describe("weightedVatPercent", () => {
  // A plain mean of per-line percentages reports 2.5% for a 0%/5% mix, which is wrong.
  it("weights by line value instead of averaging percentages", () => {
    const items = [
      { lineValue: 1000, vatAmount: 50 }, // 5%
      { lineValue: 1000, vatAmount: 0 }, // 0%
    ];
    expect(weightedVatPercent(items)).toBe(2.5); // equal bases: mean happens to match

    const skewed = [
      { lineValue: 9000, vatAmount: 450 }, // 5%
      { lineValue: 1000, vatAmount: 0 }, // 0%
    ];
    expect(weightedVatPercent(skewed)).toBe(4.5); // a plain mean would say 2.5
  });

  it("returns 0 with no taxable base", () => {
    expect(weightedVatPercent([])).toBe(0);
    expect(weightedVatPercent([{ lineValue: 0, vatAmount: 0 }])).toBe(0);
  });
});

describe("amount in words", () => {
  // The previous per-file implementation only handled 0-999.
  it("handles the values that used to break", () => {
    expect(numberToWords(999)).toBe("Nine Hundred Ninety Nine");
    expect(numberToWords(1000)).toBe("One Thousand");
    expect(numberToWords(1234)).toBe("One Thousand Two Hundred Thirty Four");
    expect(numberToWords(2000)).toBe("Two Thousand");
    expect(numberToWords(1000000)).toBe("One Million");
  });

  it("never emits 'undefined' or 'Twelve Hundred'", () => {
    for (const n of [1234, 1999, 2000, 25000, 1234567]) {
      const w = numberToWords(n);
      expect(w).not.toContain("undefined");
      expect(w).not.toMatch(/^(Ten|Eleven|Twelve|Thirteen|Nineteen) Hundred/);
    }
  });

  it("renders zero and fils", () => {
    expect(numberToWords(0)).toBe("Zero");
    expect(amountInWords(0)).toBe("Zero Dirhams Only");
    expect(amountInWords(1234.5)).toBe(
      "One Thousand Two Hundred Thirty Four Dirhams and Fifty Fils Only"
    );
    expect(amountInWords(100)).toBe("One Hundred Dirhams Only");
  });
});
