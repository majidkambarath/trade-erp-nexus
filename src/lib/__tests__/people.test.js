import { describe, it, expect } from "vitest";
import { isRecordId, personLabel } from "../people.js";

const ID = "6aca1d9b5caae294d2bad5cf";

describe("isRecordId", () => {
  it("knows a database id and nothing else", () => {
    expect(isRecordId(ID)).toBe(true);
    expect(isRecordId(ID.toUpperCase())).toBe(true);
    expect(isRecordId("system")).toBe(false);
    expect(isRecordId("CUST2026001")).toBe(false);
    expect(isRecordId(null)).toBe(false);
    expect(isRecordId("")).toBe(false);
  });
});

describe("personLabel", () => {
  it("prefers the name", () => {
    expect(personLabel("Asha", ID)).toBe("Asha");
  });
  it("never shows an id", () => {
    expect(personLabel("", ID)).toBe("");
    expect(personLabel(null, ID)).toBe("");
  });
  it("keeps a word such as system, capitalised", () => {
    expect(personLabel("", "system")).toBe("System");
  });
  it("is empty when there is nothing", () => {
    expect(personLabel(undefined, undefined)).toBe("");
  });
});
