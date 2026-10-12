import React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

// Where an order stands, as one line: Confirmed -> Delivered / Received -> Invoiced -> Approved -> Paid, and the one thing to do
// next in words. The steps come from lib/invoiceFlow.js (orderSteps) built from what the server sent, so this holds no rules.
export default function OrderProgress({ model }) {
  if (!model || model.cancelled || !model.steps.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 print:hidden">
      <ol aria-label="Order progress" className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {model.steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2" aria-current={s.state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                s.state === "done" && "border-status-success/40 bg-status-success/10 text-status-success",
                s.state === "current" && "border-ring bg-secondary text-foreground",
                s.state === "todo" && "border-border text-muted-foreground",
                s.part && s.state !== "done" && "border-status-warning/50 text-foreground"
              )}
            >
              {s.state === "done" && <Check className="h-3 w-3" aria-hidden="true" />}
              <span>{s.label}</span>
              <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "current" ? " (now)" : " (not yet)"}</span>
            </span>
            {i < model.steps.length - 1 && <span aria-hidden="true" className="text-muted-foreground">›</span>}
          </li>
        ))}
      </ol>
      {model.next && (
        <p className="mt-2 text-sm text-muted-foreground">
          Next: <span className="font-medium text-foreground">{model.next.text}</span>
        </p>
      )}
    </div>
  );
}
