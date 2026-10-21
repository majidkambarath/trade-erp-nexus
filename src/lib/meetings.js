// Scheduling a meeting, the browser's half: the form's own rules and the words a screen shows. Pure, so the awkward
// parts (a time that is not a time, an end before a start, a meeting read on the wrong clock) are tests rather than
// something a person finds out when the customer does not turn up.
//
// The SERVER decides and stores the instant (utils/meetings.js on the backend, against the organisation's zone). This
// only shapes what the form sends and reads back what came, so the two cannot disagree about what 14:30 means.

export const MIN_MINUTES = 5;
export const MAX_MINUTES = 12 * 60;
export const DEFAULT_MINUTES = 30;

/** What the duration picker offers. A person may still be given any number between the two bounds by the server. */
export const DURATIONS = [
  [15, "15 minutes"],
  [30, "30 minutes"],
  [45, "45 minutes"],
  [60, "1 hour"],
  [90, "1½ hours"],
  [120, "2 hours"],
];

export const WHERE = [
  ["online", "Online"],
  ["in_person", "In person"],
  ["phone", "By phone"],
];

export const RSVP_LABEL = { invited: "Invited", accepted: "Accepted", declined: "Declined", tentative: "Maybe" };
export const RSVP_TONE = { invited: "default", accepted: "success", declined: "danger", tentative: "warning" };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const text = (v, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Times a person picks from, every quarter hour. Typing a time the list does not hold is still allowed. */
export function timeChoices(step = 15) {
  const out = [];
  for (let m = 0; m < 24 * 60; m += step) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
}

/** The next quarter hour from now, which is what a person booking "shortly" means. */
export function nextQuarterHour(now = new Date()) {
  const d = new Date(now.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const emptyMeeting = (today = "", now = new Date()) => ({
  subject: "",
  day: today,
  time: nextQuarterHour(now),
  minutes: DEFAULT_MINUTES,
  where: "online",
  joinUrl: "",
  location: "",
  note: "",
  attendees: [],
  notify: true,
  // Ask Google for a Meet link. Only offered where the person has connected their own Google account; off for
  // anybody who has not, so the form never promises a link that cannot be made.
  googleMeet: false,
});

/** A meeting read back from the server, filled into the form for a reschedule. */
export const meetingToForm = (activity) => {
  const m = activity?.meeting || {};
  return {
    subject: activity?.subject || "",
    day: (m.startAt && String(m.startAt).slice(0, 10)) || "",
    time: m.time || "",
    minutes: m.minutes || DEFAULT_MINUTES,
    where: m.where || "online",
    joinUrl: m.joinUrl || "",
    location: m.location || "",
    note: "",
    attendees: (m.attendees || []).map((a) => ({ kind: a.kind, id: a.id })),
    notify: true,
  };
};

/**
 * What the form will not send. The same refusals as the server's, in the same words, so a person is told by the form
 * rather than by a failed request - and the server still decides, because this is only a courtesy.
 */
export function validateMeeting(form = {}, { partial = false } = {}) {
  const errors = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(form, k);

  if (!partial || has("subject")) {
    if (!text(form.subject, 200)) errors.subject = "Say what the meeting is about";
  }
  if (!partial || has("day")) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(form.day, 10))) errors.day = "Choose the day";
  }
  if (!partial || has("time")) {
    if (!TIME_RE.test(text(form.time, 5))) errors.time = "Give a start time, as 14:30";
  }
  if (!partial || has("minutes")) {
    const minutes = Number(form.minutes);
    if (!Number.isFinite(minutes) || minutes < MIN_MINUTES) errors.minutes = `At least ${MIN_MINUTES} minutes`;
    else if (minutes > MAX_MINUTES) errors.minutes = "Longer than 12 hours is probably a mistake";
  }
  const link = text(form.joinUrl, 500);
  if (link && !/^https?:\/\/\S+$/i.test(link)) errors.joinUrl = "A link must start with http:// or https://";
  if (!partial || has("attendees")) {
    if (!(form.attendees || []).length) errors.attendees = "Invite at least one person";
  }
  return errors;
}

/** The body the server takes. `notify: false` books it without telling anybody, which the form offers as a tick. */
export const meetingBody = (form = {}, regarding) => ({
  subject: text(form.subject, 200),
  regarding,
  day: text(form.day, 10),
  time: text(form.time, 5),
  minutes: Number(form.minutes) || DEFAULT_MINUTES,
  where: form.where || "online",
  joinUrl: form.where === "in_person" ? "" : text(form.joinUrl, 500),
  location: form.where === "in_person" ? text(form.location, 300) : "",
  note: text(form.note, 500),
  attendees: (form.attendees || []).map((a) => ({ kind: a.kind, id: a.id })),
  notify: form.notify !== false,
  googleMeet: form.googleMeet === true,
  ownerId: form.ownerId || undefined,
});

