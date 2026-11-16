import { describe, it, expect } from "vitest";
import { bodyToSend, canSave, expensePrefillFromAssistant, formTarget, partyPrefillFromAssistant, normaliseProposals, numberOf, refusalText, savedResult, saveUrl, stillNeeded } from "../assistantProposals";

const payment = {
  id: "p1", kind: "payment", endpoint: "voucher", title: "Payment", confirm: "Pay AED 500.00 to Gulf Packaging",
  lines: [["Pay", "Gulf Packaging"], ["Amount", "AED 500.00"]],
  body: { voucherType: "payment", vendorId: "v1", totalAmount: 500, paymentMode: "transfer", paymentDetails: { accountId: "bk1" } },
  missing: ["reference"], warnings: [], prefill: { partyId: "v1", amount: 500, mode: "transfer", accountId: "bk1", reference: "" },
};
const invoice = { id: "p2", kind: "invoice", endpoint: "transaction", title: "Invoice (draft)", confirm: "Create draft invoice", lines: [], body: { type: "sales_order", partyId: "c1", items: [] }, missing: [], warnings: [], prefill: null };

describe("what the panel keeps of a prepared document", () => {
  it("keeps a well-formed proposal and drops anything else, so a surprise from the server cannot draw a broken card", () => {
    const kept = normaliseProposals([payment, null, { id: "x", kind: "wire", endpoint: "voucher", body: {} }, { id: "y", kind: "payment", endpoint: "elsewhere", body: {} }, { kind: "payment", endpoint: "voucher", body: {} }, "text"]);
    expect(kept.map((p) => p.id)).toEqual(["p1"]);
    expect(normaliseProposals(undefined)).toEqual([]);
    expect(normaliseProposals({})).toEqual([]);
  });
  it("rows are label / value pairs of text, and a saved mark survives", () => {
    const [p] = normaliseProposals([{ ...payment, lines: [["Pay", 5], ["bad"], "nope"], savedAs: "PV-1" }]);
    expect(p.lines).toEqual([["Pay", "5"]]);
    expect(p.savedAs).toBe("PV-1");
  });
});

describe("when the button works", () => {
  it("a reference that is still needed keeps it disabled until it is typed", () => {
    expect(stillNeeded(payment, {})).toEqual(["reference"]);
    expect(canSave(payment, {})).toBe(false);
    expect(canSave(payment, { reference: "   " })).toBe(false);
    expect(canSave(payment, { reference: "TT-9" })).toBe(true);
    expect(canSave(invoice)).toBe(true);
  });
  it("never again once saved, here or on an earlier visit", () => {
    expect(canSave({ ...invoice, savedAs: "SO-1" })).toBe(false);
    expect(canSave({ ...invoice, result: { ok: true } })).toBe(false);
    expect(canSave(null)).toBe(false);
  });
});

describe("what is sent", () => {
  it("puts the typed reference where the form puts it, and changes nothing else", () => {
    const sent = bodyToSend(payment, { reference: "  TT-9  " });
    expect(sent.paymentDetails).toEqual({ accountId: "bk1", reference: "TT-9" });
    expect(sent).toMatchObject({ voucherType: "payment", vendorId: "v1", totalAmount: 500 });
    expect(payment.body.paymentDetails).toEqual({ accountId: "bk1" });
  });
  it("an invoice body goes as prepared, whatever was typed", () => {
    expect(bodyToSend(invoice, { reference: "X" })).toEqual(invoice.body);
  });
  it("each goes to the product's own route", () => {
    expect(saveUrl(payment)).toBe("/vouchers/vouchers");
    expect(saveUrl(invoice)).toBe("/transactions/transactions");
  });
});

describe("Change details", () => {
  it("opens the normal form for the kind, with what was prepared and what was typed", () => {
    expect(formTarget(payment, { reference: "TT-9" })).toEqual({ path: "/payment-voucher", state: { assistantPrefill: { partyId: "v1", amount: 500, mode: "transfer", accountId: "bk1", reference: "TT-9", kind: "payment" } } });
    expect(formTarget({ ...payment, kind: "receipt" }).path).toBe("/receipt-voucher");
    expect(formTarget({ ...payment, kind: "expense" }).path).toBe("/expense-voucher");
  });
  it("an invoice has no form to prefill", () => {
    expect(formTarget(invoice)).toBe(null);
  });
});

