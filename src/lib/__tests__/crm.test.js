import { describe, it, expect } from "vitest";
import * as crm from "../crm";

// The CRM's client-side rules: the words, the small derivations a screen needs, and the form validators. The server
// judges everything again; these exist so a person is told before they press, and so the wording is in one place.

describe("words", () => {
  it("names every source, kind, outcome and reason it offers", () => {
    for (const [, label] of [...crm.SOURCES, ...crm.ACTIVITY_KINDS, ...crm.OUTCOMES, ...crm.LOST_REASONS, ...crm.BANDS]) {
      expect(label).toBeTruthy();
      expect(label).not.toMatch(/_/);
    }
    expect(crm.sourceLabel("walk_in")).toBe("Walk-in");
    expect(crm.sourceLabel("nonsense")).toBe("nonsense");
    expect(crm.sourceLabel("")).toBe("Other");
    expect(crm.lostLabel("price")).toBe("Price too high");
    expect(crm.eventLabel("invoice_approved")).toBe("The invoice was approved");
    expect(crm.eventLabel(null)).toBe("Nothing - moved by hand");
  });

  it("offers only the events the server can actually notice", () => {
    // utils/crm.js EVENTS, plus the empty "moved by hand" choice. A stage promising a move nothing fires would be a lie.
    expect(crm.ADVANCE_EVENTS.map(([value]) => value)).toEqual(["", "quotation_sent", "quotation_accepted", "invoice_approved"]);
  });
});

describe("what a screen says about what is owed", () => {
  it("counts the days without pretending a missing date is today", () => {
    expect(crm.dayGap("2026-10-20", "2026-10-23")).toBe(3);
    expect(crm.dayGap("2026-10-23", "2026-10-20")).toBe(-3);
    expect(crm.dayGap(null, "2026-10-20")).toBe(null);
    expect(crm.dayGap("2026-10-20", "soon")).toBe(null);
  });

  it("says when the next action is due, in words", () => {
    const today = "2026-10-20";
    expect(crm.nextActionText({ nextActionAt: "2026-10-18" }, today)).toBe("2 days late");
    expect(crm.nextActionText({ nextActionAt: "2026-10-19" }, today)).toBe("1 day late");
    expect(crm.nextActionText({ nextActionAt: today }, today)).toBe("Due today");
    expect(crm.nextActionText({ nextActionAt: "2026-10-21" }, today)).toBe("Due tomorrow");
    expect(crm.nextActionText({ nextActionAt: "2026-10-25" }, today)).toBe("Due in 5 days");
    expect(crm.nextActionText({}, today)).toBe("Nothing planned");
  });

  it("opens the worklist on whatever is late, then on today - never on an empty tab", () => {
    expect(crm.openingTab({ overdue: 2, today: 5 })).toBe("overdue");
    expect(crm.openingTab({ overdue: 0, today: 5 })).toBe("today");
    expect(crm.openingTab({ overdue: 0, today: 0 })).toBe("week");
    expect(crm.openingTab({})).toBe("week");
  });

  it("counts the worklist by the state the server judged, and the week by the date", () => {
    const rows = [
      { dueState: "overdue", dueAt: "2026-10-18" },
      { dueState: "today", dueAt: "2026-10-20" },
      { dueState: "soon", dueAt: "2026-10-24" },
      { dueState: "later", dueAt: "2026-12-01" },
    ];
    expect(crm.dueCounts(rows, "2026-10-20")).toEqual({ overdue: 1, today: 1, week: 3, all: 4 });
  });
});

