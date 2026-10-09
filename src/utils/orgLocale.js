// The organisation's own currency and time zone, and calendar days in that zone.
//
// Until an organisation says otherwise this is the brand pack's (AED, Asia/Dubai: what the product always assumed). When the
// signed-in organisation's status loads, `OrganisationContext` calls `setOrgLocale` with ITS base currency and time zone, and
// everything that formats money or reads a day (utils/format.js, and everything that imports from it) follows.
//
// The day rules here are the same as the server's (utils/tz.js there): a day begins and ends on the organisation's wall clock,
// found from the zone's offset AT that moment, so a zone with clock changes is right too. Only zones never west of UTC are
// supported (day-only dates are stored at UTC midnight), which the server enforces when an organisation is made.
import { getBrand } from "../config/brands";

const brand = getBrand();
let locale = { currency: brand.currency, timezone: brand.timezone };
const listeners = new Set();

const validZone = (zone) => {
  if (!zone || typeof zone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

export const getOrgLocale = () => locale;
export const orgCurrency = () => locale.currency;
export const orgTimezone = () => locale.timezone;

/** Subscribe to a change of currency or zone. Returns the unsubscribe. */
export function subscribeOrgLocale(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Set the organisation's currency and zone. A missing or invalid part keeps what is held. -> true when something changed. */
export function setOrgLocale({ currency, timezone } = {}) {
  const next = {
    currency: typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency.trim()) ? currency.trim().toUpperCase() : locale.currency,
    timezone: validZone(timezone) ? timezone : locale.timezone,
  };
  if (next.currency === locale.currency && next.timezone === locale.timezone) return false;
  locale = next;
  listeners.forEach((fn) => fn(locale));
  return true;
}

/** Back to the brand pack's (for a test, and for signing out). */
export const resetOrgLocale = () => setOrgLocale({ currency: brand.currency, timezone: brand.timezone });

// ----------------------------------------------------------------------------------------------- days in a zone

const formatters = new Map();
const formattersFor = (zone) => {
  let f = formatters.get(zone);
  if (!f) {
    f = {
      wall: new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }),
      day: new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }),
    };
    formatters.set(zone, f);
  }
  return f;
};
const safe = (zone) => (validZone(zone) ? zone : "UTC");
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, "0");

/** The zone's offset from UTC, in minutes, at an instant. */
export function offsetMinutes(instant, zone = locale.timezone) {
  const ms = instant instanceof Date ? instant.getTime() : Number(instant);
  const p = Object.fromEntries(formattersFor(safe(zone)).wall.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}

/** "YYYY-MM-DD" of an instant as seen in the zone (the organisation's, by default). A plain day comes back as it is; nonsense is null. */
export function dayOf(input = new Date(), zone = locale.timezone) {
  if (typeof input === "string" && DAY_RE.test(input.trim())) return input.trim();
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return formattersFor(safe(zone)).day.format(d);
}

/** Today, in the organisation's zone. */
export const today = (now = new Date()) => dayOf(now);

function wallToInstant(y, m, d, h, mi, s, ms, zone) {
  const z = safe(zone);
  const guess = Date.UTC(y, m - 1, d, h, mi, s, ms);
  let t = guess - offsetMinutes(guess, z) * 60000;
  t = guess - offsetMinutes(t, z) * 60000;
  return new Date(t);
}

const parts = (ymd) => {
  if (!DAY_RE.test(String(ymd ?? "").trim())) throw new Error(`Not a calendar day: ${ymd}`);
  return String(ymd).trim().split("-").map(Number);
};

/** The instant a calendar day begins on the organisation's wall clock. */
export function dayStart(ymd, zone = locale.timezone) {
  const [y, m, d] = parts(ymd);
  return wallToInstant(y, m, d, 0, 0, 0, 0, zone);
}

/** The instant the day ends and the next begins (use `< dayEnd`). */
export function dayEnd(ymd, zone = locale.timezone) {
  const [y, m, d] = parts(ymd);
  return wallToInstant(y, m, d + 1, 0, 0, 0, 0, zone);
}

/** The last millisecond of the day (use `<= endOfDay`). */
export const endOfDay = (ymd, zone = locale.timezone) => new Date(dayEnd(ymd, zone).getTime() - 1);

/** Add whole days to a calendar day, by calendar arithmetic. */
export function addDays(ymd, days) {
  const [y, m, d] = parts(ymd);
  const t = new Date(Date.UTC(y, m - 1, d + Number(days)));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
