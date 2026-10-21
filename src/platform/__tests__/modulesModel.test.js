import { describe, expect, it } from "vitest";
import { differenceText, featureApplies, featureOn, featureOverridesFor, moduleStateOf, moduleTree, nextFeatureChoice, planDifference, roleAccess } from "../modulesModel";
import { toCreatePayload } from "../platformForms";

const act = (action, short) => ({ action, short, label: `${short} things` });
const MODULES = [
  { key: "sales", label: "Sales", group: "trade", sections: [{ feature: "quotations" }, "Orders"], actions: [act("view", "View"), act("create", "Add"), act("approve", "Approve")], alwaysOn: [] },
  { key: "inventory", label: "Inventory", group: "trade", sections: ["Stock items", { feature: "production" }], actions: [act("view", "View"), act("adjust", "Adjust stock")], alwaysOn: [] },
  { key: "reports", label: "Reports", group: "money", sections: [{ feature: "vatReturn" }], actions: [act("view", "View"), act("financial", "Financial reports")], alwaysOn: ["view"] },
  { key: "lookups", label: "Pick lists", group: "core", sections: [], actions: [act("view", "View")], alwaysOn: ["view"] },
];
const FEATURES = [
  { key: "quotations", label: "Quotations", module: "sales", optIn: false, onlyIn: null },
  { key: "production", label: "Production", module: "inventory", optIn: true, onlyIn: null },
  { key: "vatReturn", label: "VAT return", module: "reports", optIn: false, onlyIn: ["AE"] },
  { key: "stray", label: "Stray", module: null, optIn: false, onlyIn: null },
];
const CATALOG = { modules: MODULES, features: FEATURES, groups: [{ key: "trade", label: "Trade" }, { key: "money", label: "Money" }, { key: "core", label: "Always on" }] };
const PLAN = { modules: { sales: true, inventory: true, reports: true, lookups: true }, features: { quotations: true, vatReturn: true } };

describe("the catalogue arranged for the panel", () => {
  it("groups the modules in the server's order and files each feature inside its module", () => {
    const tree = moduleTree(CATALOG);
    expect(tree.groups.map((g) => [g.label, g.modules.map((m) => m.key)])).toEqual([["Trade", ["sales", "inventory"]], ["Money", ["reports"]], ["Always on", ["lookups"]]]);
    const sales = tree.groups[0].modules[0];
    expect(sales.parts.map((p) => (p.kind === "screen" ? p.label : p.feature.key))).toEqual(["quotations", "Orders"]);
    expect(sales.features.map((f) => f.key)).toEqual(["quotations"]);
    expect(tree.groups[0].modules[1].features.map((f) => f.key)).toEqual(["production"]);
  });

  it("never loses a feature no module claims", () => {
    expect(moduleTree(CATALOG).loose.map((f) => f.key)).toEqual(["stray"]);
  });

  it("claims a feature by its module even when the module's own list forgot it", () => {
    const tree = moduleTree({ ...CATALOG, modules: [{ ...MODULES[0], sections: ["Orders"] }, ...MODULES.slice(1)] });
    expect(tree.groups[0].modules[0].features.map((f) => f.key)).toEqual(["quotations"]);
  });

  it("draws less, not wrongly, for an older server that sends no groups, screens or homes", () => {
    const older = { modules: MODULES.map(({ group, sections, ...m }) => m), features: FEATURES.map(({ module, ...f }) => f) }; // eslint-disable-line no-unused-vars
    const tree = moduleTree(older);
    expect(tree.groups).toHaveLength(1);
    expect(tree.groups[0].modules.map((m) => m.key)).toEqual(["sales", "inventory", "reports", "lookups"]);
    expect(tree.groups[0].modules.every((m) => m.features.length === 0)).toBe(true);
    expect(tree.loose.map((f) => f.key)).toEqual(["quotations", "production", "vatReturn", "stray"]);
  });
});

describe("a click on a part", () => {
  it("flips whether the customer gets it, and flipping back to the plan's answer follows the plan", () => {
    // the plan has Quotations: off is an override, and on again is the plan's own answer
    expect(nextFeatureChoice("default", true)).toBe("off");
    expect(nextFeatureChoice("off", true)).toBe("default");
    // the plan lacks Production (an opt-in): on is an override, and off again follows the plan
    expect(nextFeatureChoice("default", false)).toBe("on");
    expect(nextFeatureChoice("on", false)).toBe("default");
    // an override that merely repeated the plan is flipped the other way, never left redundant
    expect(nextFeatureChoice("on", true)).toBe("off");
    expect(nextFeatureChoice("off", false)).toBe("on");
  });

  it("is off where the country does not have it, whatever was sold", () => {
    const vat = FEATURES[2];
    expect(featureApplies(vat, "AE")).toBe(true);
    expect(featureApplies(vat, "in")).toBe(false);
    expect(featureApplies(vat, null)).toBe(true); // no country chosen yet
    expect(featureOn(PLAN, vat, "default", "AE")).toBe(true);
    expect(featureOn(PLAN, vat, "default", "IN")).toBe(false);
    expect(featureOn(PLAN, vat, "on", "IN")).toBe(false);
  });
});

