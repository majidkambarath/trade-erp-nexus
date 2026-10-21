import React, { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Lock, RotateCcw } from "lucide-react";
import { Panel, Pill } from "../components/accounting/kit";
import { cn } from "../lib/utils";
import { countryName } from "./countries";
import {
  differenceText,
  featureApplies,
  featureChoiceOf,
  featureOn,
  moduleHolds,
  modulePlanHolds,
  moduleStateOf,
  moduleTree,
  nextFeatureChoice,
  planDifference,
  roleAccess,
} from "./modulesModel";
import { featureResult, moduleOverridesFor } from "./platformForms";

// What a customer is buying, as the New organisation form and an organisation's Plan tab both draw it (one file, so the two can
// never drift apart). A module is a card with ONE switch: does this customer get Finance or not. Open it to see what is inside:
// the parts that can be sold apart (Production under Inventory, Quotations under Sales), what people can do in it, and which of
// the ready-made roles will get it. The plan sets every switch; changing one stores only the difference, so a later change of
// plan still reaches the rest.

const small = "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-input bg-card px-3 text-xs font-medium hover:bg-accent disabled:opacity-60 lg:min-h-9";
const link = "inline-flex min-h-11 items-center text-xs underline underline-offset-2 lg:min-h-0";
const chip = "inline-flex min-h-11 items-center rounded-full border border-input bg-card px-3 text-xs font-medium hover:bg-accent lg:min-h-8";

