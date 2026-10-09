import React from "react";
import { CalendarX2, LogOut, RefreshCw } from "lucide-react";
import { blockedPageText } from "../../lib/subscriptionText";
import { PRODUCT_NAME } from "../../config/product";

// Shown instead of the whole app when the organisation's subscription has ended, or it has been suspended or
// closed. One page that says why, since when and who to ask; the person can look again (after a renewal) or sign out.
export default function OrganisationBlocked({ blocked, onCheckAgain, onSignOut }) {
  const { title, lead } = blockedPageText(blocked);
  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <main className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-status-danger-soft text-status-danger">
          <CalendarX2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        {blocked?.organisation && <p className="mt-1 text-sm text-muted-foreground">{blocked.organisation}</p>}
        <p className="mt-4 text-sm text-foreground">{lead}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your records are safe and nothing has been deleted.{" "}
          {blocked?.contact ? (
            <>
              To restore access, contact <span className="font-medium text-foreground">{blocked.contact}</span>.
            </>
          ) : (
            "To restore access, contact your account manager."
          )}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {onCheckAgain && (
            <button
              type="button"
              onClick={onCheckAgain}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent md:h-10"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Check again
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground md:h-10"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">{PRODUCT_NAME}</p>
      </main>
    </div>
  );
}
