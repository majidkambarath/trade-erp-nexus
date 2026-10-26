import { describe, it, expect } from "vitest";
import {
  STATUSES, LIVE, TABS, TONE, LABEL, canDo, ACTIONS, eligible, bulkMessage, isWorklist, needsMaturity, BULK_ACTIONS, MAX_BULK,
  RETURN_REASONS, emptyBounce, chooseReason, bounceErrors, bounceBody, returnErrors, chargesNote,
} from "../chequeRules";

// The server's utils/chequeRules.js pins this SAME list in its own test. There is no cross-repo import, so the two
// copies are kept honest by both pinning the literal: change the machine on one side and the other side's test fails.
const SERVER_LEGAL = [
  "cleared>bounce>bounced", "deposited>bounce>bounced", "deposited>clear>cleared", "hold>bounce>bounced",
  "hold>cancel>cancelled", "hold>resume>pending", "hold>return>returned", "pending>bounce>bounced", "pending>cancel>cancelled",
  "pending>clear>cleared", "pending>deposit>deposited", "pending>hold>hold", "pending>return>returned",
];
const TARGET = { clear: "cleared", deposit: "deposited", hold: "hold", resume: "pending", bounce: "bounced", cancel: "cancelled", return: "returned" };

describe("chequeRules (the screen's twin of the server's)", () => {
  it("offers exactly the transitions the server allows", () => {
    const mine = [];
    for (const from of STATUSES) for (const a of ACTIONS) if (canDo(a, { status: from })) mine.push(`${from}>${a}>${TARGET[a]}`);
    expect(mine.sort()).toEqual([...SERVER_LEGAL].sort());
  });

  it("knows the seven statuses, each with a label and a tone", () => {
    expect([...STATUSES].sort()).toEqual(["bounced", "cancelled", "cleared", "deposited", "hold", "pending", "returned"]);
    for (const s of STATUSES) { expect(LABEL[s]).toBeTruthy(); expect(TONE[s]).toBeTruthy(); }
  });

  it("has a tab per status plus All, with the live ones first", () => {
    expect(TABS.map(([v]) => v)).toEqual(["pending", "deposited", "hold", "cleared", "bounced", "returned", "cancelled", ""]);
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

describe("a cheque the bank sent back (the form's rules)", () => {
  // the server pins the same codes in utils/__tests__/chequeDishonour.test.js
  it("offers the same nine reasons as the server, in the same order", () => {
    expect(RETURN_REASONS.map((r) => r.code)).toEqual(["insufficient_funds", "account_closed", "signature_mismatch", "stop_payment", "amount_mismatch", "post_dated", "stale", "technical", "other"]);
    for (const r of RETURN_REASONS) expect(r.label).toBeTruthy();
  });

  it("calls the new state 'Handed back', so it cannot be mistaken for the bank returning a cheque", () => {
    expect(LABEL.returned).toBe("Handed back");
    expect(Object.values(LABEL)).not.toContain("Returned");
  });

  it("a plain bounce still sends exactly { reason }", () => {
    expect(bounceBody({ ...emptyBounce(), reason: "  Insufficient funds " })).toEqual({ reason: "Insufficient funds" });
  });

  it("sends only what was filled in, and the charges only when ticked", () => {
    const form = {
      ...emptyBounce(), reasonCode: "account_closed", reason: "Account closed", memoDate: "2026-10-25", memoRef: " RM-1 ", partialAmount: "150",
      feeOn: true, feeAmount: "52.5", feeTaxCodeId: "t1", backOn: true, backAmount: "60", backAccountId: "a1", backNote: " Fee ",
    };
    expect(bounceBody(form)).toEqual({
      reason: "Account closed", reasonCode: "account_closed", memoDate: "2026-10-25", memoRef: "RM-1", partialAmount: 150,
      bankCharge: { amount: 52.5, taxCodeId: "t1" }, recharge: { amount: 60, accountId: "a1", description: "Fee" },
    });
    // an unticked charge is not sent even if its box still holds a number
    expect(bounceBody({ ...form, feeOn: false, backOn: false })).not.toHaveProperty("bankCharge");
    expect(bounceBody({ ...form, feeOn: false, backOn: false })).not.toHaveProperty("recharge");
  });

  it("picking a reason words it for the person - unless they already wrote their own", () => {
    const picked = chooseReason(emptyBounce(), "account_closed");
    expect(picked).toMatchObject({ reasonCode: "account_closed", reason: "Account closed" });
    expect(chooseReason(picked, "stop_payment").reason).toBe("Payment stopped by the drawer"); // still the list's own wording: replaced
    expect(chooseReason({ ...emptyBounce(), reason: "My own words" }, "stop_payment")).toMatchObject({ reasonCode: "stop_payment", reason: "My own words" });
    expect(chooseReason(emptyBounce(), "other").reason).toBe("");
  });

  it("checks the form, field by field, with the messages the existing screen has always used", () => {
    expect(bounceErrors(emptyBounce())).toEqual({ reason: "Say why the cheque was returned" });
    expect(bounceErrors({ ...emptyBounce(), reason: "r" })).toEqual({});
    const e = bounceErrors({ ...emptyBounce(), reason: "r", memoDate: "2026-12-01", partialAmount: "400", feeOn: true, backOn: true }, { amount: 400, customer: true, today: "2026-10-26" });
    expect(Object.keys(e).sort()).toEqual(["backAccountId", "backAmount", "feeAmount", "memoDate", "partialAmount"]);
    expect(bounceErrors({ ...emptyBounce(), reason: "r", backOn: true, backAmount: "5", backAccountId: "a" }, { customer: false })).toHaveProperty("backOn");
    expect(bounceErrors({ ...emptyBounce(), reason: "r", partialAmount: "abc" })).toHaveProperty("partialAmount");
  });

  it("handing a cheque back needs only a reason", () => {
    expect(returnErrors({ reason: "" })).toEqual({ reason: "Say why the cheque is being handed back" });
    expect(returnErrors({ reason: "Replaced by a transfer" })).toEqual({});
  });

  it("words what a bounce cost for the register", () => {
    expect(chargesNote({})).toBe("");
    expect(chargesNote({ charges: { expenseVoucherNo: "EV-1" } })).toBe("Bank charge EV-1");
    expect(chargesNote({ charges: { expenseVoucherNo: "EV-1", rechargeVoucherNo: "DN-2" } })).toBe("Bank charge EV-1 · charged back DN-2");
  });
});
