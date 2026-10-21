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

describe("people", () => {
  it("asks for a name and nothing else", () => {
    expect(crm.validateContact({})).toHaveProperty("name");
    expect(crm.validateContact({ name: "Rajesh" })).toEqual({});
    expect(crm.validateContact({ name: "Rajesh", email: "nope" })).toHaveProperty("email");
    expect(crm.validateContact({ name: "Rajesh", email: "r@x.ae" })).toEqual({});
  });

  it("sends the one party that was chosen, and clears both when nobody was", () => {
    const linked = crm.contactBody({ ...crm.emptyContact(), name: "Rajesh", partyKind: "customer", partyId: "c1" });
    expect(linked.customerId).toBe("c1");
    expect(linked.vendorId).toBeUndefined();

    const supplier = crm.contactBody({ ...crm.emptyContact(), name: "Imran", partyKind: "vendor", partyId: "v1" });
    expect(supplier.vendorId).toBe("v1");
    expect(supplier.customerId).toBeUndefined();

    // Nobody: both are cleared, which is how a person is taken off a company.
    const loose = crm.contactBody({ ...crm.emptyContact(), name: "Omar" });
    expect(loose.customerId).toBeNull();
    expect(loose.vendorId).toBeNull();
  });

  it("exports what is on the screen, with the company spelt out", () => {
    const csv = crm.contactsCsv([
      { name: "Rajesh", designation: "Buyer", partyKind: "customer", partyName: "Al Noor", phone: "050", email: "r@x.ae", isPrimary: true },
      { name: "Omar", partyKind: null },
    ]);
    expect(csv.headers[0]).toBe("Name");
    expect(csv.rows[0]).toContain("Customer");
    expect(csv.rows[0]).toContain("Yes");
    expect(csv.rows[1]).toContain("Nobody yet");
  });

  it("the communications log exports the outcome in words", () => {
    const csv = crm.communicationsCsv([{ kind: "call", subject: "Rang", status: "DONE", outcome: "interested", regarding: { kind: "opportunity" } }]);
    expect(csv.rows[0]).toContain("Call");
    expect(csv.rows[0]).toContain(crm.outcomeLabel("interested"));
  });
});

