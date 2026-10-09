import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setDateFormat } from "../../utils/format";
import { setOrgLocale } from "../../utils/orgLocale";
import {
  FEATURE_LABELS,
  blockedFrom,
  branchChoices,
  branchInUse,
  branchLabel,
  canViewAllBranches,
  featureLabel,
  featureOn,
  isBlockedError,
  isFeatureError,
  isLimitError,
  isReadOnlyError,
  planRefusalMessage,
  tabInPlan,
  validBranchSelection,
} from "../organisation";
import { blockedPageText, subscriptionNotice } from "../subscriptionText";

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

// A subscription's last day is shown as the person chose to read dates, and it is the day the developer entered: the server keeps it as
// 23:59:59.999 UTC of that day, which on the clock of an organisation east of UTC is already the next morning.
describe("the date a subscription ends", () => {
  const ends = { state: "expired", endsAt: E("2026-10-10") };
  beforeEach(() => { setDateFormat("DD/MM/YYYY"); setOrgLocale({ timezone: "Asia/Dubai" }); });
  afterEach(() => { setDateFormat("DD/MM/YYYY"); setOrgLocale({ timezone: "Asia/Dubai" }); });

  it("follows the date format the person chose", () => {
    expect(blockedPageText(ends).lead).toBe("It ended on 10/10/2026.");
    setDateFormat("DD MMM YYYY");
    expect(blockedPageText(ends).lead).toBe("It ended on 10 Oct 2026.");
    setDateFormat("YYYY-MM-DD");
    expect(blockedPageText(ends).lead).toBe("It ended on 2026-10-10.");
    setDateFormat("MM/DD/YYYY");
    expect(blockedPageText(ends).lead).toBe("It ended on 10/10/2026.");
    setDateFormat("DD-MM-YYYY");
    expect(blockedPageText({ state: "expired", endsAt: E("2026-03-04") }).lead).toBe("It ended on 04-03-2026.");
  });

  it("is the day it was entered, in any zone the product supports - never the next day", () => {
    setDateFormat("YYYY-MM-DD");
    for (const timezone of ["UTC", "Asia/Dubai", "Asia/Kolkata", "Asia/Kathmandu", "Europe/London", "Australia/Sydney", "Pacific/Auckland"]) {
      setOrgLocale({ timezone });
      expect(blockedPageText(ends).lead, timezone).toBe("It ended on 2026-10-10.");
    }
  });

  it("is the same day in every notice that names it", () => {
    setDateFormat("DD MMM YYYY");
    const sub = (over) => ({ state: "active", blocked: false, canRead: true, canWrite: true, endsAt: E("2026-10-10"), daysLeft: 5, ...over });
    expect(subscriptionNotice(sub({})).text).toMatch(/It runs to 10 Oct 2026\./);
    expect(subscriptionNotice(sub({ state: "grace", daysLeft: 3 })).text).toMatch(/It ended on 10 Oct 2026\./);
    expect(subscriptionNotice(sub({ state: "expired", canWrite: false })).text).toMatch(/It ended on 10 Oct 2026\./);
  });

  it("falls back to the plain sentence when the date cannot be read, rather than saying 'it ended on .'", () => {
    expect(blockedPageText({ state: "expired", endsAt: "not a date" }).lead).toBe("Access has been paused until it is renewed.");
    expect(blockedPageText({ state: "expired" }).lead).toBe("Access has been paused until it is renewed.");
  });
});

describe("the subscription notice", () => {
  beforeEach(() => setDateFormat("DD MMM YYYY"));
  afterEach(() => setDateFormat("DD/MM/YYYY"));
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
  beforeEach(() => setDateFormat("DD MMM YYYY"));
  afterEach(() => setDateFormat("DD/MM/YYYY"));
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

  it("says where the person is working, even when there is only the head office", () => {
    expect(branchLabel(headOffice, null)).toBe("All branches");
    expect(branchLabel(headOffice, "shj")).toBe("Sharjah Warehouse");
    expect(branchLabel(headOffice, "gone")).toBe("All branches");
    expect(branchLabel(branchUser, "main")).toBe("Sharjah Warehouse"); // a branch user is always in their own
    expect(branchLabel({ branches: [branches[0]], branch: { name: "Head office", canSwitch: false } }, null)).toBe("Head office");
    expect(branchLabel(null, null)).toBeNull();
  });
});

