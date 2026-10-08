import { describe, it, expect } from "vitest";
import {
  FEATURE_LABELS,
  blockedFrom,
  blockedPageText,
  branchChoices,
  branchLabel,
  featureLabel,
  featureOn,
  isBlockedError,
  isFeatureError,
  isLimitError,
  isReadOnlyError,
  planRefusalMessage,
  subscriptionNotice,
  tabInPlan,
  validBranchSelection,
} from "../organisation";

const refused = (status, errorCode, details, message = "No.") => ({ response: { status, data: { success: false, errorCode, message, details } } });
const E = (s) => `${s}T23:59:59.999Z`;

describe("recognising the server's refusals", () => {
  it("tells a blocked organisation from any other 403", () => {
    expect(isBlockedError(refused(403, "ORGANISATION_EXPIRED"))).toBe(true);
    expect(isBlockedError(refused(403, "ORGANISATION_SUSPENDED"))).toBe(true);
    expect(isBlockedError(refused(403, "ORGANISATION_CLOSED"))).toBe(true);
    expect(isBlockedError(refused(403, "INSUFFICIENT_PERMISSIONS"))).toBe(false);
    expect(isBlockedError(refused(500, "ORGANISATION_EXPIRED"))).toBe(false);
    expect(isBlockedError(new Error("network"))).toBe(false);
    expect(isBlockedError(null)).toBe(false);
  });

  it("reads why, since when and who to ask out of a blocked refusal", () => {
    const b = blockedFrom(
      refused(403, "ORGANISATION_EXPIRED", { state: "expired", endsAt: E("2026-10-10"), contact: "help@zarvia.example", organisation: "Acme LLC" }, "The subscription ended on 2026-10-10.")
    );
    expect(b).toMatchObject({ code: "ORGANISATION_EXPIRED", state: "expired", contact: "help@zarvia.example", organisation: "Acme LLC", message: "The subscription ended on 2026-10-10." });
    expect(blockedFrom(refused(403, "ORGANISATION_SUSPENDED")).contact).toBeNull();
    expect(blockedFrom(refused(403, "NOPE"))).toBeNull();
  });

  it("recognises the plan, limit and read-only refusals and passes the server's words on", () => {
    expect(isFeatureError(refused(403, "FEATURE_NOT_IN_PLAN"))).toBe(true);
    expect(isLimitError(refused(403, "LIMIT_REACHED"))).toBe(true);
    expect(isReadOnlyError(refused(403, "ORGANISATION_READ_ONLY"))).toBe(true);
    expect(planRefusalMessage(refused(403, "LIMIT_REACHED", {}, "This organisation is limited to 2 users and already has 2."))).toMatch(/limited to 2 users/);
    expect(planRefusalMessage(refused(403, "INSUFFICIENT_PERMISSIONS"))).toBeNull();
  });
});

describe("what the plan includes", () => {
  const status = { features: { quotations: true, einvoicing: false } };

  it("only an explicit no hides anything", () => {
    expect(featureOn(status, "einvoicing")).toBe(false);
    expect(featureOn(status, "quotations")).toBe(true);
    expect(featureOn(status, "banking")).toBe(true); // not mentioned: not hidden
    expect(featureOn(null, "einvoicing")).toBe(true); // unknown (loading, or unreachable): not hidden
    expect(featureOn({}, "einvoicing")).toBe(true);
    expect(featureOn(status, undefined)).toBe(true); // a tab with no feature is always in the plan
  });

  it("a tab is in the plan when it names no feature or its feature is on", () => {
    expect(tabInPlan({ label: "Orders" }, status)).toBe(true);
    expect(tabInPlan({ label: "Quotations", feature: "quotations" }, status)).toBe(true);
    expect(tabInPlan({ label: "e-Invoicing", feature: "einvoicing" }, status)).toBe(false);
  });

  it("every feature has a plain name", () => {
    for (const key of Object.keys(FEATURE_LABELS)) expect(featureLabel(key)).toBeTruthy();
    expect(featureLabel("somethingNew")).toBe("somethingNew");
  });
});

