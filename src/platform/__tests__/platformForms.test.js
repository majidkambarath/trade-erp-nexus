import { describe, it, expect, vi } from "vitest";
import { MIN_CONSOLE_PASSWORD, moduleActionsOf, moduleChoice, modulePatch, moduleResult, moduleText, roleLabel, roleOptions, suggestPassword, validateDeveloper } from "../platformForms";

// How the console words a person's role and which roles it offers when giving one.
const ROLES = [
  { key: "super_admin", name: "Owner", builtIn: true, isActive: true },
  { key: "accountant", name: "Accountant", builtIn: true, isActive: true },
  { key: "yard_lead", name: "Yard lead", builtIn: false, isActive: true },
  { key: "retired", name: "Retired role", builtIn: false, isActive: false },
];

describe("roles the console offers", () => {
  it("lists the organisation's switched-on roles, marking its own as custom", () => {
    expect(roleOptions(ROLES)).toEqual([
      { value: "super_admin", label: "Owner" },
      { value: "accountant", label: "Accountant" },
      { value: "yard_lead", label: "Yard lead (custom)" },
    ]);
  });

  it("keeps the role a person already holds in the list even when it has been switched off", () => {
    expect(roleOptions(ROLES, "retired").map((o) => o.value)).toContain("retired");
    expect(roleOptions(ROLES, "retired").find((o) => o.value === "retired").label).toBe("Retired role (custom)");
  });

  it("shows a held role that is not in the list at all (deleted, or the list is short) rather than a box with the wrong one chosen", () => {
    expect(roleOptions(ROLES, "ghost").at(-1)).toEqual({ value: "ghost", label: "ghost" });
  });

  it("offers the five original account types until the organisation's list arrives, or when it is empty", () => {
    const original = ["super_admin", "admin", "manager", "operator", "viewer"];
    expect(roleOptions(undefined).map((o) => o.value)).toEqual(original);
    expect(roleOptions(null).map((o) => o.value)).toEqual(original);
    expect(roleOptions([]).map((o) => o.value)).toEqual(original);
  });
});

describe("a person's role in words", () => {
  it("uses the name the server gives", () => {
    expect(roleLabel({ type: "viewer", role: { key: "accountant", name: "Accountant" } })).toBe("Accountant");
  });

  it("falls back to the account type's label, then the key, when the server gave no name (the role was deleted)", () => {
    expect(roleLabel({ type: "manager" })).toBe("Manager");
    expect(roleLabel({ type: "viewer", role: { key: "operator", name: null } })).toBe("Operator");
    expect(roleLabel({ type: "viewer", role: { key: "gone_role", name: null } })).toBe("gone_role");
  });

  it("copes with nothing", () => {
    expect(roleLabel(undefined)).toBe("");
    expect(roleLabel({})).toBe("");
  });
});

// A console account opens every organisation, so the server asks for more of its password than the product
// does. The form says so before it is sent, or the person types it twice for nothing.
describe("a developer console account", () => {
  const ok = { name: "Dev Two", email: "dev2@zarvia.test", password: "a-long-passphrase-123" };

  it("accepts a name, an address and a password of twelve characters with letters and digits", () => {
    expect(validateDeveloper(ok)).toEqual({});
    expect(MIN_CONSOLE_PASSWORD).toBe(12);
  });

  it("asks for the name and a real address", () => {
    expect(validateDeveloper({ ...ok, name: "   " }).name).toBeTruthy();
    expect(validateDeveloper({ ...ok, email: "dev2" }).email).toBeTruthy();
    expect(validateDeveloper({ ...ok, email: "" }).email).toBeTruthy();
  });

  it("refuses a password the server would refuse, saying which way it is short", () => {
    expect(validateDeveloper({ ...ok, password: "short-1" }).password).toMatch(/12/);
    expect(validateDeveloper({ ...ok, password: "alllettersnodigits" }).password).toMatch(/letters and digits/);
    expect(validateDeveloper({ ...ok, password: "123456789012" }).password).toMatch(/letters and digits/);
  });

  it("on an edit an empty password means keep the one it has, but anything typed is still checked", () => {
    expect(validateDeveloper({ ...ok, password: "" }, { needPassword: false })).toEqual({});
    expect(validateDeveloper({ ...ok, password: "weak" }, { needPassword: false }).password).toBeTruthy();
  });
});

