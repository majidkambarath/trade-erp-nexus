// A phone number is chosen in two halves - the country, then the number - and stored as one.
//
// Stored and sent as compact international form, "+971501234567": a plus, the country's dialling
// code, then the number with no spaces or brackets. That is the one shape every rule already in this
// product accepts - the server's own PHONE_RE (utils/partyMaster.js), the stricter 10-to-15-digits
// rule on the customer and vendor routes, the 20- and 30-character limits on the models - and the
// shape toWaNumber() (lib/sendForms.js) and the CRM's duplicate check (last eight digits) both read
// best. So nothing on the server had to change for this, and nothing about a number already on file
// stops working.
//
// What is deliberately NOT done here: no national formatting ("050 123 4567" by country), no
// validation that the number exists in that country's plan, no mobile-versus-landline. All three
// need libphonenumber's data, which is a megabyte of tables kept in step with the world's telephone
// authorities; guessing at it would be worse than leaving it alone. What is checked is what can be
// honestly checked: the digits, and how many of them (E.164 allows 15 at most).

/**
 * ISO 3166-1 alpha-2 -> international dialling code, without the plus.
 *
 * The +1 countries (the North American Numbering Plan) all share one code and are told apart by the
 * area code inside the number, so every one of them reads "+1" here. Where a country has several
 * codes in use, the one its own authority lists first is given.
 */
export const DIAL_CODES = {
  AD: "376", AE: "971", AF: "93", AG: "1", AI: "1", AL: "355", AM: "374", AO: "244", AR: "54", AS: "1",
  AT: "43", AU: "61", AW: "297", AX: "358", AZ: "994", BA: "387", BB: "1", BD: "880", BE: "32", BF: "226",
  BG: "359", BH: "973", BI: "257", BJ: "229", BL: "590", BM: "1", BN: "673", BO: "591", BQ: "599", BR: "55",
  BS: "1", BT: "975", BW: "267", BY: "375", BZ: "501", CA: "1", CD: "243", CF: "236", CG: "242", CH: "41",
  CI: "225", CK: "682", CL: "56", CM: "237", CN: "86", CO: "57", CR: "506", CU: "53", CV: "238", CW: "599",
  CY: "357", CZ: "420", DE: "49", DJ: "253", DK: "45", DM: "1", DO: "1", DZ: "213", EC: "593", EE: "372",
  EG: "20", EH: "212", ER: "291", ES: "34", ET: "251", FI: "358", FJ: "679", FK: "500", FM: "691", FO: "298",
  FR: "33", GA: "241", GB: "44", GD: "1", GE: "995", GF: "594", GG: "44", GH: "233", GI: "350", GL: "299",
  GM: "220", GN: "224", GP: "590", GQ: "240", GR: "30", GT: "502", GU: "1", GW: "245", GY: "592", HK: "852",
  HN: "504", HR: "385", HT: "509", HU: "36", ID: "62", IE: "353", IL: "972", IM: "44", IN: "91", IO: "246",
  IQ: "964", IR: "98", IS: "354", IT: "39", JE: "44", JM: "1", JO: "962", JP: "81", KE: "254", KG: "996",
  KH: "855", KI: "686", KM: "269", KN: "1", KP: "850", KR: "82", KW: "965", KY: "1", KZ: "7", LA: "856",
  LB: "961", LC: "1", LI: "423", LK: "94", LR: "231", LS: "266", LT: "370", LU: "352", LV: "371", LY: "218",
  MA: "212", MC: "377", MD: "373", ME: "382", MF: "590", MG: "261", MH: "692", MK: "389", ML: "223", MM: "95",
  MN: "976", MO: "853", MP: "1", MQ: "596", MR: "222", MS: "1", MT: "356", MU: "230", MV: "960", MW: "265",
  MX: "52", MY: "60", MZ: "258", NA: "264", NC: "687", NE: "227", NF: "672", NG: "234", NI: "505", NL: "31",
  NO: "47", NP: "977", NR: "674", NU: "683", NZ: "64", OM: "968", PA: "507", PE: "51", PF: "689", PG: "675",
  PH: "63", PK: "92", PL: "48", PM: "508", PR: "1", PS: "970", PT: "351", PW: "680", PY: "595", QA: "974",
  RE: "262", RO: "40", RS: "381", RU: "7", RW: "250", SA: "966", SB: "677", SC: "248", SD: "249", SE: "46",
  SG: "65", SH: "290", SI: "386", SJ: "47", SK: "421", SL: "232", SM: "378", SN: "221", SO: "252", SR: "597",
  SS: "211", ST: "239", SV: "503", SX: "1", SY: "963", SZ: "268", TC: "1", TD: "235", TG: "228", TH: "66",
  TJ: "992", TK: "690", TL: "670", TM: "993", TN: "216", TO: "676", TR: "90", TT: "1", TV: "688", TW: "886",
  TZ: "255", UA: "380", UG: "256", US: "1", UY: "598", UZ: "998", VA: "39", VC: "1", VE: "58", VG: "1",
  VI: "1", VN: "84", VU: "678", WF: "681", WS: "685", YE: "967", YT: "262", ZA: "27", ZM: "260", ZW: "263",
};

