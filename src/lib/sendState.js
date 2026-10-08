// How a send is named, as plain rules with no React in them, so a list, a deal card and the document
// header can all read the same words and the rules are tested without rendering. Every label names its
// channel and never says "delivered": the email service tells us it ACCEPTED a message, not that it
// reached an inbox, and WhatsApp is opened for a person who then presses send.
import { formatDate, formatDateTime } from "../utils/format";

export const SEND_STATUS = {
  NOT_SENT: { label: "Not sent", tone: "neutral" },
  QUEUED: { label: "Sending", tone: "info" },
  SENT: { label: "Emailed", tone: "info" },
  RECORDED: { label: "Recorded only", tone: "neutral" },
  OPENED: { label: "Opened by customer", tone: "success" },
  FAILED: { label: "Not delivered", tone: "danger" },
  HANDED_OFF: { label: "Given on WhatsApp", tone: "info" },
};

// What to do about each, in a sentence a person can follow.
export const NEXT_STEP = {
  NOT_SENT: "Not sent yet. Send it to the customer.",
  QUEUED: "On its way. This takes a few seconds.",
  SENT: "Emailed. The email service accepted it; it cannot tell us when the customer reads it.",
  RECORDED: "Recorded, but no email was sent: no email service is connected (Settings, Sending).",
  OPENED: "The customer opened the document from the link.",
  FAILED: "It did not go out. Check the address, then send it again.",
  HANDED_OFF: "WhatsApp was opened with the message ready. Whether it was sent is not known here.",
};

// A row of the log, or the summary a document carries, as one of the words above. OPENED outranks SENT:
// once the customer has opened the link there is nothing more to say about the email.
export const sendStateOf = (s) => {
  if (!s) return "NOT_SENT";
  if (s.status === "BOUNCED") return "FAILED";
  // "Record only" is the test mode that posts nothing: it must never be called Emailed.
  if (s.status === "SENT" || s.status === "DELIVERED") return s.openedAt ? "OPENED" : s.provider === "console" ? "RECORDED" : "SENT";
  return SEND_STATUS[s.status] ? s.status : "NOT_SENT";
};

// The short mark under a document in a list: "Emailed 6 Oct", "Opened 7 Oct", "Not delivered".
export function sendLine(send) {
  const key = sendStateOf(send);
  if (key === "NOT_SENT") return { text: "Not sent", tone: "muted" };
  if (key === "QUEUED") return { text: "Sending…", tone: "muted" };
  if (key === "OPENED") return { text: `Opened ${formatDate(send.openedAt)}`, tone: "success" };
  if (key === "FAILED") return { text: "Not delivered", tone: "danger", title: send.error || undefined };
  if (key === "HANDED_OFF") return { text: `Given on WhatsApp ${formatDate(send.at)}`, tone: "muted" };
  if (key === "RECORDED") return { text: `Recorded only ${formatDate(send.at)}`, tone: "muted", title: "No email was sent: no email service is connected" };
  return { text: `Emailed ${formatDate(send.at)}`, tone: "muted" };
}

// One sentence under the document header, naming where it went and when. Empty for a document never sent.
export function sendSentence(send) {
  const key = sendStateOf(send);
  if (key === "NOT_SENT") return "";
  const where = send.to || "the customer";
  if (key === "OPENED") return `Emailed to ${where} on ${formatDateTime(send.at)}. Opened ${formatDateTime(send.openedAt)}.`;
  if (key === "FAILED") return `This did not reach ${where} on ${formatDateTime(send.at)}${send.error ? `: ${send.error}` : "."}`;
  if (key === "RECORDED") return `Recorded for ${where} on ${formatDateTime(send.at)}. No email was sent, because no email service is connected.`;
  if (key === "HANDED_OFF") return `Given on WhatsApp to +${where} on ${formatDateTime(send.at)}. Whether it was sent is not known here.`;
  return `Emailed to ${where} on ${formatDateTime(send.at)}.`;
}

// A row of the log as the small summary a document carries (the server writes the same shape to
// `lastSend`), so a screen can show "Emailed to ..." the moment a send returns, before any reload.
export const summaryOfSend = (row) => ({
  sendId: row._id,
  channel: row.channel,
  status: row.status,
  provider: row.provider,
  at: row.sentAt || row.failedAt || row.createdAt,
  to: row.channel === "whatsapp" ? row.phone : (row.to || []).join(", "),
  openedAt: row.openedAt || null,
  error: row.lastError || null,
});
