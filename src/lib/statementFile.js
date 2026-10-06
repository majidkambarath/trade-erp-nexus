// Reading a bank statement file in the browser. A CSV or Excel sheet becomes a grid of cells and an
// MT940 file stays as text; the SERVER does the real reading (utils/bankStatement.js on the backend),
// so there is one set of rules for dates, signs and columns and the preview shows what it will do.
// This only turns a file into something that can be sent: dates become "YYYY-MM-DD", numbers stay
// numbers, text stays text.

export const MAX_ROWS = 20000;

const pad = (n) => String(n).padStart(2, "0");

// One cell to something JSON can carry. A date cell (Excel) is read as the calendar day the person
// sees. Excel stores a date as a local moment, and some versions of the reader are a few seconds
// out, so the time is rounded to the nearest minute first and only then cut to a day.
export function cellValue(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const d = new Date(Math.round(v.getTime() / 60000) * 60000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  return String(v).trim();
}

export function gridFromRows(rows) {
  return rows.slice(0, MAX_ROWS).map((r) => (Array.isArray(r) ? r.map(cellValue) : []));
}

// A sheet with nothing in it (an empty file reads as one empty cell) has no rows to read.
const hasContent = (grid) => grid.some((row) => row.some((c) => c !== ""));

// ":20:" and a balance field are what an MT940 statement starts with.
export const looksLikeMt940 = (text) => /(^|\n)\s*:20:/.test(text) && /(^|\n)\s*:6[02][FM]:/.test(text);

const BOM = String.fromCharCode(0xfeff); // written this way so no invisible character sits in the source
const decode = (buffer) => {
  const text = new TextDecoder("utf-8").decode(buffer);
  return text.startsWith(BOM) ? text.slice(1) : text;
};

// { kind: "grid", rows, fileName } | { kind: "mt940", text, fileName }
export async function readStatementFile(file) {
  const fileName = file.name || "statement";
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const buffer = await file.arrayBuffer();
  if (["xlsx", "xls", "xlsm"].includes(ext)) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("This workbook has no sheet to read");
    const grid = gridFromRows(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }));
    if (!hasContent(grid)) throw new Error("This file has no rows to read");
    return { kind: "grid", fileName, rows: grid };
  }
  const text = decode(buffer);
  if (["sta", "mt940", "940"].includes(ext) || looksLikeMt940(text)) return { kind: "mt940", fileName, text };
  const XLSX = await import("xlsx");
  // raw: every value stays the text the bank wrote (a date is not guessed at, a number keeps its commas)
  const workbook = XLSX.read(text, { type: "string", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = gridFromRows(sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) : []);
  if (!hasContent(grid)) throw new Error("This file has no rows to read");
  return { kind: "grid", fileName, rows: grid };
}
