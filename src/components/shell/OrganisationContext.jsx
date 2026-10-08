import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BLOCKED_EVENT, branchLabel, featureOn, validBranchSelection } from "../../lib/organisation";
import { getSelectedBranch, setSelectedBranch } from "../../axios/session";
import { getOrganisationStatus } from "../../lib/organisationApi";

// The signed-in organisation, loaded once for the shell: what its plan includes (so a screen the plan does not
// have is not offered), where its subscription stands (so a notice can warn before anything is refused), and
// whether it has been blocked (so one page says why, instead of every screen showing its own error).
//
// If the status cannot be loaded, nothing is hidden and nothing is blocked: the server still refuses what the
// plan does not include, and a missing status must never lock a working organisation out of its own screen.
const Context = createContext(null);

const NOTHING = { status: null, blocked: null, loading: false, refresh: () => {}, featureOn: () => true, branch: null, branchKey: 0, selectBranch: () => {} };
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

  const value = useMemo(
    () => ({
      status,
      blocked: refused || blockedFromStatus(status),
      loading,
      refresh,
      featureOn: (key) => featureOn(status, key),
      branch: { selected: validBranchSelection(status, selected), label: branchLabel(status, selected) },
      branchKey,
      selectBranch,
    }),
    [status, refused, loading, refresh, selected, branchKey, selectBranch]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
