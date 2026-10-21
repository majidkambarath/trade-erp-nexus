import { describe, it, expect } from "vitest";
import {
  DEFAULT_MINUTES, MAX_MINUTES, MIN_MINUTES, byTime, clashText, clashesAmong, emptyMeeting, endTimeOf, inviteState,
  meetingBody, meetingLabel, meetingToForm, nextQuarterHour, rescheduleBody, timeChoices, validateMeeting, whereText,
} from "../meetings";

const form = (over = {}) => ({ subject: "Price review", day: "2026-11-03", time: "14:30", minutes: 30, where: "online", joinUrl: "", location: "", note: "", attendees: [{ kind: "contact", id: "c1" }], notify: true, ...over });
const REGARDING = { kind: "lead", id: "l1" };

describe("the form's own rules", () => {
  it("passes a good meeting and names each missing piece", () => {
    expect(validateMeeting(form())).toEqual({});
    expect(validateMeeting(form({ subject: "  " })).subject).toMatch(/what the meeting is about/i);
    expect(validateMeeting(form({ day: "" })).day).toMatch(/choose the day/i);
    expect(validateMeeting(form({ time: "2:30" })).time).toMatch(/14:30/);
    expect(validateMeeting(form({ attendees: [] })).attendees).toMatch(/at least one/i);
  });

  it("holds the same bounds the server does, so a person is never refused twice", () => {
    expect(validateMeeting(form({ minutes: MIN_MINUTES - 1 })).minutes).toBeTruthy();
    expect(validateMeeting(form({ minutes: MIN_MINUTES }))).toEqual({});
    expect(validateMeeting(form({ minutes: MAX_MINUTES }))).toEqual({});
    expect(validateMeeting(form({ minutes: MAX_MINUTES + 1 })).minutes).toBeTruthy();
  });

  it("accepts only a web link, and an empty one", () => {
    expect(validateMeeting(form({ joinUrl: "https://meet.example.com/abc" }))).toEqual({});
    expect(validateMeeting(form({ joinUrl: "" }))).toEqual({});
    for (const bad of ["javascript:alert(1)", "meet.example.com", "data:text/html,x"]) {
      expect(validateMeeting(form({ joinUrl: bad })).joinUrl, bad).toBeTruthy();
    }
  });

  it("judges only what a reschedule sends", () => {
    expect(validateMeeting({ time: "09:00" }, { partial: true })).toEqual({});
    expect(validateMeeting({ time: "nope" }, { partial: true }).time).toBeTruthy();
  });
});

describe("what the form sends", () => {
  it("is the fields the server takes, trimmed", () => {
    const body = meetingBody(form({ subject: "  Price review  ", note: " bring the list " }), REGARDING);
    expect(body).toMatchObject({ subject: "Price review", day: "2026-11-03", time: "14:30", minutes: 30, where: "online", note: "bring the list", notify: true });
    expect(body.regarding).toEqual(REGARDING);
    expect(body.attendees).toEqual([{ kind: "contact", id: "c1" }]);
  });

  it("drops the link for a meeting in a room, and the room for one online", () => {
    expect(meetingBody(form({ where: "in_person", location: "Deira office", joinUrl: "https://x.test/a" }), REGARDING)).toMatchObject({ joinUrl: "", location: "Deira office" });
    expect(meetingBody(form({ where: "online", location: "Deira office", joinUrl: "https://x.test/a" }), REGARDING)).toMatchObject({ joinUrl: "https://x.test/a", location: "" });
  });

  it("only turns the invitation off when the tick was cleared", () => {
    expect(meetingBody(form({ notify: false }), REGARDING).notify).toBe(false);
    expect(meetingBody(form({ notify: undefined }), REGARDING).notify).toBe(true);
  });
});

