// Time zones in the New organisation form, as plain functions (no React, no requests): what a zone is called and reads
// like right now, whether the books can be kept in it, and the list a country offers. Pure, so each rule is a test.

// The rule the server enforces (utils/tz.js supportedZone): the zone must exist and never be west of UTC, summer or winter,
// because a date without a time is stored at UTC midnight, which reads as the day before anywhere west of it.

// Names a browser's or Node's own zone list still carries from before the IANA database renamed them. The list the server
// sends already uses the current ones; this is for a server that does not yet (the form must still be able to show India).
const ALIASES = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Africa/Asmera": "Africa/Asmara",
  "Europe/Kiev": "Europe/Kyiv",
  "Asia/Thimbu": "Asia/Thimphu",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Asia/Macao": "Asia/Macau",
  "Asia/Ujung_Pandang": "Asia/Makassar",
  "Asia/Dacca": "Asia/Dhaka",
  "Asia/Ulan_Bator": "Asia/Ulaanbaatar",
  "Asia/Chongqing": "Asia/Shanghai",
  "Asia/Harbin": "Asia/Shanghai",
  "Asia/Kashgar": "Asia/Urumqi",
  "Asia/Istanbul": "Europe/Istanbul",
  "Asia/Tel_Aviv": "Asia/Jerusalem",
  "Europe/Belfast": "Europe/London",
};

export const canonicalZone = (zone) => ALIASES[zone] || zone;

const wallFormats = new Map();
const wallFormat = (zone) => {
  let f = wallFormats.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    wallFormats.set(zone, f);
  }
  return f;
};

/** Does the engine know this zone? */
export function isRealZone(zone) {
  if (!zone || typeof zone !== "string") return false;
  try {
    wallFormat(zone);
    return true;
  } catch {
    return false;
  }
}

/** The zone's offset from UTC in minutes at an instant (Dubai +240, Kolkata +330); null for a zone that does not exist. */
export function offsetMinutes(zone, at = new Date()) {
  if (!isRealZone(zone)) return null;
  const ms = at instanceof Date ? at.getTime() : Number(at);
  const parts = Object.fromEntries(wallFormat(zone).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}

/** "UTC+05:30", "UTC+00:00", "UTC-03:30". */
export function formatOffset(minutes) {
  if (minutes === null || minutes === undefined) return "";
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Can the books be kept in this zone? Same rule as the server: it exists and is never west of UTC in the year. */
export function isSupportedZone(zone, now = new Date()) {
  if (!isRealZone(zone)) return false;
  const year = now.getUTCFullYear();
  return [Date.UTC(year, 0, 1), Date.UTC(year, 6, 1)].every((t) => offsetMinutes(zone, t) >= 0);
}

/** The clock in the zone right now as "Wed 21 Oct, 16:42", or "" for a zone that does not exist. */
export function localTime(zone, at = new Date()) {
  if (!isRealZone(zone)) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

/**
 * The zones the Timezone box offers: the country's own first (each marked), then every other zone the server accepts. A
 * zone is listed once, under its current name, whichever list it came from; one the server's list lacks (an older server)
 * still appears if the country names it. `catalogZones` is what the server sent.
 *   -> [{ value, label, hint, searchText }]
 */
export function zoneOptions({ countryZones = [], catalogZones = [], countryName = "", now = new Date() } = {}) {
  const ownZones = countryZones.map(canonicalZone).filter((z) => isSupportedZone(z, now));
  const own = new Set(ownZones);
  const rest = [...new Set((catalogZones || []).map(canonicalZone))].filter((z) => !own.has(z) && isSupportedZone(z, now)).sort();
  const option = (zone, isOwn) => ({
    value: zone,
    label: zone,
    hint: `${formatOffset(offsetMinutes(zone, now))}${isOwn && countryName ? ` · ${countryName}` : ""}`,
    // searching "india" or "+05:30" finds Asia/Kolkata
    searchText: `${isOwn ? countryName : ""} ${formatOffset(offsetMinutes(zone, now))}`,
  });
  return [...ownZones.map((z) => option(z, true)), ...rest.map((z) => option(z, false))];
}

/** Keeps the box showing what is chosen even when the list has no such entry (a saved value from another version). */
export function withCurrent(options, value) {
  if (!value || options.some((o) => o.value === value)) return options;
  return [{ value, label: value, hint: formatOffset(offsetMinutes(value)), searchText: "" }, ...options];
}
