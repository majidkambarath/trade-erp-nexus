import { describe, it, expect } from "vitest";
import {
  FIRST_APPROVAL_MESSAGE, approvalNotice, approvalState, awaitingLabel, firstApproverName, isAwaitingApproval, limitSummary, needsSecondApproval,
  noticeFor, normalisePolicy, summariseApprovals, wasFirstApproval,
} from "../approvals";

// The same checks, in the same order, as the server's decide() in utils/approvalRules.js: the screen offers Approve only to
// someone the server would let approve. Every case here is a row of that table; the server's own cases are in
// services/__tests__/approvalsHttp.test.js.

const ME = { id: "u1", role: { approvalLimit: null } };
const doc = (over = {}) => ({ status: "DRAFT", totalAmount: 100, createdBy: "u2", approvals: [], ...over });
const OFF = { separateApprover: false, secondApprovalAbove: null };
const state = (d, me = ME, policy = OFF) => approvalState({ doc: d, me, policy });

describe("approvalState: nothing is set", () => {
  it("anyone may approve any open document", () => {
    expect(state(doc())).toEqual({ awaitingSecond: false, given: 0, canApprove: true, reason: null });
  });

  it("the person who prepared it may approve it too (the organisation did not say otherwise)", () => {
    expect(state(doc({ createdBy: "u1" })).canApprove).toBe(true);
  });
});

describe("approvalState: the person who prepared a document (separate approver)", () => {
  const on = { separateApprover: true, secondApprovalAbove: null };

  it("cannot approve their own work", () => {
    expect(state(doc({ createdBy: "u1" }), ME, on)).toMatchObject({ canApprove: false, reason: "own" });
  });

  it("compares ids as text, so a number or a populated user is the same person", () => {
    expect(state(doc({ createdBy: 1 }), { id: "1", role: {} }, on).reason).toBe("own");
    expect(state(doc({ createdBy: { _id: "u1", name: "Me" } }), ME, on).reason).toBe("own");
  });

  it("someone else's work is theirs to approve", () => {
    expect(state(doc({ createdBy: "u2" }), ME, on)).toMatchObject({ canApprove: true, reason: null });
  });

  it("an unknown preparer is nobody's own work", () => {
    expect(state(doc({ createdBy: undefined }), ME, on).canApprove).toBe(true);
    expect(state(doc({ createdBy: "" }), ME, on).canApprove).toBe(true);
  });

  it("comes before the limit, as the server checks it first", () => {
    const me = { id: "u1", role: { approvalLimit: 10 } };
    expect(state(doc({ createdBy: "u1", totalAmount: 500 }), me, on).reason).toBe("own");
  });
});

describe("approvalState: a role's approval limit", () => {
  const withLimit = (limit) => ({ id: "u1", role: { approvalLimit: limit } });

  it("a document exactly at the limit is approvable, a fils over it is not", () => {
    expect(state(doc({ totalAmount: 500 }), withLimit(500))).toMatchObject({ canApprove: true, reason: null });
    expect(state(doc({ totalAmount: 500.01 }), withLimit(500))).toMatchObject({ canApprove: false, reason: "limit" });
    expect(state(doc({ totalAmount: 499.99 }), withLimit(500)).canApprove).toBe(true);
  });

  it("works to the fils, as the server rounds: under half a fils over is nothing, more than that is a fils", () => {
    expect(state(doc({ totalAmount: 500.004 }), withLimit(500)).canApprove).toBe(true);
    expect(state(doc({ totalAmount: 500.006 }), withLimit(500)).canApprove).toBe(false);
  });

  it("reads the amount and the limit when they come as text", () => {
    expect(state(doc({ totalAmount: "900.00" }), withLimit("500")).reason).toBe("limit");
    expect(state(doc({ totalAmount: "126.00" }), withLimit("500")).canApprove).toBe(true);
  });

  it("empty, null or nonsense is no limit; a limit of 0 means nothing above 0", () => {
    for (const none of [null, undefined, "", "lots", -5]) expect(state(doc({ totalAmount: 1e9 }), withLimit(none)).canApprove).toBe(true);
    expect(state(doc({ totalAmount: 0 }), withLimit(0)).canApprove).toBe(true);
    expect(state(doc({ totalAmount: 0.01 }), withLimit(0)).reason).toBe("limit");
  });
});

