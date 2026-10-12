import { describe, it, expect, vi, beforeEach } from "vitest";
import { createThenApprove, invoiceNote, invoiceConfirmLabel, orderSteps } from "../invoiceFlow";
import { applyAfterSave } from "../processTransaction";

vi.mock("../processTransaction", () => ({ applyAfterSave: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("createThenApprove", () => {
  const make = vi.fn(async () => ({ invoice: { _id: "t1", transactionNo: "SO-1" } }));
  const pick = (r) => r.invoice;

  it("makes the invoice, then approves it, and never sends the flag to the server", async () => {
    applyAfterSave.mockResolvedValue({ done: true, status: "APPROVED" });
    const out = await createThenApprove(make, { date: "2026-10-12", approveNow: true }, pick);
    expect(make).toHaveBeenCalledWith({ date: "2026-10-12" });
    expect(applyAfterSave).toHaveBeenCalledWith("t1", "approve");
    expect(out.approval).toEqual({ done: true, status: "APPROVED" });
    expect(out.invoice.transactionNo).toBe("SO-1");
  });

  it("with the choice off it only makes the draft", async () => {
    const out = await createThenApprove(make, { approveNow: false }, pick);
    expect(applyAfterSave).not.toHaveBeenCalled();
    expect(out.approval).toBeNull();
  });

  it("a refusal to create is the caller's error, not swallowed", async () => {
    const fail = vi.fn().mockRejectedValue(new Error("Nothing to invoice"));
    await expect(createThenApprove(fail, { approveNow: true }, pick)).rejects.toThrow("Nothing to invoice");
    expect(applyAfterSave).not.toHaveBeenCalled();
  });

  it("a refused approval leaves the draft and says why", async () => {
    applyAfterSave.mockResolvedValue({ done: false, message: "Over your approval limit" });
    const out = await createThenApprove(make, { approveNow: true }, pick);
    expect(out.invoice._id).toBe("t1");
    expect(out.approval).toEqual({ done: false, message: "Over your approval limit" });
  });
});

describe("invoiceNote", () => {
  it("says where the approval stands", () => {
    expect(invoiceNote("SO-1", "SORD-1", null)).toMatch(/SO-1 created from SORD-1\. Approve it to post/);
    expect(invoiceNote("SO-1", "SORD-1", { done: true })).toBe("SO-1 created from SORD-1 and approved");
    expect(invoiceNote("SO-1", "SORD-1", { awaitingSecond: true })).toMatch(/second person/);
    expect(invoiceNote("SO-1", "SORD-1", { cancelled: true })).toMatch(/as a draft\. Approve it when you are ready/);
    expect(invoiceNote("SO-1", "", { done: false, message: "Over your limit" })).toBe("SO-1 created as a draft, not approved: Over your limit");
  });

  it("labels the button by the choice", () => {
    expect(invoiceConfirmLabel(true)).toBe("Create and approve invoice");
    expect(invoiceConfirmLabel(false)).toBe("Create draft invoice");
  });
});

describe("orderSteps", () => {
  const lines = (ordered, received, invoiced = 0) => ({ l1: { ordered, received, onTheWay: 0, invoiced, toReceive: ordered - received } });
  const order = (over = {}) => ({ kind: "sales", status: "CONFIRMED", progress: { lines: lines(10, 0) }, invoices: [], actions: {}, ...over });
  const state = (m, key) => m.steps.find((s) => s.key === key).state;

  it("a draft order is waiting to be confirmed", () => {
    const m = orderSteps(order({ status: "DRAFT" }));
    expect(state(m, "confirmed")).toBe("current");
    expect(m.next.key).toBe("confirm");
  });

  it("a confirmed order with nothing delivered points at the delivery", () => {
    const m = orderSteps(order());
    expect(state(m, "confirmed")).toBe("done");
    expect(state(m, "got")).toBe("current");
    expect(m.next).toEqual({ key: "receive", text: "Deliver the goods" });
    expect(orderSteps(order({ kind: "purchase" })).next.text).toBe("Receive the goods");
  });

  it("goods in, nothing invoiced: the invoice is next when the server allows it", () => {
    const m = orderSteps(order({ progress: { lines: lines(10, 10) }, actions: { invoice: true } }));
    expect(state(m, "got")).toBe("done");
    expect(state(m, "invoiced")).toBe("current");
    expect(m.next.key).toBe("invoice");
  });

  it("a draft invoice is the next thing to approve", () => {
    const inv = { id: "t1", no: "SO-1", status: "DRAFT", outstandingAmount: 100, paidAmount: 0 };
    const m = orderSteps(order({ progress: { lines: lines(10, 10, 10) }, invoices: [inv] }));
    expect(state(m, "invoiced")).toBe("done");
    expect(state(m, "approved")).toBe("current");
    expect(m.next).toEqual({ key: "approve", text: "Approve SO-1" });
  });

  it("an approved, unpaid invoice points at the payment, and a paid one at nothing", () => {
    const base = { id: "t1", no: "SO-1", status: "APPROVED", paidAmount: 0 };
    const unpaid = orderSteps(order({ progress: { lines: lines(10, 10, 10) }, invoices: [{ ...base, outstandingAmount: 100 }] }));
    expect(state(unpaid, "approved")).toBe("done");
    expect(state(unpaid, "paid")).toBe("current");
    expect(unpaid.next).toEqual({ key: "pay", text: "Receive payment" });
    const paid = orderSteps(order({ progress: { lines: lines(10, 10, 10) }, invoices: [{ ...base, paidAmount: 100, outstandingAmount: 0 }] }));
    expect(state(paid, "paid")).toBe("done");
    expect(paid.next).toBeNull();
  });

  it("a cancelled order has no steps to follow", () => {
    expect(orderSteps(order({ status: "CANCELLED" })).next).toBeNull();
    expect(orderSteps(null)).toEqual({ steps: [], next: null });
  });
});
