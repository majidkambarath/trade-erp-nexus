import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NEXT_STEP, SEND_STATUS, SentLine, SendStatusPill, sendLine, sendSentence, sendStateOf, summaryOfSend } from "../shared";

const TONES = ["neutral", "info", "warning", "success", "danger"];

describe("the words for a send", () => {
  it("every state has a label, a tone the pill knows, and a sentence about what to do", () => {
    expect(Object.keys(SEND_STATUS).sort()).toEqual(Object.keys(NEXT_STEP).sort());
    for (const [key, s] of Object.entries(SEND_STATUS)) {
      expect(s.label.length, key).toBeGreaterThan(2);
      expect(TONES, key).toContain(s.tone);
      expect(NEXT_STEP[key].length, key).toBeGreaterThan(10);
    }
  });

  it("never promises delivery: no label says delivered, and WhatsApp never says sent", () => {
    const labels = Object.values(SEND_STATUS).map((s) => s.label.toLowerCase());
    expect(labels.some((l) => l === "delivered" || l === "sent")).toBe(false);
    expect(SEND_STATUS.HANDED_OFF.label).toBe("Given on WhatsApp");
    expect(SEND_STATUS.SENT.label).toBe("Emailed");
    expect(NEXT_STEP.SENT).toMatch(/cannot tell us/);
    expect(NEXT_STEP.HANDED_OFF).toMatch(/not known here/);
  });

  it("a record-only send is never called Emailed: it reads Recorded only, in the list, the header and the log", () => {
    const recorded = { status: "SENT", provider: "console", at: "2026-10-08T08:00:00Z", to: "ali@alnoor.ae" };
    expect(sendStateOf(recorded)).toBe("RECORDED");
    expect(sendStateOf({ ...recorded, provider: "resend" })).toBe("SENT");
    expect(sendStateOf({ status: "SENT" })).toBe("SENT");
    expect(sendLine(recorded).text).toMatch(/^Recorded only /);
    expect(sendSentence(recorded)).toMatch(/No email was sent/);
    expect(NEXT_STEP.RECORDED).toMatch(/no email was sent/i);
    expect(sendStateOf({ ...recorded, openedAt: "2026-10-08T09:00:00Z" })).toBe("OPENED");
    expect(summaryOfSend({ _id: "s1", channel: "email", status: "SENT", provider: "console", to: ["a@x.ae"] }).provider).toBe("console");
  });

  it("an opened link outranks 'emailed', and nothing outranks a failure", () => {
    expect(sendStateOf(null)).toBe("NOT_SENT");
    expect(sendStateOf({ status: "SENT" })).toBe("SENT");
    expect(sendStateOf({ status: "SENT", openedAt: "2026-10-07T08:00:00Z" })).toBe("OPENED");
    expect(sendStateOf({ status: "DELIVERED" })).toBe("SENT");
    expect(sendStateOf({ status: "BOUNCED" })).toBe("FAILED");
    expect(sendStateOf({ status: "FAILED", openedAt: "2026-10-07T08:00:00Z" })).toBe("FAILED");
    expect(sendStateOf({ status: "HANDED_OFF" })).toBe("HANDED_OFF");
    expect(sendStateOf({ status: "QUEUED" })).toBe("QUEUED");
    expect(sendStateOf({ status: "nonsense" })).toBe("NOT_SENT");
  });

  it("the list line is short, names the channel, and puts the reason in a tooltip", () => {
    expect(sendLine(null)).toEqual({ text: "Not sent", tone: "muted" });
    expect(sendLine({ status: "SENT", at: "2026-10-06T10:00:00Z" }).text).toMatch(/^Emailed /);
    expect(sendLine({ status: "SENT", at: "2026-10-06T10:00:00Z", openedAt: "2026-10-07T08:00:00Z" })).toMatchObject({ tone: "success" });
    expect(sendLine({ status: "SENT", at: "2026-10-06T10:00:00Z", openedAt: "2026-10-07T08:00:00Z" }).text).toMatch(/^Opened /);
    expect(sendLine({ status: "FAILED", error: "The mailbox is full" })).toEqual({ text: "Not delivered", tone: "danger", title: "The mailbox is full" });
    expect(sendLine({ status: "HANDED_OFF", at: "2026-10-06T10:00:00Z" }).text).toMatch(/^Given on WhatsApp /);
  });

  it("the sentence under the header says where it went, when, and why it failed", () => {
    expect(sendSentence(null)).toBe("");
    expect(sendSentence({ status: "SENT", to: "ali@alnoor.ae", at: "2026-10-06T10:32:00Z" })).toMatch(/^Emailed to ali@alnoor\.ae on /);
    expect(sendSentence({ status: "SENT", to: "ali@alnoor.ae", at: "2026-10-06T10:32:00Z", openedAt: "2026-10-07T08:00:00Z" })).toMatch(/Opened /);
    expect(sendSentence({ status: "FAILED", to: "ali@alnoor.ae", at: "2026-10-06T10:32:00Z", error: "The mailbox is full" })).toMatch(/did not reach ali@alnoor\.ae.*: The mailbox is full$/);
    expect(sendSentence({ status: "HANDED_OFF", channel: "whatsapp", to: "971501112222", at: "2026-10-06T10:32:00Z" })).toMatch(/Given on WhatsApp to \+971501112222.*not known here/);
  });

  it("a log row becomes the summary a document carries", () => {
    expect(summaryOfSend({ _id: "s1", channel: "email", status: "SENT", sentAt: "2026-10-06T10:00:00Z", to: ["a@x.ae", "b@x.ae"], openedAt: null, lastError: null }))
      .toEqual({ sendId: "s1", channel: "email", status: "SENT", at: "2026-10-06T10:00:00Z", to: "a@x.ae, b@x.ae", openedAt: null, error: null });
    expect(summaryOfSend({ _id: "s2", channel: "whatsapp", status: "HANDED_OFF", sentAt: "2026-10-06T10:00:00Z", phone: "971501112222", to: [] }).to).toBe("971501112222");
    expect(summaryOfSend({ _id: "s3", channel: "email", status: "FAILED", failedAt: "2026-10-06T11:00:00Z", to: ["a@x.ae"], lastError: "no" })).toMatchObject({ at: "2026-10-06T11:00:00Z", error: "no" });
  });

  it("the pill and the line render the words", () => {
    render(<><SendStatusPill send={{ status: "SENT" }} /><SentLine send={{ status: "FAILED", error: "boom" }} /></>);
    expect(screen.getByText("Emailed")).toBeInTheDocument();
    expect(screen.getByText("Not delivered")).toHaveAttribute("title", "boom");
  });
});
