import { describe, it, expect } from "vitest";
import {
  availabilityWarning, clockText, deliverForm, deliverPayload, expiresSoon, invoiceBlocker, invoiceText, lineageOf,
  orderPayload, orderRows, shortLines, statusLabel, validateDeliver, validateOrderRows, validityText,
} from "../salesDocuments";
import { statusTone } from "../status";

describe("status wording and colour", () => {
  it("every quotation and delivery state has a label and a tone", () => {
    for (const s of ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED", "SUPERSEDED", "DISPATCHED", "DELIVERED", "CANCELLED"]) {
      expect(statusLabel(s)).toBeTruthy();
      expect(["neutral", "info", "warning", "success", "danger"]).toContain(statusTone(s));
    }
    expect(statusLabel("DISPATCHED")).toBe("On the road");
  });

  it("keeps lapsed, rejected and draft visually distinct", () => {
    expect(statusTone("EXPIRED")).toBe("warning");
    expect(statusTone("REJECTED")).toBe("danger");
    expect(statusTone("DRAFT")).toBe("neutral");
    expect(statusTone("SENT")).not.toBe(statusTone("ACCEPTED"));
  });
});

describe("validityText", () => {
  const base = { validUntil: "2026-11-05T00:00:00.000Z" };
  it("counts days on a draft or sent offer", () => {
    expect(validityText({ ...base, status: "SENT", daysLeft: 12 })).toMatch(/· 12 days left$/);
    expect(validityText({ ...base, status: "SENT", daysLeft: 1 })).toMatch(/· 1 day left$/);
    expect(validityText({ ...base, status: "DRAFT", daysLeft: 3 })).toMatch(/3 days left/);
  });
  it("says so on the last day and after", () => {
    expect(validityText({ ...base, status: "SENT", daysLeft: 0 })).toMatch(/expires today$/);
    expect(validityText({ ...base, status: "SENT", daysLeft: -1, expired: true })).toBe("Expired 1 day ago");
    expect(validityText({ ...base, status: "SENT", daysLeft: -9, expired: true })).toBe("Expired 9 days ago");
  });
  it("stops counting once the offer has an answer", () => {
    expect(validityText({ ...base, status: "ACCEPTED", daysLeft: -30 })).toMatch(/^Valid until /);
    expect(validityText({ ...base, status: "ACCEPTED", daysLeft: -30 })).not.toMatch(/ago|left/);
  });
  it("is empty without a date", () => {
    expect(validityText({ status: "SENT" })).toBe("");
    expect(validityText(null)).toBe("");
  });
  it("flags a sent offer that runs out within a week", () => {
    expect(expiresSoon({ status: "SENT", daysLeft: 7 })).toBe(true);
    expect(expiresSoon({ status: "SENT", daysLeft: 8 })).toBe(false);
    expect(expiresSoon({ status: "SENT", daysLeft: -1, expired: true })).toBe(false);
    expect(expiresSoon({ status: "ACCEPTED", daysLeft: 2 })).toBe(false);
  });
});

describe("lineageOf", () => {
  it("names where an offer came from and where it went", () => {
    expect(lineageOf({ revisionOf: { no: "QT-1", id: "a" } })).toEqual([{ text: "Revision of QT-1", kind: "quotation", id: "a" }]);
    expect(lineageOf({ convertedTo: { kind: "sales_order", no: "SO-9", id: "b" } })[0].text).toBe("Became SO-9");
    expect(lineageOf({ convertedTo: { kind: "delivery_note", no: "DLN-3", id: "c" } })[0].text).toBe("Delivered on DLN-3");
    expect(lineageOf({})).toEqual([]);
  });
});

describe("the 14-day invoice clock in words", () => {
  const c = (clock, daysToStandard, summaryDue = "2026-11-14") => ({ clock, daysToStandard, summaryDue });
  it("walks through its four states", () => {
    expect(clockText(c("within", 9))).toBe("9 days left to invoice");
    expect(clockText(c("dueSoon", 2))).toBe("Invoice due in 2 days");
    expect(clockText(c("dueSoon", 0))).toBe("Invoice due today");
    expect(clockText(c("pastStandard", -1))).toMatch(/^14 days passed\. A summary invoice is still in time until /);
    expect(clockText(c("overdue", -40))).toBe("Invoice overdue");
    expect(clockText(null)).toBe("");
  });
  it("says what an invoice is waiting on", () => {
    expect(invoiceText({ status: "DELIVERED", invoiceStatus: "NONE" })).toBe("Not invoiced");
    expect(invoiceText({ status: "DELIVERED", invoiceStatus: "DRAFT", invoice: { no: "SO-1" } })).toBe("Draft invoice SO-1");
    expect(invoiceText({ status: "DELIVERED", invoiceStatus: "INVOICED", invoice: { no: "SO-1" } })).toBe("Invoiced on SO-1");
    expect(invoiceText({ status: "DRAFT", invoiceStatus: "NONE" })).toBe("");
  });
});

