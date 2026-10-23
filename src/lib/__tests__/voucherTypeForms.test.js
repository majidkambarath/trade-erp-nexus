// Pure logic behind the Numbering screen: what a number will read, and what the form refuses.
import { describe, expect, it } from "vitest";
import {
  emptyVoucherType, formFrom, longestNumber, previewNumber, scopeLabel, summaryOf,
  validateVoucherType, voucherTypeBody, warningsFor, CONTINUOUS,
} from "../voucherTypeForms";

const so = (over = {}) => ({ ...emptyVoucherType(), key: "SO", name: "Sales invoice", prefix: "SO", ...over });
const branches = [{ code: "main", isHeadOffice: true }, { code: "shj" }];

describe("previewNumber", () => {
  it("draws the number the server would, part for part", () => {
    expect(previewNumber(so())).toBe("SO-2026-0001");
    expect(previewNumber(so(), { branchId: "shj" })).toBe("SHJ-SO-2026-0001");
    expect(previewNumber(so(), { branchId: "main" })).toBe("SO-2026-0001");
    expect(previewNumber(so({ separator: "/" }))).toBe("SO/2026/0001");
    expect(previewNumber(so({ separator: "" }))).toBe("SO20260001");
    expect(previewNumber(so({ includeYear: false }))).toBe("SO-0001");
    expect(previewNumber(so({ numberLength: 6 }), { seq: 42 })).toBe("SO-2026-000042");
    expect(previewNumber(so({ suffix: "A" }))).toBe("SO-2026-0001-A");
    expect(previewNumber(so({ prefix: "inv" }))).toBe("INV-2026-0001");
    expect(previewNumber(so({ branchPrefix: "none" }), { branchId: "shj" })).toBe("SO-2026-0001");
    expect(previewNumber(so({ branchPrefixes: [{ branchId: "shj", prefix: "SH" }] }), { branchId: "shj" })).toBe("SH-SO-2026-0001");
  });

  it("knows the longest it can ever read, which is what a length limit is judged against", () => {
    expect(longestNumber(so())).toBe("SO-2026-9999");
    expect(longestNumber(so(), { branchId: "shj" })).toBe("SHJ-SO-2026-9999");
    expect(longestNumber(so(), { branchId: "shj" })).toHaveLength(16);
  });
});

describe("validateVoucherType", () => {
  it("accepts the defaults and refuses a number that cannot work", () => {
    expect(validateVoucherType(so())).toEqual({});
    expect(validateVoucherType(so({ name: "" })).name).toBeTruthy();
    expect(validateVoucherType(so({ name: "n".repeat(61) })).name).toBeTruthy();
    expect(validateVoucherType(so({ prefix: "" })).prefix).toBeTruthy();
    expect(validateVoucherType(so({ prefix: "SO-X" })).prefix).toBeTruthy();
    expect(validateVoucherType(so({ suffix: "TOOLONG" })).suffix).toBeTruthy();
    expect(validateVoucherType(so({ numberLength: 2 })).numberLength).toBeTruthy();
    expect(validateVoucherType(so({ numberLength: 11 })).numberLength).toBeTruthy();
    expect(validateVoucherType(so({ numberLength: "" })).numberLength).toBeTruthy();
  });

  it("refuses a continuous counter that still carries the year", () => {
    expect(validateVoucherType(so({ resetPolicy: "never" })).includeYear).toBeTruthy();
    expect(validateVoucherType(so({ resetPolicy: "never", includeYear: false }))).toEqual({});
  });

  it("refuses re-use on a tax document, and judges the 16-character cap in the longest-coded branch", () => {
    expect(validateVoucherType(so({ allowReuse: true }), { statutory: true }).allowReuse).toBeTruthy();
    expect(validateVoucherType(so({ allowReuse: true }), { statutory: false })).toEqual({});
    expect(validateVoucherType(so({ allowReuse: true }), { kind: "system" }).allowReuse).toBeTruthy();
    expect(validateVoucherType(so({ method: "auto_override" }), { kind: "system" }).method).toBeTruthy();

    expect(validateVoucherType(so(), { statutory: true, branches })).toEqual({});
    expect(validateVoucherType(so({ numberLength: 5 }), { statutory: true, branches }).numberLength).toMatch(/16 at most/);
    expect(validateVoucherType(so({ numberLength: 5 }), { statutory: false, branches })).toEqual({});
    expect(validateVoucherType(so(), { statutory: true, branches: [{ code: "jebel-ali-free-zone" }] }).numberLength).toMatch(/JEBEL-ALI-FREE-ZONE/);
  });

  it("asks a new type for a code and a parent, and only then", () => {
    expect(validateVoucherType(so({ key: "", parentKey: "" }), { isNew: false })).toEqual({});
    const e = validateVoucherType(so({ key: "", parentKey: "" }), { isNew: true });
    expect(e.key).toBeTruthy();
    expect(e.parentKey).toBeTruthy();
    expect(validateVoucherType(so({ key: "X" }), { isNew: true, takenKeys: [] }).key).toBeTruthy();
    expect(validateVoucherType(so({ key: "PV", parentKey: "PV" }), { isNew: true, takenKeys: ["PV"] }).key).toMatch(/already in use/);
    expect(validateVoucherType(so({ key: "PCV", parentKey: "PV" }), { isNew: true, takenKeys: ["PV"] })).toEqual({});
  });
});

describe("the rest", () => {
  it("says what is unusual without calling it a mistake", () => {
    expect(warningsFor(so({ resetPolicy: "never", includeYear: false })).join(" ")).toMatch(/not say which year/);
    expect(warningsFor(so({ branchPrefix: "none" }), { branches }).join(" ")).toMatch(/same number/);
    expect(warningsFor(so({ branchPrefix: "none" }), { branches: [{ code: "main" }] })).toEqual([]);
    expect(warningsFor(so({ separator: "" })).join(" ")).toMatch(/run together/);
    expect(warningsFor(so({ allowReuse: true })).join(" ")).toMatch(/given to the next document/);
    expect(warningsFor(so())).toEqual([]);
  });

  it("sends only what may change, and upper-cases the parts of the number", () => {
    const body = voucherTypeBody(so({ name: "  Sales invoice  ", prefix: "inv", suffix: "a", numberLength: "5" }));
    expect(body.name).toBe("Sales invoice");
    expect(body.prefix).toBe("INV");
    expect(body.suffix).toBe("A");
    expect(body.numberLength).toBe(5);
    expect(body.key).toBeUndefined();
    expect(body.parentKey).toBeUndefined();
    const made = voucherTypeBody(so({ key: "pcv", parentKey: "pv" }), { isNew: true });
    expect(made.key).toBe("PCV");
    expect(made.parentKey).toBe("PV");
  });

  it("opens a stored row as a form, and sums it up in one line", () => {
    const f = formFrom({ key: "JV", name: "Journal", prefix: "JV", resetPolicy: "never", includeYear: false, allowReuse: true, method: "auto_override" });
    expect(f.branchPrefixes).toEqual([]);
    expect(f.suffix).toBe("");
    expect(summaryOf(f)).toBe("JV-0001 · counts on for good · can be typed · deleted numbers re-used");
    expect(summaryOf(so())).toBe("SO-2026-0001 · restarts each year");
    expect(scopeLabel("2026")).toMatch(/2026/);
    expect(scopeLabel(CONTINUOUS)).toMatch(/continuous/i);
  });
});
