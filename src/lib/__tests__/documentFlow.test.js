import { describe, it, expect } from "vitest";
import { INVOICE_QUEUE, dealGroup, dealSteps, dealTitle, defaultFilter, filterDeals, flowCounts, leftText, nextAction, orderTo } from "../documentFlow";

const quote = (over = {}) => ({ _id: "q1", quotationNo: "QT-2026-0007", status: "SENT", expired: false, daysLeft: 12, validUntil: "2026-11-05T00:00:00.000Z", totalAmount: 210, ...over });
const order = (over = {}) => ({ _id: "o1", transactionNo: "SO-2026-0031", status: "DRAFT", totalAmount: 210, outstandingAmount: 210, ...over });
const note = (over = {}) => ({ _id: "n1", deliveryNoteNo: "DLN-2026-0012", status: "DELIVERED", deliveredAt: "2026-10-04T08:00:00.000Z", totalAmount: 105, ...over });
const deal = (over = {}) => ({ key: "k", stage: "quoted", mode: null, quotation: null, order: null, notes: [], invoiceClock: null, ...over });
const state = (c) => Object.fromEntries(dealSteps(c).map((s) => [s.key, s.state]));
const step = (c, key) => dealSteps(c).find((s) => s.key === key);

describe("steps of a deal", () => {
  it("a finished deal is four done steps with every document linked", () => {
    const c = deal({ stage: "invoiced", mode: "order_first", quotation: quote({ status: "CONVERTED" }), order: order({ status: "APPROVED", outstandingAmount: 100 }), notes: [note()] });
    expect(state(c)).toEqual({ quotation: "done", order: "done", delivery: "done", invoice: "done" });
    expect(dealSteps(c).map((s) => s.label)).toEqual(["Quotation", "Sales order", "Delivery", "Invoice"]);
    expect(step(c, "quotation").docs[0].to).toBe("/quotations?open=q1");
    expect(step(c, "delivery").docs[0].to).toBe("/delivery-notes?open=n1");
    expect(step(c, "invoice").docs[0]).toMatchObject({ no: "SO-2026-0031", status: "Invoiced", meta: "AED 100.00 outstanding" });
    expect(dealSteps(c).some((s) => s.current)).toBe(false);
  });

  it("an invoice that has been paid says so", () => {
    const c = deal({ stage: "invoiced", order: order({ status: "APPROVED", outstandingAmount: 0 }) });
    expect(step(c, "invoice").docs[0].meta).toBe("paid");
  });

  it("an offer nobody has answered: the quotation is in hand, the rest is still to come", () => {
    const c = deal({ quotation: quote() });
    expect(state(c)).toEqual({ quotation: "doing", order: "todo", delivery: "todo", invoice: "todo" });
    expect(dealSteps(c).find((s) => s.current).key).toBe("quotation");
    expect(step(c, "quotation").docs[0].meta).toBe("valid 12 more days");
    expect(step(c, "order").hint).toBe("Not ordered yet");
  });

  it("an accepted offer tells you what to do with it", () => {
    const c = deal({ quotation: quote({ status: "ACCEPTED" }) });
    expect(state(c).quotation).toBe("done");
    expect(step(c, "order").hint).toBe("Accepted: convert it to a sales order");
    expect(dealSteps(c).find((s) => s.current).key).toBe("order");
  });

  it("a rejected or expired offer stops the deal, and what would have followed is not pending", () => {
    for (const q of [quote({ status: "REJECTED" }), quote({ expired: true, daysLeft: -3 })]) {
      const c = deal({ stage: q.status === "REJECTED" ? "lost" : "lapsed", quotation: q });
      expect(state(c)).toEqual({ quotation: "stopped", order: "none", delivery: "none", invoice: "none" });
      expect(dealSteps(c).some((s) => s.current)).toBe(false);
    }
  });

  it("an order with nothing delivered, then a delivery on the road, then everything signed for", () => {
    expect(state(deal({ stage: "ordered", mode: null, order: order() }))).toEqual({ quotation: "none", order: "done", delivery: "todo", invoice: "todo" });
    expect(step(deal({ order: order() }), "delivery").hint).toBe("Nothing delivered yet");
    expect(state(deal({ order: order(), mode: "order_first", notes: [note({ status: "DISPATCHED" })] })).delivery).toBe("doing");
    expect(state(deal({ order: order(), mode: "order_first", notes: [note(), note({ _id: "n2", status: "DRAFT" })] })).delivery).toBe("doing");
    const done = deal({ stage: "delivered", order: order(), mode: "order_first", notes: [note(), note({ _id: "n2" })] });
    expect(state(done).delivery).toBe("done");
    expect(dealSteps(done).find((s) => s.current).key).toBe("invoice");
    expect(step(done, "invoice").hint).toBe("Approve the order to invoice");
  });

  it("goods first has no separate order step: the delivery leads straight to the invoice", () => {
    const c = deal({ stage: "delivered", mode: "delivery_first", quotation: quote({ status: "CONVERTED" }), notes: [note()], invoiceClock: { clock: "dueSoon", daysToStandard: 2 } });
    expect(dealSteps(c).map((s) => s.label)).toEqual(["Quotation", "Delivery", "Invoice"]);
    expect(state(c)).toEqual({ quotation: "done", delivery: "done", invoice: "todo" });
    expect(step(c, "invoice").hint).toBe("Invoice due in 2 days");

    const draft = deal({ ...c, order: order({ transactionNo: "SO-2026-0040" }) });
    expect(state(draft).invoice).toBe("doing");
    expect(step(draft, "invoice").docs[0]).toMatchObject({ no: "SO-2026-0040", status: "Draft invoice" });
    expect(step(draft, "invoice").hint).toBe("Draft invoice: approve it to book the sale");
  });

  it("a note on its own has no quotation and no order", () => {
    const c = deal({ stage: "delivered", mode: "delivery_first", notes: [note()] });
    expect(state(c)).toEqual({ quotation: "none", delivery: "done", invoice: "todo" });
    expect(step(c, "quotation").hint).toBe("No quotation");
  });
});