describe("confirming a delivery", () => {
  const note = { date: "2026-10-01", items: [{ _id: "l1", description: "Rice", qty: 10 }, { _id: "l2", description: "Oil", qty: 4 }] };
  const fresh = () => deliverForm(note, "2026-10-06");
  const filled = (patch = {}) => ({ ...fresh(), receivedBy: "Store keeper", ...patch });

  it("starts as everything delivered, so only exceptions are typed", () => {
    const f = fresh();
    expect(f.lines.map((l) => l.deliveredQty)).toEqual(["10", "4"]);
    expect(f.deliveredAt).toBe("2026-10-06");
    expect(shortLines(f)).toEqual([]);
    expect(validateDeliver(filled(), { today: "2026-10-06" })).toBeNull();
  });

  it("needs the name of whoever signed", () => {
    expect(validateDeliver(fresh(), { today: "2026-10-06" }).receivedBy).toBeTruthy();
    expect(validateDeliver(filled({ receivedBy: "   " }), { today: "2026-10-06" }).receivedBy).toBeTruthy();
  });

  it("rejects a future date and one before the note was made", () => {
    expect(validateDeliver(filled({ deliveredAt: "2026-10-07" }), { today: "2026-10-06" }).deliveredAt).toMatch(/future/);
    expect(validateDeliver(filled({ deliveredAt: "2026-09-30" }), { today: "2026-10-06", noteDate: "2026-10-01" }).deliveredAt).toMatch(/before/);
    expect(validateDeliver(filled({ deliveredAt: "2026-10-01" }), { today: "2026-10-06", noteDate: "2026-10-01" })).toBeNull();
  });

  it("a short line needs a reason, and more than was sent is refused", () => {
    const f = filled();
    f.lines[0].deliveredQty = "8";
    expect(shortLines(f)).toHaveLength(1);
    expect(validateDeliver(f, { today: "2026-10-06" }).lines[0]).toBe("Say why 2 was not delivered");
    f.lines[0].shortReason = "2 cartons damaged";
    expect(validateDeliver(f, { today: "2026-10-06" })).toBeNull();
    f.lines[1].deliveredQty = "5";
    expect(validateDeliver(f, { today: "2026-10-06" }).lines[1]).toBe("At most 4 was sent");
    f.lines[1].deliveredQty = "";
    expect(validateDeliver(f, { today: "2026-10-06" }).lines[1]).toBe("Enter zero or more");
  });

  it("delivering nothing at all is refused", () => {
    const f = filled();
    f.lines.forEach((l) => { l.deliveredQty = "0"; l.shortReason = "closed"; });
    expect(validateDeliver(f, { today: "2026-10-06" }).nothing).toMatch(/Cancel the delivery note/);
  });

  it("sends numbers, trimmed, and no reason for a full line", () => {
    const f = filled({ receivedBy: "  Ali  ", proofNote: " signed " });
    f.lines[0].deliveredQty = "8";
    f.lines[0].shortReason = " damaged ";
    const p = deliverPayload(f);
    expect(p.receivedBy).toBe("Ali");
    expect(p.proofNote).toBe("signed");
    expect(p.lines).toEqual([
      { lineId: "l1", deliveredQty: 8, shortReason: "damaged" },
      { lineId: "l2", deliveredQty: 4, shortReason: "" },
    ]);
  });
});

describe("a note against a sales order", () => {
  const prefill = {
    lines: [
      { sourceLineId: "a", description: "Rice", itemCode: "R1", ordered: 10, delivered: 2, pending: 3, remaining: 5, stockDetails: { unit: "KG" } },
      { sourceLineId: "b", description: "Oil", itemCode: "O1", ordered: 4, delivered: 4, pending: 0, remaining: 0 },
    ],
  };

  it("starts from what is left, and a finished line stays visible but empty", () => {
    const rows = orderRows(prefill);
    expect(rows.map((r) => r.qty)).toEqual(["5", ""]);
    expect(rows[0].unit).toBe("KG");
    expect(rows[1].remaining).toBe(0);
  });

  it("refuses more than is left, and a note with nothing on it", () => {
    const rows = orderRows(prefill);
    expect(validateOrderRows(rows)).toBeNull();
    rows[0].qty = "6";
    expect(validateOrderRows(rows)[0]).toBe("Only 5 is left on the order");
    rows[0].qty = "0";
    expect(validateOrderRows(rows).none).toBeTruthy();
    rows[0].qty = "-1";
    expect(validateOrderRows(rows)[0]).toBe("Enter zero or more");
  });

  it("sends only the lines with a quantity, naming the order line", () => {
    const rows = orderRows(prefill);
    const p = orderPayload("order1", rows, { date: "2026-10-06", reference: "LPO-1", vehicleNo: "DXB 1" });
    expect(p.sourceTransactionId).toBe("order1");
    expect(p.items).toEqual([{ sourceLineId: "a", qty: 5 }]);
    expect(p.reference).toBe("LPO-1");
    expect(p.driverName).toBe("");
  });
});

