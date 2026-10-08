import React from "react";
import { useOrganisation } from "./OrganisationContext";

// A settings screen the person may look at but not change: the same screen, every control disabled, and one plain
// sentence saying why - instead of letting them type and meeting a refusal on Save. A courtesy: the server refuses the
// change whatever the screen allows. While the role is not known nothing is disabled.
export default function Guarded({ permission, what = "these settings", children }) {
  const { canAny } = useOrganisation();
  const allowed = canAny(permission);
  return (
    <>
      {!allowed && (
        <p role="status" className="mb-4 rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Your role can look at {what} but not change them. Ask your administrator if something needs to change.
        </p>
      )}
      <fieldset disabled={!allowed} className="m-0 min-w-0 space-y-5 border-0 p-0">
        {children}
      </fieldset>
    </>
  );
}
