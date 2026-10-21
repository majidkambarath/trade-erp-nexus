import { describe, expect, it, beforeEach } from "vitest";
import { canSend, knownPaths, openingTip, safeLinks, toExchange, whyNotSend, MAX_QUESTION } from "../assistant";
import { clearRefusal, noteRefusal, recentRefusal } from "../lastRefusal";

const MODULES = [
  { id: "sales", tabs: [{ label: "Invoices", to: "/sales-order" }, { label: "Customers", to: "/customers", match: ["/customers/:id"] }] },
  { id: "home", tabs: [{ label: "Dashboard", to: "/dashboard" }] },
];

describe("what counts as a real screen", () => {
  it("is taken from the navigation, which the rail and the sweep are built from too", () => {
    const paths = knownPaths(MODULES);
    expect([...paths].sort()).toEqual(["/customers", "/customers/:id", "/dashboard", "/sales-order"]);
    // the real navigation, so the rule cannot pass on a fixture alone
    expect(knownPaths().has("/dashboard")).toBe(true);
  });

  it("drops a link to a screen that does not exist, however the server labelled it", () => {
    const links = safeLinks(
      [
        { path: "/dashboard", label: "Open home" },
        { path: "/pay-here-now", label: "Claim your refund" },
        { path: 42, label: "Nonsense" },
        null,
      ],
      MODULES
    );
    expect(links).toEqual([{ path: "/dashboard", label: "Open home" }]);
  });

  it("offers a screen once, however many times it was named", () => {
    const links = safeLinks([{ path: "/customers", label: "A" }, { path: "/customers", label: "B" }], MODULES);
    expect(links).toHaveLength(1);
  });
});

describe("the line it opens with", () => {
  it("names the topics about this screen, and says nothing when there are none", () => {
    expect(openingTip("/customers", [{ title: "Customers and vendors" }])).toBe("I can tell you about Customers and vendors.");
    expect(openingTip("/customers", [{ title: "A" }, { title: "B" }, { title: "C" }])).toBe("I can tell you about A, B and C.");
    expect(openingTip("/nowhere", [])).toBe("");
  });
});

describe("whether a question can be sent", () => {
  it("refuses an empty one quietly and a huge one with a reason", () => {
    expect(canSend("", {})).toBe(false);
    expect(whyNotSend("", {})).toBe("");
    expect(canSend("how do I raise an invoice", {})).toBe(true);
    expect(whyNotSend("x".repeat(MAX_QUESTION + 1), {})).toMatch(/too long/);
    expect(whyNotSend("anything", { busy: true })).toMatch(/Still working/);
    expect(canSend("anything", { busy: true })).toBe(false);
  });
});

describe("an exchange as the panel draws it", () => {
  it("keeps the server's own words and only the links that go somewhere", () => {
    const x = toExchange("how do I raise an invoice", {
      messageId: "m1",
      answer: "Open Sales, then Invoices.",
      citations: [{ title: "Order to cash" }, { title: "" }],
      links: [{ path: "/sales-order", label: "Open invoices" }, { path: "/made-up", label: "Go" }],
      outcome: "answered",
      canEscalate: false,
    });
    expect(x.id).toBe("m1");
    expect(x.answer).toBe("Open Sales, then Invoices.");
    expect(x.citations).toEqual(["Order to cash"]);
    expect(x.links.map((l) => l.path)).toEqual(["/sales-order"]);
    expect(x.helpful).toBeNull();
  });

  it("treats a hand-over already made as escalated", () => {
    expect(toExchange("q", { supportRequestId: "s1" }).escalated).toBe(true);
    expect(toExchange("q", { canEscalate: true }).canEscalate).toBe(true);
  });
});

describe("the refusal it explains", () => {
  beforeEach(() => clearRefusal());

  it("remembers the last error code for a few minutes, then forgets it", () => {
    noteRefusal({ response: { data: { errorCode: "PERIOD_CLOSED", message: "Posting is closed up to 31 Aug 2026" } }, config: { url: "/vouchers" } });
    expect(recentRefusal()).toEqual({ code: "PERIOD_CLOSED", message: "Posting is closed up to 31 Aug 2026" });
    expect(recentRefusal(Date.now() + 10 * 60 * 1000)).toBeNull();
  });

  it("records nothing when there was no code: there is then nothing to explain", () => {
    noteRefusal({ response: { data: { message: "Request failed" } } });
    expect(recentRefusal()).toBeNull();
    noteRefusal(undefined);
    expect(recentRefusal()).toBeNull();
  });

  it("is forgotten at sign-out, because a refusal names what somebody was doing", async () => {
    noteRefusal({ response: { data: { errorCode: "PERMISSION_DENIED", message: "no" } } });
    expect(recentRefusal()).not.toBeNull();
    clearRefusal();
    expect(recentRefusal()).toBeNull();
  });
});
