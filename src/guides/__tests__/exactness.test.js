import { describe, it, expect } from "vitest";
import en from "../i18n/en";
import ar from "../i18n/ar";
import hi from "../i18n/hi";
import ml from "../i18n/ml";
import { GLOSSARY, fixedParts, missingTerms, termsIn, stripFixed } from "../glossary";
import { parseRich } from "../RichText";

const LANGS = [["ar", ar], ["hi", hi], ["ml", ml]];
const lines = (table) => Object.keys(table).filter((k) => k !== "reviewed" && k !== "ui");

describe("the exactness rules", () => {
  describe.each(LANGS)("%s keeps the meaning of the English", (code, table) => {
    it("carries exactly the same on-screen names and examples as English, in every line", () => {
      for (const k of lines(en)) {
        expect(fixedParts(table[k]?.text), `${code} ${k}`).toEqual(fixedParts(en[k].text));
        expect(fixedParts(table[k]?.title), `${code} ${k} title`).toEqual(fixedParts(en[k].title));
      }
    });

    it("renders every business term the glossary's way (one word for one thing)", () => {
      for (const k of lines(en)) {
        for (const part of ["title", "text"]) {
          expect(missingTerms(en[k][part], table[k][part], code), `${code} ${k}.${part}`).toEqual([]);
        }
      }
    });

    it("keeps every number the English has", () => {
      const nums = (s) => (stripFixed(s).match(/\d+/g) || []).sort();
      for (const k of lines(en)) expect(nums(table[k].text), `${code} ${k}`).toEqual(nums(en[k].text));
    });

    it("keeps the full stops, question marks and Latin abbreviations in their own lines", () => {
      for (const k of lines(en)) {
        for (const abbr of ["TRN", "GSTIN", "Zarvia"]) {
          expect(stripFixed(table[k].text).includes(abbr), `${code} ${k} ${abbr}`).toBe(stripFixed(en[k].text).includes(abbr));
        }
      }
    });
  });
});

describe("the glossary", () => {
  it("gives every term a rendering in every language", () => {
    for (const g of GLOSSARY) for (const l of ["ar", "hi", "ml"]) expect(g[l]?.length, `${g.en[0]} ${l}`).toBeGreaterThan(0);
  });
  it("finds the longest term first (sales order, not order)", () => {
    expect(termsIn("Open the sales order and press [[Add Customer]].").map((g) => g.en[0])).toEqual(["sales order"]);
    expect(termsIn("A purchase invoice").map((g) => g.en[0])).toEqual(["invoice"]);
  });
  it("ignores on-screen names and examples (they are never translated)", () => {
    expect(termsIn("Press [[Add Customer]] for {{Net 30 invoice}}.")).toEqual([]);
  });
  it("reports a translation that uses another word", () => {
    expect(missingTerms("Open the invoice.", "Open the bill.", "ar")).toEqual(["invoice"]);
    expect(missingTerms("Open the invoice.", "افتح الفاتورة.", "ar")).toEqual([]);
  });
});

describe("RichText parsing", () => {
  it("splits names, examples and plain text", () => {
    expect(parseRich("Press [[Save]] for {{Net 30}}.")).toEqual([
      { kind: "text", text: "Press " }, { kind: "name", text: "Save" }, { kind: "text", text: " for " }, { kind: "example", text: "Net 30" }, { kind: "text", text: "." },
    ]);
  });
});

// Every translated line has its back-translation (what the translation says, in English), with the same on-screen
// names and examples and the same numbers, so a reviewer who reads one language can compare the others' meaning.
import backAr from "../i18n/back/ar";
import backHi from "../i18n/back/hi";
import backMl from "../i18n/back/ml";

describe.each([["ar", ar, backAr], ["hi", hi, backHi], ["ml", ml, backMl]])("%s back-translation", (code, table, back) => {
  it("exists for every line, with a title and a text", () => {
    for (const k of lines(en)) {
      expect(back[k]?.title, `${code} ${k} title`).toBeTruthy();
      expect(back[k]?.text, `${code} ${k} text`).toBeTruthy();
    }
  });
  it("has no line the translation does not have", () => {
    expect(Object.keys(back).sort()).toEqual(lines(table).sort());
  });
  it("carries the same on-screen names, examples and numbers as the translation", () => {
    const nums = (s) => (stripFixed(s).match(/\d+/g) || []).sort();
    for (const k of lines(en)) {
      expect(fixedParts(back[k].text), `${code} ${k}`).toEqual(fixedParts(table[k].text));
      expect(nums(back[k].text), `${code} ${k} numbers`).toEqual(nums(table[k].text));
    }
  });
});