// The leading 0 a number is written with at home ("050 123 4567" in Dubai, "07911 123456" in Britain)
// is a trunk prefix: it is dropped when the country's code is in front. A few countries keep it as
// part of the number instead, so dropping it there would make the number unreachable.
const KEEPS_LEADING_ZERO = new Set(["IT", "VA"]);

const upper = (iso) => String(iso || "").toUpperCase();

/** The dialling code for a country, without the plus. "" when the country is not one we know. */
export const dialCodeOf = (iso) => DIAL_CODES[upper(iso)] || "";

/** Is this a country this table can dial? */
export const canDial = (iso) => Boolean(dialCodeOf(iso));

let regionNames = null;
/** "United Arab Emirates" for "AE", in English; the code itself where the engine has no name for it. */
export function countryName(iso) {
  const key = upper(iso);
  if (!key) return "";
  try {
    regionNames ||= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(key) || key;
  } catch {
    return key;
  }
}

/**
 * Every country for the code box, by name. The chosen one shows as "+971" and the list reads
 * "+971  United Arab Emirates"; typing the country, the code, or the ISO letters finds it.
 *
 * `first` is put at the top under its own heading-less group - the organisation's own country, which
 * is the answer on all but a handful of the numbers anybody types.
 */
export function dialOptions(first = "") {
  const top = canDial(first) ? upper(first) : "";
  const option = (iso) => ({
    value: iso,
    label: `+${DIAL_CODES[iso]}`,
    hint: countryName(iso),
    searchText: `${countryName(iso)} ${iso} +${DIAL_CODES[iso]} ${DIAL_CODES[iso]}`,
  });
  const rest = Object.keys(DIAL_CODES)
    .filter((iso) => iso !== top)
    .map(option)
    .sort((a, b) => a.hint.localeCompare(b.hint));
  return top ? [option(top), ...rest] : rest;
}

/**
 * Split a stored number into the two halves the field shows.
 *
 * A number in international form is matched against the longest dialling code it starts with; the
 * organisation's own country wins a tie, so "+1555…" reads as the United States for an American
 * organisation and the code box shows "+1" either way (the +1 countries cannot be told apart without
 * the area code, and nothing here needs to).
 *
 * A number stored by an older version with no code at all ("050 111 2222") keeps every character it
 * was saved with, under the organisation's own country. It is NOT rewritten: a number is somebody's
 * record, and only the person editing the field may change it.
 */
export function splitPhone(value, defaultCountry = "") {
  const home = canDial(defaultCountry) ? upper(defaultCountry) : "";
  const raw = String(value ?? "").trim();
  if (!raw) return { iso: home, code: dialCodeOf(home), national: "" };

  // "00971…" is the same thing as "+971…" wherever it was dialled from
  const international = raw.startsWith("+") ? raw.slice(1) : raw.startsWith("00") ? raw.slice(2) : null;
  if (international !== null) {
    const digits = international.replace(/\D/g, "");
    let best = "";
    for (const code of new Set(Object.values(DIAL_CODES))) {
      if (digits.startsWith(code) && code.length > best.length) best = code;
    }
    if (best) {
      const iso = home && DIAL_CODES[home] === best ? home : Object.keys(DIAL_CODES).find((k) => DIAL_CODES[k] === best);
      return { iso, code: best, national: digits.slice(best.length) };
    }
    return { iso: home, code: dialCodeOf(home), national: digits };
  }
  return { iso: home, code: dialCodeOf(home), national: raw };
}

/**
 * The two halves back into the one stored string. An empty number is "" whatever country is chosen:
 * a dialling code on its own is not a phone number, and saving "+971" would make every blank field
 * look filled in.
 */
export function joinPhone(iso, national) {
  const digits = String(national ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const code = dialCodeOf(iso);
  if (!code) return digits;
  const trunkless = KEEPS_LEADING_ZERO.has(upper(iso)) ? digits : digits.replace(/^0+/, "");
  return trunkless ? `+${code}${trunkless}` : `+${code}`;
}

/**
 * What is wrong with this number, in words, or null when nothing is. Deliberately shallow: the
 * digits and their count, which is all that can be judged without the world's numbering plans.
 */
export function phoneProblem(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null; // empty is a matter for the form, not for this
  if (!/^\+?[\d\s().-]+$/.test(raw)) return "A phone number can hold digits, spaces, brackets and dashes only";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "That is too short for a phone number";
  if (digits.length > 15) return "That is too long for a phone number";
  return null;
}
