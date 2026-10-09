import { describe, it, expect } from "vitest";
import { branchChanges, branchFrom, codeFromName, emptyBranch, newBranchPayload, planNote, validateBranch } from "../branchForms";

describe("a branch code suggested from its name", () => {
  it("is the first word, short, lower-case and plain", () => {
    expect(codeFromName("Sharjah Warehouse")).toBe("sharjah");
    expect(codeFromName("  Dubai   Showroom ")).toBe("dubai");
    expect(codeFromName("Al-Quoz Depot")).toBe("alquoz");
    expect(codeFromName("Zürich Office")).toBe("zurich");
    expect(codeFromName("Extraordinarilylongname Branch").length).toBeLessThanOrEqual(10);
    expect(codeFromName("")).toBe("");
    expect(codeFromName("***")).toBe("");
  });
});

describe("a branch form", () => {
  const good = { ...emptyBranch(), code: "shj", name: "Sharjah Warehouse" };

  it("is good with a code and a name", () => {
    expect(validateBranch(good, { isNew: true })).toEqual({});
  });

  it("is refused where the server would refuse it", () => {
    const v = (over, isNew = true) => validateBranch({ ...good, ...over }, { isNew });
    expect(v({ code: "" }).code).toBeTruthy();
    expect(v({ code: "x" }).code).toBeTruthy(); // too short
    expect(v({ code: "A B" }).code).toBeTruthy();
    expect(v({ code: "-shj" }).code).toBeTruthy();
    expect(v({ code: "shj-" }).code).toBeTruthy();
    expect(v({ code: "a".repeat(21) }).code).toBeTruthy();
    expect(v({ code: "dxb-2" }).code).toBeUndefined();
    expect(v({ name: "  " }).name).toBeTruthy();
    expect(v({ name: "x".repeat(121) }).name).toBeTruthy();
    expect(v({ email: "no" }).email).toBeTruthy();
    expect(v({ email: "" }).email).toBeUndefined();
  });

  it("does not check the code of a branch that exists: it never changes", () => {
    expect(validateBranch({ ...good, code: "BAD CODE" }, { isNew: false })).toEqual({});
  });

  it("builds a tidy body for a new branch, the code in lower case", () => {
    expect(newBranchPayload({ ...good, code: " SHJ ", name: " Sharjah Warehouse ", city: " Sharjah ", phone: " 06 555 0000 " })).toEqual({
      code: "shj", name: "Sharjah Warehouse", addressLine1: "", city: "Sharjah", phone: "06 555 0000", email: "",
    });
  });

  it("sends only what changed, and never the code", () => {
    const existing = { code: "shj", name: "Sharjah Warehouse", address: { line1: "Industrial Area 3", city: "Sharjah" }, phone: "06 555 0000", email: "shj@co.test" };
    expect(branchChanges(branchFrom(existing), existing)).toEqual({});
    expect(branchChanges({ ...branchFrom(existing), name: "Sharjah Depot" }, existing)).toEqual({ name: "Sharjah Depot" });
    expect(branchChanges({ ...branchFrom(existing), city: " Ajman ", phone: "" }, existing)).toEqual({ city: "Ajman", phone: "" });
    expect(branchChanges({ ...branchFrom(existing), code: "other" }, existing)).toEqual({});
  });
});

describe("where the plan stands", () => {
  it("says a plan without the feature cannot add", () => {
    expect(planNote({ featureOn: false, limit: 5, used: 1 })).toEqual({ canAdd: false, text: "More than one branch is not included in your plan." });
  });

  it("says when every branch the plan allows is in use", () => {
    expect(planNote({ featureOn: true, limit: 3, used: 3 })).toEqual({ canAdd: false, text: "Your plan allows 3 branches and all are in use." });
    expect(planNote({ featureOn: true, limit: 1, used: 1 }).text).toBe("Your plan allows 1 branch and it is in use.");
  });

  it("allows another while there is room, and counts without a limit when there is none", () => {
    expect(planNote({ featureOn: true, limit: 5, used: 2 })).toEqual({ canAdd: true, text: "2 branches in use of 5" });
    expect(planNote({ featureOn: true, limit: null, used: 1 })).toEqual({ canAdd: true, text: "1 branch in use" });
  });

  it("treats an unknown plan as allowed: the server is the lock, a missing answer must not lock anyone out", () => {
    expect(planNote({ featureOn: undefined, limit: undefined, used: 1 }).canAdd).toBe(true);
  });
});