describe("the lead form", () => {
  it("needs a name and something to reach them by", () => {
    expect(crm.validateLead({})).toEqual({ name: "Who is it?", phone: "A phone number or an email address - something to reach them by" });
    expect(crm.validateLead({ name: "Hassan", phone: "0501234567" })).toEqual({});
    expect(crm.validateLead({ name: "Hassan", email: "buyer@alnoor.ae" })).toEqual({});
    expect(crm.validateLead({ name: "Hassan", email: "not-an-email" }).email).toBeTruthy();
    expect(crm.validateLead({ name: "Hassan", phone: "05", expectedValue: -1 }).expectedValue).toBeTruthy();
  });

  it("sends what was typed, trimmed, with an empty owner left out so the server assigns it", () => {
    const body = crm.leadBody({ ...crm.emptyLead(), name: "  Hassan  ", email: " BUYER@alnoor.ae ", expectedValue: "45000" });
    expect(body.name).toBe("Hassan");
    expect(body.email).toBe("BUYER@alnoor.ae");
    expect(body.expectedValue).toBe(45000);
    expect(body.ownerId).toBeUndefined();
    expect(crm.leadBody({ expectedValue: "" }).expectedValue).toBe(0);
  });
});

describe("the deal form", () => {
  it("needs a customer and a name", () => {
    expect(crm.validateDeal({})).toEqual({ title: "What is the deal for?", customerId: "Which customer?" });
    expect(crm.validateDeal({ title: "Rice", customerId: "c1" })).toEqual({});
    expect(crm.validateDeal({ title: "Rice", customerId: "c1", value: -5 }).value).toBeTruthy();
  });

  it("leaves an empty close date out rather than sending an empty string", () => {
    expect(crm.dealBody({ title: "Rice", customerId: "c1" }).expectedCloseDate).toBeUndefined();
    expect(crm.dealBody({ title: "Rice", customerId: "c1", expectedCloseDate: "2026-11-01" }).expectedCloseDate).toBe("2026-11-01");
  });
});

describe("logging what happened", () => {
  it("asks what came of it, and will not plan the next one in the past", () => {
    expect(crm.validateDone({ outcome: "" }).outcome).toBeTruthy();
    expect(crm.validateDone({ outcome: "spoke" })).toEqual({});
    expect(crm.validateDone({ outcome: "spoke", today: "2026-10-20", nextDueAt: "2026-10-19" }).nextDueAt).toBeTruthy();
    expect(crm.validateDone({ outcome: "spoke", today: "2026-10-20", nextDueAt: "2026-10-20" })).toEqual({});
  });

  it("sends the next follow-up only when a day was chosen", () => {
    expect(crm.doneBody({ outcome: "spoke" })).toEqual({ outcome: "spoke", notes: "", nextDueAt: undefined, nextSubject: undefined, nextKind: undefined });
    const next = crm.doneBody({ outcome: "quoted", nextDueAt: "2026-10-27", nextKind: "call", nextSubject: " Ring back " });
    expect(next).toMatchObject({ nextDueAt: "2026-10-27", nextKind: "call", nextSubject: "Ring back" });
  });

  it("validates a follow-up itself", () => {
    expect(crm.validateActivity({})).toEqual({ kind: "A call, a visit, a message?", subject: "What is it about?" });
    expect(crm.validateActivity({ kind: "call", subject: "Ring back" })).toEqual({});
  });
});

