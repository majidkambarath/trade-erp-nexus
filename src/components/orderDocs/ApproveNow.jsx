import React from "react";

// The one choice in an invoice dialog: approve it now (one click, the default) or leave it as a draft to look at first.
// Approving is what posts stock and the books, so the sentence says so.
export default function ApproveNow({ value, onChange, noun = "invoice" }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium text-foreground">Approve the {noun} now</span>
        <span className="block text-muted-foreground">
          {value
            ? "It is approved as soon as it is made: stock and the books are updated in this one step."
            : "It is made as a draft. Nothing is posted until you approve it."}
        </span>
      </span>
    </label>
  );
}
