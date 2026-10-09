import { describe, it, expect } from "vitest";
import { roleLabel, roleOptions } from "../platformForms";

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
