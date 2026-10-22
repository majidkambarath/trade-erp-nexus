import { describe, expect, it } from "vitest";
import { DIAL_CODES, canDial, dialCodeOf, dialOptions, joinPhone, phoneProblem, splitPhone } from "../phoneNumbers";

// A number is picked in two halves and stored as one. These are the rules for taking it apart and
// putting it back, and for what the field may complain about.

describe("the dialling code table", () => {
  it("knows the countries this product is sold in", () => {
    expect(dialCodeOf("AE")).toBe("971");
    expect(dialCodeOf("IN")).toBe("91");
    expect(dialCodeOf("GB")).toBe("44");
    expect(dialCodeOf("SA")).toBe("966");
    expect(dialCodeOf("ae")).toBe("971"); // the case of the code is nobody's business
  });

  it("gives every North American country the one code they share", () => {
    for (const iso of ["US", "CA", "JM", "BS", "TT", "PR"]) expect(dialCodeOf(iso)).toBe("1");
  });

  it("says so, rather than guessing, for something that is not a country", () => {
    expect(dialCodeOf("XX")).toBe("");
    expect(dialCodeOf("")).toBe("");
    expect(dialCodeOf(null)).toBe("");
    expect(canDial("XX")).toBe(false);
    expect(canDial("AE")).toBe(true);
  });

  it("holds only digits, and nothing silly short or long", () => {
    for (const [iso, code] of Object.entries(DIAL_CODES)) {
      expect(iso, `${iso} is an ISO 3166 alpha-2 code`).toMatch(/^[A-Z]{2}$/);
      expect(code, `${iso}'s dialling code is bare digits`).toMatch(/^[1-9]\d{0,3}$/);
    }
  });
});

describe("the list for the code box", () => {
  it("puts the organisation's own country first, then the rest by name", () => {
    const options = dialOptions("AE");
    expect(options[0]).toMatchObject({ value: "AE", label: "+971", hint: "United Arab Emirates" });
    const names = options.slice(1).map((o) => o.hint);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
    expect(names).not.toContain("United Arab Emirates"); // listed once, at the top
  });

  it("is findable by country, by code and by the ISO letters", () => {
    const india = dialOptions("AE").find((o) => o.value === "IN");
    expect(india.searchText).toMatch(/India/);
    expect(india.searchText).toMatch(/IN/);
    expect(india.searchText).toMatch(/\+91/);
  });

  it("holds every country even when the organisation's own is not one it knows", () => {
    expect(dialOptions("XX")).toHaveLength(Object.keys(DIAL_CODES).length);
    expect(dialOptions("AE")).toHaveLength(Object.keys(DIAL_CODES).length);
  });
});

describe("splitting a stored number into the two halves the field shows", () => {
  it("reads the code off an international number", () => {
    expect(splitPhone("+971501234567", "AE")).toEqual({ iso: "AE", code: "971", national: "501234567" });
    expect(splitPhone("+919876543210", "AE")).toEqual({ iso: "IN", code: "91", national: "9876543210" });
  });

  it("takes the LONGEST code that matches, so a country inside another's range is not mistaken for it", () => {
    // +1 and +1-242 (Bahamas) both start the same way; +7 (Russia) and +971 (UAE) do not overlap, but
    // +97 is the start of +971, +972 and +974, and a two-digit guess would send a Dubai number to no country.
    expect(splitPhone("+97450123456", "AE").code).toBe("974");
    expect(splitPhone("+972501234567", "AE").code).toBe("972");
    expect(splitPhone("+35812345678", "AE").code).toBe("358");
  });

  it("keeps the organisation's own country when it shares the code, so the box does not jump to another one", () => {
    expect(splitPhone("+15551234567", "US").iso).toBe("US");
    expect(splitPhone("+15551234567", "CA").iso).toBe("CA");
    expect(splitPhone("+971501234567", "IN").iso).toBe("AE"); // but the number's own code still wins
  });

  it("reads 00 as the plus it stands for", () => {
    expect(splitPhone("00971501234567", "AE")).toEqual({ iso: "AE", code: "971", national: "501234567" });
  });

  it("ignores the spaces and brackets a number may have been typed with", () => {
    expect(splitPhone("+971 (50) 123-4567", "AE").national).toBe("501234567");
  });

  it("leaves a number saved before this field existed exactly as it is, under the organisation's own country", () => {
    // It is somebody's record: only the person editing the field may change it, so nothing is rewritten
    // on the way to the screen.
    expect(splitPhone("050 111 2222", "AE")).toEqual({ iso: "AE", code: "971", national: "050 111 2222" });
  });

  it("starts empty on the organisation's own country", () => {
    expect(splitPhone("", "IN")).toEqual({ iso: "IN", code: "91", national: "" });
    expect(splitPhone(null, "AE")).toEqual({ iso: "AE", code: "971", national: "" });
    expect(splitPhone("", "XX")).toEqual({ iso: "", code: "", national: "" });
  });

  it("holds an international number whose code belongs to nobody without losing the digits", () => {
    expect(splitPhone("+99912345678", "AE")).toEqual({ iso: "AE", code: "971", national: "99912345678" });
  });
});

