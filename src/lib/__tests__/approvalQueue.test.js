import { describe, it, expect, vi } from "vitest";
import { APPROVE_KEYS, AWAITING_SECOND, ageText, approveKeyOf, approveRow, firstApprovalNote, holdsAnyApprove, stateText, stepText, whyNot } from "../approvalQueue";
import { savedVerb } from "../voucherForms";

// The approvals list as words. The rows come from the server (services/core/approvalQueueService.js), which judges every one
// with the same rules as the approve routes; these functions only word them and call the usual approve.

const row = (over = {}) => ({
  id: "d1", kind: "document", type: "sales_order", typeLabel: "Sales order", number: "SO-2026-0001", party: "Al Noor", amount: 840, ageDays: 0,
  state: "waiting", given: 0, firstApprovers: [], step: 1, of: 1, reason: null, link: "/sales-order?search=SO-2026-0001", ...over,
});

describe("who is let into the list", () => {
  it("is anyone who holds an approve permission of any module", () => {
    for (const key of APPROVE_KEYS) expect(holdsAnyApprove({ grants: ["sales.view", key] })).toBe(true);
    expect(holdsAnyApprove({ grants: ["sales.view", "finance.create", "sales.delete"] })).toBe(false);
  });

  it("is nobody while the grants are not known: nothing is asked of the server for a person who may not see the answer", () => {
    expect(holdsAnyApprove(null)).toBe(false);
    expect(holdsAnyApprove({})).toBe(false);
    expect(holdsAnyApprove({ grants: "sales.approve" })).toBe(false);
  });
});

describe("the words on a row", () => {
  it("says how long it has waited", () => {
    expect(ageText(0)).toBe("Today");
    expect(ageText(1)).toBe("1 day");
    expect(ageText(12)).toBe("12 days");
    expect(ageText(-3)).toBe("Today");
    expect(ageText(undefined)).toBe("Today");
  });

  it("names the state, and who gave the first approval", () => {
    expect(stateText(row())).toBe("Waiting");
    expect(stateText(row({ state: AWAITING_SECOND }))).toBe("Awaiting second approver");
    expect(firstApprovalNote(row())).toBe("");
    expect(firstApprovalNote(row({ firstApprovers: ["Sam Khan"] }))).toBe("First approval by Sam Khan");
    expect(firstApprovalNote(row({ firstApprovers: ["Sam Khan", "Lina"] }))).toBe("First approval by Sam Khan, Lina");
  });

  it("says what THEIR approval will be, only when two are needed", () => {
    expect(stepText(row({ step: 1, of: 1 }))).toBe("");
    expect(stepText(row({ step: 1, of: 2 }))).toBe("Your approval is the first of two");
    expect(stepText(row({ step: 2, of: 2 }))).toBe("Your approval finishes it");
    expect(stepText(row({ step: null, of: null }))).toBe("");
    expect(stepText(null)).toBe("");
  });

  it("gives the reason it is not theirs in the server's own words", () => {
    expect(whyNot(row({ reason: { code: "SELF_APPROVAL_NOT_ALLOWED", message: "You prepared this document, so someone else has to approve it." } }))).toBe("You prepared this document, so someone else has to approve it.");
    expect(whyNot(row())).toBe("");
  });

  it("knows which permission approves a row", () => {
    expect(approveKeyOf(row())).toBe("sales.approve");
    expect(approveKeyOf(row({ type: "sales_return" }))).toBe("sales.approve");
    expect(approveKeyOf(row({ type: "purchase_order" }))).toBe("purchase.approve");
    expect(approveKeyOf(row({ type: "purchase_return" }))).toBe("purchase.approve");
    expect(approveKeyOf(row({ kind: "voucher", type: "journal" }))).toBe("finance.approve");
  });
});

describe("approving a row is the usual approve", () => {
  it("an order goes through the order approve (which also asks about a credit warning), a voucher through the voucher approve", async () => {
    const approveDocument = vi.fn().mockResolvedValue({ data: { data: { transaction: {} } } });
    const vouchers = { approve: vi.fn().mockResolvedValue({ voucher: {} }) };
    expect(await approveRow(row(), { vouchers, approveDocument })).toEqual({ id: "d1", outcome: "approved" });
    expect(approveDocument).toHaveBeenCalledWith("d1", "approve");
    expect(vouchers.approve).not.toHaveBeenCalled();

    expect(await approveRow(row({ id: "v1", kind: "voucher", type: "journal" }), { vouchers, approveDocument })).toEqual({ id: "v1", outcome: "approved" });
    expect(vouchers.approve).toHaveBeenCalledWith("v1", "approve");
    expect(approveDocument).toHaveBeenCalledTimes(1);
  });

  it("the first of two approvals is said to be waiting, never approved - for an order and for a voucher", async () => {
    const approveDocument = vi.fn().mockResolvedValue({ data: { data: { approval: { awaitingSecond: true, given: 1 } } } });
    const vouchers = { approve: vi.fn().mockResolvedValue({ voucher: {}, approval: { awaitingSecond: true, given: 1 } }) };
    expect((await approveRow(row(), { vouchers, approveDocument })).outcome).toBe("waiting");
    expect((await approveRow(row({ kind: "voucher" }), { vouchers, approveDocument })).outcome).toBe("waiting");
  });

  it("a refusal is reported in the server's own sentence, and never thrown", async () => {
    const approveDocument = vi.fn().mockRejectedValue({ response: { data: { message: "This document is 840.00 AED and your approval limit is 500.00 AED. Ask someone with a higher limit to approve it." } } });
    const vouchers = { approve: vi.fn().mockRejectedValue(new Error("You have already given the first approval. A different person has to give the second.")) };
    expect(await approveRow(row(), { vouchers, approveDocument })).toEqual({ id: "d1", outcome: "refused", reason: "This document is 840.00 AED and your approval limit is 500.00 AED. Ask someone with a higher limit to approve it." });
    expect(await approveRow(row({ kind: "voucher" }), { vouchers, approveDocument })).toMatchObject({ outcome: "refused", reason: "You have already given the first approval. A different person has to give the second." });
  });

  it("a person who declines the credit warning leaves it as it was", async () => {
    const cancelled = Object.assign(new Error("Approval cancelled"), { cancelled: true });
    const approveDocument = vi.fn().mockRejectedValue(cancelled);
    expect((await approveRow(row(), { vouchers: {}, approveDocument })).outcome).toBe("cancelled");
  });
});

describe("what a voucher form says after saving", () => {
  it("posted, updated - or, for a voucher the server held, that it is saved and NOT posted", () => {
    expect(savedVerb({ status: "approved" })).toBe("posted");
    expect(savedVerb({ status: "approved" }, { updated: true })).toBe("updated");
    expect(savedVerb({ status: "pending" })).toBe("saved, waiting for approval - not posted yet");
    expect(savedVerb({ status: "pending" }, { updated: true })).toBe("saved, waiting for approval - not posted yet");
    expect(savedVerb(undefined)).toBe("posted");
  });
});
