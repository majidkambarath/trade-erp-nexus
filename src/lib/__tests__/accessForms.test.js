import { describe, it, expect } from "vitest";
import {
  effectiveOf, emptyPerson, emptyRole, impliedOf, isLocked, keyFromName, mayChange, minimal, newPersonPayload, personChanges, personFrom,
  rankChoices, rolePayload, rolesToGive, summarise, ticksOf, toggle, toggleModule, validatePerson, validateRole,
} from "../accessForms";

// the shape the server sends (utils/permissions.js catalogue()): each action says what ticking it brings along
const action = (key, short, implies = []) => ({ key, short, label: `${short}.`, implies });
const catalogue = [
  { key: "sales", label: "Sales", actions: [action("sales.view", "View"), action("sales.create", "Add", ["sales.view", "lookups.view"]), action("sales.edit", "Edit", ["sales.view", "lookups.view"]), action("sales.approve", "Approve", ["sales.view", "inventory.view", "lookups.view"]), action("sales.delete", "Delete", ["sales.view", "lookups.view"])] },
  { key: "inventory", label: "Inventory", actions: [action("inventory.view", "View"), action("inventory.adjust", "Adjust stock", ["inventory.view", "lookups.view"])] },
  { key: "lookups", label: "Pick lists", automatic: true, actions: [action("lookups.view", "Pick lists")] },
];

describe("ticking a box", () => {
  it("brings along what it needs, and those boxes are locked while something ticked needs them", () => {
    const named = new Set(["sales.approve"]);
    expect([...impliedOf(catalogue, named)].sort()).toEqual(["inventory.view", "lookups.view", "sales.view"]);
    expect([...effectiveOf(catalogue, named)].sort()).toEqual(["inventory.view", "lookups.view", "sales.approve", "sales.view"]);
    expect(isLocked(catalogue, named, "sales.view")).toBe(true);
    expect(isLocked(catalogue, named, "sales.approve")).toBe(false);
  });

  it("unlocks them again when nothing needs them", () => {
    let named = toggle(new Set(), "sales.approve", true);
    expect(isLocked(catalogue, named, "sales.view")).toBe(true);
    named = toggle(named, "sales.approve", false);
    expect(isLocked(catalogue, named, "sales.view")).toBe(false);
    expect([...effectiveOf(catalogue, named)]).toEqual([]);
  });

  it("a box that is ticked itself stays ticked, and locked, while another needs it", () => {
    const named = new Set(["sales.view", "sales.create"]);
    expect(isLocked(catalogue, named, "sales.view")).toBe(true);
    expect(effectiveOf(catalogue, named).has("sales.view")).toBe(true);
  });

  it("does not mutate what it was given", () => {
    const before = new Set(["sales.view"]);
    toggle(before, "sales.create", true);
    expect([...before]).toEqual(["sales.view"]);
  });
});

describe("a whole module at once", () => {
  const holds = (...keys) => (k) => keys.includes(k);

  it("All ticks every box the person may grant, and no more", () => {
    const next = toggleModule(catalogue, new Set(), "sales", true, holds("sales.view", "sales.create"));
    expect([...next].sort()).toEqual(["sales.create", "sales.view"]);
  });

  it("None clears the module, except a box something elsewhere still needs", () => {
    const named = new Set(["sales.view", "sales.create", "inventory.adjust"]);
    const next = toggleModule(catalogue, named, "sales", false);
    expect([...next]).toEqual(["inventory.adjust"]);
    const needed = toggleModule(catalogue, new Set(["inventory.adjust", "inventory.view"]), "inventory", false);
    expect([...needed]).toEqual([]);
  });
});

describe("copying a role", () => {
  it("reduces a built-in role to the boxes that matter, not every implied one", () => {
    const expanded = ["inventory.view", "lookups.view", "sales.approve", "sales.view"];
    expect([...minimal(catalogue, expanded)]).toEqual(["sales.approve"]);
    expect([...ticksOf(catalogue, { permissions: expanded })]).toEqual(["sales.approve"]);
  });

  it("keeps a custom role's ticks exactly as they were made", () => {
    expect([...ticksOf(catalogue, { named: ["sales.view", "sales.create"], permissions: ["lookups.view", "sales.create", "sales.view"] })]).toEqual(["sales.view", "sales.create"]);
  });
});

