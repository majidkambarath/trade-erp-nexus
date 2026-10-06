// One source of truth for status colour. Every page that shows a document status or a
// priority uses these, so "Pending" looks the same on every screen and can never be
// confused with the brand accent.
//
// Colour is never the only signal: badges always show their text label, because the
// gold brand accent and the warning amber are far apart in hue but close in lightness.

const TONE_CLASSES = {
  neutral: "bg-secondary text-muted-foreground border-border",
  info: "bg-status-info-soft text-status-info border-status-info/25",
  warning: "bg-status-warning-soft text-status-warning border-status-warning/25",
  success: "bg-status-success-soft text-status-success border-status-success/25",
  danger: "bg-status-danger-soft text-status-danger border-status-danger/25",
};

const STATUS_TONES = {
  DRAFT: "neutral",
  CANCELLED: "neutral",
  PENDING: "warning",
  PARTIAL: "warning",
  UNPAID: "warning",
  CONFIRMED: "info",
  INVOICED: "info",
  FINALIZED: "info",
  APPROVED: "success",
  PAID: "success",
  SUBMITTED: "success",
  SETTLED: "success",
  COMPLETED: "success",
  REJECTED: "danger",
  OVERDUE: "danger",
  // Quotations: out with the customer (sent), won (accepted), lapsed (expired), handed on (converted).
  SENT: "info",
  ACCEPTED: "success",
  EXPIRED: "warning",
  CONVERTED: "info",
  SUPERSEDED: "neutral",
  // Delivery notes: on the road, signed for.
  DISPATCHED: "info",
  DELIVERED: "success",
};

// "Partially Paid", "partial-paid", "PARTIAL" all normalise the same way.
const normalise = (status) =>
  String(status ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

export const statusTone = (status) => STATUS_TONES[normalise(status)] ?? "neutral";

/** Background, text and border classes for a status badge. */
export const statusClasses = (status) => TONE_CLASSES[statusTone(status)];

const PRIORITY_DOTS = {
  High: "bg-status-danger",
  Medium: "bg-status-warning",
  Low: "bg-muted-foreground",
};

/** Fill class for a priority indicator dot. */
export const priorityDotClass = (priority) => PRIORITY_DOTS[priority] ?? "bg-muted-foreground";

const TOAST_EDGE = {
  success: "border-s-status-success",
  error: "border-s-status-danger",
  danger: "border-s-status-danger",
  warning: "border-s-status-warning",
  info: "border-s-status-info",
};

/**
 * Toast surface: a card with a coloured edge instead of a solid bright fill, so a toast
 * reads as part of the product rather than a colour block. The message text always
 * carries the meaning; the edge colour only reinforces it.
 */
export const toastClasses = (type) =>
  `rounded-xl border border-border border-s-4 bg-card p-4 text-foreground shadow-elevated animate-toast-in ${
    TOAST_EDGE[type] ?? "border-s-muted-foreground"
  }`;
