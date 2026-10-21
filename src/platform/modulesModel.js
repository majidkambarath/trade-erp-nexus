// The modules panel's rules as plain functions (no React, no requests): the catalogue arranged as groups of modules each
// holding its parts, what a click on a part means, what changed from the plan, and who will get a module. Pure, so each rule is a test.
import { featureApplies, featureChoice, featureOverridesFor, featureResult, moduleActionsOf, moduleChoice, moduleOverridesFor, moduleResult } from "./platformForms";

export { featureApplies, featureOverridesFor };

// ---- the catalogue, arranged

// Older servers send neither groups nor screens nor a home for a feature. Then the modules are one list, a module has no
// parts of its own, and every feature is a part of "More features": the panel draws less, never wrongly.
const FALLBACK_GROUP = { key: "all", label: "" };

/**
 * { groups: [{ key, label, modules: [module + { parts, features }] }], loose: [feature] }.
 * `parts` is the module's screens in order: { kind: "screen", label } (goes with the module) or { kind: "feature", feature }
 * (can be sold apart). `loose` is any feature no module claims, so nothing the server offers is ever left out of the panel.
 */
export function moduleTree(catalog) {
  const modules = catalog?.modules || [];
  const features = catalog?.features || [];
  const byKey = new Map(features.map((f) => [f.key, f]));
  const claimed = new Set();
  const withParts = modules.map((m) => {
    const parts = [];
    for (const s of m.sections || []) {
      if (typeof s === "string") parts.push({ kind: "screen", label: s });
      else if (byKey.has(s.feature)) {
        parts.push({ kind: "feature", feature: byKey.get(s.feature) });
        claimed.add(s.feature);
      }
    }
    // a feature that names this module but is missing from its screen list still belongs here
    for (const f of features) {
      if (f.module === m.key && !claimed.has(f.key)) {
        parts.push({ kind: "feature", feature: f });
        claimed.add(f.key);
      }
    }
    return { ...m, parts, features: parts.filter((p) => p.kind === "feature").map((p) => p.feature) };
  });
  const order = catalog?.groups?.length ? catalog.groups : [FALLBACK_GROUP];
  const known = new Set(order.map((g) => g.key));
  const groups = order
    .map((g) => ({ ...g, modules: withParts.filter((m) => (known.has(m.group) ? m.group === g.key : g === order[order.length - 1])) }))
    .filter((g) => g.modules.length > 0);
  return { groups, loose: features.filter((f) => !claimed.has(f.key)) };
}

// ---- a module's and a feature's state

/** One module as the panel holds it: the developer's own edit, else what is stored (or the plan, for a new organisation). */
export const moduleStateOf = (organisation, plan, m, edits = {}) =>
  edits[m.key] ?? { choice: moduleChoice(organisation, m.key), actions: moduleActionsOf(organisation, plan, m.key, m.actions.map((a) => a.action)) };

/** What a module comes to right now: { on, full, actions }, the floor no plan can remove always included. */
export const moduleHolds = (plan, m, state) =>
  moduleResult(state.choice, { planValue: plan?.modules?.[m.key], ticked: state.actions, allActions: m.actions.map((a) => a.action), alwaysOn: m.alwaysOn || [] });

/** What the plan alone gives for a module. */
export const modulePlanHolds = (plan, m) => moduleResult("default", { planValue: plan?.modules?.[m.key], allActions: m.actions.map((a) => a.action), alwaysOn: m.alwaysOn || [] });

/** "default" (follow the plan), "on" or "off" for one feature: the developer's edit, else what is stored. */
export const featureChoiceOf = (organisation, key, edits = {}) => edits[key] ?? featureChoice(organisation, key);

/** Is the feature on for this customer? A feature that does not apply in their country is off whatever the choice says. */
export const featureOn = (plan, feature, choice, country) => featureApplies(feature, country) && featureResult(choice, plan?.features?.[feature.key]);

/**
 * The choice a click on a feature's switch makes. The switch shows whether the customer GETS it, so a click flips that; and
 * flipping it back to what the plan says is "follow the plan", which stores nothing (a later change of plan still reaches it).
 */
export function nextFeatureChoice(choice, planHas) {
  const next = !featureResult(choice, planHas);
  return next === Boolean(planHas) ? "default" : next ? "on" : "off";
}

// ---- what changed from the plan

/**
 * What the panel says before anything is opened. `modules` / `features` are the developer's edits (`organisation` is what is
 * stored, null for a new one). A choice that merely repeats the plan is not a difference, as nothing would be stored for it.
 */
export function planDifference({ catalog, plan, organisation = null, modules = {}, features = {}, country = null }) {
  const all = catalog?.modules || [];
  const states = Object.fromEntries(all.map((m) => [m.key, moduleStateOf(organisation, plan, m, modules)]));
  const changedModules = Object.keys(moduleOverridesFor(plan, states, all)).map((key) => all.find((m) => m.key === key)?.label || key);
  const featureList = catalog?.features || [];
  const featureChoices = Object.fromEntries(featureList.map((f) => [f.key, featureChoiceOf(organisation, f.key, features)]));
  const changedFeatures = Object.keys(featureOverridesFor(plan, featureChoices, featureList, country)).map((key) => featureList.find((f) => f.key === key)?.label || key);
  const modulesOn = all.filter((m) => moduleHolds(plan, m, states[m.key]).on).length;
  const featuresOn = featureList.filter((f) => featureOn(plan, f, featureChoices[f.key], country)).length;
  return { changedModules, changedFeatures, changed: changedModules.length + changedFeatures.length, modulesOn, modulesTotal: all.length, featuresOn, featuresTotal: featureList.length };
}

/** "Everything the plan includes." or "Different from the plan: Finance, Production." */
export function differenceText(diff) {
  const named = [...diff.changedModules, ...diff.changedFeatures];
  return named.length ? `Different from the plan: ${named.join(", ")}.` : "Everything the plan includes.";
}

// ---- who gets a module

/**
 * What each ready-made role will be able to do in a module, given what is sold. The sale is a ceiling (the role's own actions
 * cut down to what the customer bought), which is exactly how the server applies it, so a role the customer makes later can
 * hold no more than this.
 *   -> [{ key, name, level: "full" | "part" | "none", actions: ["View", "Add"], text }]
 * `full` means everything that is sold; `part` something less; `none` nothing at all.
 */
export function roleAccess(roles = [], module, sold = []) {
  const shortOf = new Map(module.actions.map((a) => [a.action, a.short || a.action]));
  const soldSet = new Set(sold);
  return [...roles]
    .sort((a, b) => b.rank - a.rank)
    .map((role) => {
      const held = (role.modules?.[module.key] || []).filter((a) => soldSet.has(a));
      const level = !held.length ? "none" : held.length === soldSet.size ? "full" : "part";
      const actions = module.actions.filter((a) => held.includes(a.action)).map((a) => shortOf.get(a.action));
      const text = level === "none" ? "No access" : level === "full" ? "Full access" : actions.length === 1 && held[0] === "view" ? "View only" : actions.join(", ");
      return { key: role.key, name: role.name, level, actions, text };
    });
}