describe("a role", () => {
  const ok = { ...emptyRole(), name: "Sales supervisor", key: "sales_supervisor", rank: 55 };
  const holdsAll = () => true;

  it("makes a key from a name", () => {
    expect(keyFromName("Sales supervisor")).toBe("sales_supervisor");
    expect(keyFromName("  Warehouse (night shift)  ")).toBe("warehouse_night_shift");
    expect(keyFromName("2nd shift")).toBe("role_2nd_shift");
    expect(keyFromName("***")).toBe("");
    expect(keyFromName("x".repeat(60)).length).toBeLessThanOrEqual(30);
  });

  it("a good one has nothing wrong with it", () => {
    expect(validateRole(ok, new Set(["sales.view"]), { isNew: true, myRank: 80, canGrant: holdsAll })).toEqual({});
  });

  it("is refused where the server would refuse it", () => {
    const v = (over, named = new Set(), opts = {}) => validateRole({ ...ok, ...over }, named, { isNew: true, myRank: 80, canGrant: holdsAll, ...opts });
    expect(v({ name: " " }).name).toBeTruthy();
    expect(v({ key: "Bad Key" }).key).toBeTruthy();
    expect(v({ rank: 80 }).rank).toMatch(/at or above/);
    expect(v({ rank: 95 }).rank).toBeTruthy();
    expect(v({ rank: 5 }).rank).toBeTruthy();
    expect(v({ rank: 80 }, new Set(), { myRank: 100 }).rank).toBeUndefined(); // the owner may sit anywhere below themselves
    expect(v({}, new Set(["finance.approve", "sales.view"]), { canGrant: (k) => k === "sales.view" }).permissions).toMatch(/finance\.approve/);
  });

  it("the key is only checked on a new role", () => {
    expect(validateRole({ ...ok, key: "BAD" }, new Set(), { isNew: false, myRank: 80, canGrant: holdsAll }).key).toBeUndefined();
  });

  it("builds the body the server expects, and a new role names its key", () => {
    expect(rolePayload({ ...ok, name: " Sales supervisor ", description: " Approves " }, new Set(["sales.approve"]), { isNew: true })).toEqual({ key: "sales_supervisor", name: "Sales supervisor", description: "Approves", rank: 55, permissions: ["sales.approve"] });
    expect(rolePayload(ok, new Set(), { isNew: false })).not.toHaveProperty("key");
  });

  it("offers only ranks below the person's own", () => {
    expect(rankChoices(80).map((r) => r.value)).toEqual([75, 60, 50, 40, 30, 20]);
    expect(rankChoices(55).map((r) => r.value)).toEqual([50, 40, 30, 20]);
    expect(rankChoices(20)).toEqual([]);
  });

  it("is summarised for a list row", () => {
    expect(summarise({ permissions: ["sales.view", "sales.create", "lookups.view", "inventory.view"] })).toBe("4 permissions in 2 areas");
    expect(summarise({ permissions: ["sales.view"] })).toBe("1 permission in 1 area");
    expect(summarise({})).toBe("0 permissions in 0 areas");
  });
});

describe("a person", () => {
  const good = { ...emptyPerson(), name: "Aisha Khan", email: "Aisha@Acc.Test", password: "a-long-password" };

  it("is valid when it has a name, an email, a password and a role", () => {
    expect(validatePerson(good, { isNew: true })).toEqual({});
  });

  it("is refused where the server would refuse it", () => {
    const v = (over) => validatePerson({ ...good, ...over }, { isNew: true });
    expect(v({ name: "A" }).name).toBeTruthy();
    expect(v({ email: "no" }).email).toBeTruthy();
    expect(v({ password: "short" }).password).toBeTruthy();
    expect(v({ role: "" }).role).toBeTruthy();
  });

  it("changing a person does not demand an email or a password, but a new password must be long enough", () => {
    expect(validatePerson({ ...good, email: "", password: "" }, { isNew: false })).toEqual({});
    expect(validatePerson({ ...good, password: "short" }, { isNew: false }).password).toBeTruthy();
  });

  it("builds a tidy body for a new person", () => {
    expect(newPersonPayload({ ...good, name: " Aisha Khan " })).toEqual({ name: "Aisha Khan", email: "aisha@acc.test", password: "a-long-password", role: "viewer", branchId: "main" });
  });

  it("sends only what changed", () => {
    const person = { id: "1", name: "Aisha", email: "a@x.test", role: { key: "accountant" }, branchId: "main", isActive: true };
    expect(personChanges(personFrom(person), person)).toEqual({});
    expect(personChanges({ ...personFrom(person), role: "sales", status: "inactive", password: "new-password-1" }, person)).toEqual({ role: "sales", status: "inactive", password: "new-password-1" });
    expect(personChanges({ ...personFrom(person), name: "Aisha K" }, person)).toEqual({ name: "Aisha K" });
  });

  it("only the roles a person may give are offered, and never one at or above their own", () => {
    const roles = [{ key: "owner", rank: 100, isActive: true }, { key: "admin", rank: 80, isActive: true }, { key: "manager", rank: 60, isActive: true }, { key: "off", rank: 30, isActive: false }, { key: "viewer", rank: 20, isActive: true }];
    expect(rolesToGive(roles, 80).map((r) => r.key)).toEqual(["manager", "viewer"]);
    expect(rolesToGive(roles, 100).map((r) => r.key)).toEqual(["owner", "admin", "manager", "viewer"]);
    expect(mayChange(80, 60)).toBe(true);
    expect(mayChange(80, 80)).toBe(false);
    expect(mayChange(100, 100)).toBe(true);
  });
});
