import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { cellValue, gridFromRows, looksLikeMt940, readStatementFile } from "../statementFile";

// a File as far as the reader needs one
const fileOf = (name, content) => {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  return { name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};

describe("cells", () => {
  it("a date is the calendar day the person sees, even a few seconds either side of midnight", () => {
    expect(cellValue(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(cellValue(new Date(2026, 9, 5, 0, 0, 20))).toBe("2026-10-05");
    expect(cellValue(new Date(2026, 9, 4, 23, 59, 40))).toBe("2026-10-05"); // a reader that is 20 seconds early
    expect(cellValue(new Date(2026, 9, 5, 14, 30))).toBe("2026-10-05");
    expect(cellValue(new Date("nonsense"))).toBe("");
  });

  it("numbers stay numbers and text is trimmed", () => {
    expect(cellValue(1050.5)).toBe(1050.5);
    expect(cellValue("  AL NOOR  ")).toBe("AL NOOR");
    expect(cellValue(null)).toBe("");
    expect(cellValue(undefined)).toBe("");
    expect(cellValue(NaN)).toBe("");
  });

  it("a grid is rows of cells, capped", () => {
    expect(gridFromRows([[new Date(2026, 9, 5), 5, " x "], "not a row"])).toEqual([["2026-10-05", 5, "x"], []]);
  });
});

describe("telling an MT940 file from a spreadsheet", () => {
  it("looks for the statement and balance fields", () => {
    expect(looksLikeMt940(":20:STMT\n:25:AE07\n:60F:C261001AED100,00\n:62F:C261005AED100,00")).toBe(true);
    expect(looksLikeMt940("Date,Description,Amount\n05/10/2026,SHOP,5")).toBe(false);
  });
});

describe("reading a file", () => {
  it("a CSV keeps every value as the bank wrote it: dates are not guessed at, commas stay", async () => {
    const csv = "Account statement,,,\nDate,Description,Debit,Credit,Balance\n05/10/2026,TRANSFER IN,,\"1,050.00\",\"11,050.00\"\n06/10/2026,FEE,21.00,,\"11,029.00\"\n";
    const out = await readStatementFile(fileOf("oct.csv", csv));
    expect(out.kind).toBe("grid");
    expect(out.fileName).toBe("oct.csv");
    expect(out.rows[1]).toEqual(["Date", "Description", "Debit", "Credit", "Balance"]);
    expect(out.rows[2]).toEqual(["05/10/2026", "TRANSFER IN", "", "1,050.00", "11,050.00"]);
    expect(out.rows[3][2]).toBe("21.00");
  });

  it("a BOM at the start of a CSV is ignored", async () => {
    const out = await readStatementFile(fileOf("x.csv", "﻿Date,Amount\n05/10/2026,5"));
    expect(out.rows[0][0]).toBe("Date");
  });

  it("an Excel workbook: date cells come out as days, numbers as numbers", async () => {
    const ws = XLSX.utils.aoa_to_sheet([["Date", "Description", "Debit", "Credit"], [new Date(2026, 9, 5), "TRANSFER IN", null, 1050.5], [new Date(2026, 9, 6), "FEE", 21, null]], { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const out = await readStatementFile(fileOf("oct.xlsx", new Uint8Array(buffer)));
    expect(out.kind).toBe("grid");
    expect(out.rows[0]).toEqual(["Date", "Description", "Debit", "Credit"]);
    expect(out.rows[1][0]).toBe("2026-10-05");
    expect(out.rows[1][3]).toBe(1050.5);
    expect(out.rows[2][0]).toBe("2026-10-06");
    expect(out.rows[2][2]).toBe(21);
  });

  it("an MT940 file is kept as text for the server", async () => {
    const text = ":20:STMT\n:25:AE07\n:60F:C261001AED10000,00\n:61:2610021002C1050,00NTRFNONREF\n:86:TRANSFER\n:62F:C261002AED11050,00\n";
    const byName = await readStatementFile(fileOf("oct.sta", text));
    expect(byName).toEqual({ kind: "mt940", fileName: "oct.sta", text });
    const byContent = await readStatementFile(fileOf("oct.txt", text));
    expect(byContent.kind).toBe("mt940");
  });

  it("an empty file says so", async () => {
    await expect(readStatementFile(fileOf("empty.csv", ""))).rejects.toThrow(/no rows/);
  });
});
