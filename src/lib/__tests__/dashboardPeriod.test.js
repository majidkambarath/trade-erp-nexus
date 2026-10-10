import { describe, it, expect } from "vitest";
import { asAt, defaultSelection, describePeriod, monthChoices, quarterChoices, selectionFor, tidySelection, trailing, yearChoices } from "../dashboardPeriod";

// The dashboard's period: what a person picked -> what the server is asked for and what the screen says.
// `today` is passed in, so every boundary is pinned without a clock.

const TODAY = "2026-10-10"; // a Saturday, in the fourth quarter

describe("the periods the server already knows", () => {
  it("this week runs Monday to today and is asked for as period=week", () => {
    const p = describePeriod({ kind: "week" }, TODAY);
    expect(p).toMatchObject({ ok: true, from: "2026-10-05", to: TODAY, query: { period: "week" }, current: true, at: "this week", before: "week before" });
  });

  it("this month is the 1st to today, period=month, and reads 'this month' in a sentence", () => {
    const p = describePeriod(defaultSelection(), TODAY);
    expect(p).toMatchObject({ ok: true, from: "2026-10-01", to: TODAY, query: { period: "month" }, label: "This month", noun: "this month", at: "this month", before: "month before", current: true });
  });

  it("this quarter starts on the quarter's first day, whichever month of it we are in", () => {
    expect(describePeriod({ kind: "quarter" }, "2026-10-10")).toMatchObject({ from: "2026-10-01", query: { period: "quarter" } });
    expect(describePeriod({ kind: "quarter" }, "2026-02-14")).toMatchObject({ from: "2026-01-01" });
    expect(describePeriod({ kind: "quarter" }, "2026-06-30")).toMatchObject({ from: "2026-04-01" });
    expect(describePeriod({ kind: "quarter" }, "2026-07-01")).toMatchObject({ from: "2026-07-01" });
  });

  it("an unknown kind is refused, not guessed", () => {
    expect(describePeriod({ kind: "decade" }, TODAY)).toMatchObject({ ok: false, code: "INVALID_PERIOD" });
  });
});

describe("this year and previous years", () => {
  it("this year is 1 January to today (year to date), sent as from / to", () => {
    const p = describePeriod({ kind: "year" }, TODAY);
    expect(p).toMatchObject({ ok: true, from: "2026-01-01", to: TODAY, query: { from: "2026-01-01", to: TODAY }, current: true, at: "this year so far" });
  });

  it("on the first day of the year it is that one day", () => {
    expect(describePeriod({ kind: "year" }, "2027-01-01")).toMatchObject({ from: "2027-01-01", to: "2027-01-01" });
  });

  it("a previous year is the whole of it, ends on 31 December and is not 'current'", () => {
    const p = describePeriod({ kind: "yearOf", year: 2025 }, TODAY);
    expect(p).toMatchObject({ ok: true, from: "2025-01-01", to: "2025-12-31", query: { from: "2025-01-01", to: "2025-12-31" }, current: false, capped: false, label: "2025", at: "in 2025", noun: "2025" });
  });

  it("the year we are in, asked for by number, runs to today and says so", () => {
    const p = describePeriod({ kind: "yearOf", year: 2026 }, TODAY);
    expect(p).toMatchObject({ ok: true, to: TODAY, current: true, capped: true, label: "2026 (so far)", at: "in 2026 so far" });
  });

  it("a year that has not started is refused", () => {
    expect(describePeriod({ kind: "yearOf", year: 2027 }, TODAY)).toMatchObject({ ok: false, code: "FUTURE_PERIOD" });
  });

  it("a leap year's last day is 31 December like any other, and the day before 1 March is the 29th", () => {
    expect(describePeriod({ kind: "yearOf", year: 2024 }, TODAY).to).toBe("2024-12-31");
    expect(describePeriod({ kind: "custom", from: "2024-02-01", to: "2024-02-29" }, TODAY)).toMatchObject({ ok: true, to: "2024-02-29" });
    expect(describePeriod({ kind: "custom", from: "2025-02-01", to: "2025-02-30" }, TODAY)).toMatchObject({ ok: false, code: "MISSING_DATES" });
  });
});