describe("what a new organisation sends for its parts", () => {
  it("sends only what differs from the plan, and only where it applies", () => {
    expect(featureOverridesFor(PLAN, {}, FEATURES, "AE")).toEqual({});
    expect(featureOverridesFor(PLAN, { quotations: "default", production: "default" }, FEATURES, "AE")).toEqual({});
    expect(featureOverridesFor(PLAN, { production: "on", quotations: "off" }, FEATURES, "AE")).toEqual({ production: true, quotations: false });
    // an override that repeats the plan would stick to it: it is not an override
    expect(featureOverridesFor(PLAN, { quotations: "on", production: "off" }, FEATURES, "AE")).toEqual({});
    // the UAE's own feature in another country is not sent at all
    expect(featureOverridesFor(PLAN, { vatReturn: "off" }, FEATURES, "IN")).toEqual({});
    expect(featureOverridesFor(PLAN, { vatReturn: "off" }, FEATURES, "AE")).toEqual({ vatReturn: false });
  });

  it("puts them in the create payload beside the modules, and only when there are any", () => {
    const form = { legalName: "Brivox", code: "", country: "AE", baseCurrency: "AED", timezone: "Asia/Dubai", planCode: "standard", modules: {}, features: { production: "on" }, adminName: "A", adminEmail: "a@b.co", adminPassword: "12345678" };
    expect(toCreatePayload(form, { plan: PLAN, modules: MODULES, features: FEATURES })).toMatchObject({ featureOverrides: { production: true } });
    expect(toCreatePayload({ ...form, features: {} }, { plan: PLAN, modules: MODULES, features: FEATURES }).featureOverrides).toBeUndefined();
    expect(toCreatePayload(form).featureOverrides).toBeUndefined(); // a caller with no catalogue sends no override
  });
});

describe("what changed from the plan", () => {
  const diff = (over = {}) => planDifference({ catalog: CATALOG, plan: PLAN, country: "AE", ...over });

  it("says everything the plan includes when nothing changed, with the counts", () => {
    const d = diff();
    expect(differenceText(d)).toBe("Everything the plan includes.");
    expect(d).toMatchObject({ changed: 0, modulesOn: 4, modulesTotal: 4, featuresOn: 2, featuresTotal: 4 });
  });

  it("names a module and a part that differ, and ignores a choice that only repeats the plan", () => {
    const d = diff({ modules: { inventory: { choice: "off", actions: [] }, sales: { choice: "all", actions: ["view", "create", "approve"] } }, features: { production: "on", quotations: "on" } });
    expect(differenceText(d)).toBe("Different from the plan: Inventory, Production.");
    expect(d.modulesOn).toBe(3);
  });

  it("starts from what is stored on an organisation that already has overrides", () => {
    const org = { moduleOverrides: { sales: false }, featureOverrides: { production: true } };
    expect(differenceText(diff({ organisation: org }))).toBe("Different from the plan: Sales, Production.");
    expect(moduleStateOf(org, PLAN, MODULES[0], {})).toEqual({ choice: "off", actions: [] });
    // the developer's own edit wins over what is stored
    expect(moduleStateOf(org, PLAN, MODULES[0], { sales: { choice: "default", actions: ["view"] } }).choice).toBe("default");
  });
});

describe("who gets a module", () => {
  const ROLES = [
    { key: "viewer", name: "Viewer", rank: 20, modules: { sales: ["view"] } },
    { key: "super_admin", name: "Owner", rank: 100, modules: { sales: ["view", "create", "approve"], inventory: ["view", "adjust"] } },
    { key: "manager", name: "Manager", rank: 60, modules: { sales: ["view", "create"] } },
    { key: "operator", name: "Operator", rank: 40, modules: { inventory: ["view"] } },
  ];
  const sales = MODULES[0];

  it("reads each role's reach, strongest role first", () => {
    expect(roleAccess(ROLES, sales, ["view", "create", "approve"]).map((r) => [r.name, r.level, r.text])).toEqual([
      ["Owner", "full", "Full access"],
      ["Manager", "part", "View, Add"],
      ["Operator", "none", "No access"],
      ["Viewer", "part", "View only"],
    ]);
  });

  it("cuts every role down to what is sold, as the server does", () => {
    const rows = roleAccess(ROLES, sales, ["view"]);
    expect(rows.map((r) => [r.name, r.level])).toEqual([["Owner", "full"], ["Manager", "full"], ["Operator", "none"], ["Viewer", "full"]]);
  });

  it("gives nobody anything when nothing is sold", () => {
    expect(roleAccess(ROLES, sales, []).every((r) => r.level === "none")).toBe(true);
  });
});