describe("the subscription notice", () => {
  const sub = (over) => ({ state: "active", blocked: false, canRead: true, canWrite: true, endsAt: E("2026-10-10"), daysLeft: 30, ...over });

  it("says nothing while there is plenty of time, or no end date, or nothing is known", () => {
    expect(subscriptionNotice(sub({ daysLeft: 30 }))).toBeNull();
    expect(subscriptionNotice(sub({ endsAt: null, daysLeft: null }))).toBeNull();
    expect(subscriptionNotice(null)).toBeNull();
    expect(subscriptionNotice(undefined)).toBeNull();
  });

  it("warns in the last fortnight, more sharply in the last three days", () => {
    const week = subscriptionNotice(sub({ daysLeft: 6 }));
    expect(week.tone).toBe("info");
    expect(week.title).toBe("Your subscription ends in 6 days");
    expect(week.text).toMatch(/10 Oct 2026/);
    const soon = subscriptionNotice(sub({ daysLeft: 2 }));
    expect(soon.tone).toBe("warning");
    expect(subscriptionNotice(sub({ daysLeft: 1 })).title).toBe("Your subscription ends in 1 day");
  });

  it("says plainly when it is in its grace period and when it has gone read-only", () => {
    const grace = subscriptionNotice(sub({ state: "grace", daysLeft: 3 }));
    expect(grace.tone).toBe("warning");
    expect(grace.text).toMatch(/3 more days/);
    const ro = subscriptionNotice(sub({ state: "expired", canWrite: false }));
    expect(ro.tone).toBe("danger");
    expect(ro.text).toMatch(/nothing can be changed/);
  });

  it("is not the blocked page's job: a blocked organisation gets no notice", () => {
    expect(subscriptionNotice(sub({ state: "expired", blocked: true }))).toBeNull();
  });
});

describe("the blocked page wording", () => {
  it("names the reason", () => {
    expect(blockedPageText({ state: "suspended" }).title).toBe("This account is suspended");
    expect(blockedPageText({ state: "closed" }).title).toBe("This account is closed");
    const expired = blockedPageText({ state: "expired", endsAt: E("2026-10-10") });
    expect(expired.title).toBe("Your subscription has ended");
    expect(expired.lead).toBe("It ended on 10 Oct 2026.");
    expect(blockedPageText({ state: "expired" }).lead).toMatch(/until it is renewed/);
  });
});

describe("working in a branch", () => {
  const branches = [
    { code: "main", name: "Head office", isHeadOffice: true },
    { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false },
  ];
  const headOffice = { branches, branch: { code: "main", name: "Head office", isHeadOffice: true, canSwitch: true } };
  const branchUser = { branches, branch: { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false, canSwitch: false } };

  it("offers a head-office user every branch and all of them together", () => {
    expect(branchChoices(headOffice)).toEqual([
      { value: "", label: "All branches" },
      { value: "main", label: "Head office" },
      { value: "shj", label: "Sharjah Warehouse" },
    ]);
  });

  it("offers nothing to anyone else, or in an organisation with one branch", () => {
    expect(branchChoices(branchUser)).toEqual([]);
    expect(branchChoices({ branches: [branches[0]], branch: { canSwitch: true } })).toEqual([]);
    expect(branchChoices(null)).toEqual([]);
  });

  it("keeps a remembered choice only while it is still one the person can make", () => {
    expect(validBranchSelection(headOffice, "shj")).toBe("shj");
    expect(validBranchSelection(headOffice, "gone")).toBeNull();
    expect(validBranchSelection(headOffice, "")).toBeNull();
    expect(validBranchSelection(branchUser, "shj")).toBeNull(); // not theirs to choose
    expect(validBranchSelection(null, "shj")).toBeNull();
  });

  it("says where the person is working, and says nothing for a single branch", () => {
    expect(branchLabel(headOffice, null)).toBe("All branches");
    expect(branchLabel(headOffice, "shj")).toBe("Sharjah Warehouse");
    expect(branchLabel(headOffice, "gone")).toBe("All branches");
    expect(branchLabel(branchUser, "main")).toBe("Sharjah Warehouse"); // a branch user is always in their own
    expect(branchLabel({ branches: [branches[0]], branch: { name: "Head office" } }, null)).toBeNull();
    expect(branchLabel(null, null)).toBeNull();
  });
});
