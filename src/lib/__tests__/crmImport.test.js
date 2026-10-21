import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import {
  CONTACT_FIELDS, LEAD_FIELDS, LOT, MAX_FILE_ROWS, columnLabel, columnLetter, guessMapping, issueText, lots, mappedRows, mergeResults,
  missingFields, readSpreadsheet, sendInLots, templateFor,
} from "../crmImport";

// A File as far as the reader needs one (the same stand-in statementFile.test.js uses).
const fileOf = (name, content) => {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  return { name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};

describe("which column is which", () => {
  it("is guessed from the headings people actually use", () => {
    const map = guessMapping(["Full Name", "Company Name", "Mobile", "E-mail", "Lead Source", "Budget", "Assigned To", "Remarks"], LEAD_FIELDS);
    expect(map).toMatchObject({ name: 0, company: 1, phone: 2, email: 3, source: 4, expectedValue: 5, owner: 6, notes: 7 });
    expect(map.city).toBeNull(); // nothing in the file is a city: left for the person to say
  });

  it("is not thrown by case, punctuation or spacing", () => {
    expect(guessMapping(["  NAME ", "e-mail", "PHONE_NUMBER"], LEAD_FIELDS)).toMatchObject({ name: 0, email: 1, phone: 2 });
  });

  it("uses a column once, so 'Contact name' is the name and not also the company", () => {
    const map = guessMapping(["Contact Name", "Customer"], CONTACT_FIELDS);
    expect(map.name).toBe(0);
    expect(map.company).toBe(1);
  });

  it("matches a heading that merely CONTAINS a word we know, as whole words", () => {
    expect(guessMapping(["Customer mobile no", "Name"], LEAD_FIELDS)).toMatchObject({ name: 1, phone: 0 });
    // "Rep" must not be found inside "Report"
    expect(guessMapping(["Name", "Report date"], LEAD_FIELDS).owner).toBeNull();
  });

  it("prefers an exact heading over one that only contains it", () => {
    const map = guessMapping(["Phone notes", "Phone", "Name"], LEAD_FIELDS);
    expect(map.phone).toBe(1);
  });

  it("says which required field nobody could be found for", () => {
    expect(missingFields(guessMapping(["Phone", "Email"], LEAD_FIELDS), LEAD_FIELDS).map((f) => f.key)).toEqual(["name"]);
    expect(missingFields(guessMapping(["Name"], LEAD_FIELDS), LEAD_FIELDS)).toEqual([]);
    expect(missingFields({}, CONTACT_FIELDS).map((f) => f.key)).toEqual(["name"]);
  });

  it("copes with a file whose first row is empty or odd", () => {
    expect(guessMapping([], LEAD_FIELDS).name).toBeNull();
    expect(guessMapping([null, undefined, 5, ""], LEAD_FIELDS).name).toBeNull();
  });
});

describe("spreadsheet columns", () => {
  it("are lettered the way a spreadsheet letters them", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetter)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  });

  it("tell two columns headed alike apart", () => {
    expect(columnLabel(2, "Phone")).toBe("Phone - column C");
    expect(columnLabel(4, "  ")).toBe("(no heading) - column E");
  });
});

describe("the rows to send", () => {
  const grid = [
    ["Name", "Phone", "Notes"],
    ["Ali", "0501", "first"],
    ["", "", ""], // a blank line in the sheet
    ["Sara", 971502222222, "second"],
    ["  ", " ", ""], // spaces only
    ["Omar"], // a short row
  ];
  const map = { name: 0, phone: 1, notes: 2 };

  it("skip the header and the blank lines, and number each as the person's own spreadsheet does", () => {
    const rows = mappedRows(grid, map, LEAD_FIELDS);
    expect(rows.map((r) => r.line)).toEqual([2, 4, 6]);
    expect(rows[0]).toEqual({ line: 2, name: "Ali", phone: "0501", notes: "first" });
  });

  it("keep a number a number, and fill a short row's missing cells with nothing", () => {
    const rows = mappedRows(grid, map, LEAD_FIELDS);
    expect(rows[1].phone).toBe(971502222222);
    expect(rows[2]).toEqual({ line: 6, name: "Omar", phone: "", notes: "" });
  });

  it("carry only the fields that have a column", () => {
    const rows = mappedRows(grid, { name: 0 }, LEAD_FIELDS);
    expect(Object.keys(rows[0]).sort()).toEqual(["line", "name"]);
    expect(mappedRows([["Name"]], map, LEAD_FIELDS)).toEqual([]); // a header and nothing under it
    expect(mappedRows(undefined, map, LEAD_FIELDS)).toEqual([]);
  });
});

