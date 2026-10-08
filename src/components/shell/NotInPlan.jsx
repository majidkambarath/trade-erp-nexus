import React from "react";
import { Lock } from "lucide-react";
import { featureLabel } from "../../lib/organisation";

// Shown in the workspace in place of a screen the organisation's plan does not include (reached by a typed address
// or an old bookmark; the navigation does not offer it).
export default function NotInPlan({ feature }) {
  const name = featureLabel(feature);
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="text-lg font-semibold">{name} is not included in your plan</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This part of the product is switched off for your organisation. Ask your account manager if you would like it added.
      </p>
    </div>
  );
}