describe("stock promised on notes", () => {
  const a = { onHand: 20, committed: 12, available: 8 };
  it("is silent while the quantity fits", () => {
    expect(availabilityWarning("Rice", 8, a)).toBeNull();
    expect(availabilityWarning("Rice", 0, a)).toBeNull();
    expect(availabilityWarning("Rice", 5, undefined)).toBeNull();
  });
  it("says how much is really free, and why", () => {
    expect(availabilityWarning("Rice", 10, a)).toBe("Rice: 10 asked, 8 available (20 on hand, 12 already promised on other delivery notes)");
    expect(availabilityWarning("Rice", 5, { onHand: 3, committed: 0, available: 3 })).toBe("Rice: 5 asked, 3 available (3 on hand)");
    expect(availabilityWarning("Rice", 5, { onHand: 3, committed: 6, available: -3 })).toMatch(/0 available/);
  });
});

describe("invoicing notes together", () => {
  const ok = (id, party = "p1") => ({ deliveryNoteNo: id, partyId: party, actions: { invoice: true } });
  it("accepts delivered, uninvoiced notes of one customer", () => {
    expect(invoiceBlocker([ok("A"), ok("B")])).toBeNull();
  });
  it("explains what is wrong", () => {
    expect(invoiceBlocker([])).toMatch(/Choose/);
    expect(invoiceBlocker([ok("A"), ok("B", "p2")])).toMatch(/different customers/);
    expect(invoiceBlocker([{ deliveryNoteNo: "C", partyId: "p1", actions: { invoice: false }, source: { kind: "sales_order", no: "SO-5" } }])).toBe("C cannot be invoiced from here: approve SO-5 instead");
  });
});

import { addDaysToInput, newDeliveryNoteForm, newQuotationForm } from "../salesDocuments";

describe("dates for a new document", () => {
  it("adds days on the calendar, across months, years and a leap day", () => {
    expect(addDaysToInput("2026-10-06", 30)).toBe("2026-11-05");
    expect(addDaysToInput("2026-12-20", 15)).toBe("2027-01-04");
    expect(addDaysToInput("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToInput("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("a quotation starts valid for 30 days, a delivery note starts with nothing chosen", () => {
    const q = newQuotationForm("2026-10-06");
    expect(q).toMatchObject({ date: "2026-10-06", validUntil: "2026-11-05", partyType: "Customer", items: [], charges: [] });
    const d = newDeliveryNoteForm("2026-10-06");
    expect(d).toMatchObject({ date: "2026-10-06", partyId: "", deliveryAddress: "" });
    expect(d).not.toHaveProperty("validUntil");
  });
});

describe("editing a note against an order", () => {
  const prefill = {
    lines: [
      // 10 ordered, 2 delivered elsewhere, 3 pending of which this note holds all 3, so 5 remain for others
      { sourceLineId: "a", description: "Rice", ordered: 10, delivered: 2, pending: 3, remaining: 5 },
      { sourceLineId: "b", description: "Oil", ordered: 4, delivered: 0, pending: 0, remaining: 4 },
    ],
  };

  it("counts what the note already holds as available to it, and starts there", () => {
    const rows = orderRows(prefill, { a: 3 });
    expect(rows[0]).toMatchObject({ remaining: 8, pending: 0, qty: "3" });
    expect(rows[1]).toMatchObject({ remaining: 4, qty: "" }); // a line this note does not carry starts empty
  });

  it("lets it be raised to everything left, and no further", () => {
    const rows = orderRows(prefill, { a: 3 });
    rows[0].qty = "8";
    expect(validateOrderRows(rows)).toBeNull();
    rows[0].qty = "9";
    expect(validateOrderRows(rows)[0]).toBe("Only 8 is left on the order");
  });
});
