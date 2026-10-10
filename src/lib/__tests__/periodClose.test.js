import { describe, it, expect } from "vitest";
import { closedNote, closedToast, defaultYear, lockSentence, monthAction, reopenedToast, statusLabel } from "../periodClose";
import { closedNote as yearNote } from "../yearEnd";

// The small things around the month close: which year the list opens on, how a month reads, the sentences a toast says.
// The rules themselves are the server's (utils/periodClose.js there), so nothing here decides what may be closed.

const month = (key, status, over = {}) => ({ key, label: key, status, canClose: false, canReopen: false, ...over });
const year = (code, status, months, over = {}) => ({ _id: code, code, status, months, ...over });

describe("the month lock as a sentence", () => {
  it("names the last locked day, and says nothing when no month is closed", () => {
    expect(lockSentence("2026-08-31")).toMatch(/^Posting is closed up to .*2026$/);
    expect(lockSentence(null)).toBe("");
    expect(lockSentence(undefined)).toBe("");
  });

  it("is what a toast and an open year's row say", () => {
    expect(closedToast("August 2026", "2026-08-31")).toMatch(/^August 2026 closed\. Posting is closed up to .*2026\.$/);
    expect(reopenedToast("August 2026", "2026-07-31")).toMatch(/^August 2026 reopened\. Posting is closed up to .*2026\.$/);
    expect(reopenedToast("January 2026", null)).toBe("January 2026 reopened");
    expect(yearNote({ status: "open", lockedThrough: "2026-03-31" })).toMatch(/^Months closed\. Posting is closed up to /);
    expect(yearNote({ status: "open" })).toBe("");
  });
});

describe("which year the list of months opens on", () => {
  const closed = year("2024", "closed", [month("2024-12", "closed")]);
  const done = year("2025", "open", [month("2025-12", "closed")]);
  const working = year("2026", "open", [month("2026-01", "closed"), month("2026-02", "open", { canClose: true })]);
  const future = year("2027", "open", [month("2027-01", "open")]);

  it("is the oldest open year that still has a month to close", () => {
    expect(defaultYear([future, working, done, closed]).code).toBe("2026");
    expect(defaultYear([working, done, closed]).code).toBe("2026");
  });

  it("is the newest year when nothing is left to close, and nothing when there are no years", () => {
    expect(defaultYear([done, closed]).code).toBe("2025");
    expect(defaultYear([closed]).code).toBe("2024");
    expect(defaultYear([])).toBeNull();
    expect(defaultYear(undefined)).toBeNull();
  });

  it("copes with a year the server sent without its months", () => {
    expect(defaultYear([{ _id: "y", code: "2026", status: "open" }]).code).toBe("2026");
  });
});

describe("how a month reads in the list", () => {
  it("has a word for each status", () => {
    expect(statusLabel(month("m", "open"))).toBe("Open");
    expect(statusLabel(month("m", "closed"))).toBe("Closed");
    expect(statusLabel(month("m", "yearClosed"))).toBe("Closed with the year");
  });

  it("says who closed a closed month and when, and nothing for one that is not", () => {
    expect(closedNote(month("m", "closed", { closedBy: "Mariam", closedAt: "2026-09-02T08:00:00Z" }))).toMatch(/^Mariam, .*2026/);
    expect(closedNote(month("m", "closed", { closedBy: "Mariam" }))).toBe("Mariam");
    expect(closedNote(month("m", "closed"))).toBe("");
    expect(closedNote(month("m", "open"))).toBe("");
    expect(closedNote(month("m", "yearClosed", { closedBy: "Mariam" }))).toBe("");
  });

  it("offers Close on the next month in order and Reopen on the latest closed one, never both", () => {
    expect(monthAction(month("m", "open", { canClose: true }))).toBe("close");
    expect(monthAction(month("m", "closed", { canReopen: true }))).toBe("reopen");
    expect(monthAction(month("m", "open"))).toBeNull();
    expect(monthAction(month("m", "closed"))).toBeNull();
    expect(monthAction(undefined)).toBeNull();
  });
});
