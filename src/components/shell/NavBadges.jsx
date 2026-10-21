import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { approvalQueue, APPROVALS_CHANGED } from "../../lib/approvalsApi";
import { holdsAnyApprove } from "../../lib/approvalQueue";
import { processOrders, PROCESS_WORK_CHANGED } from "../../lib/processOrderApi";
import { notifications, NOTIFICATIONS_CHANGED } from "../../lib/notificationsApi";
import { crm, CRM_WORK_CHANGED } from "../../lib/crmApi";
import { cn } from "../../lib/utils";
import { useOrganisation } from "./OrganisationContext";

// Small counts beside a navigation entry. A tab in config/navigation.js that names a `badge` ("approvals"; "myWork", the process
// steps given to this person) shows its number in the header tabs, the More sheet, the rail and the bottom bar.
//
// The approvals number is asked of the server only by a person who holds an approve permission, with the cheap
// `?countOnly=1` form, again every couple of minutes, when the tab comes back to the front, when the person changes branch,
// and the moment anything is decided (lib/approvalsApi.js `announceApprovalsChanged`). A failure shows nothing rather than a
// wrong number. Outside the provider every count is 0, so a screen rendered on its own shows no badge.
const Context = createContext({});

const REFRESH_MS = 2 * 60 * 1000;

// One count asked of the server while `enabled`: at once, every couple of minutes, when the tab comes back to the front, when
// the person changes branch, and whenever `eventName` fires. A failure shows nothing rather than a wrong number.
function usePolledCount(enabled, load, eventName, branchKey) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return undefined;
    }
    let alive = true;
    const refresh = () => {
      Promise.resolve()
        .then(load)
        .then((answer) => alive && setCount(Number(answer?.count) || 0))
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener(eventName, refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(eventName, refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is a module-level call
  }, [enabled, eventName, branchKey]);
  return count;
}

export function NavBadgesProvider({ children }) {
  const { me, branchKey, status, can } = useOrganisation();
  const approvals = usePolledCount(holdsAnyApprove(me), () => approvalQueue.count(), APPROVALS_CHANGED, branchKey);
  // the process steps given to this person (Inventory > Production): only where Production is switched on, and an opt-in
  // feature is on only when the server says so (a status without it asks nothing)
  const myWork = usePolledCount(Boolean(status?.features?.production === true && can?.("inventory.view")), () => processOrders.myWork(), PROCESS_WORK_CHANGED, branchKey);
  // What this person owes in the CRM today (CRM > Follow-ups). Judged STRICTLY, like holdsAnyApprove: `can` is
  // permissive while the grants are still unknown (the app hides nothing until it knows), which is right for drawing a
  // screen and wrong for asking the server a question - an organisation without the CRM module would be asked once on
  // every load and refused.
  const holdsCrm = Array.isArray(me?.grants) && me.grants.includes("crm.view");
  const crmFollowUps = usePolledCount(holdsCrm, () => crm.followUpCount(), CRM_WORK_CHANGED, branchKey);
  // Everyone signed in has their own feed - a row's audience can be any permission, so there is no single
  // one to gate this on (the server filters per row instead; see notificationRoutes.js).
  const notificationsCount = usePolledCount(Boolean(me), () => notifications.unreadCount(), NOTIFICATIONS_CHANGED, branchKey);

  const value = useMemo(
    () => ({ approvals, myWork, crmFollowUps, notifications: notificationsCount }),
    [approvals, myWork, crmFollowUps, notificationsCount]
  );
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