describe("lots", () => {
  it("cut a file into the pieces the server accepts, in order", () => {
    const rows = Array.from({ length: 450 }, (_, i) => i);
    const cut = lots(rows);
    expect(cut.map((l) => l.length)).toEqual([LOT, LOT, 50]);
    expect(cut.flat()).toEqual(rows);
    expect(lots([])).toEqual([]);
  });

  it("match the server's own limit, so a lot is never refused for its size", () => {
    expect(LOT).toBe(200);
    expect(MAX_FILE_ROWS).toBeGreaterThan(LOT);
  });
});

describe("putting the answers back together", () => {
  const answer = (over = {}) => ({
    dryRun: true,
    summary: { total: 3, create: 2, invalid: 1, duplicate: 0, skipped: 0 },
    issues: [{ line: 4, status: "invalid" }],
    sample: [{ name: "A" }, { name: "B" }],
    ...over,
  });

  it("adds the counts, keeps the rows to look at in file order, and shows the first few to be made", () => {
    const merged = mergeResults([answer(), answer({ issues: [{ line: 9, status: "duplicate" }], summary: { total: 5, create: 3, invalid: 0, duplicate: 1, skipped: 1 }, sample: [{ name: "C" }, { name: "D" }, { name: "E" }, { name: "F" }] })]);
    expect(merged.summary).toMatchObject({ total: 8, create: 5, invalid: 1, duplicate: 1, skipped: 1 });
    expect(merged.issues.map((i) => i.line)).toEqual([4, 9]);
    expect(merged.sample.map((s) => s.name)).toEqual(["A", "B", "C", "D", "E"]); // five, however many lots
    expect(merged.dryRun).toBe(true);
  });

  it("knows when it was a real import, and adds what was made and what failed", () => {
    const real = (n) => ({ dryRun: false, summary: { total: n, create: n, invalid: 0, duplicate: 0, skipped: 0, created: n, failed: 0 }, issues: [], failed: [], created: Array.from({ length: n }, (_, i) => ({ id: `id${n}${i}` })) });
    const merged = mergeResults([real(2), real(3)]);
    expect(merged.dryRun).toBe(false);
    expect(merged.summary.created).toBe(5);
    expect(merged.createdIds).toHaveLength(5);
  });

  it("caps the list of problems, and says it did", () => {
    const issues = Array.from({ length: 500 }, (_, i) => ({ line: i + 2, status: "invalid" }));
    const merged = mergeResults([answer({ issues })], { issueLimit: 300 });
    expect(merged.issues).toHaveLength(300);
    expect(merged.truncated).toBe(true);
    expect(mergeResults([answer()]).truncated).toBe(false);
  });

  it("copes with nothing, and with an answer that has gaps", () => {
    expect(mergeResults([]).summary.total).toBe(0);
    expect(mergeResults([null, {}]).summary.create).toBe(0);
  });
});

describe("sending in lots", () => {
  const rows = Array.from({ length: 450 }, (_, i) => ({ line: i + 2, name: `L${i}` }));
  const ok = (lot) => Promise.resolve({ dryRun: true, summary: { total: lot.length, create: lot.length, invalid: 0, duplicate: 0, skipped: 0 }, issues: [], sample: lot.slice(0, 5) });

  it("sends the lots one after another, never together, and reports progress", async () => {
    const order = [];
    let inFlight = 0;
    let most = 0;
    const send = async (lot) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      order.push(lot[0].line);
      await Promise.resolve();
      inFlight -= 1;
      return ok(lot);
    };
    const progress = vi.fn();
    const out = await sendInLots(rows, send, { onProgress: progress });
    expect(order).toEqual([2, 202, 402]);
    expect(most).toBe(1); // the second lot must see what the first made
    expect(progress.mock.calls.map((c) => c[0])).toEqual([0, 200, 400, 450]);
    expect(out.summary.total).toBe(450);
    expect(out.error).toBeUndefined();
  });

  it("stops at a lot that fails and hands back what the earlier ones did, with the failure beside it", async () => {
    let n = 0;
    const send = async (lot) => {
      n += 1;
      if (n === 2) throw new Error("Network Error");
      return ok(lot);
    };
    const out = await sendInLots(rows, send);
    expect(out.error.message).toBe("Network Error");
    expect(out.stoppedAt).toBe(200); // rows the server answered for before it stopped
    expect(out.summary.total).toBe(200);
    expect(n).toBe(2); // and it did not go on to the third
  });

  it("sends nothing for no rows", async () => {
    const send = vi.fn();
    const out = await sendInLots([], send);
    expect(send).not.toHaveBeenCalled();
    expect(out.summary.total).toBe(0);
  });
});

