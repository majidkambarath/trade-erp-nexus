// Countries in the New organisation form (pure): the list to choose from, and what choosing one suggests - the time zone
// the customer's clocks run on and the currency their books are usually kept in. Choosing India offers Asia/Kolkata and
// INR; a country with several zones (Australia, Russia, Indonesia) offers its main one and lists the others first.
import { COUNTRY_CURRENCY, COUNTRY_ZONES } from "./countryZones";
import { canonicalZone, formatOffset, isSupportedZone, localTime, offsetMinutes } from "./timezones";

let regionNames = null;
/** "India" for "IN", in English; the code itself where the engine has no name for it. */
export function countryName(code) {
  const key = String(code || "").toUpperCase();
  if (!key) return "";
  try {
    regionNames ||= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(key) || key;
  } catch {
    return key;
  }
}

/** The zones a country keeps its clocks in that the books can use, its main one first. Empty when none can be used yet. */
export function zonesOf(code, now = new Date()) {
  return (COUNTRY_ZONES[String(code || "").toUpperCase()] || []).map(canonicalZone).filter((z) => isSupportedZone(z, now));
}

/** Is this a country the table knows? */
export const isKnownCountry = (code) => Object.prototype.hasOwnProperty.call(COUNTRY_ZONES, String(code || "").toUpperCase());

/** Every country, by name, for the country box. One whose time zones the books cannot use yet says so beside its name. */
export function countryOptions(now = new Date()) {
  return Object.keys(COUNTRY_ZONES)
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map(({ code, name }) => ({
      value: code,
      label: name,
      hint: zonesOf(code, now).length ? code : `${code} · not available yet`,
      searchText: code,
    }));
}

/**
 * What choosing a country suggests, given the server's catalogue.
 *   zones         the country's usable time zones, main first (empty = the books cannot be kept there yet)
 *   zone          the main one, or null
 *   currency      its usual currency when it is clear, and `currencyOk` when the server lists it as one the books can be kept in
 *   notes         plain sentences for what could not be suggested and why
 *   clock         "Wed 21 Oct, 16:42" there right now, and `offset` ("UTC+05:30")
 */
export function suggestFor(code, catalog = {}, now = new Date()) {
  const upper = String(code || "").toUpperCase();
  const name = countryName(upper);
  const zones = zonesOf(upper, now);
  const zone = zones[0] || null;
  const currency = COUNTRY_CURRENCY[upper] || null;
  const listed = (catalog?.currencies || []).some((c) => c.code === currency);
  const notes = [];
  if (isKnownCountry(upper) && !zone) {
    notes.push(`${name} cannot be set up yet: its time zones are west of UTC, and dates without a time are stored at UTC midnight, which would read as the day before there.`);
  }
  if (currency && !listed) {
    notes.push(
      (catalog?.unsupportedCurrencies || []).includes(currency)
        ? `${name} usually keeps its books in ${currency}, which uses three decimal places; the books round to two, so it cannot be used yet. Choose another base currency.`
        : `${name} usually keeps its books in ${currency}, which is not one of the base currencies the books support yet. Choose one from the list.`
    );
  }
  return {
    code: upper,
    name,
    zones,
    zone,
    currency,
    currencyOk: Boolean(currency && listed),
    notes,
    offset: zone ? formatOffset(offsetMinutes(zone, now)) : "",
    clock: zone ? localTime(zone, now) : "",
  };
}
