import { describe, it, expect } from "vitest";
import { DEFAULT_LIST_PERIOD, LIST_PERIODS, compareCount, inPeriod, previousPeriod, resolveListPeriod, widerChoices } from "../listPeriod";
import { addDays, addMonths, daysBetween, isDay, lastDayOf, monthName, quarterOf, weekStart } from "../calendarDays";

// The period a document list shows: it opens on the CALENDAR month and every boundary is pinned here without a clock.

const TODAY = "2026-10-10"; // Saturday

describe("the default is this calendar month", () => {
  it("is the 1st to the last day of the month, not the last 30 days and not 'to today'", () => {
    expect(DEFAULT_LIST_PERIOD).toBe("month");
    const p = resolveListPeriod({}, TODAY);
    expect(p).toMatchObject({ ok: true, preset: "month", from: "2026-10-01", to: "2026-10-31", label: "This month", name: "October 2026", all: false });
  });

  it("follows the month's own length: February in a leap year and a 30-day month", () => {
    expect(resolveListPeriod({}, "2024-02-10")).toMatchObject({ from: "2024-02-01", to: "2024-02-29" });
    expect(resolveListPeriod({}, "2026-02-10")).toMatchObject({ to: "2026-02-28" });
    expect(resolveListPeriod({}, "2026-09-30")).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("on the first and the last day of the month it is still that month", () => {
    expect(resolveListPeriod({}, "2026-10-01")).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolveListPeriod({}, "2026-10-31")).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("offers this month first among the calendar choices and all time last", () => {
    const values = LIST_PERIODS.map((p) => p.value);
    expect(values).toEqual(expect.arrayContaining(["month", "lastMonth", "quarter", "year", "custom", "all"]));
    expect(values[values.length - 1]).toBe("all");
  });
});

describe("the other choices", () => {
  it("last month crosses the year boundary", () => {
    expect(resolveListPeriod({ preset: "lastMonth" }, TODAY)).toMatchObject({ from: "2026-09-01", to: "2026-09-30", name: "September 2026" });
    expect(resolveListPeriod({ preset: "lastMonth" }, "2026-01-15")).toMatchObject({ from: "2025-12-01", to: "2025-12-31", name: "December 2025" });
  });

  it("this quarter is the whole quarter, on each side of its boundaries", () => {
    expect(resolveListPeriod({ preset: "quarter" }, TODAY)).toMatchObject({ from: "2026-10-01", to: "2026-12-31", name: "Q4 2026" });
    expect(resolveListPeriod({ preset: "quarter" }, "2026-03-31")).toMatchObject({ from: "2026-01-01", to: "2026-03-31", name: "Q1 2026" });
    expect(resolveListPeriod({ preset: "quarter" }, "2026-04-01")).toMatchObject({ from: "2026-04-01", to: "2026-06-30", name: "Q2 2026" });
  });

  it("this year is the whole year", () => {
    expect(resolveListPeriod({ preset: "year" }, TODAY)).toMatchObject({ from: "2026-01-01", to: "2026-12-31", name: "2026" });
    expect(resolveListPeriod({ preset: "year" }, "2026-12-31")).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("today is one day and this week runs Monday to Sunday", () => {
    expect(resolveListPeriod({ preset: "today" }, TODAY)).toMatchObject({ from: TODAY, to: TODAY });
    expect(resolveListPeriod({ preset: "week" }, TODAY)).toMatchObject({ from: "2026-10-05", to: "2026-10-11" });
    expect(resolveListPeriod({ preset: "week" }, "2026-10-05")).toMatchObject({ from: "2026-10-05", to: "2026-10-11" }); // a Monday
    expect(resolveListPeriod({ preset: "week" }, "2026-10-11")).toMatchObject({ from: "2026-10-05", to: "2026-10-11" }); // a Sunday
  });

  it("all time has no limit, and an unknown choice falls back to it rather than to a guess", () => {
    expect(resolveListPeriod({ preset: "all" }, TODAY)).toMatchObject({ ok: true, all: true, from: "", to: "", label: "All time" });
    expect(resolveListPeriod({ preset: "decade" }, TODAY)).toMatchObject({ all: true, preset: "all" });
  });
});

describe("a custom range", () => {
  it("is the two dates given, and may leave one end open", () => {
    expect(resolveListPeriod({ preset: "custom", from: "2026-03-05", to: "2026-04-20" }, TODAY)).toMatchObject({ ok: true, from: "2026-03-05", to: "2026-04-20", all: false, label: "Custom range" });
    expect(resolveListPeriod({ preset: "custom", from: "2026-03-05", to: "" }, TODAY)).toMatchObject({ ok: true, from: "2026-03-05", to: "", all: false });
    expect(resolveListPeriod({ preset: "custom", from: "", to: "2026-04-20" }, TODAY)).toMatchObject({ ok: true, from: "", to: "2026-04-20", all: false });
  });

  it("refuses an end before the start, and ignores anything that is not a real day", () => {
    expect(resolveListPeriod({ preset: "custom", from: "2026-05-02", to: "2026-05-01" }, TODAY)).toMatchObject({ ok: false, error: "The end date is before the start date." });
    expect(resolveListPeriod({ preset: "custom", from: "2026-02-30", to: "2026-03-01" }, TODAY)).toMatchObject({ ok: true, from: "", to: "2026-03-01" });
  });

  it("a single day is allowed, and a custom range with no dates is unlimited", () => {
    expect(resolveListPeriod({ preset: "custom", from: "2026-05-02", to: "2026-05-02" }, TODAY)).toMatchObject({ ok: true, from: "2026-05-02", to: "2026-05-02" });
    expect(resolveListPeriod({ preset: "custom" }, TODAY)).toMatchObject({ ok: true, all: true });
  });
});

describe("inPeriod, the exact test applied in the browser", () => {
  const month = resolveListPeriod({}, TODAY);

  it("includes both end days and excludes the day either side", () => {
    expect(inPeriod("2026-10-01", month)).toBe(true);
    expect(inPeriod("2026-10-31", month)).toBe(true);
    expect(inPeriod("2026-09-30", month)).toBe(false);
    expect(inPeriod("2026-11-01", month)).toBe(false);
  });

  it("a row with no date is in only when nothing limits the period", () => {
    expect(inPeriod("", month)).toBe(false);
    expect(inPeriod(null, month)).toBe(false);
    expect(inPeriod("", resolveListPeriod({ preset: "all" }, TODAY))).toBe(true);
  });

  it("an open end is open", () => {
    const from = resolveListPeriod({ preset: "custom", from: "2026-03-05" }, TODAY);
    expect(inPeriod("2026-03-04", from)).toBe(false);
    expect(inPeriod("2030-01-01", from)).toBe(true);
    const until = resolveListPeriod({ preset: "custom", to: "2026-03-05" }, TODAY);
    expect(inPeriod("1999-01-01", until)).toBe(true);
    expect(inPeriod("2026-03-06", until)).toBe(false);
  });

  it("every period resolves to days that exist, from <= to, and contain today when they are 'this' something", () => {
    for (const today of ["2026-01-01", "2026-02-28", "2024-02-29", "2026-10-10", "2026-12-31"]) {
      for (const { value } of LIST_PERIODS) {
        const p = resolveListPeriod({ preset: value, from: "2026-01-02", to: "2026-01-09" }, today);
        expect(p.ok, `${value} on ${today}`).toBe(true);
        if (p.from) expect(isDay(p.from)).toBe(true);
        if (p.to) expect(isDay(p.to)).toBe(true);
        if (p.from && p.to) expect(p.from <= p.to).toBe(true);
        if (["today", "week", "month", "quarter", "year"].includes(value)) expect(inPeriod(today, p), `${value} on ${today}`).toBe(true);
      }
    }
  });
});

describe("the period it is compared with", () => {
  it("the month before a month, across the year boundary", () => {
    expect(previousPeriod(resolveListPeriod({}, TODAY), TODAY)).toEqual({ from: "2026-09-01", to: "2026-09-30", name: "September 2026" });
    expect(previousPeriod(resolveListPeriod({}, "2026-01-05"), "2026-01-05")).toEqual({ from: "2025-12-01", to: "2025-12-31", name: "December 2025" });
    expect(previousPeriod(resolveListPeriod({ preset: "lastMonth" }, TODAY), TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-31", name: "August 2026" });
  });

  it("the quarter before, the year before, last week and yesterday", () => {
    expect(previousPeriod(resolveListPeriod({ preset: "quarter" }, TODAY), TODAY)).toEqual({ from: "2026-07-01", to: "2026-09-30", name: "Q3 2026" });
    expect(previousPeriod(resolveListPeriod({ preset: "quarter" }, "2026-02-01"), "2026-02-01")).toEqual({ from: "2025-10-01", to: "2025-12-31", name: "Q4 2025" });
    expect(previousPeriod(resolveListPeriod({ preset: "year" }, TODAY), TODAY)).toEqual({ from: "2025-01-01", to: "2025-12-31", name: "2025" });
    expect(previousPeriod(resolveListPeriod({ preset: "week" }, TODAY), TODAY)).toEqual({ from: "2026-09-28", to: "2026-10-04", name: "last week" });
    expect(previousPeriod(resolveListPeriod({ preset: "today" }, TODAY), TODAY)).toEqual({ from: "2026-10-09", to: "2026-10-09", name: "yesterday" });
  });

  it("a custom range is compared with the same number of days immediately before it", () => {
    const p = resolveListPeriod({ preset: "custom", from: "2026-03-05", to: "2026-03-14" }, TODAY);
    expect(previousPeriod(p, TODAY)).toEqual({ from: "2026-02-23", to: "2026-03-04", name: "the 10 days before" });
  });

  it("all time and an open-ended range have nothing to compare with", () => {
    expect(previousPeriod(resolveListPeriod({ preset: "all" }, TODAY), TODAY)).toBeNull();
    expect(previousPeriod(resolveListPeriod({ preset: "custom", from: "2026-03-05" }, TODAY), TODAY)).toBeNull();
    expect(previousPeriod({ ok: false }, TODAY)).toBeNull();
  });
});

describe("what a total card says against the period before", () => {
  it("gives the words and the change, with a minus sign for a fall", () => {
    expect(compareCount(45, 40, "September 2026")).toEqual({ subText: "Against September 2026 (40)", trend: "+12.5%" });
    expect(compareCount(30, 40, "September 2026")).toEqual({ subText: "Against September 2026 (40)", trend: "−25.0%" });
    expect(compareCount(40, 40, "Q3 2026").trend).toBe("+0.0%");
  });

  it("invents nothing when there is nothing to compare with", () => {
    expect(compareCount(5, null, "September 2026")).toEqual({ subText: null, trend: null });
    expect(compareCount(5, 12, null)).toEqual({ subText: null, trend: null });
    expect(compareCount(5, 0, "September 2026")).toEqual({ subText: "None in September 2026", trend: null });
  });
});

describe("one-tap ways to widen", () => {
  it("never offers the period that is already showing", () => {
    expect(widerChoices({ preset: "month" })).toEqual(["lastMonth", "quarter", "year", "all"]);
    expect(widerChoices({ preset: "all" })).toEqual(["lastMonth", "quarter", "year"]);
  });
});

describe("calendar helpers", () => {
  it("add days and months across boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(daysBetween("2026-03-05", "2026-03-14")).toBe(9);
    expect(lastDayOf("2026-02")).toBe("2026-02-28");
    expect(quarterOf("2026-06-30")).toBe(2);
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
    expect(monthName("2026-10")).toBe("October 2026");
    expect(isDay("2026-02-30")).toBe(false);
  });
});
