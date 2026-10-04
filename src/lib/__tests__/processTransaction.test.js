import { describe, it, expect, vi, beforeEach } from "vitest";

const patch = vi.hoisted(() => vi.fn());
vi.mock("../../axios/axios", () => ({ default: { patch } }));
vi.mock("sweetalert2", () => ({ default: { fire: vi.fn() } }));

import { processTransaction, applyAfterSave } from "../processTransaction";

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
