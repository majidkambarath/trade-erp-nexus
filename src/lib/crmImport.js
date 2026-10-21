// Bringing a spreadsheet into the CRM, the browser's half: read the file, work out which column is which, build the rows
// the server asks for, send them in lots, and put the answers back together. Pure apart from `readSpreadsheet`, so every
// awkward header and every half-failed import is a test.
//
// The SERVER decides what each row means (utils/crmImport.js on the backend): which are valid, which we already hold,
// what a source word or an amount means. This only gets the file there, numbered the way the person's own spreadsheet is
// (the header is line 1), so a message that says "line 14" points at a row they can find.
import { readStatementFile } from "./statementFile";

/** Rows per request: the server's limit (utils/crmImport.js MAX_ROWS). A bigger file goes in lots. */
export const LOT = 200;
/** What one file may hold. Beyond this the person is better served splitting it than watching a bar for ten minutes. */
export const MAX_FILE_ROWS = 5000;

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// What each column may be called in somebody's spreadsheet. `required` fields must be matched before a file can be read.
export const LEAD_FIELDS = [
  { key: "name", label: "Name", required: true, aliases: ["name", "full name", "contact name", "contact person", "person", "lead name", "lead", "customer name"] },
  { key: "company", label: "Company", aliases: ["company", "company name", "organisation", "organization", "business", "firm", "account"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number", "mobile", "mobile number", "tel", "telephone", "contact number", "cell", "whatsapp", "whatsapp number"] },
  { key: "email", label: "Email", aliases: ["email", "e mail", "email address", "mail"] },
  { key: "city", label: "City", aliases: ["city", "town", "location", "area", "emirate"] },
  { key: "source", label: "Where from", aliases: ["source", "lead source", "channel", "came from", "origin", "where from"] },
  { key: "sourceNote", label: "Source detail", aliases: ["source detail", "source note", "referred by", "referrer", "campaign"] },
  { key: "interest", label: "Wants", aliases: ["interest", "requirement", "requirements", "enquiry", "inquiry", "needs", "product", "wants", "looking for", "interested in"] },
  { key: "expectedValue", label: "May be worth", aliases: ["value", "expected value", "amount", "budget", "deal value", "worth", "potential"] },
  { key: "owner", label: "Chased by", aliases: ["owner", "assigned to", "salesperson", "sales person", "sales rep", "handled by", "assignee", "rep"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "remarks", "comments", "comment", "description"] },
];

export const CONTACT_FIELDS = [
  { key: "name", label: "Name", required: true, aliases: ["name", "full name", "contact name", "contact person", "person"] },
  { key: "designation", label: "Job title", aliases: ["designation", "title", "job title", "position", "role"] },
  { key: "email", label: "Email", aliases: ["email", "e mail", "email address", "mail"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number", "mobile", "mobile number", "tel", "telephone", "contact number", "cell", "whatsapp"] },
  { key: "company", label: "Company", aliases: ["company", "company name", "customer", "organisation", "organization", "business", "firm", "account"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "remarks", "comments", "comment"] },
];

/** A column the way a spreadsheet names it: 0 is A, 25 is Z, 26 is AA. */
export function columnLetter(index) {
  let n = Number(index) + 1;
  let out = "";
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** What the column picker shows for one column: its heading, and where it is in the sheet, so two headed "Phone" can be told apart. */
export const columnLabel = (index, header) => `${String(header ?? "").trim() || "(no heading)"} - column ${columnLetter(index)}`;

export const fieldsFor = (kind) => (kind === "contact" ? CONTACT_FIELDS : LEAD_FIELDS);

/**
 * Which file column is which field: `{ [fieldKey]: columnIndex | null }`. An exact match on a header wins; failing that, a
 * header that CONTAINS an alias as whole words does ("Customer mobile no" is a phone). Each column is used once, and the
 * fields are served in order, so a column called "Contact name" is the name and not also the person's company.
 */
export function guessMapping(headers = [], fields = LEAD_FIELDS) {
  const heads = headers.map(norm);
  const used = new Set();
  const out = Object.fromEntries(fields.map((f) => [f.key, null]));
  const take = (field, test) => {
    for (let i = 0; i < heads.length; i += 1) {
      if (used.has(i) || !heads[i]) continue;
      if (field.aliases.some((a) => test(heads[i], norm(a)))) {
        out[field.key] = i;
        used.add(i);
        return;
      }
    }
  };
  for (const f of fields) take(f, (h, a) => h === a);
  for (const f of fields) if (out[f.key] === null) take(f, (h, a) => ` ${h} `.includes(` ${a} `));
  return out;
}

/** What is still needed before the file can be read: the required fields that no column was chosen for. */
export const missingFields = (mapping = {}, fields = LEAD_FIELDS) => fields.filter((f) => f.required && (mapping[f.key] === null || mapping[f.key] === undefined));

const blank = (row) => !row.some((c) => String(c ?? "").trim() !== "");

/**
 * The rows to send. The first row of the grid is the header; every other row that is not entirely blank becomes one
 * object of the fields that have a column, carrying `line` - its place in the person's file, where the header is line 1.
 */
export function mappedRows(grid = [], mapping = {}, fields = LEAD_FIELDS) {
  const out = [];
  for (let i = 1; i < grid.length; i += 1) {
    const cells = Array.isArray(grid[i]) ? grid[i] : [];
    if (blank(cells)) continue;
    const row = { line: i + 1 };
    for (const f of fields) {
      const col = mapping[f.key];
      if (col !== null && col !== undefined) row[f.key] = cells[col] ?? "";
    }
    out.push(row);
  }
  return out;
}

export const lots = (rows = [], size = LOT) => {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

const EMPTY = () => ({ total: 0, create: 0, invalid: 0, duplicate: 0, skipped: 0, created: 0, failed: 0 });

/**
 * One answer from the lots. The counts add up; the rows a person has to look at are kept, in file order, up to a limit
 * (a file that is wrong on every row must not make a page of ten thousand lines); `sample` is the first few rows that
 * will be made, so the preview can show what is about to happen.
 */
export function mergeResults(answers = [], { issueLimit = 300 } = {}) {
  const out = { dryRun: answers.length ? answers.every((a) => a?.dryRun !== false) : true, summary: EMPTY(), issues: [], failed: [], sample: [], createdIds: [] };
  for (const a of answers) {
    if (!a) continue;
    for (const k of Object.keys(out.summary)) out.summary[k] += Number(a.summary?.[k]) || 0;
    out.issues.push(...(a.issues || []));
    out.failed.push(...(a.failed || []));
    if (out.sample.length < 5) out.sample.push(...(a.sample || []).slice(0, 5 - out.sample.length));
    out.createdIds.push(...(a.created || []).map((c) => c.id));
  }
  out.truncated = out.issues.length > issueLimit;
  out.issues = out.issues.slice(0, issueLimit);
  return out;
}

/**
 * Send every lot in turn - never together: each is a few writes per row, and the second lot must see what the first made
 * (that is how a row repeated across the lots is caught). `send(lot)` is the API call; `onProgress(done, total)` feeds the
 * bar. If a lot fails outright (no network, a refusal) the lots already answered are kept and the failure is returned
 * beside them, so a person is told what was done before it stopped, not left to guess.
 */
export async function sendInLots(rows, send, { size = LOT, onProgress } = {}) {
  const all = lots(rows, size);
  const answers = [];
  let done = 0;
  onProgress?.(0, rows.length);
  for (const lot of all) {
    try {
      answers.push(await send(lot));
    } catch (error) {
      return { ...mergeResults(answers), error, stoppedAt: done };
    }
    done += lot.length;
    onProgress?.(done, rows.length);
  }
  return mergeResults(answers);
}

const DUPLICATE_OF = { lead: "already a lead", customer: "already a customer", contact: "already one of your contacts" };
const BY = { email: "email", phone: "phone number", name: "name" };

/** One row a person has to look at, in a sentence: where it is in their file, and what to do about it. */
export function issueText(issue = {}) {
  const where = `Line ${issue.line}`;
  if (issue.status === "invalid") {
    const first = issue.errors?.[0]?.message || "This row cannot be read";
    const more = (issue.errors?.length || 0) - 1;
    return `${where}: ${first}${more > 0 ? ` (and ${more} more)` : ""}`;
  }
  if (issue.status === "duplicate") {
    const of = issue.duplicateOf || {};
    const by = BY[of.by] ? ` (same ${BY[of.by]})` : "";
    return of.kind === "file" ? `${where}: repeats line ${of.line}${by}` : `${where}: ${DUPLICATE_OF[of.kind] || "already held"}${by}`;
  }
  if (issue.status === "skipped") return `${where}: ${issue.reason || "left out"}`;
  return `${where}: ${issue.warnings?.[0]?.message || "check this row"}`;
}

export const issueTone = (issue = {}) => (issue.status === "invalid" ? "danger" : issue.status === "create" ? "warning" : "default");

/** A file read in the browser: a grid of cells with a header row. Anything that is not a list is refused in words. */
export async function readSpreadsheet(file) {
  const read = await readStatementFile(file);
  if (read.kind !== "grid") throw new Error("This looks like a bank statement, not a list. Use a CSV or Excel file with one row per person.");
  const rows = read.rows;
  if (rows.length < 2) throw new Error("This file has a header row and nothing under it");
  if (rows.length - 1 > MAX_FILE_ROWS) throw new Error(`This file has ${rows.length - 1} rows; import up to ${MAX_FILE_ROWS} at a time`);
  return { fileName: read.fileName, grid: rows };
}

/** What a person downloads to see the shape we read: the headers we recognise and two rows to copy from. */
export const templateFor = (kind) =>
  kind === "contact"
    ? {
        fileName: "crm-people-template.csv",
        headers: ["Name", "Job title", "Email", "Phone", "Company", "Notes"],
        rows: [
          ["Omar Hassan", "Purchasing manager", "omar@alnoor.example", "+971 50 123 4567", "Al Noor Foods", "Prefers a call before 11"],
          ["Priya Nair", "Owner", "priya@example.com", "+971 55 987 6543", "", "Met at the expo"],
        ],
      }
    : {
        fileName: "crm-leads-template.csv",
        headers: ["Name", "Company", "Phone", "Email", "City", "Source", "Wants", "Value", "Owner", "Notes"],
        rows: [
          ["Hassan Al Noor", "Al Noor Foods", "+971 50 123 4567", "hassan@alnoor.example", "Dubai", "Referral", "200 bags of flour a week", "45000", "", ""],
          ["Priya Nair", "", "+971 55 987 6543", "", "Sharjah", "WhatsApp", "Price list", "", "", "Asked on Friday"],
        ],
      };