describe("approvalState: a second approver above an amount", () => {
  const two = { separateApprover: false, secondApprovalAbove: 500 };
  const first = [{ by: "u9", name: "Sam", at: "2026-10-08T09:00:00Z", step: 1 }];

  it("one approval is all a document at or under the amount needs", () => {
    expect(state(doc({ totalAmount: 500, approvals: [] }), ME, two)).toMatchObject({ awaitingSecond: false, canApprove: true });
    // ... and a first approval on such a document (the amount was raised later) is not awaiting anything
    expect(state(doc({ totalAmount: 500, approvals: first }), ME, two)).toMatchObject({ awaitingSecond: false, given: 1, canApprove: true });
  });

  it("a document above the amount with no approval yet is not awaiting a second, and anyone may give the first", () => {
    expect(state(doc({ totalAmount: 500.01 }), ME, two)).toEqual({ awaitingSecond: false, given: 0, canApprove: true, reason: null });
  });

  it("once the first approval is in it is awaiting the second, and a different person may give it", () => {
    expect(state(doc({ totalAmount: 900, approvals: first }), ME, two)).toEqual({ awaitingSecond: true, given: 1, canApprove: true, reason: null });
  });

  it("the person who gave the first may not give the second", () => {
    const mine = [{ by: "u1", name: "Me", step: 1 }];
    expect(state(doc({ totalAmount: 900, approvals: mine }), ME, two)).toEqual({ awaitingSecond: true, given: 1, canApprove: false, reason: "already" });
  });

  it("an approval whose person is unknown counts as one given, but is nobody in particular", () => {
    expect(state(doc({ totalAmount: 900, approvals: [{ name: "?" }] }), ME, two).given).toBe(0); // no `by`: not an approval
  });

  it("a person over their limit cannot give the second either, and the limit is named before the second-approver rule", () => {
    const small = { id: "u1", role: { approvalLimit: 500 } };
    expect(state(doc({ totalAmount: 900, approvals: first }), small, two)).toMatchObject({ awaitingSecond: true, canApprove: false, reason: "limit" });
  });

  it("with the separate approver as well, the preparer is out of both steps", () => {
    const both = { separateApprover: true, secondApprovalAbove: 500 };
    expect(state(doc({ totalAmount: 900, createdBy: "u1", approvals: first }), ME, both).reason).toBe("own");
  });

  it("a document that is already decided is not awaiting anything and cannot be approved", () => {
    expect(state(doc({ status: "APPROVED", totalAmount: 900, approvals: first }), ME, two)).toEqual({ awaitingSecond: false, given: 1, canApprove: false, reason: null });
    expect(state(doc({ status: "REJECTED" }), ME, two).canApprove).toBe(false);
    expect(state(doc({ status: "approved" }), ME, two).canApprove).toBe(false);
  });

  it("a voucher that is pending (or draft) is open, in any case; a purchase order may say PENDING", () => {
    for (const status of ["pending", "draft", "PENDING", "DRAFT"]) {
      expect(isAwaitingApproval({ status })).toBe(true);
      expect(state(doc({ status, totalAmount: 900, approvals: first }), ME, two).awaitingSecond).toBe(true);
    }
    expect(isAwaitingApproval({ status: "INVOICED" })).toBe(false);
  });
});

describe("approvalState: while something is unknown nothing is hidden", () => {
  it("no person, no policy or no document says yes", () => {
    expect(approvalState({ doc: doc(), me: null, policy: { separateApprover: true, secondApprovalAbove: 10 } }).canApprove).toBe(true);
    expect(approvalState({ doc: doc(), me: ME, policy: undefined }).canApprove).toBe(true);
    expect(approvalState({ doc: doc({ createdBy: "u1" }), me: ME }).canApprove).toBe(true);
    expect(approvalState({}).canApprove).toBe(true);
    expect(approvalState().canApprove).toBe(true);
  });

  it("a missing person is never taken for the preparer or for the first approver", () => {
    const on = { separateApprover: true, secondApprovalAbove: 10 };
    expect(approvalState({ doc: doc({ createdBy: undefined, totalAmount: 900, approvals: [{ by: undefined }] }), me: {}, policy: on }).canApprove).toBe(true);
  });

  it("with no policy a first approval is not called awaiting (the screen cannot know a second is needed)", () => {
    expect(approvalState({ doc: doc({ totalAmount: 900, approvals: [{ by: "u9" }] }), me: ME, policy: undefined }).awaitingSecond).toBe(false);
  });
});

describe("the policy", () => {
  it("reads every missing or nonsensical value as not set", () => {
    expect(normalisePolicy(undefined)).toEqual(OFF);
    expect(normalisePolicy({ separateApprover: "yes", secondApprovalAbove: "plenty" })).toEqual(OFF);
    expect(normalisePolicy({ separateApprover: true, secondApprovalAbove: "" })).toEqual({ separateApprover: true, secondApprovalAbove: null });
    expect(normalisePolicy({ secondApprovalAbove: -1 }).secondApprovalAbove).toBe(null);
    expect(normalisePolicy({ secondApprovalAbove: "500.456" }).secondApprovalAbove).toBe(500.46);
  });

  it("a document needs a second approver only strictly above the amount", () => {
    const p = { secondApprovalAbove: 500 };
    expect(needsSecondApproval(p, 500)).toBe(false);
    expect(needsSecondApproval(p, 500.01)).toBe(true);
    expect(needsSecondApproval(OFF, 1e9)).toBe(false);
    expect(needsSecondApproval({ secondApprovalAbove: 0 }, 0.01)).toBe(true);
  });
});