describe("the next thing to do", () => {
  const to = (c) => nextAction(c)?.to;
  const label = (c) => nextAction(c)?.label;

  it("an offer: finish it, wait for the answer, convert it, or revise it", () => {
    expect(label(deal({ quotation: quote({ status: "DRAFT" }) }))).toBe("Finish and send");
    expect(nextAction(deal({ quotation: quote() }))).toMatchObject({ label: "Record the answer", waiting: true, to: "/quotations?open=q1" });
    expect(label(deal({ quotation: quote({ status: "ACCEPTED" }) }))).toBe("Convert to a sales order");
    expect(label(deal({ quotation: quote({ expired: true, daysLeft: -2 }) }))).toBe("Revise the offer");
    expect(nextAction(deal({ quotation: quote({ status: "REJECTED" }) }))).toBeNull();
  });

  it("an order: approve it, or deal with the delivery first", () => {
    expect(label(deal({ order: order() }))).toBe("Approve the order");
    expect(to(deal({ order: order() }))).toBe("/sales-order?search=SO-2026-0031");
    expect(label(deal({ order: order(), notes: [note()] }))).toBe("Approve the order to invoice it");
    expect(label(deal({ order: order(), notes: [note({ status: "DRAFT" })] }))).toBe("Dispatch the delivery");
    expect(nextAction(deal({ order: order(), notes: [note({ status: "DISPATCHED" })] }))).toMatchObject({ label: "Confirm the delivery", to: "/delivery-notes?open=n1" });
  });

  it("goods first: raise the invoice from the notes, then approve it", () => {
    const c = deal({ mode: "delivery_first", notes: [note()], invoiceClock: { clock: "overdue", daysToStandard: -40, summaryDue: "2026-09-14" } });
    expect(nextAction(c)).toMatchObject({ label: "Create the invoice", to: INVOICE_QUEUE, why: "Invoice overdue" });
    expect(label(deal({ mode: "delivery_first", notes: [note()], order: order() }))).toBe("Approve the invoice");
  });

  it("a finished deal has nothing to do, unless a delivery is still out", () => {
    expect(nextAction(deal({ stage: "invoiced", order: order({ status: "APPROVED" }), notes: [note()] }))).toBeNull();
    expect(label(deal({ stage: "invoiced", order: order({ status: "APPROVED" }), notes: [note({ status: "DISPATCHED" })] }))).toBe("Confirm the delivery");
  });

  it("order links are safe for any document number", () => {
    expect(orderTo({ transactionNo: "SO 2026/1&x" })).toBe("/sales-order?search=SO%202026%2F1%26x");
  });
});