describe("moving a meeting sends only what changed", () => {
  const saved = {
    subject: "Price review",
    meeting: { startAt: "2026-11-03T10:30:00.000Z", time: "14:30", minutes: 30, where: "online", joinUrl: "https://x.test/a", location: "", attendees: [{ kind: "contact", id: "c1" }] },
  };

  it("sends the new time and nothing else", () => {
    const next = { ...meetingToForm(saved), time: "09:00" };
    expect(rescheduleBody(next, saved)).toEqual({ notify: true, time: "09:00" });
  });

  it("sends nothing but the tick when nothing moved", () => {
    expect(rescheduleBody(meetingToForm(saved), saved)).toEqual({ notify: true });
  });

  it("notices a changed length, place and guest list", () => {
    const next = { ...meetingToForm(saved), minutes: 60, where: "in_person", location: "Deira office", attendees: [{ kind: "contact", id: "c1" }, { kind: "user", id: "u2" }] };
    const body = rescheduleBody(next, saved);
    expect(body.minutes).toBe(60);
    expect(body.where).toBe("in_person");
    expect(body.attendees).toHaveLength(2);
  });

  it("does not call the same guest list a change, whatever order it is in", () => {
    const next = { ...meetingToForm(saved), attendees: [{ kind: "contact", id: "c1" }] };
    expect(rescheduleBody(next, saved).attendees).toBeUndefined();
  });

  it("fills the form from what was saved", () => {
    expect(meetingToForm(saved)).toMatchObject({ subject: "Price review", day: "2026-11-03", time: "14:30", minutes: 30, where: "online" });
  });
});

describe("times", () => {
  it("offers every quarter hour of the day", () => {
    const all = timeChoices();
    expect(all).toHaveLength(96);
    expect(all[0]).toBe("00:00");
    expect(all[58]).toBe("14:30");
    expect(all.at(-1)).toBe("23:45");
  });

  it("starts a new meeting at the next quarter hour", () => {
    expect(nextQuarterHour(new Date("2026-11-03T09:02:00"))).toBe("09:15");
    expect(nextQuarterHour(new Date("2026-11-03T09:15:00"))).toBe("09:30");
    expect(nextQuarterHour(new Date("2026-11-03T09:46:00"))).toBe("10:00");
  });

  it("works out when a meeting ends, and never wraps past midnight", () => {
    expect(endTimeOf("14:30", 30)).toBe("15:00");
    expect(endTimeOf("14:30", 90)).toBe("16:00");
    expect(endTimeOf("23:30", 60)).toBe("23:59", "a meeting does not run into tomorrow");
    expect(endTimeOf("nope", 30)).toBe("");
  });

  it("gives a new meeting today's date and a sensible length", () => {
    const fresh = emptyMeeting("2026-11-03", new Date("2026-11-03T09:02:00"));
    expect(fresh).toMatchObject({ day: "2026-11-03", time: "09:15", minutes: DEFAULT_MINUTES, where: "online", notify: true });
  });
});

describe("a clash, which only warns", () => {
  const row = (id, time, end, over = {}) => ({ _id: id, subject: `Meeting ${id}`, meeting: { time, timeRange: `${time} - ${end}`, ...over } });

  it("finds an overlap and ignores a touching end", () => {
    const rows = [row("a", "10:00", "11:00"), row("b", "11:00", "11:30"), row("c", "09:30", "10:00")];
    // 10:30-11:00 overlaps a (10:00-11:00); it ENDS as b begins and BEGINS as c ends, and neither of those is a clash
    expect(clashesAmong({ time: "10:30", minutes: 30 }, rows).map((c) => c.id)).toEqual(["a"]);
    // 10:30-11:30 runs into b as well, which is a real overlap
    expect(clashesAmong({ time: "10:30", minutes: 60 }, rows).map((c) => c.id)).toEqual(["a", "b"]);
    expect(clashesAmong({ time: "11:00", minutes: 30 }, rows).map((c) => c.id)).toEqual(["b"]);
    expect(clashesAmong({ time: "08:00", minutes: 30 }, rows)).toEqual([]);
  });

  it("never clashes with itself, nor with one called off", () => {
    const rows = [row("a", "10:00", "11:00"), row("b", "10:15", "10:45", { cancelled: true })];
    expect(clashesAmong({ time: "10:00", minutes: 60, id: "a" }, rows)).toEqual([]);
    expect(clashesAmong({ time: "10:20", minutes: 10 }, rows).map((c) => c.id)).toEqual(["a"]);
  });

  it("copes with nothing to compare", () => {
    expect(clashesAmong({ time: "", minutes: 30 }, [row("a", "10:00", "11:00")])).toEqual([]);
    expect(clashesAmong({ time: "10:00", minutes: 30 }, null)).toEqual([]);
  });

  it("says it in words", () => {
    expect(clashText([])).toBe("");
    expect(clashText([{ subject: "Morning one" }])).toBe('This overlaps "Morning one".');
    expect(clashText([{ subject: "a" }, { subject: "b" }])).toBe("This overlaps 2 other meetings.");
  });
});

