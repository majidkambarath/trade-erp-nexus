import { describe, expect, it } from "vitest";
import { fiscalYearOf } from "../reportKit";

// Reports open "year to date" from the organisation's fiscal year, not 1 January: an April-March organisation's
// statements would otherwise open on the last quarter of the previous year plus this one.
describe("fiscalYearOf", () => {
  const years = [
    { startDay: "2025-04-01", endDay: "2026-03-31" },
    { startDay: "2026-04-01", endDay: "2027-03-31" },
  ];
  it("finds the year that holds the day, its first and last day included", () => {
    expect(fiscalYearOf(years, "2026-11-18")).toEqual({ from: "2026-04-01", to: "2027-03-31" });
    expect(fiscalYearOf(years, "2026-04-01")).toEqual({ from: "2026-04-01", to: "2027-03-31" });
    expect(fiscalYearOf(years, "2026-03-31")).toEqual({ from: "2025-04-01", to: "2026-03-31" });
  });
  it("answers null when no year covers the day, or there is no list, so the calendar year stays", () => {
    expect(fiscalYearOf(years, "2028-01-01")).toBeNull();
    expect(fiscalYearOf(null, "2026-11-18")).toBeNull();
    expect(fiscalYearOf([{ startDay: "2026-01-01" }], "2026-11-18")).toBeNull();
  });
});
