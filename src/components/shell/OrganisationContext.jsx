import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BLOCKED_EVENT, BRANCH_RESET_EVENT, branchLabel, featureOn, validBranchSelection } from "../../lib/organisation";
import { getSelectedBranch, setSelectedBranch } from "../../axios/session";
import { can, canAny } from "../../lib/permissions";
import { normalisePolicy } from "../../lib/approvals";
import { getOrganisationStatus } from "../../lib/organisationApi";
import { orgCurrency, orgTimezone, setOrgLocale } from "../../utils/orgLocale";

// The signed-in organisation, loaded once for the shell: what its plan includes (so a screen the plan does not
// have is not offered), where its subscription stands (so a notice can warn before anything is refused), and
// whether it has been blocked (so one page says why, instead of every screen showing its own error).
//
// If the status cannot be loaded, nothing is hidden and nothing is blocked: the server still refuses what the
// plan does not include, and a missing status must never lock a working organisation out of its own screen.
const Context = createContext(null);

// The approval rules the organisation has set (Settings -> Business rules -> Approvals); off until it sets them.
const NO_APPROVAL_POLICY = { separateApprover: false, secondApprovalAbove: null };

const NOTHING = { status: null, me: null, policy: NO_APPROVAL_POLICY, blocked: null, loading: false, refresh: () => {}, featureOn: () => true, can: () => true, canAny: () => true, branch: null, branchKey: 0, localeKey: "", selectBranch: () => {} };
export const useOrganisation = () => useContext(Context) || NOTHING;

const REFRESH_AFTER_MS = 60 * 1000;

// What the status route says about a blocked organisation, in the shape the blocked page reads.
const blockedFromStatus = (status) => {
  const sub = status?.subscription;
  if (!sub?.blocked) return null;
  return { code: null, state: sub.state, message: sub.reason, endsAt: sub.endsAt || null, contact: status.support?.contact || null, organisation: status.organisation?.legalName || null };
};

export function OrganisationProvider({ children }) {
  const [status, setStatus] = useState(null);
  const [refused, setRefused] = useState(null); // a request was refused as blocked, before or without the status
  const [loading, setLoading] = useState(true);
  // The branch a head-office user works in. Changing it re-keys the page (so every list is fetched again).
  const [selected, setSelected] = useState(getSelectedBranch);
  const [branchKey, setBranchKey] = useState(0);
  const lastLoad = useRef(0);

  const refresh = useCallback(async () => {
    lastLoad.current = Date.now();
    try {
      const next = await getOrganisationStatus();
      setStatus(next);
      // a remembered branch that is gone, switched off, or no longer the person's to choose is dropped
      if (getSelectedBranch() && !validBranchSelection(next, getSelectedBranch())) {
        setSelectedBranch(null);
        setSelected(null);
        setBranchKey((k) => k + 1);
      }
      if (!next?.subscription?.blocked) setRefused(null);
    } catch {
      // keep whatever was known: an unreachable status is not a reason to hide or block anything
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Any request the server refuses as blocked reaches here through the axios instance.
  useEffect(() => {
    const onBlocked = (e) => setRefused(e.detail || {});
    window.addEventListener(BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(BLOCKED_EVENT, onBlocked);
  }, []);

  // The branch this tab remembered is no longer the person's to work in (the request layer has already forgotten it, because
  // every request naming it was refused - the status read too): start again from the branch they belong to.
  useEffect(() => {
    const onReset = () => {
      setSelected(null);
      setBranchKey((k) => k + 1);
      refresh();
    };
    window.addEventListener(BRANCH_RESET_EVENT, onReset);
    return () => window.removeEventListener(BRANCH_RESET_EVENT, onReset);
  }, [refresh]);

  // A tab left open overnight learns about a renewal, a grace period or a suspension when it comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current > REFRESH_AFTER_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const selectBranch = useCallback(
    (code) => {
      setSelectedBranch(code || null);
      setSelected(code || null);
      setBranchKey((k) => k + 1);
      refresh();
    },
    [refresh]
  );

  // The organisation's own currency and time zone: set before the shell's children render, so money and dates are right on the
  // first paint after the status loads. (Idempotent: it only changes when the organisation's values differ from what is held.)
  if (status?.organisation) setOrgLocale({ currency: status.organisation.baseCurrency, timezone: status.organisation.timezone });
  const localeKey = `${orgCurrency()}|${orgTimezone()}`;

  const value = useMemo(
    () => ({
      status,
      // who is asking and what their role holds; unknown (and so nothing is hidden) until the status has loaded
      me: status?.me || null,
      // who must approve what (the person who prepared a document; a second approver above an amount); off until set
      policy: status?.policy?.approvals ? normalisePolicy(status.policy.approvals) : NO_APPROVAL_POLICY,
      can: (key) => can(status?.me, key),
      canAny: (keys) => canAny(status?.me, keys),
      blocked: refused || blockedFromStatus(status),
      loading,
      refresh,
      featureOn: (key) => featureOn(status, key),
      branch: { selected: validBranchSelection(status, selected), label: branchLabel(status, selected) },
      branchKey,
      // changes when the organisation's currency or time zone does, so a page remounts and reads everything again
      localeKey,
      selectBranch,
    }),
    [status, refused, loading, refresh, selected, branchKey, localeKey, selectBranch]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
