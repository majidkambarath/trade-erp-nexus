// Every country a customer or vendor address can be in (pure), and the seven emirates of the UAE. The country is stored as its
// ISO 3166 alpha-2 code ("AE"); the name shown is the browser's own English name for it, so no list of names is kept here.
// This is NOT the console's country list (platform/countries.js), which offers only countries the books can run in.
import { GST_STATES } from "./gstStates";

const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
  "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT " +
  "JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ " +
  "OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";

export const COUNTRY_CODES = CODES.split(" ");
export const DEFAULT_COUNTRY = "AE";
export const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
export const DEFAULT_EMIRATE = "Abu Dhabi";

let names = null;
/** "United Arab Emirates" for "AE", in English; the code itself where the engine has no name for it. */
export function countryLabel(code) {
  const key = String(code || "").trim().toUpperCase();
  if (!key) return "";
  try {
    names ||= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(key) || key;
  } catch {
    return key;
  }
}

/** Every country as { value: "AE", label: "United Arab Emirates" }, A to Z by name. */
export const countryOptions = () =>
  COUNTRY_CODES.map((value) => ({ value, label: countryLabel(value) })).sort((a, b) => a.label.localeCompare(b.label));

export const emirateOptions = () => EMIRATES.map((e) => ({ value: e, label: e }));

/** India's GST states and union territories as { value: "27", label: "27 - Maharashtra" }, by code. */
export const stateOptions = () => GST_STATES.map(([value, name]) => ({ value, label: `${value} - ${name}` }));
