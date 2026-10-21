import { describe, expect, it } from "vitest";
import { COUNTRY_CURRENCY, COUNTRY_ZONES } from "../countryZones";
import { countryName, countryOptions, isKnownCountry, suggestFor, zonesOf } from "../countries";
import { canonicalZone, formatOffset, isRealZone, isSupportedZone, localTime, offsetMinutes, withCurrent, zoneOptions } from "../timezones";
import { emptyOrganisation, validateNewOrganisation, withCountry } from "../platformForms";

// The catalogue as the server sends it: only currencies the books can be kept in, and only zones it accepts.
const CATALOG = {
  currencies: [{ code: "AED" }, { code: "INR" }, { code: "SAR" }, { code: "GBP" }, { code: "EUR" }, { code: "AUD" }],
  unsupportedCurrencies: ["KWD", "OMR"],
  timezones: ["Asia/Dubai", "Asia/Kolkata", "Asia/Riyadh", "Europe/London"],
};
const NOW = new Date("2026-10-21T08:00:00Z");

describe("the time-zone table", () => {
  it("only lists real zones the server would accept, under names this engine knows", () => {
    for (const [code, zones] of Object.entries(COUNTRY_ZONES)) {
      for (const zone of zones) {
        expect(isRealZone(zone), `${code}: ${zone}`).toBe(true);
        expect(isSupportedZone(zone, NOW), `${code}: ${zone} is west of UTC`).toBe(true);
        expect(canonicalZone(zone), `${code}: ${zone} is a name the zone database no longer uses`).toBe(zone);
      }
      expect(new Set(zones).size, `${code} lists a zone twice`).toBe(zones.length);
    }
  });

  it("names India's zone the way the zone list and the server do", () => {
    expect(COUNTRY_ZONES.IN).toEqual(["Asia/Kolkata"]);
    expect(zonesOf("IN", NOW)).toEqual(["Asia/Kolkata"]);
    expect(offsetMinutes("Asia/Kolkata", NOW)).toBe(330);
    expect(formatOffset(330)).toBe("UTC+05:30");
  });

  it("puts a country's main zone first, and keeps the others for the box", () => {
    expect(zonesOf("AU", NOW)[0]).toBe("Australia/Sydney");
    expect(zonesOf("RU", NOW)[0]).toBe("Europe/Moscow");
    expect(zonesOf("ES", NOW)[0]).toBe("Europe/Madrid");
    expect(zonesOf("AE", NOW)).toEqual(["Asia/Dubai"]);
    expect(zonesOf("ID", NOW).length).toBeGreaterThan(1);
  });

  it("has nothing usable for a country west of UTC, and says so rather than guessing", () => {
    for (const code of ["US", "CA", "BR", "MX", "AR"]) {
      expect(isKnownCountry(code)).toBe(true);
      expect(COUNTRY_ZONES[code]).toEqual([]);
      expect(zonesOf(code, NOW)).toEqual([]);
    }
  });

  it("knows each usual currency as an ISO code", () => {
    for (const [code, currency] of Object.entries(COUNTRY_CURRENCY)) {
      expect(isKnownCountry(code), code).toBe(true);
      expect(currency, code).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("what choosing a country suggests", () => {
  it("sets India to its zone and rupee, with the clock there", () => {
    const s = suggestFor("IN", CATALOG, NOW);
    expect(s).toMatchObject({ name: "India", zone: "Asia/Kolkata", currency: "INR", currencyOk: true, offset: "UTC+05:30" });
    expect(s.clock).toMatch(/13:30/); // 08:00 UTC is 13:30 in Kolkata
    expect(s.notes).toEqual([]);
  });

  it("explains a currency the books cannot keep, without losing the zone", () => {
    const kuwait = suggestFor("KW", CATALOG, NOW);
    expect(kuwait.zone).toBe("Asia/Kuwait");
    expect(kuwait.currencyOk).toBe(false);
    expect(kuwait.notes[0]).toMatch(/KWD, which uses three decimal places/);
    const kenya = suggestFor("KE", CATALOG, NOW);
    expect(kenya.notes[0]).toMatch(/KES, which is not one of the base currencies the books support yet/);
  });

  it("explains a country that cannot be set up yet", () => {
    const us = suggestFor("US", CATALOG, NOW);
    expect(us.zone).toBeNull();
    expect(us.notes[0]).toMatch(/United States cannot be set up yet: its time zones are west of UTC/);
  });

  it("fills the form's zone and currency, and keeps what was there when the country offers nothing", () => {
    const start = emptyOrganisation();
    expect(withCountry(start, "IN", CATALOG)).toMatchObject({ country: "IN", timezone: "Asia/Kolkata", baseCurrency: "INR" });
    expect(withCountry(start, "GB", CATALOG)).toMatchObject({ timezone: "Europe/London", baseCurrency: "GBP" });
    // Kuwait: its zone, but the dinar is not offered, so the currency stays as it was
    expect(withCountry(start, "KW", CATALOG)).toMatchObject({ timezone: "Asia/Kuwait", baseCurrency: "AED" });
    // the US has no usable zone: nothing is overwritten, and validation refuses it
    const us = withCountry(start, "US", CATALOG);
    expect(us).toMatchObject({ country: "US", timezone: "Asia/Dubai", baseCurrency: "AED" });
    expect(validateNewOrganisation({ ...us, legalName: "X Ltd", adminName: "A", adminEmail: "a@b.co", adminPassword: "12345678" }, CATALOG).country).toMatch(/cannot be set up yet/);
  });

  it("offers the usual currency as before when the catalogue has not arrived", () => {
    expect(withCountry(emptyOrganisation(), "IN")).toMatchObject({ timezone: "Asia/Kolkata", baseCurrency: "INR" });
  });

  it("refuses a time zone west of UTC that was typed or chosen by hand", () => {
    const form = { ...emptyOrganisation(), legalName: "X Ltd", adminName: "A", adminEmail: "a@b.co", adminPassword: "12345678", timezone: "America/New_York" };
    expect(validateNewOrganisation(form, CATALOG).timezone).toMatch(/west of it/);
    expect(validateNewOrganisation({ ...form, timezone: "Asia/Kolkata" }, CATALOG).timezone).toBeUndefined();
  });
});

describe("the country box", () => {
  it("lists every country by name and says which ones cannot be used yet", () => {
    const options = countryOptions(NOW);
    expect(options.length).toBeGreaterThan(200);
    const names = options.map((o) => o.label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    expect(options.find((o) => o.value === "IN")).toMatchObject({ label: "India", hint: "IN" });
    expect(options.find((o) => o.value === "US").hint).toBe("US · not available yet");
    expect(countryName("AE")).toBe("United Arab Emirates");
    expect(countryName("")).toBe("");
  });
});

describe("the time-zone box", () => {
  it("lists the country's zones first and every other accepted zone once, under current names", () => {
    const options = zoneOptions({ countryZones: ["Asia/Kolkata"], catalogZones: ["Asia/Calcutta", "Asia/Dubai", "America/New_York", "Asia/Kolkata"], countryName: "India", now: NOW });
    expect(options.map((o) => o.value)).toEqual(["Asia/Kolkata", "Asia/Dubai"]);
    expect(options[0].hint).toBe("UTC+05:30 · India");
    expect(options[1].hint).toBe("UTC+04:00");
    expect(options[0].searchText).toContain("India");
  });

  it("still offers a country's own zone when an older server's list lacks it", () => {
    const options = zoneOptions({ countryZones: ["Asia/Kolkata"], catalogZones: ["Asia/Dubai"], countryName: "India", now: NOW });
    expect(options[0].value).toBe("Asia/Kolkata");
  });

  it("keeps showing a saved value the list does not have", () => {
    expect(withCurrent([{ value: "Asia/Dubai" }], "Asia/Qatar")[0]).toMatchObject({ value: "Asia/Qatar", label: "Asia/Qatar" });
    const list = [{ value: "Asia/Dubai" }];
    expect(withCurrent(list, "Asia/Dubai")).toBe(list);
  });

  it("reads the clock in a zone, and nothing for one that does not exist", () => {
    expect(localTime("Asia/Dubai", NOW)).toMatch(/12:00/);
    expect(localTime("Mars/Phobos", NOW)).toBe("");
    expect(offsetMinutes("Mars/Phobos", NOW)).toBeNull();
    expect(isSupportedZone("Europe/London", NOW)).toBe(true); // summer and winter are both at or east of UTC
    expect(isSupportedZone("America/New_York", NOW)).toBe(false);
    expect(isSupportedZone("Atlantic/Azores", NOW)).toBe(false); // -1 in winter
  });
});
