import { describe, it, expect } from "vitest";
import { STATUSES, LIVE, TABS, TONE, LABEL, canDo, ACTIONS, eligible, bulkMessage, isWorklist, needsMaturity, BULK_ACTIONS, MAX_BULK } from "../chequeRules";

// The server's utils/chequeRules.js pins this SAME list in its own test. There is no cross-repo import, so the two
// copies are kept honest by both pinning the literal: change the machine on one side and the other side's test fails.
const SERVER_LEGAL = [
  "cleared>bounce>bounced", "deposited>bounce>bounced", "deposited>clear>cleared", "hold>bounce>bounced",
  "hold>cancel>cancelled", "hold>resume>pending", "pending>bounce>bounced", "pending>cancel>cancelled",
  "pending>clear>cleared", "pending>deposit>deposited", "pending>hold>hold",
];
const TARGET = { clear: "cleared", deposit: "deposited", hold: "hold", resume: "pending", bounce: "bounced", cancel: "cancelled" };

describe("chequeRules (the screen's twin of the server's)", () => {
  it("offers exactly the transitions the server allows", () => {
    const mine = [];
    for (const from of STATUSES) for (const a of ACTIONS) if (canDo(a, { status: from })) mine.push(`${from}>${a}>${TARGET[a]}`);
    expect(mine.sort()).toEqual([...SERVER_LEGAL].sort());
  });

  it("knows the six statuses, each with a label and a tone", () => {
    expect(STATUSES).toEqual(["pending", "deposited", "hold", "cleared", "bounced", "cancelled"]);
    for (const s of STATUSES) { expect(LABEL[s]).toBeTruthy(); expect(TONE[s]).toBeTruthy(); }
  });

  it("has a tab per status plus All, with the live ones first", () => {
    expect(TABS.map(([v]) => v)).toEqual(["pending", "deposited", "hold", "cleared", "bounced", "cancelled", ""]);
    expect(TABS.at(-1)).toEqual(["", "All"]);
  });

  it("treats the live tabs as worklists (every date) and the rest as periods", () => {
    expect(LIVE.every(isWorklist)).toBe(true);
    for (const s of ["cleared", "bounced", "cancelled", ""]) expect(isWorklist(s)).toBe(false);
  });

  it("refuses an unknown action, a missing cheque and prototype keys", () => {
    expect(canDo("teleport", { status: "pending" })).toBe(false);
    expect(canDo("clear", null)).toBe(false);
    for (const a of ["constructor", "__proto__", "toString"]) expect(canDo(a, { status: "pending" })).toBe(false);
  });

  it("only clear and deposit wait for the cheque's date", () => {
    expect(ACTIONS.filter(needsMaturity).sort()).toEqual(["clear", "deposit"]);
  });

  it("bulk: the same four actions and the same cap as the server, and never bounce", () => {
    expect([...BULK_ACTIONS].sort()).toEqual(["clear", "deposit", "hold", "resume"]);
    expect(MAX_BULK).toBe(200);
  });

  it("eligible() keeps only what an action could apply to", () => {
    const rows = [{ status: "pending" }, { status: "hold" }, { status: "deposited" }, { status: "cleared" }];
    expect(eligible("deposit", rows)).toHaveLength(1);
    expect(eligible("clear", rows)).toHaveLength(2);
    expect(eligible("resume", rows)).toHaveLength(1);
  });

  it("bulkMessage names the first problem, because 'left alone' with no reason is useless", () => {
    expect(bulkMessage("deposit", { successful: [{}, {}], failed: [] })).toBe("2 cheques deposited.");
    expect(bulkMessage("deposit", { successful: [{}], failed: [] })).toBe("1 cheque deposited.");
    const m = bulkMessage("clear", { successful: [{}], failed: [{ message: "This cheque is dated 2026-12-01 and cannot clear before then" }, {}] });
    expect(m).toBe("1 cleared, 2 left alone. First problem: This cheque is dated 2026-12-01 and cannot clear before then");
  });
});
