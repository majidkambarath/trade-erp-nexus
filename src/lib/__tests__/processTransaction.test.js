import { describe, it, expect, vi, beforeEach } from "vitest";

const patch = vi.hoisted(() => vi.fn());
vi.mock("../../axios/axios", () => ({ default: { patch } }));
vi.mock("sweetalert2", () => ({ default: { fire: vi.fn() } }));

import { processTransaction, applyAfterSave, approveMany } from "../processTransaction";

// axios rejects with an Error that carries .response
const httpError = (status, data) => Object.assign(new Error(`Request failed with status ${status}`), { response: { status, data } });
const warning = (field = "riskAck_limit_party_credit") => httpError(409, { errorCode: "RISK_WARNING_ACKNOWLEDGEMENT_REQUIRED", message: "Credit warning", details: { risk: { acknowledgementField: field, breaches: [{ message: "limit exceeded" }] } } });

beforeEach(() => {
  patch.mockReset();
});

describe("processTransaction", () => {
  it("sends a plain action when nothing objects", async () => {
    patch.mockResolvedValue({ data: {} });
    await processTransaction("t1", "approve");
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith("/transactions/transactions/t1/process", { action: "approve" });
  });

  it("asks once on a credit warning, then resends with the acknowledgement the server named", async () => {
    patch.mockRejectedValueOnce(warning()).mockResolvedValueOnce({ data: {} });
    const confirm = vi.fn().mockResolvedValue(true);
    await processTransaction("t1", "approve", { confirm });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0].message).toBe("Credit warning");
    expect(patch).toHaveBeenLastCalledWith("/transactions/transactions/t1/process", { action: "approve", riskAck_limit_party_credit: true });
  });

  it("does not resend if the user declines, and says the approval was cancelled", async () => {
    patch.mockRejectedValueOnce(warning());
    const confirm = vi.fn().mockResolvedValue(false);
    await expect(processTransaction("t1", "approve", { confirm })).rejects.toMatchObject({ cancelled: true });
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it("uses whatever field the server names, never a fixed one", async () => {
    patch.mockRejectedValueOnce(warning("riskAck_something_else")).mockResolvedValueOnce({ data: {} });
    await processTransaction("t1", "approve", { confirm: async () => true });
    expect(patch.mock.calls[1][1]).toEqual({ action: "approve", riskAck_something_else: true });
  });

  it("a block is an ordinary error and is never offered an override", async () => {
    const blocked = httpError(403, { errorCode: "RISK_LIMIT_BLOCKED", message: "Credit check failed" });
    patch.mockRejectedValue(blocked);
    const confirm = vi.fn();
    await expect(processTransaction("t1", "approve", { confirm })).rejects.toBe(blocked);
    expect(confirm).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it("other failures pass straight through", async () => {
    const boom = httpError(500, { message: "boom" });
    patch.mockRejectedValue(boom);
    await expect(processTransaction("t1", "reject")).rejects.toBe(boom);
  });
});

describe("applyAfterSave", () => {
  it("reports the new status when the action goes through", async () => {
    patch.mockResolvedValue({ data: {} });
    expect(await applyAfterSave("t1", "approve")).toEqual({ done: true, status: "APPROVED" });
    expect(await applyAfterSave("t1", "reject")).toEqual({ done: true, status: "REJECTED" });
  });

  it("leaves the draft alone and says so when the user declines a credit warning", async () => {
    patch.mockRejectedValueOnce(warning());
    const confirm = vi.fn().mockResolvedValue(false);
    expect(await applyAfterSave("t1", "approve", { confirm })).toEqual({ done: false, cancelled: true });
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it("returns the server's reason when the approval is refused", async () => {
    patch.mockRejectedValueOnce(httpError(403, { errorCode: "RISK_LIMIT_BLOCKED", message: "Credit limit 1000.00 would be exceeded" }));
    expect(await applyAfterSave("t1", "approve")).toEqual({ done: false, message: "Credit limit 1000.00 would be exceeded" });
  });
});

// Above the organisation's second-approver amount the first approval is only recorded: the answer says awaitingSecond and the
// document is still a draft. It must never be reported as approved.
const firstOfTwo = { data: { data: { transaction: { status: "DRAFT" }, approval: { awaitingSecond: true, given: 1 } } } };

describe("applyAfterSave: the first of two approvals", () => {
  it("says the approval is awaiting a second person, not done", async () => {
    patch.mockResolvedValue(firstOfTwo);
    expect(await applyAfterSave("t1", "approve")).toEqual({ done: false, awaitingSecond: true });
  });

  it("rejecting is never a first approval", async () => {
    patch.mockResolvedValue(firstOfTwo);
    expect(await applyAfterSave("t1", "reject")).toEqual({ done: true, status: "REJECTED" });
  });

  it("returns the server's reason when it refuses the approver (their own work, over their limit)", async () => {
    patch.mockRejectedValueOnce(httpError(403, { errorCode: "SELF_APPROVAL_NOT_ALLOWED", message: "You prepared this document, so someone else has to approve it." }));
    expect(await applyAfterSave("t1", "approve")).toEqual({ done: false, message: "You prepared this document, so someone else has to approve it." });
  });
});

describe("approveMany", () => {
  const final = { data: { data: { transaction: { status: "APPROVED" } } } };
  const state = (over = {}) => ({ awaitingSecond: false, given: 0, canApprove: true, reason: null, ...over });
  const rows = (...ids) => ids.map((id) => ({ id, status: "DRAFT", totalAmount: 100, createdBy: "u2", approvals: [] }));

  it("says what each came to: approved, waiting for a second approver, refused with the server's words", async () => {
    patch
      .mockResolvedValueOnce(final)
      .mockResolvedValueOnce(firstOfTwo)
      .mockRejectedValueOnce(httpError(403, { errorCode: "APPROVAL_LIMIT_EXCEEDED", message: "This document is 900.00 AED and your approval limit is 500.00 AED." }));
    const out = await approveMany(["a", "b", "c"], { docs: rows("a", "b", "c"), stateOf: () => state() });
    expect(out).toEqual([
      { id: "a", outcome: "approved" },
      { id: "b", outcome: "waiting" },
      { id: "c", outcome: "refused", reason: "This document is 900.00 AED and your approval limit is 500.00 AED." },
    ]);
    expect(patch).toHaveBeenCalledTimes(3);
  });

  it("goes on after a refusal instead of stopping at the first", async () => {
    patch.mockRejectedValueOnce(httpError(403, { message: "No" })).mockResolvedValueOnce(final);
    const out = await approveMany(["a", "b"], { docs: rows("a", "b"), stateOf: () => state() });
    expect(out.map((r) => r.outcome)).toEqual(["refused", "approved"]);
  });

  it("does not send what the person could not approve, and gives the same words the server would", async () => {
    patch.mockResolvedValue(final);
    const stateOf = (d) => (d.id === "own" ? state({ canApprove: false, reason: "own" }) : state());
    const out = await approveMany(["own", "ok"], { docs: rows("own", "ok"), stateOf, me: { id: "u1", role: {} } });
    expect(out).toEqual([{ id: "own", outcome: "refused", reason: "You prepared this document, so someone else has to approve it." }, { id: "ok", outcome: "approved" }]);
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith("/transactions/transactions/ok/process", { action: "approve" });
  });

  it("names the person's own limit when a document is over it", async () => {
    const out = await approveMany(["x"], { docs: rows("x"), stateOf: () => state({ canApprove: false, reason: "limit" }), me: { id: "u1", role: { approvalLimit: 500 } } });
    expect(out[0].reason).toBe("This is over your approval limit of 500.00 AED.");
    expect(patch).not.toHaveBeenCalled();
  });

  it("a document that is already decided is refused without a request", async () => {
    const out = await approveMany(["x"], { docs: [{ id: "x", status: "APPROVED" }], stateOf: () => state({ canApprove: false, reason: null }) });
    expect(out).toEqual([{ id: "x", outcome: "refused", reason: "It is already decided" }]);
    expect(patch).not.toHaveBeenCalled();
  });

  it("a document it cannot find in the list is still tried: the server decides", async () => {
    patch.mockResolvedValue(final);
    const out = await approveMany(["gone"], { docs: [], stateOf: () => state({ canApprove: false, reason: "own" }) });
    expect(out).toEqual([{ id: "gone", outcome: "approved" }]);
  });

  it("a declined credit warning is reported as cancelled, not as a failure, and the run goes on", async () => {
    patch.mockRejectedValueOnce(warning()).mockResolvedValueOnce(final);
    const confirm = vi.fn().mockResolvedValue(false);
    const out = await approveMany(["a", "b"], { docs: rows("a", "b"), stateOf: () => state(), approve: (id, action) => processTransaction(id, action, { confirm }) });
    expect(out.map((r) => r.outcome)).toEqual(["cancelled", "approved"]);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("works with no stateOf (the list could not tell): every one is sent", async () => {
    patch.mockResolvedValue(final);
    const out = await approveMany(["a", "b"], { docs: rows("a", "b") });
    expect(out.map((r) => r.outcome)).toEqual(["approved", "approved"]);
  });
});