describe("which deals need someone", () => {
  const waiting = deal({ key: "w", stage: "quoted", quotation: quote() });
  const accepted = deal({ key: "a", stage: "quoted", quotation: quote({ status: "ACCEPTED" }) });
  const toApprove = deal({ key: "o", stage: "ordered", order: order() });
  const finished = deal({ key: "f", stage: "invoiced", order: order({ status: "APPROVED" }) });
  const lost = deal({ key: "l", stage: "lost", quotation: quote({ status: "REJECTED" }) });
  const lapsed = deal({ key: "x", stage: "lapsed", quotation: quote({ expired: true, daysLeft: -1 }) });
  const all = [waiting, accepted, toApprove, finished, lost, lapsed];

  it("groups deals", () => {
    expect(all.map(dealGroup)).toEqual(["progress", "action", "action", "done", "done", "done"]);
    expect(dealGroup(deal({ stage: "invoiced", order: order({ status: "APPROVED" }), notes: [note({ status: "DISPATCHED" })] }))).toBe("action");
  });

  it("counts, filters and opens on what needs doing", () => {
    const counts = flowCounts(all);
    expect(counts).toEqual({ action: 2, progress: 1, done: 3, all: 6 });
    expect(filterDeals(all, "action").map((c) => c.key)).toEqual(["a", "o"]);
    expect(filterDeals(all, "all")).toHaveLength(6);
    expect(defaultFilter(counts)).toBe("action");
    expect(defaultFilter(flowCounts([finished, lost]))).toBe("all");
  });
});

describe("what heads a deal", () => {
  it("is its invoice or order, else its offer, else its note", () => {
    expect(dealTitle(deal({ order: order({ status: "APPROVED" }) }))).toEqual({ no: "SO-2026-0031", kind: "Tax invoice" });
    expect(dealTitle(deal({ order: order() }))).toEqual({ no: "SO-2026-0031", kind: "Sales order" });
    expect(dealTitle(deal({ order: order(), mode: "delivery_first" })).kind).toBe("Draft invoice");
    expect(dealTitle(deal({ quotation: quote() }))).toEqual({ no: "QT-2026-0007", kind: "Quotation" });
    expect(dealTitle(deal({ notes: [note()] }))).toEqual({ no: "DLN-2026-0012", kind: "Delivery note" });
  });
});

describe("part deliveries", () => {
  const left = (remaining) => ({ started: true, complete: false, remaining });
  const rice = [{ description: "Rice", qty: 4 }];

  it("every note signed for is still not a finished delivery when part of the order has not gone out", () => {
    const c = deal({ stage: "delivering", mode: "order_first", order: order(), notes: [note()], delivery: left(rice) });
    expect(state(c).delivery).toBe("doing");
    expect(step(c, "delivery").hint).toBe("Still to deliver: 4 x Rice");
    expect(dealSteps(c).find((s) => s.current).key).toBe("delivery");
    expect(state(deal({ order: order(), mode: "order_first", notes: [note()], delivery: { started: true, complete: true, remaining: [] } })).delivery).toBe("done");
  });

  it("the next step is to deliver the rest, to a note started against that order", () => {
    const c = deal({ stage: "delivering", mode: "order_first", order: order(), notes: [note()], delivery: left(rice) });
    expect(nextAction(c)).toMatchObject({ label: "Deliver the rest", why: "Still to deliver: 4 x Rice", to: "/delivery-notes?order=o1" });
    expect(dealGroup(c)).toBe("action");
  });

  it("an invoiced order that is only part delivered still needs someone", () => {
    const c = deal({ stage: "invoiced", mode: "order_first", order: order({ status: "APPROVED" }), notes: [note()], delivery: left(rice) });
    expect(nextAction(c).label).toBe("Deliver the rest");
    expect(dealGroup(c)).toBe("action");
    expect(dealSteps(c).some((s) => s.current)).toBe(false); // the invoice itself is done
  });

  it("a delivery still on the road is dealt with before the rest is", () => {
    const c = deal({ mode: "order_first", order: order(), notes: [note({ status: "DISPATCHED" })], delivery: left(rice) });
    expect(nextAction(c).label).toBe("Confirm the delivery");
  });

  it("an order nothing has gone out on keeps its own next step", () => {
    const c = deal({ stage: "ordered", order: order(), delivery: { started: false, complete: false, remaining: rice } });
    expect(nextAction(c).label).toBe("Approve the order");
    expect(step(c, "delivery").hint).toBe("Nothing delivered yet");
  });

  it("lists at most two lines of what is left", () => {
    expect(leftText([{ description: "Rice", qty: 4 }, { description: "Oil", qty: 2.5 }])).toBe("4 x Rice, 2.5 x Oil");
    expect(leftText([{ description: "A", qty: 1 }, { description: "B", qty: 2 }, { description: "C", qty: 3 }, { description: "D", qty: 4 }])).toBe("1 x A, 2 x B +2 more");
    expect(leftText([])).toBe("");
  });
});