describe("a specific quarter", () => {
  it.each([
    [1, "2026-01-01", "2026-03-31"],
    [2, "2026-04-01", "2026-06-30"],
    [3, "2026-07-01", "2026-09-30"],
  ])("Q%i of 2026 runs %s to %s, ends before today and is asked for as from / to", (q, from, to) => {
    const p = describePeriod({ kind: "quarterOf", year: 2026, quarter: q }, TODAY);
    expect(p).toMatchObject({ ok: true, from, to, query: { from, to }, current: false, capped: false, label: `Q${q} 2026`, at: `in Q${q} 2026`, noun: `Q${q} 2026`, before: "period before" });
  });

  it("Q4 of a past year ends on 31 December", () => {
    expect(describePeriod({ kind: "quarterOf", year: 2025, quarter: 4 }, TODAY)).toMatchObject({ from: "2025-10-01", to: "2025-12-31", current: false });
  });

  it("the quarter we are in is capped at today - its last day is still to come", () => {
    const p = describePeriod({ kind: "quarterOf", year: 2026, quarter: 4 }, TODAY);
    expect(p).toMatchObject({ ok: true, from: "2026-10-01", to: TODAY, query: { from: "2026-10-01", to: TODAY }, current: true, capped: true, label: "Q4 2026 (so far)", at: "in Q4 2026 so far" });
  });

  it("a quarter that has not started is refused, on its first day exactly", () => {
    expect(describePeriod({ kind: "quarterOf", year: 2026, quarter: 4 }, "2026-09-30")).toMatchObject({ ok: false, code: "FUTURE_PERIOD" });
    expect(describePeriod({ kind: "quarterOf", year: 2026, quarter: 4 }, "2026-10-01")).toMatchObject({ ok: true, from: "2026-10-01", to: "2026-10-01" });
    expect(describePeriod({ kind: "quarterOf", year: 2027, quarter: 1 }, TODAY)).toMatchObject({ ok: false });
  });

  it("a quarter number outside 1-4 is refused", () => {
    expect(describePeriod({ kind: "quarterOf", year: 2026, quarter: 5 }, TODAY)).toMatchObject({ ok: false, code: "INVALID_PERIOD" });
    expect(describePeriod({ kind: "quarterOf", year: 2026 }, TODAY)).toMatchObject({ ok: false });
  });

  it("offers only the quarters that have started, and none of a future year", () => {
    expect(quarterChoices(2026, TODAY)).toEqual([1, 2, 3, 4]);
    expect(quarterChoices(2026, "2026-05-02")).toEqual([1, 2]);
    expect(quarterChoices(2025, "2026-01-01")).toEqual([1, 2, 3, 4]);
    expect(quarterChoices(2026, "2026-01-01")).toEqual([1]);
    expect(quarterChoices(2027, TODAY)).toEqual([]);
  });
});

