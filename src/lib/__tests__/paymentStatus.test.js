import { describe, it, expect } from "vitest";
import { paymentStatus, isPaid, PAYMENT_LABEL } from "../paymentStatus";

const invoice = (over = {}) => ({ status: "APPROVED", totalAmount: 1000, paidAmount: 0, outstandingAmount: 1000, ...over });

describe("paymentStatus", () => {
  it("says unpaid, partly paid and paid from the amounts", () => {
    expect(paymentStatus(invoice()).key).toBe("UNPAID");
    expect(paymentStatus(invoice({ paidAmount: 250, outstandingAmount: 750 }))).toMatchObject({ key: "PARTIAL", label: "Partly paid", paid: 250, outstanding: 750, total: 1000 });
    expect(paymentStatus(invoice({ paidAmount: 1000, outstandingAmount: 0 }))).toMatchObject({ key: "PAID", label: "Paid" });
  });

  it("has nothing to say about a document that is not posted", () => {
    for (const status of ["DRAFT", "PENDING", "REJECTED", "CANCELLED"]) {
      expect(paymentStatus(invoice({ status }))).toBeNull();
    }
    expect(paymentStatus(null)).toBeNull();
    expect(paymentStatus(undefined)).toBeNull();
  });

  it("reads the amounts, not the status word: an older route wrote PAID or PARTIAL into status", () => {
    expect(paymentStatus(invoice({ status: "PAID", paidAmount: 0, outstandingAmount: 1000 })).key).toBe("UNPAID");
    expect(paymentStatus(invoice({ status: "PARTIAL", paidAmount: 400, outstandingAmount: 600 })).key).toBe("PARTIAL");
    // with no amounts at all the old word is all there is
    expect(paymentStatus({ status: "PAID", totalAmount: 500 })).toMatchObject({ key: "PAID" });
    expect(paymentStatus({ status: "APPROVED", totalAmount: 500 })).toBeNull();
  });

  it("treats a figure that did not arrive as missing, never as zero", () => {
    // outstanding 0 would read as paid; a row with neither amount must say nothing
    expect(paymentStatus({ status: "APPROVED", totalAmount: 1000 })).toBeNull();
    expect(paymentStatus({ status: "APPROVED", totalAmount: 1000, paidAmount: null, outstandingAmount: "" })).toBeNull();
    // one of the two is enough
    expect(paymentStatus({ status: "APPROVED", totalAmount: 1000, outstandingAmount: 0 }).key).toBe("PAID");
    expect(paymentStatus({ status: "APPROVED", totalAmount: 1000, paidAmount: 300 })).toMatchObject({ key: "PARTIAL", outstanding: 700 });
  });

  it("accepts the two-decimal strings the order lists carry", () => {
    expect(paymentStatus({ status: "APPROVED", totalAmount: "1312.50", paidAmount: "312.50", outstandingAmount: "1000.00" })).toMatchObject({ key: "PARTIAL", paid: 312.5, outstanding: 1000 });
  });

  it("allows for the half-fils of rounding and for overpayment", () => {
    expect(paymentStatus(invoice({ paidAmount: 999.996, outstandingAmount: 0.004 })).key).toBe("PAID");
    expect(paymentStatus(invoice({ paidAmount: 1000.01, outstandingAmount: -0.01 })).key).toBe("PAID");
    expect(paymentStatus(invoice({ paidAmount: 0.004, outstandingAmount: 999.996 })).key).toBe("UNPAID");
  });

  it("says nothing for a nil document", () => {
    expect(paymentStatus(invoice({ totalAmount: 0, outstandingAmount: 0 }))).toBeNull();
  });

  it("has a label for every state", () => {
    expect(Object.keys(PAYMENT_LABEL).sort()).toEqual(["PAID", "PARTIAL", "UNPAID"]);
  });

  it("an invoice that returns have part-settled is partly credited, and one they settled in full is credited", () => {
    const part = paymentStatus(invoice({ creditedAmount: 300, outstandingAmount: 700 }));
    expect(part).toMatchObject({ key: "PARTIAL", label: "Partly credited", paid: 0, credited: 300, outstanding: 700 });
    const full = paymentStatus(invoice({ creditedAmount: 1000, outstandingAmount: 0 }));
    expect(full).toMatchObject({ key: "PAID", label: "Credited" });
    // money paid still decides the plain words
    expect(paymentStatus(invoice({ paidAmount: 600, creditedAmount: 400, outstandingAmount: 0 })).label).toBe("Paid");
    expect(paymentStatus(invoice({ paidAmount: 500, creditedAmount: 100, outstandingAmount: 400 })).label).toBe("Partly paid");
    // a row that carries no creditedAmount reads exactly as before
    expect(paymentStatus(invoice()).credited).toBe(0);
  });

  it("isPaid is true only for a settled posted invoice", () => {
    expect(isPaid(invoice({ paidAmount: 1000, outstandingAmount: 0 }))).toBe(true);
    expect(isPaid(invoice())).toBe(false);
    expect(isPaid(invoice({ status: "DRAFT", paidAmount: 1000, outstandingAmount: 0 }))).toBe(false);
  });
});

import { dueDateOf, isPastDue, termDays } from "../paymentStatus";

describe("when an invoice falls due", () => {
  const DAY = 86400000;
  const now = Date.parse("2026-10-11T12:00:00Z");
  const inv = (over = {}) => ({ status: "APPROVED", totalAmount: 100, paidAmount: 0, outstandingAmount: 100, date: "2026-09-01T00:00:00.000Z", ...over });

  it("reads the number of days in the party's terms", () => {
    expect(termDays("Net 30")).toBe(30);
    expect(termDays("45 days")).toBe(45);
    expect(termDays("COD")).toBe(0);
    expect(termDays(undefined)).toBe(0);
  });

  it("uses the stored date, else the invoice date plus the terms (on the row or on its party)", () => {
    expect(dueDateOf(inv({ dueDate: "2026-12-01T00:00:00.000Z" })).toISOString().slice(0, 10)).toBe("2026-12-01");
    expect(dueDateOf(inv({ paymentTerms: "Net 30" })).toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(dueDateOf(inv({ party: { paymentTerms: "Net 45" } })).toISOString().slice(0, 10)).toBe("2026-10-16");
    expect(dueDateOf(inv({ date: undefined }))).toBeNull();
  });

  it("is past due only after a whole day, and only while something is owed", () => {
    expect(isPastDue(inv({ paymentTerms: "Net 30" }), now)).toBe(true); // fell due 1 Oct
    expect(isPastDue(inv({ paymentTerms: "Net 45" }), now)).toBe(false); // falls due 16 Oct
    expect(isPastDue(inv({ paymentTerms: "Net 30", paidAmount: 100, outstandingAmount: 0 }), now)).toBe(false); // paid
    expect(isPastDue(inv({ status: "DRAFT", paymentTerms: "Net 30" }), now)).toBe(false); // a draft owes nothing
    expect(isPastDue(inv({ paymentTerms: "Net 30", dueDate: new Date(now - DAY / 2).toISOString() }), now)).toBe(false); // due earlier today
  });
});
