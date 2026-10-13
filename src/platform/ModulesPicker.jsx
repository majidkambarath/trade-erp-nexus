import React, { useEffect, useRef, useState } from "react";
import { Check, Minus } from "lucide-react";
import { moduleResult } from "./platformForms";

// One module of the product, as both console screens draw it: the New organisation form (what this customer is
// buying) and an organisation's Plan tab (what it has). Kept in one file so the two can never drift apart.
//
// It is ONE TICK, because that is the question nine times out of ten: does this customer get Finance or not. The
// plan sets the ticks; a module left as the plan has it stores nothing. The rarer answers are a quiet line under
// the name: selling a module in part ("Choose what they can do") and putting one back to the plan.

/** The actions the plan itself gives for this module. */
const planActions = (m, plan) =>
  moduleResult("default", {
    planValue: plan?.modules?.[m.key],
    allActions: m.actions.map((a) => a.action),
    alwaysOn: m.alwaysOn || [],
  }).actions;

const linkClass = "inline-flex min-h-11 items-center text-xs underline-offset-2 hover:underline lg:min-h-0";

export default function ModuleRow({ module: m, plan, state, onChange }) {
  const allActions = m.actions.map((a) => a.action);
  const alwaysOn = m.alwaysOn || [];
  const result = moduleResult(state.choice, { planValue: plan?.modules?.[m.key], ticked: state.actions, allActions, alwaysOn });
  const fromPlan = planActions(m, plan);
  const [open, setOpen] = useState(state.choice === "some");
  const box = useRef(null);
  // "some of it" is neither ticked nor empty, and a checkbox can say exactly that
  const partial = result.on && !result.full;
  useEffect(() => {
    if (box.current) box.current.indeterminate = partial;
  }, [partial]);

  // A module that is on whatever anyone says (the pick lists, the company settings): a tick that cannot be
  // unticked is a lie, so it is shown as the fact it is.
  const locked = alwaysOn.length === allActions.length;
  const changed = state.choice !== "default";

  const toggle = () => {
    setOpen(false);
    if (result.on) return onChange({ choice: "off", actions: [] });
    // turning one on means "as the plan has it" when the plan has any of it, so nothing is stored for it
    onChange({ choice: fromPlan.length ? "default" : "all", actions: allActions });
  };
  const chooseActions = () => {
    setOpen(true);
    if (state.choice !== "some") onChange({ choice: "some", actions: result.actions });
  };
  const followPlan = () => {
    setOpen(false);
    onChange({ choice: "default", actions: fromPlan });
  };
  const toggleAction = (action) => {
    const on = state.actions.includes(action);
    onChange({ choice: "some", actions: on ? state.actions.filter((a) => a !== action) : [...state.actions, action] });
  };

  return (
    <li className="border-t border-border py-1.5 first:border-t-0">
      <div className="flex items-start gap-3">
        {/* the tap target is the whole name, not the 20px box (the rule is a finger on touch, tight on a mouse) */}
        <label className={`flex min-h-11 flex-1 items-start gap-3 py-1 lg:min-h-0 ${locked ? "" : "cursor-pointer"}`}>
          <input
            ref={box}
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-primary"
            checked={result.on}
            disabled={locked}
            onChange={toggle}
            aria-label={m.label}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {m.label}
              {locked ? <span className="ms-2 text-xs font-normal text-muted-foreground">always on</span> : null}
              {partial && !locked ? <span className="ms-2 text-xs font-normal text-status-warning">only {result.actions.join(", ")}</span> : null}
              {!result.on ? <span className="ms-2 text-xs font-normal text-muted-foreground">not included</span> : null}
            </span>
            <span className="block text-xs text-muted-foreground">{m.hint}</span>
          </span>
        </label>
        <span className={`mt-2 inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium ${result.full ? "bg-status-success/10 text-status-success" : result.on ? "bg-status-warning/10 text-status-warning" : "bg-secondary text-muted-foreground"}`}>
          {result.full ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : result.on ? <Minus className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {result.full ? "All" : result.on ? "Part" : "Off"}
        </span>
      </div>

      {!locked && (
        <p className="-mt-1 flex flex-wrap items-center gap-x-4 ps-8 text-xs">
          {result.on && (
            <button type="button" onClick={open ? () => setOpen(false) : chooseActions} className={`${linkClass} text-primary`}>
              {open ? "Done" : "Choose what they can do"}
            </button>
          )}
          {changed && (
            <button type="button" onClick={followPlan} className={`${linkClass} text-muted-foreground`}>
              Follow the plan
            </button>
          )}
          {!changed && (
            <span className="text-muted-foreground">
              {fromPlan.length === allActions.length ? "as the plan has it" : fromPlan.length ? `the plan gives ${fromPlan.join(", ")}` : "the plan does not include it"}
            </span>
          )}
        </p>
      )}

      {open && !locked ? (
        <ul className="mb-2 flex flex-wrap gap-x-4 ps-8">
          {m.actions.map((a) => {
            const fixed = alwaysOn.includes(a.action);
            return (
              <li key={a.action}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs lg:min-h-0 lg:py-1">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={fixed || state.actions.includes(a.action)} disabled={fixed} onChange={() => toggleAction(a.action)} />
                  <span className={fixed ? "text-muted-foreground" : ""}>{a.action}{fixed ? " (always on)" : ""}</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
