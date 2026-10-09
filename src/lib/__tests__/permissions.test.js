import { describe, it, expect } from "vitest";
import { can, canAny, deleteKey, isPostedDocument, notAllowedText, planBulkDelete, postedDeleteText, roleName, skippedPostedText, tabAllowed } from "../permissions";
import { isPermissionError, planRefusalMessage } from "../organisation";
import { allowActions } from "../salesDocuments";

const me = (...grants) => ({ role: { key: "sales", name: "Sales executive" }, grants });
const refused = (code, message = "No.") => ({ response: { status: 403, data: { success: false, errorCode: code, message } } });

describe("can and canAny", () => {
  it("answer from what the server says the person holds", () => {
    expect(can(me("sales.view"), "sales.view")).toBe(true);
    expect(can(me("sales.view"), "sales.approve")).toBe(false);
    expect(canAny(me("sales.view"), ["sales.approve", "sales.view"])).toBe(true);
    expect(canAny(me("sales.view"), ["finance.view", "sales.approve"])).toBe(false);
  });

  it("hide nothing while the role is not known, because the server is the lock", () => {
    for (const unknown of [null, undefined, {}, { role: null }]) {
      expect(can(unknown, "finance.approve")).toBe(true);
      expect(canAny(unknown, ["finance.approve"])).toBe(true);
    }
  });

  it("a person who holds nothing is refused everything, which is different from not knowing", () => {
    expect(can(me(), "sales.view")).toBe(false);
    expect(canAny(me(), ["sales.view"])).toBe(false);
  });

  it("a question that names nothing is refused once the role is known", () => {
    expect(canAny(me("sales.view"), [])).toBe(false);
    expect(canAny(me("sales.view"), undefined)).toBe(false);
    expect(canAny(me("sales.view"), [undefined, null])).toBe(false);
  });
});

describe("a tab", () => {
  it("is open when it says so, or when the role holds any one of the permissions it names", () => {
    expect(tabAllowed({ open: "everyone has a password" }, me())).toBe(true);
    expect(tabAllowed({ permission: ["finance.view", "reports.financial"] }, me("reports.financial"))).toBe(true);
    expect(tabAllowed({ permission: "finance.view" }, me("sales.view"))).toBe(false);
  });

  it("that names nothing and is not open is refused: guarding is the default", () => {
    expect(tabAllowed({ label: "Forgotten" }, me("sales.view"))).toBe(false);
    expect(tabAllowed({ label: "Forgotten" }, null)).toBe(true); // ...but only once the role is known
  });
});

describe("the not-allowed page", () => {
  it("names the role and what was needed", () => {
    expect(roleName(me())).toBe("Sales executive");
    expect(roleName({ role: { key: "lead" } })).toBe("lead");
    expect(roleName(null)).toBeNull();
    const t = notAllowedText(me(), ["finance.view", "reports.financial"]);
    expect(t.title).toMatch(/do not have access/);
    expect(t.lead).toContain("Sales executive");
    expect(t.need).toEqual(["finance.view", "reports.financial"]);
    expect(notAllowedText(null, undefined).need).toBeNull();
    expect(notAllowedText(null, undefined).lead).toMatch(/Your role does not include it/);
  });
});

describe("the server's refusal", () => {
  it("is recognised, and its own sentence is passed on", () => {
    expect(isPermissionError(refused("PERMISSION_DENIED"))).toBe(true);
    expect(isPermissionError(refused("LIMIT_REACHED"))).toBe(false);
    expect(isPermissionError({ response: { status: 500, data: { errorCode: "PERMISSION_DENIED" } } })).toBe(false);
    expect(planRefusalMessage(refused("PERMISSION_DENIED", "Your role (Viewer) does not allow this."))).toBe("Your role (Viewer) does not allow this.");
    expect(planRefusalMessage(refused("SOMETHING_ELSE"))).toBeNull();
  });
});