// These passwords are handed to a client's first administrator and to a console account that can reach every
// organisation, so where the randomness comes from is the point - Math.random is not meant to be unguessable.
describe("the password the console suggests", () => {
  it("takes its randomness from crypto, not Math.random", () => {
    const fromCrypto = vi.spyOn(globalThis.crypto, "getRandomValues");
    const fromMath = vi.spyOn(Math, "random");
    try {
      suggestPassword();
      expect(fromCrypto).toHaveBeenCalled();
      expect(fromMath).not.toHaveBeenCalled();
    } finally {
      fromCrypto.mockRestore();
      fromMath.mockRestore();
    }
  });

  it("is twelve characters with letters and digits, and passes the rule the server enforces", () => {
    for (let i = 0; i < 50; i += 1) {
      const p = suggestPassword();
      expect(p).toHaveLength(MIN_CONSOLE_PASSWORD);
      expect(validateDeveloper({ name: "A", email: "a@b.test", password: p })).toEqual({});
    }
  });

  it("does not repeat itself", () => {
    expect(new Set(Array.from({ length: 50 }, () => suggestPassword())).size).toBe(50);
  });
});

// The modules an organisation was sold: the ceiling the developer sets, which no role inside it can exceed.
describe("modules in the console", () => {
  const SALES = ["view", "create", "approve"];
  const REPORTS = ["view", "financial", "vat"];
  const plan = { modules: { sales: true, reports: true, finance: ["view"] } };

  it("reads what a module holds now: its own override, else the plan's", () => {
    expect(moduleChoice({}, "sales")).toBe("default");
    expect(moduleChoice({ moduleOverrides: { sales: true } }, "sales")).toBe("all");
    expect(moduleChoice({ moduleOverrides: { sales: false } }, "sales")).toBe("off");
    expect(moduleChoice({ moduleOverrides: { sales: ["view"] } }, "sales")).toBe("some");
    // a value we cannot make sense of reads as "follow the plan" rather than inventing a setting
    expect(moduleChoice({ moduleOverrides: { sales: "yes" } }, "sales")).toBe("default");

    expect(moduleActionsOf({}, plan, "sales", SALES)).toEqual(SALES);
    expect(moduleActionsOf({}, plan, "finance", ["view", "create"])).toEqual(["view"]);
    expect(moduleActionsOf({ moduleOverrides: { sales: ["approve", "view"] } }, plan, "sales", SALES)).toEqual(["view", "approve"]);
    expect(moduleActionsOf({ moduleOverrides: { sales: false } }, plan, "sales", SALES)).toEqual([]);
    expect(moduleActionsOf({}, { modules: {} }, "sales", SALES)).toEqual([], "a plan that does not name it holds none of it");
  });

  it("says what a choice comes to, with the actions that can never be taken away put back", () => {
    const of = (choice, ticked = []) => moduleResult(choice, { planValue: true, ticked, allActions: REPORTS, alwaysOn: ["view"] });
    expect(of("all")).toEqual({ on: true, full: true, actions: REPORTS });
    expect(of("some", ["financial"])).toEqual({ on: true, full: false, actions: ["view", "financial"] });
    // "off" cannot remove the floor: the server puts it back, so the console must not promise otherwise
    expect(of("off")).toEqual({ on: true, full: false, actions: ["view"] });
    expect(moduleResult("off", { planValue: true, allActions: ["view", "create"], alwaysOn: [] })).toEqual({ on: false, full: false, actions: [] });
    expect(moduleResult("default", { planValue: ["view"], allActions: REPORTS, alwaysOn: [] }).actions).toEqual(["view"]);
    expect(moduleText(of("all"))).toBe("All of it");
    expect(moduleText(of("some", ["financial"]))).toBe("Only: view, financial");
    expect(moduleText({ on: false, full: false, actions: [] })).toBe("Not included");
  });

  it("sends only what changed, and nothing at all when nothing did", () => {
    const org = { moduleOverrides: { finance: false, reports: ["view"] } };
    const same = { finance: { choice: "off", actions: [] }, reports: { choice: "some", actions: ["view"] } };
    expect(modulePatch(org, same)).toEqual({});
    // the same list in another order is not a change
    expect(modulePatch({ moduleOverrides: { reports: ["view", "financial"] } }, { reports: { choice: "some", actions: ["financial", "view"] } })).toEqual({});
    expect(modulePatch(org, { finance: { choice: "default" } })).toEqual({ resetModules: ["finance"] });
    expect(modulePatch(org, { finance: { choice: "all" } })).toEqual({ moduleOverrides: { finance: true } });
    expect(modulePatch({}, { sales: { choice: "some", actions: ["view", "create"] } })).toEqual({ moduleOverrides: { sales: ["create", "view"] } });
    // "chosen actions" with nothing ticked means the module is not included, which is what is stored
    expect(modulePatch({}, { sales: { choice: "some", actions: [] } })).toEqual({ moduleOverrides: { sales: false } });
    // a module already at the plan's setting needs no reset
    expect(modulePatch({}, { sales: { choice: "default" } })).toEqual({});
  });
});
