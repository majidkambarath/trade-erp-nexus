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

// Wafeq's delivery leg and the tax authority's leg, in words. The sandbox never reports to the tax authority, and says so.
export const DELIVERY = {
  queued: "Queued at Wafeq", sending: "Sending", retrying: "Retrying", sent: "Delivered", received_by_ap: "Received by the buyer's provider",
  forwarded: "Forwarded", delivered_confirmed: "Delivery confirmed", rejected: "Rejected by the buyer", failed: "Buyer not reached (still reported to the tax authority)",
  attention_required: "Needs attention at Wafeq", delivered: "Delivered",
};
export const FTA = { reporting: "Being reported", reported: "Reported", rejected: "Not compliant", withdrawn: "Withdrawn", unresolved: "Unresolved", not_reported: "Not reported (Wafeq sandbox)" };
export const deliveryText = (s) => DELIVERY[s] || s || "";
export const ftaText = (s) => FTA[String(s || "").toLowerCase()] || s || "";
