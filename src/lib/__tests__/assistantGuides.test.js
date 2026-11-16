import { describe, it, expect } from "vitest";
import { questionWords, suggestGuides, withinOne } from "../assistantGuides";
import { FLOWS, wording } from "../../guides/index";

// The real guides and their real English wording, so a renamed guide shows up here.
const describeFlow = (f) => wording(null, `flow.${f.id}`);
const ids = (q, flows = FLOWS, opts) => suggestGuides(q, flows, describeFlow, opts).map((g) => g.id);

describe("which walkthroughs a question is offered", () => {
  it("a purchase, typed with a typo and a request in front, offers the purchase order first, and not a purchase RETURN", () => {
    const got = ids("i need to purcahse");
    expect(got[0]).toBe("create-purchase-order");
    expect(got).not.toContain("purchase-return");
  });

  it("the words people use are the words the guides use", () => {
    expect(ids("add a custmer")[0]).toBe("add-customer");
    expect(ids("pay my supplier")[0]).toBe("pay-supplier");
    expect(ids("i want to pay a suplier")[0]).toBe("pay-supplier");
    expect(ids("how do I buy something")[0]).toBe("create-purchase-order");
    expect(ids("record an expense")[0]).toBe("record-expense");
    expect(ids("How do I raise an invoice?")[0]).toBe("quick-sales-invoice");
  });

  it("a return is offered when the person asks for one", () => {
    expect(ids("the customer returned goods")).toContain("sales-return");
  });

  it("a verb alone does not qualify a guide, and a question no guide fits gets none", () => {
    expect(ids("add")).toEqual([]);
    expect(ids("how many chartofaccounts have")).toEqual([]);
    expect(ids("")).toEqual([]);
    expect(ids(null)).toEqual([]);
  });

  it("only guides this person may run are offered, and never more than two", () => {
    const allowed = FLOWS.filter((f) => f.id !== "create-purchase-order");
    expect(ids("i need to purcahse", allowed)).not.toContain("create-purchase-order");
    expect(ids("i need to purchase", FLOWS).length).toBeLessThanOrEqual(2);
    expect(ids("purchase", FLOWS, { max: 1 }).length).toBe(1);
    expect(ids("pay", [])).toEqual([]);
  });

  it("each suggestion carries its title for the button", () => {
    const [first] = suggestGuides("pay my supplier", FLOWS, describeFlow);
    expect(first).toEqual({ id: "pay-supplier", title: "Pay a vendor" });
  });
});

describe("reading a question", () => {
  it("drops the request in front and the filler words", () => {
    expect(questionWords("I need to purchase")).toEqual(["purchase"]);
    expect(questionWords("how do I add a client")).toEqual(["add", "customer"]);
  });
  it("one slip apart, for words of five letters or more", () => {
    expect(withinOne("purcahse", "purchase")).toBe(true);
    expect(withinOne("custmer", "customer")).toBe(true);
    expect(withinOne("vendr", "vendor")).toBe(true);
    expect(withinOne("pay", "pat")).toBe(false);
    expect(withinOne("production", "protection")).toBe(false);
  });
});
