import React from "react";
import { Pill } from "../accounting/kit";

// One place for how an e-invoice's state is shown, so "Rejected" looks the same on every tab.
export const STATUS = {
  NOT_SENT: { label: "Not sent", tone: "neutral" },
  QUEUED: { label: "Queued", tone: "info" },
  SUBMITTED: { label: "Sent", tone: "info" },
  ACKNOWLEDGED: { label: "Delivered", tone: "success" },
  REPORTED: { label: "Reported to FTA", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export function StatusPill({ status }) {
  const s = STATUS[status] || { label: status, tone: "neutral" };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export const DOC_TYPE = { 380: "Tax invoice", 381: "Credit note" };

// What the user can do about a state, in words.
export const NEXT_STEP = {
  NOT_SENT: "Review and send.",
  QUEUED: "Waiting to be sent.",
  SUBMITTED: "Sent. Waiting for delivery confirmation.",
  ACKNOWLEDGED: "Delivered. Waiting for the tax authority's confirmation.",
  REPORTED: "Complete.",
  FAILED: "Could not be sent. Retry once the cause is fixed.",
  REJECTED: "Rejected. Issue a credit note and a corrected invoice.",
};