describe("what a screen says", () => {
  const meeting = (over = {}) => ({ subject: "Price review", meeting: { time: "14:30", timeRange: "14:30 - 15:00", where: "online", joinUrl: "https://meet.example.com/abc-defg", ...over } });

  it("leads a row with the time", () => {
    expect(meetingLabel(meeting())).toBe("14:30 Price review");
    expect(meetingLabel({ subject: "A call" })).toBe("A call", "a follow-up has no time and is not given one");
  });

  it("says where it is, without making a link look like a place", () => {
    expect(whereText(meeting())).toBe("Online, meet.example.com");
    expect(whereText(meeting({ joinUrl: "" }))).toBe("Online, no link yet");
    expect(whereText(meeting({ where: "in_person", location: "Deira office" }))).toBe("Deira office");
    expect(whereText(meeting({ where: "in_person", location: "" }))).toBe("In person");
    expect(whereText(meeting({ where: "phone" }))).toBe("By phone");
    expect(whereText(meeting({ joinUrl: "not a url" }))).toBe("Online");
  });

  it("never claims an invitation went out when it did not", () => {
    expect(inviteState(meeting()).label).toBe("Not sent");
    expect(inviteState(meeting({ invite: { sentAt: "2026-10-21T10:00:00Z", provider: "resend", count: 1 } }))).toMatchObject({ label: "Invitation sent", tone: "success" });
    // the setup that records and posts nothing: a demo must not read "sent"
    expect(inviteState(meeting({ invite: { sentAt: "2026-10-21T10:00:00Z", provider: "console", count: 1 } }))).toMatchObject({ label: "Recorded only", tone: "warning" });
    expect(inviteState(meeting({ invite: { sentAt: null, lastError: "The mailbox is full" } }))).toMatchObject({ label: "Not sent", tone: "danger", detail: "The mailbox is full" });
    expect(inviteState(meeting({ invite: { sentAt: "2026-10-21T10:00:00Z", provider: "smtp", count: 3 } })).detail).toBe("Sent 3 times");
  });

  it("puts a day's meetings in time order, with everything else after them", () => {
    const day = [{ subject: "A follow-up" }, meeting({ time: "15:00" }), meeting({ time: "09:00" }), { subject: "Another follow-up" }];
    expect(day.slice().sort(byTime).map((x) => x.meeting?.time || x.subject)).toEqual(["09:00", "15:00", "A follow-up", "Another follow-up"]);
  });

  it("sorts a CALENDAR entry too, which carries its time at the top rather than under `meeting`", () => {
    // The two shapes are real: calendarItems flattens an entry, the activity API nests it. Reading one sorted nothing.
    const entries = [
      { id: "x", title: "A follow-up" },
      { id: "b", title: "Later meeting", time: "15:00" },
      { id: "a", title: "Earlier meeting", time: "09:00" },
    ];
    expect(entries.slice().sort(byTime).map((e) => e.id)).toEqual(["a", "b", "x"]);
  });
});
