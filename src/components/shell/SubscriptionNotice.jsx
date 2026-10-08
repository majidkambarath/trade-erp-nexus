import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "../../lib/utils";

const TONE = {
  info: "border-status-info/25 bg-status-info-soft text-status-info",
  warning: "border-status-warning/25 bg-status-warning-soft text-status-warning",
  danger: "border-status-danger/25 bg-status-danger-soft text-status-danger",
};

// One line above the work when the subscription is about to end, is in its grace period, or has ended on the
// read-only rule. Said before anything is refused, never after.
export default function SubscriptionNotice({ notice }) {
  if (!notice) return null;
  const Icon = notice.tone === "info" ? Info : AlertTriangle;
  return (
    <div role="status" className={cn("flex items-start gap-2.5 border-b px-4 py-2.5 text-sm lg:px-6", TONE[notice.tone] || TONE.info)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0">
        <span className="font-semibold">{notice.title}.</span> <span className="text-foreground">{notice.text}</span>
      </p>
    </div>
  );
}