describe("putting the two halves back together", () => {
  it("writes the one compact form every rule in the product accepts", () => {
    expect(joinPhone("AE", "501234567")).toBe("+971501234567");
    expect(joinPhone("IN", "9876543210")).toBe("+919876543210");
  });

  it("drops the spaces, brackets and dashes a person types", () => {
    expect(joinPhone("AE", "50 123 4567")).toBe("+971501234567");
    expect(joinPhone("AE", "(50) 123-4567")).toBe("+971501234567");
  });

  it("drops the leading 0 a number is written with at home: with a country code in front it is not dialled", () => {
    expect(joinPhone("AE", "050 123 4567")).toBe("+971501234567");
    expect(joinPhone("GB", "07911 123456")).toBe("+447911123456");
  });

  it("keeps the leading 0 in the few countries where it is part of the number", () => {
    expect(joinPhone("IT", "06 1234 5678")).toBe("+390612345678");
    expect(joinPhone("IT", "0612345678")).toBe("+390612345678");
  });

  it("an empty number is empty whatever country is chosen: a dialling code alone is not a phone number", () => {
    expect(joinPhone("AE", "")).toBe("");
    expect(joinPhone("AE", "   ")).toBe("");
    expect(joinPhone("AE", null)).toBe("");
  });

  it("keeps the digits when the country is unknown, rather than throwing them away", () => {
    expect(joinPhone("", "501234567")).toBe("501234567");
    expect(joinPhone("XX", "501234567")).toBe("501234567");
  });

  it("survives a round trip", () => {
    for (const [iso, stored] of [["AE", "+971501234567"], ["IN", "+919876543210"], ["GB", "+447911123456"]]) {
      const { iso: readIso, national } = splitPhone(stored, iso);
      expect(joinPhone(readIso, national)).toBe(stored);
    }
  });
});

describe("what the field may complain about", () => {
  it("passes a real number", () => {
    expect(phoneProblem("+971501234567")).toBeNull();
    expect(phoneProblem("+971 50 123 4567")).toBeNull();
  });

  it("says nothing about an empty field: whether a number is required is the form's business", () => {
    expect(phoneProblem("")).toBeNull();
    expect(phoneProblem(null)).toBeNull();
  });

  it("refuses letters", () => {
    expect(phoneProblem("+971 50 CALL ME")).toMatch(/digits, spaces, brackets and dashes only/);
  });

  it("knows a number cannot be shorter than seven digits or longer than fifteen", () => {
    expect(phoneProblem("+9715")).toMatch(/too short/);
    expect(phoneProblem("+9715012345678901")).toMatch(/too long/);
    expect(phoneProblem("+971501234567")).toBeNull(); // 12 digits, inside E.164
  });
});
