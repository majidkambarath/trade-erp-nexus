import { describe, it, expect, afterEach, vi } from "vitest";
import { addDays, dayEnd, dayOf, dayStart, endOfDay, getOrgLocale, offsetMinutes, orgCurrency, orgTimezone, resetOrgLocale, setOrgLocale, subscribeOrgLocale, today } from "../orgLocale";
import { CURRENCY, TIMEZONE, formatCurrencyAED, formatCurrencyCompact, formatDate, formatDateTime, formatTime, toInputDate } from "../format";

afterEach(() => resetOrgLocale());

describe("the organisation's locale", () => {
  it("is what the product always assumed until an organisation says otherwise: AED and Dubai", () => {
    expect(getOrgLocale()).toEqual({ currency: "AED", timezone: "Asia/Dubai" });
    expect(orgCurrency()).toBe("AED");
    expect(orgTimezone()).toBe("Asia/Dubai");
  });

  it("takes the organisation's own, tidied, and tells whoever listens", () => {
    const heard = vi.fn();
    const stop = subscribeOrgLocale(heard);
    expect(setOrgLocale({ currency: "gbp", timezone: "Europe/London" })).toBe(true);
    expect(getOrgLocale()).toEqual({ currency: "GBP", timezone: "Europe/London" });
    expect(heard).toHaveBeenCalledWith({ currency: "GBP", timezone: "Europe/London" });
    expect(setOrgLocale({ currency: "GBP", timezone: "Europe/London" })).toBe(false); // nothing changed, nothing said
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    setOrgLocale({ currency: "INR" });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("keeps what it holds for a part that is missing or not valid", () => {
    setOrgLocale({ currency: "INR", timezone: "Asia/Kolkata" });
    setOrgLocale({ currency: "", timezone: "Mars/Phobos" });
    expect(getOrgLocale()).toEqual({ currency: "INR", timezone: "Asia/Kolkata" });
    setOrgLocale({ currency: "RUPEES", timezone: undefined });
    expect(orgCurrency()).toBe("INR");
    setOrgLocale({});
    setOrgLocale();
    expect(orgTimezone()).toBe("Asia/Kolkata");
  });
});

describe("days on the organisation's clock", () => {
  it("which day an instant falls on follows the zone, and a plain day is already a day", () => {
    const instant = new Date("2026-10-08T21:00:00Z");
    expect(dayOf(instant, "Asia/Dubai")).toBe("2026-10-09");
    expect(dayOf(instant, "Europe/London")).toBe("2026-10-08");
    expect(dayOf(instant, "Asia/Kolkata")).toBe("2026-10-09");
    expect(dayOf("2026-02-28", "Asia/Dubai")).toBe("2026-02-28");
    expect(dayOf("nonsense", "Asia/Dubai")).toBeNull();
    setOrgLocale({ timezone: "Europe/London" });
    expect(dayOf(instant)).toBe("2026-10-08");
    expect(today(instant)).toBe("2026-10-08");
  });

  it("a day begins and ends at the zone's own midnight, half-hour zones and clock changes included", () => {
    expect(dayStart("2026-10-09", "Asia/Dubai").toISOString()).toBe("2026-10-08T20:00:00.000Z");
    expect(endOfDay("2026-10-09", "Asia/Dubai").toISOString()).toBe("2026-10-09T19:59:59.999Z");
    expect(dayStart("2026-10-09", "Asia/Kolkata").toISOString()).toBe("2026-10-08T18:30:00.000Z");
    expect(dayStart("2026-03-29", "Europe/London").toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(dayEnd("2026-03-29", "Europe/London").toISOString()).toBe("2026-03-29T23:00:00.000Z"); // a 23-hour day
    expect(dayEnd("2026-10-25", "Europe/London").toISOString()).toBe("2026-10-26T00:00:00.000Z"); // a 25-hour day
    expect(offsetMinutes(new Date("2026-07-15T12:00:00Z"), "Europe/London")).toBe(60);
    setOrgLocale({ timezone: "Asia/Kolkata" });
    expect(dayStart("2026-10-09").toISOString()).toBe("2026-10-08T18:30:00.000Z");
    expect(() => dayStart("tomorrow")).toThrow();
  });

  it("every day begins where the previous one ended, in every zone, all year", () => {
    for (const zone of ["Asia/Dubai", "Asia/Kolkata", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Pacific/Auckland"]) {
      let day = "2026-01-01";
      for (let i = 0; i < 366; i++) {
        const next = addDays(day, 1);
        expect(dayOf(dayStart(day, zone), zone)).toBe(day);
        expect(dayEnd(day, zone).getTime()).toBe(dayStart(next, zone).getTime());
        expect(dayOf(endOfDay(day, zone), zone)).toBe(day);
        day = next;
      }
    }
  });
});

describe("what the screens print follows it", () => {
  const instant = new Date("2026-10-08T19:00:00Z"); // 23:00 on the 8th in Dubai, 00:30 on the 9th in Mumbai

  it("money is written in the organisation's currency, in every formatter", () => {
    expect(CURRENCY).toBe("AED");
    expect(formatCurrencyAED(1234.5)).toMatch(/AED/);
    setOrgLocale({ currency: "GBP" });
    expect(CURRENCY).toBe("GBP"); // a live binding: an importer sees the change
    expect(formatCurrencyAED(1234.5)).toMatch(/1,234\.50/);
    expect(formatCurrencyAED(1234.5)).not.toMatch(/AED/);
    expect(formatCurrencyCompact(2_460_000)).toBe("GBP 2.46M");
    expect(formatCurrencyCompact(195_000)).toBe("GBP 195.0K");
  });

  it("dates and times are read on the organisation's calendar and clock", () => {
    expect(formatDate(instant, "DD/MM/YYYY")).toBe("08/10/2026");
    expect(formatTime(instant, "24h", false)).toBe("23:00");
    expect(toInputDate(instant)).toBe("2026-10-08");
    setOrgLocale({ timezone: "Asia/Kolkata" });
    expect(TIMEZONE).toBe("Asia/Kolkata");
    expect(formatDate(instant, "DD/MM/YYYY")).toBe("09/10/2026");
    expect(formatTime(instant, "24h", false)).toBe("00:30");
    expect(formatDateTime(instant)).toMatch(/^09\/10\/2026 00:30$/);
    expect(toInputDate(instant)).toBe("2026-10-09");
  });

  it("changing the zone twice reads the right formatter each time (they are cached per zone)", () => {
    setOrgLocale({ timezone: "Asia/Kolkata" });
    const a = formatDate(instant, "DD/MM/YYYY");
    setOrgLocale({ timezone: "Asia/Dubai" });
    const b = formatDate(instant, "DD/MM/YYYY");
    setOrgLocale({ timezone: "Asia/Kolkata" });
    expect([a, b, formatDate(instant, "DD/MM/YYYY")]).toEqual(["09/10/2026", "08/10/2026", "09/10/2026"]);
  });
});
