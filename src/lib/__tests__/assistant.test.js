import { describe, expect, it, beforeEach } from "vitest";
import { canSend, knownPaths, openingTip, safeLinks, toExchange, whyNotSend, MAX_QUESTION } from "../assistant";
import { formatAnswer, plainAnswer } from "../answerFormat";
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

describe("an answer turned into something readable", () => {
  it("keeps numbered steps as steps, which is what the guide is written in", () => {
    const blocks = formatAnswer("To raise an invoice:\n1. Open Sales.\n2. Add the lines.\n3. Press Approve.");
    expect(blocks.map((b) => b.type)).toEqual(["p", "ol"]);
    expect(blocks[1].items).toHaveLength(3);
    expect(blocks[1].items[1].map((s) => s.text).join("")).toBe("Add the lines.");
  });

  it("recognises a list even when nothing separates it from the sentence before", () => {
    // A model writing steps often runs them together, and steps that lose their numbering are the
    // one thing somebody following instructions cannot afford.
    const blocks = formatAnswer("Do this:\n- first\n- second");
    expect(blocks.map((b) => b.type)).toEqual(["p", "ul"]);
    expect(blocks[1].items).toHaveLength(2);
  });

  it("marks bold runs as data, never as markup", () => {
    const [p] = formatAnswer("Open **Sales**, then Orders.");
    expect(p.spans).toEqual([
      { text: "Open ", bold: false },
      { text: "Sales", bold: true },
      { text: ", then Orders.", bold: false },
    ]);
    // nothing that could be injected survives as anything but text
    const [risky] = formatAnswer("<img src=x onerror=alert(1)>");
    expect(risky.spans[0].text).toBe("<img src=x onerror=alert(1)>");
    expect(risky.spans[0].bold).toBe(false);
  });

  it("joins wrapped lines into one paragraph and keeps blank lines apart", () => {
    const blocks = formatAnswer("one line\nwrapped on.\n\nA second paragraph.");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].spans[0].text).toBe("one line wrapped on.");
  });

  it("gives back plain text for the clipboard", () => {
    expect(plainAnswer("Do this:\n1. Open **Sales**.\n2. Approve.")).toBe("Do this:\n\n1. Open Sales.\n2. Approve.");
    expect(plainAnswer("")).toBe("");
  });
});