describe("what to say after saving", () => {
  it("a recorded payment says so with its number", () => {
    expect(savedResult(payment, { data: { voucherNo: "PV-2026-0007", status: "approved" } })).toEqual({ ok: true, number: "PV-2026-0007", held: false, text: "Payment PV-2026-0007 is recorded." });
  });
  it("a voucher held for approval is NOT called paid", () => {
    const r = savedResult(payment, { data: { voucherNo: "PV-8", status: "pending" }, approval: { held: true } });
    expect(r.held).toBe(true);
    expect(r.text).toMatch(/waiting for approval/);
    expect(r.text).not.toMatch(/recorded/);
    expect(savedResult(payment, { data: { voucherNo: "PV-8" }, approval: { held: true } }).held).toBe(true);
  });
  it("an invoice is a draft that posts nothing, with a way to open it", () => {
    const r = savedResult(invoice, { data: { transactionNo: "SO-2026-0042", status: "DRAFT" } });
    expect(r.text).toBe("Saved as a draft SO-2026-0042. Nothing is posted until it is approved.");
    expect(r.open).toBe("/sales-order?search=SO-2026-0042");
  });
  it("finds the number wherever the route puts it, and the server's own refusal wording", () => {
    expect(numberOf({ voucherNo: "A" })).toBe("A");
    expect(numberOf({ transactionNo: "B" })).toBe("B");
    expect(numberOf(null)).toBe("");
    expect(refusalText({ response: { data: { message: "Enter the deposit slip or reference number" } } })).toBe("Enter the deposit slip or reference number");
    expect(refusalText(new Error("boom"))).toBe("boom");
    expect(refusalText(null)).toBe("That could not be saved.");
  });
});

describe("the normal form opened from a card", () => {
  const state = (kind, extra = {}) => ({ assistantPrefill: { kind, partyId: "v1", amount: 500, date: "2026-11-16", mode: "transfer", accountId: "bk1", reference: "TT-9", narration: "Payment to X", ...extra } });
  it("a payment opens with the party, amount, day, account and reference, and asks to settle the oldest bills", () => {
    expect(partyPrefillFromAssistant(state("payment"), "payment")).toMatchObject({
      partyId: "v1", amount: "500", date: "2026-11-16", narration: "Payment to X", spread: true,
      payment: { mode: "transfer", accountId: "bk1", reference: "TT-9", chequeNo: "" },
    });
  });
  it("only on the screen of its own kind", () => {
    expect(partyPrefillFromAssistant(state("receipt"), "payment")).toBe(null);
    expect(partyPrefillFromAssistant(state("payment"), "receipt")).toBe(null);
    expect(partyPrefillFromAssistant(null, "payment")).toBe(null);
    expect(partyPrefillFromAssistant({}, "payment")).toBe(null);
  });
  it("junk from a stale or edited state becomes empty fields, not a broken form", () => {
    const f = partyPrefillFromAssistant(state("payment", { amount: "abc", date: "yesterday", mode: undefined, accountId: undefined }), "payment");
    expect(f.amount).toBe("");
    expect(f.date).toBeUndefined();
    expect(f.payment.mode).toBe("cash");
    expect(f.payment.accountId).toBe("");
    expect(partyPrefillFromAssistant(state("payment", { amount: -5 }), "payment").amount).toBe("");
  });
  it("an expense opens with its account, what it was for, and how it was paid", () => {
    const f = expensePrefillFromAssistant({ assistantPrefill: { kind: "expense", accountId: "ex1", amount: 150, description: "Fuel", mode: "bank", payAccountId: "bk1", reference: "R1" } }, "2026-11-20");
    expect(f.fields).toEqual({ date: "2026-11-20", expenseAccountId: "ex1", description: "Fuel", amount: "150", taxCodeId: "", vendorId: "" });
    expect(f.payment).toMatchObject({ mode: "bank", accountId: "bk1", reference: "R1" });
    expect(expensePrefillFromAssistant(state("payment"), "2026-11-20")).toBe(null);
  });
});

describe("a new customer or vendor", () => {
  const vendor = { id: "p1", kind: "vendor", endpoint: "party", confirm: "Add", body: { vendorName: "Desert Steel", contactPerson: "Desert Steel" }, missing: ["address"] };

  it("is kept, saved to its own route, and the address typed on the card goes into the body", async () => {
    const { normaliseProposals, saveUrl, bodyToSend, canSave } = await import("../assistantProposals");
    const [p] = normaliseProposals([vendor]);
    expect(p.kind).toBe("vendor");
    expect(saveUrl(p)).toBe("/vendors/vendors");
    expect(saveUrl({ kind: "customer", endpoint: "party" })).toBe("/customers");
    expect(canSave(p, {})).toBe(false);
    expect(bodyToSend(p, { address: "  Industrial Area 3 " })).toEqual({ vendorName: "Desert Steel", contactPerson: "Desert Steel", address: "Industrial Area 3" });
    expect(canSave(p, { address: "x" })).toBe(true);
    expect(normaliseProposals([{ ...vendor, endpoint: "elsewhere" }])).toEqual([]);
  });
});
