import { describe, it, expect } from "vitest";
import {
  MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_PAGES, attachmentDecision, attachmentNote, defaultRecipients, defaultSubject, newIdempotencyKey,
  parseRecipients, sendProblem, sizeText, toWaNumber, validateSend,
} from "../sendForms";

describe("recipients", () => {
  it("reads a paste or a typed list, lowercases, drops repeats, and sets the bad ones aside", () => {
    expect(parseRecipients("Ali@AlNoor.ae, sara@alnoor.ae; ali@alnoor.ae  boss@x")).toEqual({ emails: ["ali@alnoor.ae", "sara@alnoor.ae"], bad: ["boss@x"] });
    expect(parseRecipients("")).toEqual({ emails: [], bad: [] });
    expect(parseRecipients(null)).toEqual({ emails: [], bad: [] });
  });

  it("starts from the customer's own address, then the primary contact, then the others", () => {
    const party = { email: "Ali@AlNoor.ae", contacts: [{ email: "other@alnoor.ae" }, { email: "sara@alnoor.ae", isPrimary: true }, { email: "ali@alnoor.ae" }, { email: "" }, { email: "not-an-address" }] };
    expect(defaultRecipients(party)).toEqual(["ali@alnoor.ae", "sara@alnoor.ae", "other@alnoor.ae"]);
    expect(defaultRecipients({})).toEqual([]);
    expect(defaultRecipients(undefined)).toEqual([]);
  });
});

describe("the subject and the attachment line", () => {
  it("is named from the document's own title, so a draft is never called a tax invoice", () => {
    expect(defaultSubject({ title: "Tax invoice", number: "INV-1", companyName: "Harbour Trading" })).toBe("Tax invoice INV-1 from Harbour Trading");
    expect(defaultSubject({ title: "Sales order", number: "SO-1" })).toBe("Sales order SO-1");
  });

  it("says how big the PDF is in words a person reads", () => {
    expect(sizeText(900)).toBe("900 B");
    expect(sizeText(188416)).toBe("184 KB");
    expect(sizeText(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(attachmentNote({ label: "Customer copy", pages: 1, bytes: 188416 })).toBe("Customer copy · 1 page · 184 KB");
    expect(attachmentNote({ label: "Customer copy", pages: 3, bytes: 500000 })).toBe("Customer copy · 3 pages · 488 KB");
  });

  it("attaches a normal PDF, and says why not when it is too heavy or too long", () => {
    expect(attachmentDecision({ bytes: 200000, pages: 1 })).toEqual({ allowed: true, reason: "" });
    expect(attachmentDecision({ bytes: MAX_ATTACHMENT_BYTES, pages: MAX_ATTACHMENT_PAGES }).allowed).toBe(true);
    const big = attachmentDecision({ bytes: MAX_ATTACHMENT_BYTES + 1, pages: 1 });
    expect(big.allowed).toBe(false);
    expect(big.reason).toMatch(/too large to attach.*carry the link instead/);
    const long = attachmentDecision({ bytes: 100000, pages: MAX_ATTACHMENT_PAGES + 1 });
    expect(long.allowed).toBe(false);
    expect(long.reason).toBe("This document is 5 pages. The email will carry the link instead, or narrow the dates and attach it.");
  });
});

// The server normalises the number for the history (trade ERP node/utils/phone.js) and this screen shows what
// it will make of it: one rule written twice. Both repos test THIS SAME TABLE of inputs and answers
// (utils/__tests__/shareTokenPhone.test.js on the server), so they cannot drift apart without one failing.
describe("WhatsApp numbers", () => {
  it("reads a UAE number however it was typed", () => {
    for (const [typed, want] of [["050 111 2222", "971501112222"], ["+971 50 111 2222", "971501112222"], ["00971501112222", "971501112222"], ["0501112222", "971501112222"], ["501112222", "971501112222"], ["971501112222", "971501112222"], ["04 123 4567", "97141234567"], ["050-111-2222", "971501112222"]]) {
      expect(toWaNumber(typed), typed).toBe(want);
    }
  });

  it("keeps another country's code, and refuses what is not a number", () => {
    expect(toWaNumber("+91 98765 43210")).toBe("919876543210");
    expect(toWaNumber("0044 20 7946 0958")).toBe("442079460958");
    for (const bad of ["", null, undefined, "abc", "123", "050 111", "+1", "call me", "05011122223333"]) expect(toWaNumber(bad), String(bad)).toBeNull();
  });
});

describe("what the dialog checks before it asks the server", () => {
  it("asks for an address, names a bad one, and caps the lists", () => {
    expect(validateSend({ channel: "email", to: "", cc: "" }).errors.to).toBe("Who should it go to? Add an email address.");
    expect(validateSend({ channel: "email", to: "ali@x.ae, nope", cc: "" }).errors.to).toBe("nope does not look like an email address.");
    expect(validateSend({ channel: "email", to: "ali@x.ae", cc: "bad1, bad2" }).errors.cc).toBe("bad1, bad2 do not look like an email address.");
    expect(validateSend({ channel: "email", to: Array.from({ length: 11 }, (_, i) => `a${i}@x.ae`).join(","), cc: "" }).errors.to).toBe("At most 10 addresses in To.");
    const ok = validateSend({ channel: "email", to: "Ali@X.ae; sara@x.ae", cc: "boss@x.ae" });
    expect(ok.errors).toEqual({});
    expect(ok.to).toEqual(["ali@x.ae", "sara@x.ae"]);
    expect(ok.cc).toEqual(["boss@x.ae"]);
  });

  it("WhatsApp needs no address; a typed number must be a number, an empty one is allowed", () => {
    expect(validateSend({ channel: "whatsapp", phone: "" }).errors).toEqual({});
    expect(validateSend({ channel: "whatsapp", phone: "050 111 2222" }).errors).toEqual({});
    expect(validateSend({ channel: "whatsapp", phone: "call me" }).errors.phone).toMatch(/country code/);
  });
});

describe("a press of the button", () => {
  it("gets its own key every time, so a double click is recognised and a second send is not", () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(50);
    for (const k of keys) expect(k).toMatch(/^send-[A-Za-z0-9-]{8,}$/);
  });

  it("flags a setup problem so the dialog can point at Settings", () => {
    expect(sendProblem({ code: "MESSAGING_DISABLED", message: "Sending is switched off." })).toEqual({ message: "Sending is switched off.", setup: true });
    expect(sendProblem({ code: "MESSAGING_NOT_CONFIGURED", message: "x" }).setup).toBe(true);
    expect(sendProblem({ code: "INVALID_EMAIL", message: "no" })).toEqual({ message: "no", setup: false });
    expect(sendProblem(null).message).toMatch(/could not be sent/);
  });
});
