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

  it("isPaid is true only for a settled posted invoice", () => {
    expect(isPaid(invoice({ paidAmount: 1000, outstandingAmount: 0 }))).toBe(true);
    expect(isPaid(invoice())).toBe(false);
    expect(isPaid(invoice({ status: "DRAFT", paidAmount: 1000, outstandingAmount: 0 }))).toBe(false);
  });
});
