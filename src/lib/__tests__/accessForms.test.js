import { describe, it, expect } from "vitest";
import {
  effectiveOf, emptyPerson, emptyRole, impliedOf, isLocked, keyFromName, mayChange, minimal, newPersonPayload, personChanges, personFrom,
  holdsApprove, parseLimit, rankChoices, roleFrom, rolePayload, rolesToGive, serverField, serverMessage, summarise, ticksOf, toggle, toggleModule, validatePerson, validateRole,
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
    expect(rolePayload({ ...ok, name: " Sales supervisor ", description: " Approves " }, new Set(["sales.approve"]), { isNew: true })).toEqual({ key: "sales_supervisor", name: "Sales supervisor", description: "Approves", rank: 55, permissions: ["sales.approve"], approvalLimit: null });
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

describe("a role's approval limit", () => {
  const base = { ...emptyRole(), name: "Sales supervisor", key: "sales_supervisor", rank: 55 };
  const named = new Set(["sales.approve"]);

  it("is read from what was typed: empty is no limit, an amount is a number, anything else is not an amount", () => {
    expect(parseLimit("")).toBeNull();
    expect(parseLimit("   ")).toBeNull();
    expect(parseLimit(undefined)).toBeNull();
    expect(parseLimit("5000")).toBe(5000);
    expect(parseLimit(" 1,250.50 ")).toBe(1250.5);
    expect(parseLimit("0")).toBe(0);
    for (const bad of ["lots", "-5", "5 000", "1e3", "5."]) expect(Number.isNaN(parseLimit(bad))).toBe(true);
  });

  it("starts empty on a new role, and shows a stored limit as text", () => {
    expect(emptyRole().approvalLimit).toBe("");
    expect(roleFrom({ name: "A", key: "a", rank: 50, approvalLimit: 5000 }).approvalLimit).toBe("5000");
    expect(roleFrom({ name: "A", key: "a", rank: 50, approvalLimit: null }).approvalLimit).toBe("");
    expect(roleFrom({ name: "A", key: "a", rank: 50 }).approvalLimit).toBe("");
    expect(roleFrom({ name: "A", key: "a", rank: 50, approvalLimit: 0 }).approvalLimit).toBe("0");
  });

  it("is sent as a number, or as null when empty", () => {
    expect(rolePayload({ ...base, approvalLimit: "5000" }, named, { isNew: true }).approvalLimit).toBe(5000);
    expect(rolePayload({ ...base, approvalLimit: "" }, named, { isNew: true }).approvalLimit).toBeNull();
    expect(rolePayload({ ...base, approvalLimit: "0" }, named, { isNew: false }).approvalLimit).toBe(0);
  });

  it("is sent as null for a role that approves nothing, whatever the box held", () => {
    expect(rolePayload({ ...base, approvalLimit: "5000" }, new Set(["sales.view"]), { isNew: true, approves: false }).approvalLimit).toBeNull();
  });

  it("is refused before it is sent only when it is not an amount (the cap on it is the server's to judge)", () => {
    const v = (approvalLimit, opts = {}) => validateRole({ ...base, approvalLimit }, named, { isNew: true, myRank: 80, canGrant: () => true, ...opts });
    expect(v("").approvalLimit).toBeUndefined();
    expect(v("5000").approvalLimit).toBeUndefined();
    expect(v("lots").approvalLimit).toMatch(/amount of 0 or more/);
    expect(v("-5").approvalLimit).toMatch(/amount of 0 or more/);
    expect(v("lots", { approves: false }).approvalLimit).toBeUndefined(); // not asked for, so not checked
  });

  it("knows a role that approves from its permissions", () => {
    expect(holdsApprove(["sales.view", "sales.approve"])).toBe(true);
    expect(holdsApprove(new Set(["finance.approve"]))).toBe(true);
    expect(holdsApprove(["sales.view", "sales.create"])).toBe(false);
    expect(holdsApprove(undefined)).toBe(false);
  });

  it("a role list row says what an approving role may approve, and says nothing about one that does not", () => {
    expect(summarise({ permissions: ["sales.view", "sales.approve"], approvalLimit: 5000 })).toBe("2 permissions in 1 area · Approval: Up to 5,000.00 AED");
    expect(summarise({ permissions: ["sales.view", "sales.approve"], approvalLimit: null })).toBe("2 permissions in 1 area · Approval: No limit");
    expect(summarise({ permissions: ["sales.view", "sales.approve"] })).toBe("2 permissions in 1 area · Approval: No limit"); // a built-in role has none
    expect(summarise({ permissions: ["sales.view"], approvalLimit: 5000 })).toBe("1 permission in 1 area");
  });

  it("reads the server's refusal: its sentence, and the field it names", () => {
    const refusal = { message: "Request failed with status code 400", response: { data: { message: "A limit cannot be above your own (1000)", errorCode: "ROLE_INVALID", details: { field: "approvalLimit" } } } };
    expect(serverMessage(refusal)).toBe("A limit cannot be above your own (1000)");
    expect(serverField(refusal)).toBe("approvalLimit");
    expect(serverMessage(new Error("Network Error"))).toBe("Network Error");
    expect(serverField(new Error("Network Error"))).toBeNull();
    expect(serverField(null)).toBeNull();
    expect(serverMessage(undefined)).toBe("");
  });
});
