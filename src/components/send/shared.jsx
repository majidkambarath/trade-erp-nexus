// The send words as components. The rules are in lib/sendState.js; this file only draws them.
import React from "react";
import { Pill } from "../accounting/kit";
import { SEND_STATUS, sendLine, sendStateOf } from "../../lib/sendState";

// Re-exported so a screen can take everything about a send from one place.
export { NEXT_STEP, SEND_STATUS, sendLine, sendSentence, sendStateOf, summaryOfSend } from "../../lib/sendState";

export function SendStatusPill({ send, className }) {
  const key = sendStateOf(send);
  const s = SEND_STATUS[key];
  return <Pill tone={s.tone} className={className}>{s.label}</Pill>;
}

const LINE_CLASS = { muted: "text-muted-foreground", success: "text-status-success", danger: "text-status-danger" };

export function SentLine({ send, className = "" }) {
  const line = sendLine(send);
  return <span title={line.title} className={`text-xs font-medium ${LINE_CLASS[line.tone]} ${className}`}>{line.text}</span>;
}