describe("days, the task board and the calendar", () => {
  it("shifts a day on the string itself, across month and year ends", () => {
    expect(crm.shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(crm.shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(crm.shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(crm.daysBetween("2026-10-20", "2026-10-27")).toBe(7);
    expect(crm.daysBetween("2026-10-20", "2026-10-15")).toBe(-5);
  });

  it("sorts a task into the column it belongs to", () => {
    const at = (d) => crm.taskBucket({ dueAt: d }, "2026-10-20");
    expect([at("2026-10-01"), at("2026-10-19"), at("2026-10-20"), at("2026-10-21"), at("2026-10-22"), at("2026-10-27"), at("2026-10-28")]).toEqual([
      "late", "late", "today", "tomorrow", "week", "week", "later",
    ]);
  });

  it("a drop sets one named day, and Late takes no drops", () => {
    expect(crm.bucketTarget("late", "2026-10-20")).toBeNull();
    expect(crm.bucketTarget("today", "2026-10-20")).toBe("2026-10-20");
    expect(crm.bucketTarget("tomorrow", "2026-10-20")).toBe("2026-10-21");
    expect(crm.bucketTarget("week", "2026-10-20")).toBe("2026-10-27");
    // The day a drop SETS must land back in the column it was dropped on, or a card would jump column on arrival.
    for (const b of ["today", "tomorrow", "week", "later"]) {
      expect(crm.taskBucket({ dueAt: crm.bucketTarget(b, "2026-10-20") }, "2026-10-20")).toBe(b);
    }
  });

  it("groups every task, keeps every column even when empty, and orders by day", () => {
    const rows = [{ id: "a", dueAt: "2026-10-22" }, { id: "b", dueAt: "2026-10-21" }, { id: "c", dueAt: "2026-10-01" }];
    const out = crm.groupTasks(rows, "2026-10-20");
    expect(Object.keys(out)).toEqual(["late", "today", "tomorrow", "week", "later"]);
    expect(out.late.map((r) => r.id)).toEqual(["c"]);
    expect(out.today).toEqual([]);
    expect(out.tomorrow.map((r) => r.id)).toEqual(["b"]);
  });

  it("groups by person, with 'nobody' for what has no owner or an owner who has gone", () => {
    const out = crm.groupByPerson([{ id: "a", ownerId: "u1" }, { id: "b", ownerId: null }, { id: "c", ownerId: "gone" }], [{ id: "u1" }, { id: "u2" }]);
    expect(out.u1.map((r) => r.id)).toEqual(["a"]);
    expect(out.u2).toEqual([]);
    expect(out.__nobody__.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("draws a month as clean weeks of seven, with the neighbouring months' days filling the corners", () => {
    const weeks = crm.monthWeeks("2026-10");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].day).toBe("2026-09-28");
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][3]).toEqual({ day: "2026-10-01", inMonth: true });
    expect(crm.monthRange("2026-10")).toEqual({ from: "2026-09-28", to: "2026-11-01" });
    // A Sunday-first week starts a day earlier.
    expect(crm.monthWeeks("2026-10", 0)[0][0].day).toBe("2026-09-27");
    expect(crm.WEEKDAYS(1)[0]).toBe("Mon");
    expect(crm.WEEKDAYS(0)[0]).toBe("Sun");
  });

  it("a month whose first day is the week's first day needs no leading days", () => {
    // 1 June 2026 is a Monday.
    expect(crm.monthWeeks("2026-06")[0][0]).toEqual({ day: "2026-06-01", inMonth: true });
  });

  it("steps months across a year end", () => {
    expect(crm.shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(crm.shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(crm.monthKeyOf("2026-10-20")).toBe("2026-10");
  });

  it("colours stages in a fixed order, never cycled, and won / lost are status", () => {
    const hues = crm.stageHues([
      { key: "new", type: "open" }, { key: "q", type: "open" }, { key: "won", type: "won" }, { key: "lost", type: "lost" },
    ]);
    expect(hues.new).toBe(crm.CHART_HUES[0]);
    expect(hues.q).toBe(crm.CHART_HUES[1]);
    expect(hues.won).toBe("var(--status-success)");
    expect(hues.lost).toBe("var(--status-danger)");
    // Past five stages they share the last hue rather than inventing one nobody validated.
    expect(crm.hueFor(99)).toBe(crm.CHART_HUES[4]);
  });
});

describe("filling a period", () => {
  it("gives every day its count and the quiet ones nothing, so a quiet day is a bar and not a gap", () => {
    const out = crm.fillDays([{ day: "2026-10-02", count: 3 }], "2026-10-01", "2026-10-04");
    expect(out).toEqual([
      { day: "2026-10-01", count: 0 }, { day: "2026-10-02", count: 3 }, { day: "2026-10-03", count: 0 }, { day: "2026-10-04", count: 0 },
    ]);
  });
  it("is empty for a missing or backwards range rather than looping", () => {
    expect(crm.fillDays([], "2026-10-05", "2026-10-01")).toEqual([]);
    expect(crm.fillDays([], null, "2026-10-01")).toEqual([]);
  });
  it("has one age colour for every age band the server draws", () => {
    expect(crm.AGE_HUES).toHaveLength(5);
  });
});

describe("the setup screen's rules", () => {
  it("moves an item and hands back the same list when there is nothing to do", () => {
    const list = ["a", "b", "c", "d"];
    expect(crm.moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(crm.moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(list).toEqual(["a", "b", "c", "d"]); // never edited in place
    expect(crm.moveItem(list, 1, 1)).toBe(list);
    expect(crm.moveItem(list, 0, 9)).toBe(list);
    expect(crm.moveItem(list, -1, 2)).toBe(list);
  });

  it("says what a stage's timing means - zero days is the same day, not never", () => {
    const open = { type: "open", followUpDays: 3, staleDays: 14 };
    expect(crm.stageSummary(open)).toBe("Follow-up in 3 days · quiet after 14 days");
    expect(crm.stageSummary({ ...open, followUpDays: 1, staleDays: 1 })).toBe("Follow-up in 1 day · quiet after 1 day");
    expect(crm.stageSummary({ ...open, followUpDays: 0 })).toMatch(/^Follow-up due the same day/);
  });

  it("quiet-after zero means the organisation's usual, and says so", () => {
    const stage = { type: "open", followUpDays: 2, staleDays: 0 };
    expect(crm.stageSummary(stage)).toBe("Follow-up in 2 days · quiet after the usual time");
    expect(crm.stageSummary(stage, { defaultQuietDays: 14 })).toBe("Follow-up in 2 days · quiet after the usual 14 days");
  });

  it("a closed stage has nothing to chase, whatever its fields still hold", () => {
    expect(crm.stageSummary({ type: "won", followUpDays: 5, staleDays: 9 })).toBe("Closed as won - nothing left to chase");
    expect(crm.stageSummary({ type: "lost", followUpDays: 5 })).toBe("Closed as lost - nothing left to chase");
  });

  it("gives each row its own colour in the order shown, with won and lost as status", () => {
    const hues = crm.rowHues([{ type: "open" }, { type: "open" }, { type: "won" }, { type: "lost" }, { type: "open" }]);
    expect(hues[0]).toBe(crm.CHART_HUES[0]);
    expect(hues[1]).toBe(crm.CHART_HUES[1]);
    expect(hues[2]).toBe("var(--status-success)");
    expect(hues[3]).toBe("var(--status-danger)");
    // The third OPEN stage is the third hue, not the fifth: closed stages do not use up the chart colours.
    expect(hues[4]).toBe(crm.CHART_HUES[2]);
    // A row with no key yet (just added) still gets a colour, which is why this is by position.
    expect(crm.rowHues([{ type: "open", key: "" }])).toHaveLength(1);
  });

  it("knows a pipeline is unchanged by what the server would be sent, not by what the screen adds", () => {
    const saved = [
      { key: "new", name: "New", order: 1, probability: 10, advanceOn: null, followUpDays: 1, staleDays: 7, type: "open" },
      { key: "won", name: "Won", order: 2, probability: 100, advanceOn: "invoice_approved", followUpDays: 0, staleDays: 0, type: "won" },
    ];
    // The screen gives every row a client-side id; that must never read as an edit.
    const shown = saved.map((s, i) => ({ ...s, uid: `s${i}` }));
    expect(crm.pipelineDirty(saved, shown)).toBe(false);
    expect(crm.pipelineDirty(saved, shown.map((s) => (s.key === "new" ? { ...s, name: "Fresh" } : s)))).toBe(true);
    expect(crm.pipelineDirty(saved, [...shown].reverse())).toBe(true); // order is part of the pipeline
    expect(crm.pipelineDirty(saved, [...shown, { uid: "s9", name: "Quoted", type: "open" }])).toBe(true);
    expect(crm.pipelineDirty(saved, shown.slice(0, 1))).toBe(true);
  });

  it("knows settings are unchanged, including when a number was typed as text", () => {
    const saved = { autoAdvance: true, autoFollowUp: true, assignmentMode: "round_robin", fixedOwnerId: null, uncontactedHours: 24, staleDays: 14, quotationExpiryDays: 3, lastAssignedOwnerId: "u1" };
    expect(crm.settingsDirty(saved, { ...saved })).toBe(false);
    // A form field hands numbers back as strings; "24" is not a change from 24.
    expect(crm.settingsDirty(saved, { ...saved, uncontactedHours: "24", staleDays: "14" })).toBe(false);
    // And a bookkeeping field the person never sees is not an edit either.
    expect(crm.settingsDirty(saved, { ...saved, lastAssignedOwnerId: "u2" })).toBe(false);
    expect(crm.settingsDirty(saved, { ...saved, autoAdvance: false })).toBe(true);
    expect(crm.settingsDirty(saved, { ...saved, staleDays: "30" })).toBe(true);
  });
});
