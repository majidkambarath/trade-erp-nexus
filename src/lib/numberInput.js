// Typing an amount with the grouping the organisation's country uses: 20,000 in Dubai, 20,000 in London,
// 1,20,000 (one lakh twenty thousand) in India.
//
// Pure. The component is `AmountInput` in components/accounting/kit.jsx; what is formatted and read back
// everywhere else is utils/format.js, which takes its grouping from the same table (NUMBER_LOCALE).
//
// Two rules hold whatever the country is, because the field has to stay typeable:
//   - the digits are Latin and the decimal point is a point, so what a person types parses the same way;
//   - only the GROUPING follows the country. That is why the table names "en-" locales and why `usable()`
//     checks each one before it is trusted: `en-DE`, for instance, groups with dots and takes a comma as
//     the decimal point, which would make "20,5" mean twenty and a half. Such a locale is refused.

// A country whose English grouping is not plain thousands. Everything absent keeps the deployment's own
// (the brand pack's en-GB: 1,234,567.50). Add a country here, never a bare locale tag at a call site.
const COUNTRY_LOCALE = {
  IN: "en-IN", // lakh / crore: 1,20,000 and 1,00,00,000
};

const parts = (locale) => {
  try {
    return new Intl.NumberFormat(locale).formatToParts(1234567.5);
  } catch {
    return null;
  }
};

/** True when a locale groups with "," and takes "." as the decimal point - the only kind this field can use. */
export function usable(locale) {
  const p = parts(locale);
  if (!p) return false;
  const group = p.find((x) => x.type === "group")?.value;
  const decimal = p.find((x) => x.type === "decimal")?.value;
  return group === "," && decimal === ".";
}

/** The grouping locale for a country ("IN" -> "en-IN"), or the fallback when it has none or it is unusable. */
export function groupingLocaleFor(country, fallback = "en-GB") {
  const code = typeof country === "string" ? country.trim().toUpperCase() : "";
  const named = COUNTRY_LOCALE[code];
  return named && usable(named) ? named : fallback;
}

/**
 * What a person typed, reduced to a number this form can store: Latin digits, at most one point, an
 * optional leading minus. Grouping commas and anything else typed or pasted are dropped.
 * A comma is always the grouping this field itself drew, so it is dropped: "AED 20,000.50" -> "20000.50".
 * A minus on its own is kept ("-"): they are still typing.
 */
export function sanitizeAmount(text, { allowNegative = true, maxDecimals } = {}) {
  const raw = String(text ?? "");
  let out = "";
  let dot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (dot && maxDecimals !== undefined && out.length - out.indexOf(".") - 1 >= maxDecimals) continue;
      out += ch;
    } else if (ch === "." && !dot && maxDecimals !== 0) {
      out += ".";
      dot = true;
    } else if (ch === "-" && allowNegative && out === "") {
      out = "-";
    }
  }
  return out;
}

/** The integer and decimal halves of a sanitised amount. */
const halves = (clean) => {
  const sign = clean.startsWith("-") ? "-" : "";
  const body = sign ? clean.slice(1) : clean;
  const at = body.indexOf(".");
  return at === -1 ? { sign, whole: body, rest: null } : { sign, whole: body.slice(0, at), rest: body.slice(at + 1) };
};

/**
 * A sanitised amount with its integer part grouped the way the locale does, and the decimals left exactly
 * as typed (so "20.50" does not snap to "20.5" under the caret, and a trailing "20." stays).
 */
export function groupAmount(clean, locale = "en-GB") {
  const text = String(clean ?? "");
  if (!text || text === "-") return text;
  const { sign, whole, rest } = halves(text);
  let head = whole;
  if (whole) {
    try {
      head = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 }).format(BigInt(whole));
    } catch {
      head = whole;
    }
  }
  return `${sign}${head}${rest === null ? "" : `.${rest}`}`;
}

/** What to show for a value held by the form (a number, or the plain text a person is part way through typing). */
export function displayAmount(value, locale = "en-GB", options) {
  if (value === null || value === undefined || value === "") return "";
  return groupAmount(sanitizeAmount(value, options), locale);
}

/**
 * The caret, kept where the person left it. It is counted in the characters that carry meaning (digits, the
 * point, the minus), because the commas around them move as the number grows: "1,234|" + "5" is "12,345|".
 */
export function meaningBefore(text, caret) {
  let n = 0;
  for (const ch of String(text ?? "").slice(0, Math.max(0, caret || 0))) {
    if ((ch >= "0" && ch <= "9") || ch === "." || ch === "-") n += 1;
  }
  return n;
}

/** Where that caret lands in the grouped text. */
export function caretAfter(shown, meaning) {
  const text = String(shown ?? "");
  if (meaning <= 0) {
    // in front of the first digit, not in front of a group separator that may yet appear
    let i = 0;
    while (i < text.length && text[i] === ",") i += 1;
    return i;
  }
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if ((ch >= "0" && ch <= "9") || ch === "." || ch === "-") {
      n += 1;
      if (n === meaning) return i + 1;
    }
  }
  return text.length;
}
