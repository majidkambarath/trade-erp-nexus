import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { approvalQueue, APPROVALS_CHANGED } from "../../lib/approvalsApi";
import { holdsAnyApprove } from "../../lib/approvalQueue";
import { cn } from "../../lib/utils";
import { useOrganisation } from "./OrganisationContext";

// Small counts beside a navigation entry. A tab in config/navigation.js that names a `badge` (today: "approvals") shows its
// number in the header tabs, the More sheet, the rail and the bottom bar.
//
// The approvals number is asked of the server only by a person who holds an approve permission, with the cheap
// `?countOnly=1` form, again every couple of minutes, when the tab comes back to the front, when the person changes branch,
// and the moment anything is decided (lib/approvalsApi.js `announceApprovalsChanged`). A failure shows nothing rather than a
// wrong number. Outside the provider every count is 0, so a screen rendered on its own shows no badge.
const Context = createContext({});

const REFRESH_MS = 2 * 60 * 1000;

export function NavBadgesProvider({ children }) {
  const { me, branchKey } = useOrganisation();
  const entitled = holdsAnyApprove(me);
  const [approvals, setApprovals] = useState(0);

  useEffect(() => {
    if (!entitled) {
      setApprovals(0);
      return undefined;
    }
    let alive = true;
    const load = () => {
      Promise.resolve()
        .then(() => approvalQueue.count())
        .then((answer) => alive && setApprovals(Number(answer?.count) || 0))
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    window.addEventListener(APPROVALS_CHANGED, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(APPROVALS_CHANGED, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [entitled, branchKey]);

  const value = useMemo(() => ({ approvals }), [approvals]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The count behind a badge key, 0 when there is none. */
export const useNavBadge = (key) => useContext(Context)[key] || 0;

/** The badge keys a module's tabs name. */
export const badgeKeysOf = (module) => (module?.tabs || []).map((t) => t.badge).filter(Boolean);

/** The total waiting behind a module's tabs: what the rail and the bottom bar show for the module. */
export function useModuleBadge(module) {
  const counts = useContext(Context);
  return badgeKeysOf(module).reduce((total, key) => total + (counts[key] || 0), 0);
}

const text = (n) => (n > 99 ? "99+" : String(n));

/** The number as a small pill; nothing at 0. `label` is what a screen reader hears after the entry's name. */
export function CountPill({ count, label = "waiting", className }) {
  if (!count) return null;
  return (
    <span className={cn("inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground", className)}>
      <span aria-hidden="true">{text(count)}</span>
      <span className="sr-only">{`, ${count} ${label}`}</span>
    </span>
  );
}

/** The pill for one tab, by the badge key the tab names. */
export function TabBadge({ tab, className }) {
  const count = useNavBadge(tab?.badge);
  return <CountPill count={count} className={className} />;
}