describe("the pipeline editor", () => {
  const stage = (over = {}) => ({ ...crm.stageRow(), name: "Stage", key: "stage", ...over });

  it("insists on one won stage, one lost stage, and no two stages waiting for the same thing", () => {
    const good = [stage({ key: "new", name: "New" }), stage({ key: "won", name: "Won", type: "won" }), stage({ key: "lost", name: "Lost", type: "lost" })];
    expect(crm.validateStages(good)).toEqual({});

    expect(crm.validateStages([]).stages).toBeTruthy();
    expect(crm.validateStages([stage({ type: "won" })]).stages).toBe("Exactly one stage must be the lost one");
    expect(crm.validateStages([stage({ type: "lost" })]).stages).toBe("Exactly one stage must be the won one");
    expect(crm.validateStages([stage({ key: "a" }), stage({ key: "a" }), stage({ type: "won" }), stage({ type: "lost" })])["1.key"]).toBeTruthy();

    const twice = [
      stage({ key: "a", advanceOn: "quotation_sent" }),
      stage({ key: "b", advanceOn: "quotation_sent" }),
      stage({ key: "won", type: "won" }),
      stage({ key: "lost", type: "lost" }),
    ];
    expect(crm.validateStages(twice)["1.advanceOn"]).toBe("Another stage already waits for this");

    expect(crm.validateStages([stage({ name: "" }), stage({ type: "won" }), stage({ type: "lost" })])["0.name"]).toBeTruthy();
    expect(crm.validateStages([stage({ probability: 140 }), stage({ type: "won" }), stage({ type: "lost" })])["0.probability"]).toBeTruthy();
  });

  it("makes a key from the name, so nobody has to invent one", () => {
    expect(crm.keyFor("Offer accepted")).toBe("offer-accepted");
    expect(crm.keyFor("  Quotation sent!  ")).toBe("quotation-sent");
    expect(crm.keyFor("")).toBe("");
  });

  it("numbers the stages by the order they are shown in, and nulls an empty event", () => {
    const body = crm.stagesBody([
      { name: "New", probability: "10", followUpDays: "1", staleDays: "7", advanceOn: "" },
      { name: "Quotation sent", probability: 50, advanceOn: "quotation_sent", type: "open" },
      { key: "won", name: "Won", type: "won", probability: 100 },
    ]);
    expect(body.map((s) => [s.key, s.order, s.advanceOn])).toEqual([
      ["new", 1, null],
      ["quotation-sent", 2, "quotation_sent"],
      ["won", 3, null],
    ]);
    expect(body[0].probability).toBe(10);
    expect(body[0].followUpDays).toBe(1);
  });
});

describe("the automation settings", () => {
  it("asks who, when one person is to get everything", () => {
    const base = { autoAdvance: true, autoFollowUp: true, assignmentMode: "round_robin", uncontactedHours: 24, staleDays: 14 };
    expect(crm.validateSettings(base)).toEqual({});
    expect(crm.validateSettings({ ...base, assignmentMode: "fixed" }).fixedOwnerId).toBeTruthy();
    expect(crm.validateSettings({ ...base, assignmentMode: "fixed", fixedOwnerId: "u1" })).toEqual({});
    expect(crm.validateSettings({ ...base, uncontactedHours: 0 }).uncontactedHours).toBeTruthy();
    expect(crm.validateSettings({ ...base, staleDays: 999 }).staleDays).toBeTruthy();
  });

  it("drops a fixed owner when the mode is not fixed, and keeps nought days as a real answer", () => {
    expect(crm.settingsBody({ assignmentMode: "round_robin", fixedOwnerId: "u1" }).fixedOwnerId).toBe(null);
    expect(crm.settingsBody({ assignmentMode: "fixed", fixedOwnerId: "u1" }).fixedOwnerId).toBe("u1");
    expect(crm.settingsBody({ quotationExpiryDays: 0 }).quotationExpiryDays).toBe(0);
    expect(crm.settingsBody({}).quotationExpiryDays).toBe(3);
    expect(crm.settingsBody({ autoAdvance: false }).autoAdvance).toBe(false);
  });
});

describe("exports", () => {
  it("hands downloadCSV the headers and the rows it takes", () => {
    const { headers, rows } = crm.leadsCsv([{ leadNo: "LD-2026-0001", name: "Hassan", source: "referral", status: "NEW", expectedValue: 45000, score: 47 }]);
    expect(headers[0]).toBe("Lead no.");
    expect(rows[0][0]).toBe("LD-2026-0001");
    expect(rows[0][5]).toBe("Referral");
    expect(rows[0][6]).toBe("New");

    const funnel = crm.pipelineCsv([{ name: "Quotation sent", probability: 50, count: 2, value: 10000, weighted: 5000 }]);
    expect(funnel.rows[0]).toEqual(["Quotation sent", "50%", 2, 10000, 5000]);
  });
});
