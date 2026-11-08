import React from "react";
import { Button } from "../ui/button";
import Can from "../shell/Can.jsx";
import RowMenu from "../lists/RowMenu";
import { jobOverflowActions, jobPrimaryAction } from "../../lib/garage";

// One loud button for the card's current status, plus everything else behind a "More actions" menu - the
// nine-button row (GarageBoard's own QA screenshot: five lines on a phone) replaced with the hierarchy
// `jobPrimaryAction`/`jobOverflowActions` (lib/garage.js) compute from the same `card.actions` flags the
// old footer read. Every button keeps its own `<Can permission>` gate exactly as before - this only
// decides WHERE each is drawn, never who may press it.
export default function JobCardActions({ card, onAction }) {
  const primary = jobPrimaryAction(card);
  const overflow = jobOverflowActions(card);
  if (!primary && overflow.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {primary && (
        <Can permission={primary.permission}>
          <Button className="flex-1 lg:flex-none" onClick={() => onAction(primary.key)}>{primary.label}</Button>
        </Can>
      )}
      {overflow.length > 0 && (
        <RowMenu label="More actions" menuClassName="w-56 rounded-2xl border border-border bg-card py-1 shadow-lg">
          {overflow.map((a) => (
            <Can key={a.key} permission={a.permission}>
              <button
                type="button"
                onClick={() => onAction(a.key)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-secondary ${a.danger ? "text-destructive" : "text-muted-foreground"}`}
              >
                {a.label}
              </button>
            </Can>
          ))}
        </RowMenu>
      )}
    </div>
  );
}