describe("the words", () => {
  it("labels a document that is waiting for its second approval, and only that", () => {
    expect(awaitingLabel({ awaitingSecond: true })).toBe("Awaiting second approval");
    expect(awaitingLabel({ awaitingSecond: false })).toBe("");
    expect(awaitingLabel(undefined)).toBe("");
  });

  it("names who gave the first approval, when it is known", () => {
    expect(firstApproverName({ approvals: [{ by: "u9", name: "Sam Khan" }] })).toBe("Sam Khan");
    expect(firstApproverName({ approvals: [{ by: "u9" }] })).toBe("");
    expect(firstApproverName({})).toBe("");
  });

  it("explains why Approve is not offered, in the server's own sentences", () => {
    expect(approvalNotice("own")).toBe("You prepared this document, so someone else has to approve it.");
    expect(approvalNotice("already")).toBe("You gave the first approval; a different person has to give the second.");
    expect(approvalNotice("limit", { limit: 5000 })).toBe("This is over your approval limit of 5,000.00 AED.");
    expect(approvalNotice("limit")).toBe("This is over your approval limit.");
    expect(approvalNotice(null)).toBe("");
    expect(approvalNotice(undefined)).toBe("");
  });

  it("takes the person's own limit from the state it is given", () => {
    const me = { id: "u1", role: { approvalLimit: 500 } };
    const s = approvalState({ doc: doc({ totalAmount: 900 }), me, policy: OFF });
    expect(noticeFor(s, me)).toBe("This is over your approval limit of 500.00 AED.");
    expect(noticeFor(approvalState({ doc: doc(), me, policy: OFF }), me)).toBe("");
  });

  it("says a role's limit as an amount or as none", () => {
    expect(limitSummary(5000)).toBe("Up to 5,000.00 AED");
    expect(limitSummary("750.5")).toBe("Up to 750.50 AED");
    expect(limitSummary(null)).toBe("No limit");
    expect(limitSummary("")).toBe("No limit");
    expect(limitSummary(undefined)).toBe("No limit");
  });

  it("the first-approval message says a second person must approve it, and never says approved", () => {
    expect(FIRST_APPROVAL_MESSAGE).toBe("First approval recorded. A second person must approve it before it takes effect.");
  });
});

describe("what an approve answered", () => {
  it("recognises the first of two approvals in a document's answer and in a voucher's", () => {
    expect(wasFirstApproval({ data: { data: { transaction: { status: "DRAFT" }, approval: { awaitingSecond: true, given: 1 } } } })).toBe(true);
    expect(wasFirstApproval({ voucher: {}, approval: { awaitingSecond: true, given: 1 } })).toBe(true);
    expect(wasFirstApproval({ awaitingSecondApproval: true })).toBe(true); // a bulk item
  });

  it("a final approval, an empty answer or nothing at all is not a first approval", () => {
    expect(wasFirstApproval({ data: { data: { transaction: { status: "APPROVED" } } } })).toBe(false);
    expect(wasFirstApproval({ data: {} })).toBe(false);
    expect(wasFirstApproval({ data: { data: { approval: { awaitingSecond: false } } } })).toBe(false);
    expect(wasFirstApproval(undefined)).toBe(false);
    expect(wasFirstApproval(null)).toBe(false);
  });
});

describe("summarising a run of approvals", () => {
  const r = (outcome, reason) => ({ outcome, ...(reason ? { reason } : {}) });

  it("says how many were approved, how many wait for a second person, and how many were refused and why", () => {
    const out = summariseApprovals([r("approved"), r("approved"), r("waiting"), r("refused", "You prepared this document, so someone else has to approve it.")]);
    expect(out.text).toBe("2 approved, 1 waiting for a second approver, 1 refused: You prepared this document, so someone else has to approve it.");
    expect(out.tone).toBe("warning");
  });

  it("everything approved is a success", () => {
    expect(summariseApprovals([r("approved"), r("approved")])).toEqual({ text: "2 approved", tone: "success" });
  });

  it("some waiting and none refused is information, not a success", () => {
    expect(summariseApprovals([r("approved"), r("waiting")])).toEqual({ text: "1 approved, 1 waiting for a second approver", tone: "info" });
  });

  it("gives each different reason once", () => {
    const out = summariseApprovals([r("refused", "Over limit"), r("refused", "Over limit"), r("refused", "Prepared by you")]);
    expect(out.text).toBe("3 refused: Over limit / Prepared by you");
  });

  it("a refusal with no words still counts", () => {
    expect(summariseApprovals([r("refused")]).text).toBe("1 refused");
  });

  it("counts what the person cancelled (a credit warning they declined) without calling it a refusal", () => {
    expect(summariseApprovals([r("approved"), r("cancelled")])).toEqual({ text: "1 approved, 1 left as it was (you cancelled)", tone: "info" });
    expect(summariseApprovals([r("cancelled"), r("cancelled")]).text).toBe("2 left as they were (you cancelled)");
  });

  it("an empty run says nothing was approved", () => {
    expect(summariseApprovals([])).toEqual({ text: "Nothing was approved.", tone: "warning" });
    expect(summariseApprovals(undefined).tone).toBe("warning");
  });
});