describe("what a row that needs a look is called", () => {
  it("says what is wrong with a row, and how many other things", () => {
    expect(issueText({ line: 5, status: "invalid", errors: [{ message: "Give the person or company a name" }] })).toBe("Line 5: Give the person or company a name");
    expect(issueText({ line: 6, status: "invalid", errors: [{ message: "A" }, { message: "B" }, { message: "C" }] })).toBe("Line 6: A (and 2 more)");
    expect(issueText({ line: 7, status: "invalid" })).toBe("Line 7: This row cannot be read");
  });

  it("says what a duplicate is a duplicate of, and by what", () => {
    expect(issueText({ line: 8, status: "duplicate", duplicateOf: { kind: "lead", by: "phone" } })).toBe("Line 8: already a lead (same phone number)");
    expect(issueText({ line: 9, status: "duplicate", duplicateOf: { kind: "customer", by: "email" } })).toBe("Line 9: already a customer (same email)");
    expect(issueText({ line: 10, status: "duplicate", duplicateOf: { kind: "file", line: 3, by: "email" } })).toBe("Line 10: repeats line 3 (same email)");
    expect(issueText({ line: 11, status: "duplicate", duplicateOf: { kind: "contact", by: "name" } })).toBe("Line 11: already one of your contacts (same name)");
    expect(issueText({ line: 12, status: "duplicate" })).toBe("Line 12: already held");
  });

  it("says why a row was left out, and what a warning is about", () => {
    expect(issueText({ line: 13, status: "skipped", reason: '"Nobody Co" is not a customer' })).toBe('Line 13: "Nobody Co" is not a customer');
    expect(issueText({ line: 14, status: "create", warnings: [{ message: "Nobody called Ghost can be given CRM work" }] })).toBe("Line 14: Nobody called Ghost can be given CRM work");
  });
});

describe("reading the file itself", () => {
  it("turns a CSV into a header and rows", async () => {
    const read = await readSpreadsheet(fileOf("leads.csv", "Name,Phone,Value\nAli,0501,\"1,200\"\nSara,0502,300\n"));
    expect(read.fileName).toBe("leads.csv");
    expect(read.grid).toEqual([["Name", "Phone", "Value"], ["Ali", "0501", "1,200"], ["Sara", "0502", "300"]]);
  });

  it("keeps a phone number's leading zero when it is text, and takes an Excel sheet the same way", async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Name", "Phone"], ["Ali", "0501234567"]]), "Sheet1");
    const bytes = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
    const read = await readSpreadsheet(fileOf("leads.xlsx", bytes));
    expect(read.grid[1]).toEqual(["Ali", "0501234567"]);
  });

  it("refuses a bank statement in words, because it is not a list of people", async () => {
    await expect(readSpreadsheet(fileOf("stmt.sta", ":20:STMT\n:25:AE07\n:60F:C261001AED100,00\n:62F:C261005AED100,00"))).rejects.toThrow(/bank statement/);
  });

  it("refuses a file with a header and nothing under it, and one that is empty", async () => {
    await expect(readSpreadsheet(fileOf("a.csv", "Name,Phone\n"))).rejects.toThrow(/nothing under it|no rows/);
    await expect(readSpreadsheet(fileOf("b.csv", ""))).rejects.toThrow(/no rows/);
  });

  it("refuses a file too big to watch a bar for", async () => {
    const body = ["Name"].concat(Array.from({ length: MAX_FILE_ROWS + 1 }, (_, i) => `P${i}`)).join("\n");
    await expect(readSpreadsheet(fileOf("big.csv", body))).rejects.toThrow(new RegExp(`up to ${MAX_FILE_ROWS}`));
  });
});

describe("the template", () => {
  it("uses headings the guess recognises, so a person who fills it in never has to match a column", () => {
    for (const kind of ["lead", "contact"]) {
      const t = templateFor(kind);
      const fields = kind === "contact" ? CONTACT_FIELDS : LEAD_FIELDS;
      const map = guessMapping(t.headers, fields);
      expect(missingFields(map, fields), kind).toEqual([]);
      // every heading the template has is recognised as SOME field (the template leaves out only the optional ones)
      const recognised = Object.values(map).filter((i) => i !== null);
      expect(recognised.sort(), kind).toEqual(t.headers.map((_, i) => i));
      expect(t.rows.every((r) => r.length === t.headers.length)).toBe(true);
    }
    expect(templateFor("lead").fileName).toMatch(/\.csv$/);
  });
});