describe("working in one branch at a time (canViewAll: false)", () => {
  const branches = [
    { code: "main", name: "Head office", isHeadOffice: true },
    { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false },
    { code: "dxb", name: "Dubai Depot", isHeadOffice: false },
  ];
  // a head-office manager who is a viewer in Sharjah: the server lists every branch, and takes the all-branches view away
  const byBranch = { branches, branch: { code: "main", name: "Head office", isHeadOffice: true, canSwitch: true, canViewAll: false } };
  // a Sharjah clerk who was given Dubai: the server lists the two
  const clerk = { branches: [branches[1], branches[2]], branch: { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false, canSwitch: true, canViewAll: false } };
  const older = { branches, branch: { code: "main", name: "Head office", isHeadOffice: true, canSwitch: true } }; // a server that does not say

  it("only an explicit false takes the all-branches view away", () => {
    expect(canViewAllBranches(byBranch)).toBe(false);
    expect(canViewAllBranches({ ...older, branch: { ...older.branch, canViewAll: true } })).toBe(true);
    expect(canViewAllBranches(older)).toBe(true); // an older server: as it has always been
    expect(canViewAllBranches(null)).toBe(true);
  });

  it("offers every listed branch and no 'All branches'", () => {
    expect(branchChoices(byBranch)).toEqual([
      { value: "main", label: "Head office" },
      { value: "shj", label: "Sharjah Warehouse" },
      { value: "dxb", label: "Dubai Depot" },
    ]);
  });

  it("offers a branch person exactly the branches the server lists", () => {
    expect(branchChoices(clerk)).toEqual([
      { value: "shj", label: "Sharjah Warehouse" },
      { value: "dxb", label: "Dubai Depot" },
    ]);
  });

  it("still offers All branches, first, when the server does not say (or says yes)", () => {
    expect(branchChoices(older)[0]).toEqual({ value: "", label: "All branches" });
    expect(branchChoices({ ...older, branch: { ...older.branch, canViewAll: true } })[0]).toEqual({ value: "", label: "All branches" });
  });

  it("drops a remembered all-branches view, and keeps a branch that is one of theirs", () => {
    expect(validBranchSelection(byBranch, "all")).toBeNull();
    expect(validBranchSelection(byBranch, "")).toBeNull();
    expect(validBranchSelection(byBranch, "shj")).toBe("shj");
    expect(validBranchSelection(clerk, "dxb")).toBe("dxb");
    expect(validBranchSelection(clerk, "main")).toBeNull(); // not one they were given
  });

  it("names the branch in use instead of 'All branches'", () => {
    expect(branchLabel(byBranch, null)).toBe("Head office");
    expect(branchLabel(byBranch, "all")).toBe("Head office");
    expect(branchLabel(byBranch, "shj")).toBe("Sharjah Warehouse");
    expect(branchLabel(clerk, null)).toBe("Sharjah Warehouse");
    expect(branchLabel(clerk, "dxb")).toBe("Dubai Depot");
    expect(branchLabel(older, null)).toBe("All branches"); // unchanged for a server that does not say
  });

  it("says which choice is in use: theirs, else the branch the server put them in, else all", () => {
    expect(branchInUse(byBranch, null)).toBe("main");
    expect(branchInUse(byBranch, "shj")).toBe("shj");
    expect(branchInUse(clerk, null)).toBe("shj");
    expect(branchInUse(clerk, "dxb")).toBe("dxb");
    expect(branchInUse(older, null)).toBe("");
    expect(branchInUse(older, "shj")).toBe("shj");
    expect(branchInUse(null, null)).toBe("");
  });
});