// A switch is a real role="switch" so a screen reader says on or off; the 44px target is the button, the pill is only what is drawn.
function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 lg:h-9"
    >
      <span aria-hidden="true" className={cn("relative h-6 w-11 rounded-full transition-colors duration-200 motion-reduce:transition-none", checked ? "bg-brand" : "bg-border")}>
        <span className={cn("absolute start-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

function Heading({ children }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h4>;
}

// One optional part of a module, switched on or off for this customer.
function FeatureRow({ feature: f, plan, choice, country, moduleOn, moduleLabel, onChange }) {
  const planHas = Boolean(plan?.features?.[f.key]);
  const applies = featureApplies(f, country);
  const on = featureOn(plan, f, choice, country);
  const differs = applies && featureResult(choice, planHas) !== planHas;
  const stored = choice !== "default";
  let status;
  if (!applies) status = `Only for organisations in ${f.onlyIn.map(countryName).join(" and ")}, so it is not available in ${countryName(country)}.`;
  else if (choice === "on") status = planHas ? "Switched on for this customer (the plan has it too)." : "Switched on for this customer only.";
  else if (choice === "off") status = planHas ? "Switched off for this customer, although the plan has it." : "Switched off for this customer.";
  else status = planHas ? "In the plan." : f.optIn ? "In no plan: switched on one customer at a time." : "Not in the plan.";
  return (
    <li className="flex items-start gap-1 px-1 py-1 sm:px-2">
      <Toggle checked={on} disabled={!applies} label={f.label} onChange={() => onChange(f.key, nextFeatureChoice(choice, planHas))} />
      <div className="min-w-0 flex-1 py-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {f.label}
          {f.optIn ? <Pill tone="info">Optional extra</Pill> : null}
        </p>
        {f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          <span className={differs ? "text-status-warning" : ""}>{status}</span>
          {on && !moduleOn && moduleLabel ? <span className="text-status-warning">Has no effect while {moduleLabel} is not included.</span> : null}
          {stored && applies ? (
            <button type="button" onClick={() => onChange(f.key, "default")} className={`${link} text-primary`} aria-label={`${f.label}: follow the plan`}>
              Follow the plan
            </button>
          ) : null}
        </p>
      </div>
    </li>
  );
}

// Who gets a module: the ready-made roles, cut down to what is sold (the same cut the server makes).
function WhoGetsIt({ module: m, roles, sold, label }) {
  const rows = useMemo(() => roleAccess(roles, m, sold), [roles, m, sold]);
  if (!roles?.length) return null;
  const with_ = rows.filter((r) => r.level !== "none");
  const without = rows.filter((r) => r.level === "none");
  return (
    <section>
      <Heading>Who gets it</Heading>
      {with_.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nobody: {label} is not included, so no role can reach it, not even the owner.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">The ready-made roles. A role the customer makes later can hold only what is included here.</p>
          <dl className="mt-2 grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
            {with_.map((r) => (
              <React.Fragment key={r.key}>
                <dt className="font-medium text-foreground">{r.name}</dt>
                <dd className={r.level === "full" ? "text-status-success" : "text-muted-foreground"}>{r.text}</dd>
              </React.Fragment>
            ))}
          </dl>
          {without.length ? <p className="mt-2 text-xs text-muted-foreground">No access: {without.map((r) => r.name).join(", ")}.</p> : null}
        </>
      )}
    </section>
  );
}

function ModuleCard({ module: m, plan, organisation, edits, featureEdits, country, roles, open, onToggleOpen, onModule, onFeature }) {
  const bodyId = useId();
  const allActions = m.actions.map((a) => a.action);
  const alwaysOn = m.alwaysOn || [];
  const state = moduleStateOf(organisation, plan, m, edits);
  const result = moduleHolds(plan, m, state);
  const fromPlan = modulePlanHolds(plan, m);
  const locked = alwaysOn.length === allActions.length;
  const stored = state.choice !== "default";
  const differs = Object.keys(moduleOverridesFor(plan, { [m.key]: state }, [m])).length > 0;
  const partial = result.on && !result.full;

  const toggleModule = () => {
    if (result.on) return onModule(m.key, { choice: "off", actions: [] });
    // turning one on means "as the plan has it" when the plan has any of it, so nothing is stored for it
    onModule(m.key, { choice: fromPlan.actions.length ? "default" : "all", actions: allActions });
  };
  const toggleAction = (action) => {
    const next = result.actions.includes(action) ? result.actions.filter((a) => a !== action) : [...result.actions, action];
    onModule(m.key, { choice: "some", actions: next });
  };

  if (locked) {
    return (
      <li className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {m.label}
          <Pill tone="neutral">Always on</Pill>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>
      </li>
    );
  }

  const featureCount = m.features.length;
  const featuresOnCount = m.features.filter((f) => featureOn(plan, f, featureChoiceOf(organisation, f.key, featureEdits), country)).length;
  const summary = !result.on
    ? null
    : [
        featureCount ? `${featuresOnCount} of ${featureCount} optional ${featureCount === 1 ? "part" : "parts"}` : null,
        result.full ? "everything people can do" : `only ${m.actions.filter((a) => result.actions.includes(a.action)).map((a) => a.short.toLowerCase()).join(", ")}`,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <li className={cn("rounded-xl border bg-card transition-colors", differs ? "border-status-warning/50" : "border-border", !result.on && "bg-secondary/40")}>
      <div className="flex items-start gap-1 p-1.5 sm:p-2.5">
        <Toggle checked={result.on} label={m.label} onChange={toggleModule} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${m.label} details`}
          onClick={onToggleOpen}
          className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-1.5 text-start hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn("text-sm font-semibold", !result.on && "text-muted-foreground")}>{m.label}</span>
              <Pill tone={result.full ? "success" : result.on ? "warning" : "neutral"}>{result.full ? "All" : result.on ? "Part" : "Off"}</Pill>
              {differs ? <span className="text-xs text-status-warning">Changed from the plan</span> : null}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{m.hint}</span>
            {summary ? <span className={cn("mt-1 block text-xs", partial ? "text-status-warning" : "text-muted-foreground")}>{summary}</span> : null}
          </span>
          <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div id={bodyId} className="space-y-5 border-t border-border px-3 pb-4 pt-3 sm:px-4 sm:ps-[4.25rem]">
          {m.parts.length ? (
            <section>
              <Heading>Parts of {m.label}</Heading>
              {m.parts.some((p) => p.kind === "screen") ? (
                <ul className={cn("mt-2 flex flex-wrap gap-1.5", !result.on && "opacity-50")} aria-label={`Included with ${m.label}`}>
                  {m.parts
                    .filter((p) => p.kind === "screen")
                    .map((p) => (
                      <li key={p.label} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground">
                        <Check className="h-3 w-3 text-status-success" aria-hidden="true" />
                        {p.label}
                      </li>
                    ))}
                </ul>
              ) : null}
              {featureCount ? (
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {m.features.map((f) => (
                    <FeatureRow
                      key={f.key}
                      feature={f}
                      plan={plan}
                      country={country}
                      choice={featureChoiceOf(organisation, f.key, featureEdits)}
                      moduleOn={result.on}
                      moduleLabel={m.label}
                      onChange={onFeature}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section>
            <Heading>What people can do</Heading>
            {!result.on ? (
              <p className="mt-2 text-xs text-muted-foreground">Switch {m.label} on to choose what people can do in it.</p>
            ) : (
              <>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <button type="button" onClick={() => onModule(m.key, { choice: "all", actions: allActions })} className={chip} aria-label={`${m.label}: everything`}>
                    Everything
                  </button>
                  <button type="button" onClick={() => onModule(m.key, { choice: "some", actions: allActions.filter((a) => a === "view") })} className={chip} aria-label={`${m.label}: view only`}>
                    View only
                  </button>
                  {stored ? (
                    <button type="button" onClick={() => onModule(m.key, { choice: "default", actions: fromPlan.actions })} className={chip} aria-label={`${m.label}: follow the plan`}>
                      Follow the plan
                    </button>
                  ) : (
                    <span className="text-muted-foreground">
                      {fromPlan.actions.length === allActions.length ? "as the plan has it" : fromPlan.actions.length ? "the plan gives only part of it" : "the plan does not include it"}
                    </span>
                  )}
                </p>
                <ul className="mt-1 grid gap-x-3 sm:grid-cols-2">
                  {m.actions.map((a) => {
                    const fixed = alwaysOn.includes(a.action);
                    const nameId = `${bodyId}-${a.action}-name`;
                    const textId = `${bodyId}-${a.action}-text`;
                    return (
                      <li key={a.action}>
                        <label className={cn("flex min-h-11 items-start gap-2.5 rounded-lg px-1.5 py-1.5 lg:min-h-0", fixed ? "" : "cursor-pointer hover:bg-accent/40")}>
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                            checked={fixed || result.actions.includes(a.action)}
                            disabled={fixed}
                            onChange={() => toggleAction(a.action)}
                            aria-labelledby={nameId}
                            aria-describedby={textId}
                          />
                          <span className="min-w-0">
                            <span id={nameId} className="block text-sm">
                              {a.short}
                              {fixed ? <span className="ms-1.5 text-xs text-muted-foreground">(always on)</span> : null}
                            </span>
                            <span id={textId} className="block text-xs text-muted-foreground">{a.label}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <WhoGetsIt module={m} roles={roles} sold={result.actions} label={m.label} />
        </div>
      ) : null}
    </li>
  );
}

/**
 * The whole panel. `edits` (modules) and `featureEdits` are only what the developer changed, so everything else follows the plan
 * (or, on an organisation's Plan tab, what is stored: `organisation`). `onModule(key, { choice, actions })` and
 * `onFeature(key, "default" | "on" | "off")` report a change; the screen turns them into what is sent.
 */
export default function ModulesPanel({ catalog, plan, organisation = null, country = null, edits = {}, featureEdits = {}, onModule, onFeature, actions = null }) {
  const tree = useMemo(() => moduleTree(catalog), [catalog]);
  const all = catalog?.modules || [];
  const diff = planDifference({ catalog, plan, organisation, modules: edits, features: featureEdits, country });
  // what the developer already changed (or what is stored) opens by itself: that is where they look first
  const [open, setOpen] = useState(() => new Set(all.filter((m) => moduleStateOf(organisation, plan, m, edits).choice !== "default").map((m) => m.key)));
  // the cards that can be opened (a module that is always on has nothing to choose)
  const openable = all.filter((m) => (m.alwaysOn || []).length !== m.actions.length).map((m) => m.key);
  const everyOpen = openable.length > 0 && openable.every((k) => open.has(k));
  const flip = (key) => setOpen((set) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const resetAll = () => {
    for (const m of all) onModule(m.key, { choice: "default", actions: modulePlanHolds(plan, m).actions });
    for (const f of catalog?.features || []) onFeature(f.key, "default");
  };

  // an older server sends no module catalogue: its features are then drawn on their own, and with neither the panel is absent
  if (!all.length && !(catalog?.features || []).length) return null;

  return (
    <Panel
      title="Modules"
      description="What this customer is buying. The plan sets every switch: turn off what they are not getting, and open a module to choose its parts and what people can do. Only the difference is stored, so a later change of plan still reaches the rest."
    >
      <div className="-mx-4 -mt-4 flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:-mx-5 sm:-mt-5 sm:px-5">
        <div aria-live="polite">
          <p className="text-sm">{differenceText(diff)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {diff.modulesTotal ? `${diff.modulesOn} of ${diff.modulesTotal} modules on · ` : ""}
            {diff.featuresOn} of {diff.featuresTotal} optional parts on
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {diff.changed > 0 ? (
            <button type="button" onClick={resetAll} className={small}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset to the plan
            </button>
          ) : null}
          <button type="button" onClick={() => setOpen(everyOpen ? new Set() : new Set(openable))} className={small}>
            {everyOpen ? "Collapse all" : "Expand all"}
          </button>
          {actions}
        </div>
      </div>

      <div className="mt-4 space-y-5">
        {tree.groups.map((g) => (
          <section key={g.key} aria-label={g.label || undefined}>
            {g.label ? <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h3> : null}
            <ul className="space-y-2">
              {g.modules.map((m) => (
                <ModuleCard
                  key={m.key}
                  module={m}
                  plan={plan}
                  organisation={organisation}
                  edits={edits}
                  featureEdits={featureEdits}
                  country={country}
                  roles={catalog?.roles}
                  open={open.has(m.key)}
                  onToggleOpen={() => flip(m.key)}
                  onModule={onModule}
                  onFeature={onFeature}
                />
              ))}
            </ul>
          </section>
        ))}

        {tree.loose.length ? (
          <section aria-label="More features">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">More features</h3>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {tree.loose.map((f) => (
                <FeatureRow
                  key={f.key}
                  feature={f}
                  plan={plan}
                  country={country}
                  choice={featureChoiceOf(organisation, f.key, featureEdits)}
                  moduleOn
                  onChange={onFeature}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Panel>
  );
}