describe("what a role may do to a quotation or a delivery note", () => {
  const state = { edit: true, delete: true, send: true, accept: true, reject: true, convert: true, dispatch: false, deliver: true, cancel: true, invoice: true, revise: true };

  it("narrows what the document's state allows to what the role holds", () => {
    const clerk = allowActions(state, me("sales.create", "sales.edit", "sales.send", "sales.view"));
    expect(clerk).toMatchObject({ edit: true, send: true, revise: true, delete: false, accept: false, reject: false, convert: false, deliver: false, cancel: false, invoice: false });
    const manager = allowActions(state, me("sales.create", "sales.edit", "sales.send", "sales.approve", "sales.delete"));
    expect(manager).toMatchObject({ edit: true, delete: true, accept: true, convert: true, deliver: true, invoice: true });
  });

  it("keeps Add and Edit apart: someone who may add but not change is offered a new version, never an edit", () => {
    const adder = allowActions(state, me("sales.create", "sales.view"));
    expect(adder).toMatchObject({ edit: false, revise: true });
    const editor = allowActions(state, me("sales.edit", "sales.view"));
    expect(editor).toMatchObject({ edit: true, revise: false });
  });

  it("never offers what the state itself does not allow, whatever the role holds", () => {
    expect(allowActions(state, me("sales.approve")).dispatch).toBe(false);
  });

  it("changes nothing while the role is not known, and copes with no actions at all", () => {
    expect(allowActions(state, null).accept).toBe(true);
    expect(allowActions(state, null).dispatch).toBe(false);
    expect(allowActions(undefined, me("sales.view"))).toEqual({});
  });
});

// Deleting an approved document reverses its stock and ledger postings, so the server makes it its own permission
// (byDocumentDelete / byVoucherDelete: the STORED status decides). The screens mirror it with these.
describe("deleteKey", () => {
  it("asks for deletePosted on a posted document and for plain delete on anything else", () => {
    expect(deleteKey("sales", true)).toBe("sales.deletePosted");
    expect(deleteKey("sales", false)).toBe("sales.delete");
    expect(deleteKey("purchase", true)).toBe("purchase.deletePosted");
    expect(deleteKey("purchase", false)).toBe("purchase.delete");
    expect(deleteKey("finance", true)).toBe("finance.deletePosted");
    expect(deleteKey("finance")).toBe("finance.delete");
  });

  it("keys the rule to the stored status APPROVED, and to nothing else", () => {
    expect(isPostedDocument({ status: "APPROVED" })).toBe(true);
    for (const status of ["DRAFT", "REJECTED", "CANCELLED", "approved", undefined]) expect(isPostedDocument({ status })).toBe(false);
    expect(isPostedDocument(undefined)).toBe(false);
  });
});

describe("planBulkDelete", () => {
  const docs = [
    { id: "d1", status: "DRAFT" },
    { id: "a1", status: "APPROVED" },
    { id: "a2", status: "APPROVED" },
    { id: "r1", status: "REJECTED" },
  ];

  it("leaves approved documents out for someone without deletePosted, and counts them", () => {
    expect(planBulkDelete(["d1", "a1", "r1", "a2"], docs, false)).toEqual({ deletable: ["d1", "r1"], skipped: ["a1", "a2"], posted: 0 });
  });

  it("sends everything for someone who holds deletePosted, and counts the approved ones it will reverse", () => {
    expect(planBulkDelete(["d1", "a1", "a2"], docs, true)).toEqual({ deletable: ["d1", "a1", "a2"], skipped: [], posted: 2 });
  });

  it("a selection of approved documents only leaves nothing to delete for someone without it", () => {
    const plan = planBulkDelete(["a1", "a2"], docs, false);
    expect(plan.deletable).toEqual([]);
    expect(plan.skipped).toEqual(["a1", "a2"]);
  });

  it("keeps an id the list does not hold (its status is not known; the server answers for it) and copes with nothing", () => {
    expect(planBulkDelete(["ghost"], docs, false).deletable).toEqual(["ghost"]);
    expect(planBulkDelete(undefined, undefined, false)).toEqual({ deletable: [], skipped: [], posted: 0 });
  });

  it("says plainly how many were left alone and why, and what deleting an approved one does", () => {
    expect(skippedPostedText(1)).toBe("1 approved document was left alone: deleting an approved document needs the Delete approved permission.");
    expect(skippedPostedText(3)).toBe("3 approved documents were left alone: deleting an approved document needs the Delete approved permission.");
    expect(postedDeleteText(1)).toMatch(/1 of them is approved: deleting it REVERSES its stock and ledger postings/);
    expect(postedDeleteText(2)).toMatch(/2 of them are approved: deleting those REVERSES their stock and ledger postings/);
  });
});
