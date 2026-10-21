import { describe, it, expect } from "vitest";
import * as e from "../crmEmail";

// The form's own rules for writing to a customer. What is tested is what would reach somebody's inbox before a
// person noticed: an address typed wrong, a template that threw away what was written, an unfilled placeholder, and
// above all the three answers - sent, recorded only, failed - never reading the same.

describe("addresses", () => {
  it("reads several from one box, however they were separated", () => {
    expect(e.splitAddresses("a@b.com, c@d.com; e@f.com\ng@h.com")).toEqual(["a@b.com", "c@d.com", "e@f.com", "g@h.com"]);
    expect(e.splitAddresses("  A@B.com  ")).toEqual(["a@b.com"]);
    expect(e.splitAddresses("")).toEqual([]);
    expect(e.splitAddresses(null)).toEqual([]);
  });

  it("knows an address from something that is not one", () => {
    expect(e.isAddress("hassan@example.com")).toBe(true);
    expect(e.isAddress("hassan@example")).toBe(false);
    expect(e.isAddress("hassan at example.com")).toBe(false);
  });
});

describe("what the form will not send", () => {
  const good = { to: "a@b.com", subject: "Hello", body: "Something" };

  it("passes a letter that is complete", () => {
    expect(e.validate(good)).toEqual({});
  });

  it("names the field, so the message lands under the right box", () => {
    expect(e.validate({ ...good, to: "" }).to).toMatch(/who it goes to/i);
    expect(e.validate({ ...good, to: "a@b.com, nonsense" }).to).toMatch(/not an email address/i);
    expect(e.validate({ ...good, cc: "nope" }).cc).toMatch(/copied/i);
    expect(e.validate({ ...good, subject: "  " }).subject).toMatch(/subject/i);
    expect(e.validate({ ...good, body: "" }).body).toMatch(/Write something/i);
  });

  it("a long list is a campaign, which this is not", () => {
    const many = Array.from({ length: 11 }, (_, i) => `p${i}@b.com`).join(",");
    expect(e.validate({ ...good, to: many }).to).toMatch(/campaign/i);
  });
});

describe("the body sent to the server", () => {
  it("carries the addresses as a list and what it is about", () => {
    const body = e.emailBody({ to: "A@B.com, c@d.com", cc: "", subject: " Hi ", body: " Text " }, { kind: "opportunity", id: "deal1" });
    expect(body).toEqual({
      regarding: { kind: "opportunity", id: "deal1" },
      to: ["a@b.com", "c@d.com"],
      cc: [],
      subject: "Hi",
      body: "Text",
      templateKey: undefined,
    });
  });
});

describe("templates", () => {
  const template = { key: "after-a-call", name: "After a call", subject: "Following up", body: "Hello {{contact.firstName}}," };

  it("replaces the subject and the message, and SAYS so when something was written", () => {
    const blank = e.applyTemplate(e.blankEmail(), template);
    expect(blank.overwrote).toBe(false);
    expect(blank.form.subject).toBe("Following up");
    expect(blank.form.templateKey).toBe("after-a-call");

    const typed = e.applyTemplate({ subject: "", body: "I had started writing this" }, template);
    expect(typed.overwrote).toBe(true);
  });

  it("choosing nothing leaves the letter alone", () => {
    const form = { subject: "Mine", body: "Mine too" };
    expect(e.applyTemplate(form, null)).toEqual({ form, overwrote: false });
  });

  it("fills what it can and LEAVES an unknown placeholder visible", () => {
    const values = { "contact.firstName": "Rania", "deal.title": "" };
    expect(e.fill("Hello {{contact.firstName}}, about {{deal.title}}.", values)).toBe("Hello Rania, about .");
    // Left as written so the person proof-reading sees it, rather than a sentence with a silent hole.
    expect(e.fill("Your {{customer.trn}} please", values)).toBe("Your {{customer.trn}} please");
  });

  it("warns about exactly the placeholders nothing can fill", () => {
    const placeholders = [{ key: "contact.firstName" }, { key: "deal.title" }];
    expect(e.unknownIn("Hi {{contact.firstName}}, {{customer.trn}} and {{customer.trn}}", placeholders)).toEqual(["customer.trn"]);
    expect(e.unknownIn("Hi {{deal.title}}", placeholders)).toEqual([]);
  });
});

describe("the answer a person is given", () => {
  it("says it was sent", () => {
    const said = e.sendResult({ sent: true, recordedOnly: false, activity: { email: { to: ["rania@gulfsteel.test"] } } });
    expect(said.tone).toBe("success");
    expect(said.text).toContain("rania@gulfsteel.test");
  });

  it("never calls a recorded letter a sent one", () => {
    const said = e.sendResult({ sent: true, recordedOnly: true, provider: "console" });
    expect(said.tone).toBe("warning");
    expect(said.text).toMatch(/NOT emailed/);
    expect(said.text).not.toMatch(/^Sent/);
  });

  it("says plainly when it failed, and that the record shows that", () => {
    const said = e.sendResult({ sent: false, error: "the mailbox refused it" });
    expect(said.tone).toBe("danger");
    expect(said.text).toContain("the mailbox refused it");
    expect(said.text).toMatch(/marked as not sent/);
  });
});

describe("how one sent email reads on a record", () => {
  it("tells the three states apart", () => {
    expect(e.emailLine({ email: { to: ["a@b.com"], sentAt: "2026-10-21T08:00:00Z", provider: "resend" } })).toMatchObject({ state: "Sent", tone: "success" });
    expect(e.emailLine({ email: { to: ["a@b.com"], sentAt: "2026-10-21T08:00:00Z", provider: "console" } })).toMatchObject({ state: "Recorded only", tone: "warning" });
    expect(e.emailLine({ email: { to: ["a@b.com"], error: "refused" } })).toMatchObject({ state: "Not sent", tone: "danger" });
    expect(e.emailLine({ kind: "call" })).toMatchObject({ to: "", state: "" });
  });
});

it("the screen always says replies are not read here", () => {
  expect(e.REPLY_NOTE).toMatch(/own mailbox/i);
  expect(e.REPLY_NOTE).toMatch(/not shown here/i);
});
