import { useCallback, useMemo, useState } from "react";
import { DEFAULT_LIST_PERIOD, resolveListPeriod } from "@/lib/listPeriod";
import { todayInput } from "@/utils/format";

// The period state of one list: what was picked, and the period in force.
//
// A custom range that cannot be asked for (an end before the start) is explained under the control while the list stays on
// the last period that could - so typing the end date first never blanks the list or fires a request for nonsense.
//
//   period    the resolved period in force (lib/listPeriod.js): { ok, preset, from, to, all, label, name, key }
//   preset    the choice showing in the control            from, to   the custom dates showing
//   problem   why the latest pick was not applied, or null
//   today     the organisation's day
//   choose(preset) / setFrom(day) / setTo(day) / reset()
export function usePeriodFilter({ initial = DEFAULT_LIST_PERIOD } = {}) {
  const today = todayInput();
  const [draft, setDraft] = useState({ preset: initial, from: "", to: "" });
  const [applied, setApplied] = useState(draft);

  const change = useCallback(
    (next) => {
      setDraft(next);
      if (resolveListPeriod(next, today).ok) setApplied(next);
    },
    [today]
  );

  const period = useMemo(() => resolveListPeriod(applied, today), [applied, today]);
  const asked = useMemo(() => resolveListPeriod(draft, today), [draft, today]);

  return {
    period,
    preset: draft.preset,
    from: draft.from,
    to: draft.to,
    problem: asked.ok ? null : asked.error,
    today,
    choose: (preset) => change({ ...draft, preset }),
    setFrom: (from) => change({ ...draft, preset: "custom", from }),
    setTo: (to) => change({ ...draft, preset: "custom", to }),
    reset: () => change({ preset: initial, from: "", to: "" }),
  };
}
