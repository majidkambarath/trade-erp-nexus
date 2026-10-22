import { describe, expect, it } from "vitest";
import {
  caretAfter,
  displayAmount,
  groupAmount,
  groupingLocaleFor,
  meaningBefore,
  sanitizeAmount,
  usable,
} from "../numberInput";

describe("which grouping a country uses", () => {
  it("gives India its lakh grouping and everybody else the deployment's", () => {
    expect(groupingLocaleFor("IN")).toBe("en-IN");
    expect(groupingLocaleFor("in")).toBe("en-IN"); // a country code arrives in either case
    expect(groupingLocaleFor("AE")).toBe("en-GB");
    expect(groupingLocaleFor("")).toBe("en-GB");
    expect(groupingLocaleFor(null, "en-AE")).toBe("en-AE");
  });

  it("refuses a locale that would change what a typed character MEANS", () => {
    // en-DE groups with dots and reads a comma as the decimal point: "20,5" would be twenty and a half
    expect(usable("en-DE")).toBe(false);
    expect(usable("not a locale")).toBe(false);
    expect(usable("en-GB")).toBe(true);
    expect(usable("en-IN")).toBe(true);
  });
});

describe("what the form stores", () => {
  it("keeps the digits and one point, and drops the grouping the field drew", () => {
    expect(sanitizeAmount("20,000")).toBe("20000");
    expect(sanitizeAmount("1,20,000.50")).toBe("120000.50");
    expect(sanitizeAmount("AED 20,000.50")).toBe("20000.50");
    expect(sanitizeAmount("20.00.5")).toBe("20.005");
  });

  it("keeps what is only part way typed, so the next key still lands", () => {
    expect(sanitizeAmount("20.")).toBe("20.");
    expect(sanitizeAmount("20.50")).toBe("20.50"); // not snapped to 20.5 under the caret
    expect(sanitizeAmount("-")).toBe("-");
    expect(sanitizeAmount("")).toBe("");
  });

  it("takes a minus only where one is allowed, and only in front", () => {
    expect(sanitizeAmount("-500")).toBe("-500");
    expect(sanitizeAmount("-500", { allowNegative: false })).toBe("500");
    expect(sanitizeAmount("5-00")).toBe("500");
  });

  it("holds the decimals to a maximum when one is given", () => {
    expect(sanitizeAmount("20.5555", { maxDecimals: 2 })).toBe("20.55");
    expect(sanitizeAmount("20.5", { maxDecimals: 0 })).toBe("205");
    expect(sanitizeAmount("20.5555")).toBe("20.5555"); // no maximum: nothing is dropped
  });
});

describe("what the field shows", () => {
  it("groups the way the country does", () => {
    expect(groupAmount("20000", "en-GB")).toBe("20,000");
    expect(groupAmount("20000", "en-IN")).toBe("20,000");
    expect(groupAmount("120000", "en-IN")).toBe("1,20,000");
    expect(groupAmount("120000", "en-GB")).toBe("120,000");
    expect(groupAmount("12345678", "en-IN")).toBe("1,23,45,678");
  });

  it("leaves the decimals exactly as they were typed", () => {
    expect(groupAmount("20000.50", "en-GB")).toBe("20,000.50");
    expect(groupAmount("20000.", "en-GB")).toBe("20,000.");
    expect(groupAmount(".5", "en-GB")).toBe(".5");
    expect(groupAmount("-20000", "en-GB")).toBe("-20,000");
  });

  it("shows nothing for nothing, and a number held as a number", () => {
    expect(displayAmount("", "en-GB")).toBe("");
    expect(displayAmount(null, "en-GB")).toBe("");
    expect(displayAmount(0, "en-GB")).toBe("0");
    expect(displayAmount(20000.5, "en-GB")).toBe("20,000.5");
  });

  it("is beyond what a double can count exactly", () => {
    expect(groupAmount("12345678901234567890", "en-GB")).toBe("12,345,678,901,234,567,890");
  });
});

describe("where the caret lands", () => {
  // the commas move as the number grows, so the caret is counted in the characters that carry meaning
  it("stays after the digit just typed", () => {
    expect(caretAfter("12,345", meaningBefore("1,2345", 6))).toBe(6); // "1,234|5" -> "12,345|"
    // "2,0|000" is two digits in, which is "20|,000" once the comma has moved along
    expect(caretAfter("20,000", meaningBefore("2,0000", 3))).toBe(2);
  });

  it("sits in front of the first digit when there is nothing before it", () => {
    expect(caretAfter("20,000", 0)).toBe(0);
    expect(caretAfter("20,000.50", meaningBefore("20,000.50", 9))).toBe(9);
  });
});