describe("a specific month", () => {
  it("a past month is asked for as month=YYYY-MM and runs to its own last day", () => {
    const p = describePeriod({ kind: "monthOf", year: 2026, month: 2 }, TODAY);
    expect(p).toMatchObject({ ok: true, from: "2026-02-01", to: "2026-02-28", query: { month: "2026-02" }, current: false, label: "February 2026", at: "in February 2026", before: "month before" });
    expect(describePeriod({ kind: "monthOf", year: 2024, month: 2 }, TODAY).to).toBe("2024-02-29");
    expect(describePeriod({ kind: "monthOf", year: 2025, month: 12 }, TODAY).to).toBe("2025-12-31");
  });

  it("the month we are in runs to today", () => {
    const p = describePeriod({ kind: "monthOf", year: 2026, month: 10 }, TODAY);
    expect(p).toMatchObject({ from: "2026-10-01", to: TODAY, query: { month: "2026-10" }, current: true, capped: true, label: "October 2026 (so far)" });
  });

  it("on the last day of the month it is complete, so it is not 'capped'", () => {
    expect(describePeriod({ kind: "monthOf", year: 2026, month: 10 }, "2026-10-31")).toMatchObject({ to: "2026-10-31", capped: false, current: true });
  });

  it("a month that has not started is refused, however the year is written", () => {
    expect(describePeriod({ kind: "monthOf", year: 2026, month: 11 }, TODAY)).toMatchObject({ ok: false, code: "FUTURE_MONTH" });
    expect(describePeriod({ kind: "monthOf", year: 2027, month: 1 }, TODAY)).toMatchObject({ ok: false, code: "FUTURE_MONTH" });
    expect(describePeriod({ kind: "monthOf", year: 2026, month: 13 }, TODAY)).toMatchObject({ ok: false, code: "INVALID_PERIOD" });
  });

  it("offers only the months that have started", () => {
    expect(monthChoices(2026, TODAY)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(monthChoices(2025, TODAY)).toHaveLength(12);
    expect(monthChoices(2027, TODAY)).toEqual([]);
  });
});

describe("a custom range", () => {
  it("is sent as from / to", () => {
    expect(describePeriod({ kind: "custom", from: "2026-03-05", to: "2026-04-20" }, TODAY)).toMatchObject({
      ok: true, from: "2026-03-05", to: "2026-04-20", query: { from: "2026-03-05", to: "2026-04-20" }, current: false, capped: false, label: "Custom range", at: "in the selected period",
    });
  });

  it("an end in the future is pulled back to today and says so", () => {
    const p = describePeriod({ kind: "custom", from: "2026-09-01", to: "2026-12-31" }, TODAY);
    expect(p).toMatchObject({ ok: true, to: TODAY, query: { from: "2026-09-01", to: TODAY }, capped: true, current: true });
  });

  it("refuses a start after today, an end before the start, and a missing or impossible date", () => {
    expect(describePeriod({ kind: "custom", from: "2026-10-11", to: "2026-10-20" }, TODAY)).toMatchObject({ ok: false, code: "FUTURE_PERIOD" });
    expect(describePeriod({ kind: "custom", from: "2026-05-02", to: "2026-05-01" }, TODAY)).toMatchObject({ ok: false, code: "INVALID_PERIOD" });
    expect(describePeriod({ kind: "custom", from: "2026-05-02", to: "" }, TODAY)).toMatchObject({ ok: false, code: "MISSING_DATES" });
    expect(describePeriod({ kind: "custom", from: "", to: "" }, TODAY)).toMatchObject({ ok: false, code: "MISSING_DATES" });
  });

  it("a single day is allowed", () => {
    expect(describePeriod({ kind: "custom", from: "2026-05-02", to: "2026-05-02" }, TODAY)).toMatchObject({ ok: true, from: "2026-05-02", to: "2026-05-02" });
  });
});

describe("choosing a kind fills in something sensible", () => {
  it("a specific quarter opens on the last complete quarter, rolling back across the year boundary", () => {
    expect(selectionFor("quarterOf", "2026-10-10")).toEqual({ kind: "quarterOf", year: 2026, quarter: 3 });
    expect(selectionFor("quarterOf", "2026-02-10")).toEqual({ kind: "quarterOf", year: 2025, quarter: 4 });
  });

  it("a specific month opens on last month, also across the year boundary", () => {
    expect(selectionFor("monthOf", "2026-10-10")).toEqual({ kind: "monthOf", year: 2026, month: 9 });
    expect(selectionFor("monthOf", "2026-01-05")).toEqual({ kind: "monthOf", year: 2025, month: 12 });
  });

  it("a previous year opens on last year, and a custom range on this month so far", () => {
    expect(selectionFor("yearOf", TODAY)).toEqual({ kind: "yearOf", year: 2025 });
    expect(selectionFor("custom", TODAY)).toEqual({ kind: "custom", from: "2026-10-01", to: TODAY });
    expect(selectionFor("week", TODAY)).toEqual({ kind: "week" });
  });

  it("every selection it makes is a period the server will accept", () => {
    for (const kind of ["week", "month", "quarter", "year", "quarterOf", "monthOf", "yearOf", "custom"]) {
      for (const today of ["2026-01-01", "2026-02-28", "2026-10-10", "2026-12-31"]) {
        expect(describePeriod(selectionFor(kind, today), today).ok, `${kind} on ${today}`).toBe(true);
      }
    }
  });

  it("changing the year to this one pulls a quarter or month that has not started back to the latest that has", () => {
    expect(tidySelection({ kind: "quarterOf", year: 2026, quarter: 4 }, "2026-05-02")).toMatchObject({ quarter: 2 });
    expect(tidySelection({ kind: "monthOf", year: 2026, month: 12 }, TODAY)).toMatchObject({ month: 10 });
    expect(tidySelection({ kind: "monthOf", year: 2025, month: 12 }, TODAY)).toMatchObject({ month: 12 });
  });

  it("lists previous years newest first, with this year only where it makes sense", () => {
    expect(yearChoices(TODAY, { includeCurrent: false, back: 3 })).toEqual([2025, 2024, 2023]);
    expect(yearChoices(TODAY, { back: 2 })).toEqual([2026, 2025, 2024]);
  });
});

describe("the words for a series and for an as-at figure", () => {
  const now = describePeriod({ kind: "month" }, TODAY);
  const past = describePeriod({ kind: "monthOf", year: 2026, month: 3 }, TODAY);
  const day = (d) => `<${d}>`;

  it("a series that ends today is 'the last 8 months'; for a past period it is 'the 8 months to March 2026'", () => {
    expect(trailing(now, 8, "months")).toBe("last 8 months");
    expect(trailing(past, 8, "months")).toBe("8 months to March 2026");
    expect(trailing(now, 7, "days", day)).toBe("last 7 days");
    expect(trailing(past, 7, "days", day)).toBe("7 days to <2026-03-31>");
    expect(trailing(past, 6, "weeks", day)).toBe("6 weeks to <2026-03-31>");
  });

  it("a position is 'today' while the period runs to today and the period's last day otherwise", () => {
    expect(asAt(now, day)).toBe("today");
    expect(asAt(past, day)).toBe("<2026-03-31>");
  });
});