/** Only what changed, for a reschedule: sending the whole form would re-resolve attendees nobody touched. */
export const rescheduleBody = (form = {}, original = {}) => {
  const body = { notify: form.notify !== false };
  const before = meetingToForm(original);
  for (const key of ["subject", "day", "time", "where", "joinUrl", "location"]) {
    if (text(form[key], 500) !== text(before[key], 500)) body[key] = text(form[key], 500);
  }
  if (Number(form.minutes) !== Number(before.minutes)) body.minutes = Number(form.minutes);
  const ids = (list) => (list || []).map((a) => `${a.kind}:${a.id}`).sort().join(",");
  if (ids(form.attendees) !== ids(before.attendees)) body.attendees = (form.attendees || []).map((a) => ({ kind: a.kind, id: a.id }));
  if (text(form.note, 500)) body.note = text(form.note, 500);
  return body;
};

/** "14:30 - 15:00", from what the server already worked out; it is never recomputed in the browser. */
export const timeRangeOf = (activity) => activity?.meeting?.timeRange || "";

/** The one line a chip or a row shows: the time, then what it is. */
export const meetingLabel = (activity) => {
  const time = activity?.meeting?.time;
  return time ? `${time} ${activity.subject}` : activity?.subject || "";
};

/** Where it happens, in words: the link's host for an online meeting, the address for a real one. */
export function whereText(activity) {
  const m = activity?.meeting;
  if (!m) return "";
  if (m.where === "in_person") return m.location || "In person";
  if (m.where === "phone") return "By phone";
  if (!m.joinUrl) return "Online, no link yet";
  try {
    return `Online, ${new URL(m.joinUrl).hostname.replace(/^www\./, "")}`;
  } catch {
    return "Online";
  }
}

/** What the screen says about the invitation, which must never claim more than happened. */
export function inviteState(activity) {
  const invite = activity?.meeting?.invite;
  if (!invite) return { label: "Not sent", tone: "default", detail: "" };
  if (invite.lastError) return { label: "Not sent", tone: "danger", detail: invite.lastError };
  if (!invite.sentAt) return { label: "Not sent", tone: "default", detail: "" };
  // "console" is the setup that records and posts nothing: saying "Sent" there would be a lie in a demo.
  if (invite.provider === "console") return { label: "Recorded only", tone: "warning", detail: "Email is in test mode, so nothing was sent." };
  return { label: "Invitation sent", tone: "success", detail: invite.count > 1 ? `Sent ${invite.count} times` : "" };
}

const toMinutes = (hhmm) => {
  const m = TIME_RE.exec(text(hhmm, 5));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** What the screen says after Google was asked for a link, which must never claim one that was not made. */
export function googleResult(google) {
  if (!google) return null;
  if (google.ok && google.meetLink) return { tone: "success", text: "A Google Meet link was created." };
  if (google.ok) return { tone: "warning", text: google.error || "Google made the event but no Meet link." };
  return { tone: "danger", text: google.error || "Google could not make the link. The meeting is still arranged." };
}

/** "14:30" plus 45 minutes is "15:15"; past midnight it stops at the end of the day, because a meeting does not wrap. */
export function endTimeOf(start, minutes) {
  const from = toMinutes(start);
  if (from === null) return "";
  const to = Math.min(from + (Number(minutes) || 0), 24 * 60 - 1);
  return `${String(Math.floor(to / 60)).padStart(2, "0")}:${String(to % 60).padStart(2, "0")}`;
}

/**
 * The meetings already on that day which overlap the one being booked. Touching ends do not overlap, a cancelled one
 * cannot, and the meeting being moved never clashes with itself. The SERVER decides this too, and its answer is the
 * one that counts; this is so the form can warn before the person presses the button.
 */
export function clashesAmong({ time, minutes, id = null } = {}, rows = []) {
  const from = toMinutes(time);
  const to = toMinutes(endTimeOf(time, minutes));
  if (from === null || to === null) return [];
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => {
      const m = r?.meeting;
      if (!m || m.cancelled || (id && String(r._id) === String(id))) return false;
      const s = toMinutes(m.time);
      const e = toMinutes((m.timeRange || "").split(" - ")[1]);
      return s !== null && e !== null && s < to && e > from;
    })
    .map((r) => ({ id: String(r._id), subject: r.subject }));
}

/** Two meetings that overlap, said plainly. The server decides what clashes; this only words it. */
export const clashText = (clashes = []) =>
  !clashes.length ? "" : clashes.length === 1 ? `This overlaps "${clashes[0].subject}".` : `This overlaps ${clashes.length} other meetings.`;

/**
 * Sort a day's entries so meetings come first in time order and everything else follows.
 *
 * It takes BOTH shapes on purpose: a calendar entry carries `time` at the top (utils/crm.js `calendarItems` flattens
 * it), while an activity read from the API keeps it under `meeting`. Reading only one silently sorted nothing.
 */
const timeOfEntry = (x) => x?.meeting?.time || x?.time || "";
export const byTime = (a, b) => {
  const at = timeOfEntry(a);
  const bt = timeOfEntry(b);
  if (at && bt) return at.localeCompare(bt);
  if (at) return -1;
  if (bt) return 1;
  return 0;
};
