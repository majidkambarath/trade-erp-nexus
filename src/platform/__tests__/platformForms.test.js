import { describe, it, expect } from "vitest";
import {
  COUNTRIES,
  emptyOrganisation,
  featureChoice,
  featurePatch,
  featureResult,
  isoDay,
  limitChoice,
  limitPatch,
  limitText,
  provisioningIssues,
  stateLabel,
  subscriptionPatch,
  suggestPassword,
  toCreatePayload,
  validateNewOrganisation,
  withCountry,
} from "../platformForms";

const catalog = { currencies: [{ code: "AED" }, { code: "SAR" }, { code: "USD" }], unsupportedCurrencies: ["KWD", "BHD"] };
const filled = () => ({
  ...emptyOrganisation(),
  legalName: "Gulf Fresh Foods LLC",
  adminName: "Owner One",
  adminEmail: "Owner@GulfFresh.example",
  adminPassword: "a-long-password",
});

describe("creating an organisation", () => {
  it("a complete form has nothing wrong with it", () => {
    expect(validateNewOrganisation(filled(), catalog)).toEqual({});
  });

  it("says what is missing before anything is sent", () => {
    const errors = validateNewOrganisation(emptyOrganisation(), catalog);
    expect(Object.keys(errors).sort()).toEqual(["adminEmail", "adminName", "adminPassword", "legalName"]);
  });

  it("refuses a three-decimal currency with its reason, and a code the server would reject", () => {
    expect(validateNewOrganisation({ ...filled(), baseCurrency: "KWD" }, catalog).baseCurrency).toMatch(/three decimal places/);
    expect(validateNewOrganisation({ ...filled(), baseCurrency: "XYZ" }, catalog).baseCurrency).toMatch(/listed currencies/);
    expect(validateNewOrganisation({ ...filled(), code: "Bad Code" }, catalog).code).toBeTruthy();
    expect(validateNewOrganisation({ ...filled(), code: "gulf-fresh" }, catalog).code).toBeUndefined();
    expect(validateNewOrganisation({ ...filled(), adminEmail: "not an email" }, catalog).adminEmail).toBeTruthy();
    expect(validateNewOrganisation({ ...filled(), adminPassword: "short" }, catalog).adminPassword).toBeTruthy();
  });

  it("choosing a country offers its currency and timezone, which can still be changed", () => {
    const sa = withCountry(emptyOrganisation(), "SA");
    expect(sa).toMatchObject({ country: "SA", baseCurrency: "SAR", timezone: "Asia/Riyadh" });
    expect(withCountry(sa, "AE")).toMatchObject({ baseCurrency: "AED", timezone: "Asia/Dubai" });
    expect(withCountry(emptyOrganisation(), "ZZ").baseCurrency).toBe("AED"); // unknown country: nothing is guessed
    expect(COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c.code))).toBe(true);
  });

  it("builds the body the server expects, tidied", () => {
    expect(toCreatePayload({ ...filled(), code: " Gulf-Fresh " })).toEqual({
      legalName: "Gulf Fresh Foods LLC",
      code: "gulf-fresh",
      country: "AE",
      baseCurrency: "AED",
      timezone: "Asia/Dubai",
      planCode: "standard",
      firstAdmin: { name: "Owner One", email: "owner@gulffresh.example", password: "a-long-password" },
    });
    expect(toCreatePayload(filled())).not.toHaveProperty("code"); // blank: the server makes one from the name
  });

  it("suggests a password the server would accept", () => {
    for (let i = 0; i < 50; i += 1) {
      const p = suggestPassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/[0-9]/);
    }
  });
});

describe("features: the plan's setting or the developer's own", () => {
  const org = { featureOverrides: { einvoicing: true, banking: false } };

  it("reads the choice and what it means against the plan", () => {
    expect(featureChoice(org, "einvoicing")).toBe("on");
    expect(featureChoice(org, "banking")).toBe("off");
    expect(featureChoice(org, "quotations")).toBe("default");
    expect(featureChoice(null, "quotations")).toBe("default");
    expect(featureResult("on", false)).toBe(true);
    expect(featureResult("off", true)).toBe(false);
    expect(featureResult("default", true)).toBe(true);
    expect(featureResult("default", undefined)).toBe(false);
  });

  it("sends only what changed, and resets rather than storing a copy of the plan", () => {
    const patch = featurePatch(org, { einvoicing: "on", banking: "default", quotations: "off", messaging: "default" });
    expect(patch).toEqual({ featureOverrides: { quotations: false }, resetFeatures: ["banking"] });
    expect(featurePatch(org, { einvoicing: "on", banking: "off" })).toEqual({});
  });
});

describe("limits: the plan's number, one of its own, or none", () => {
  it("reads the choice", () => {
    const org = { limitOverrides: { users: null, branches: 5 } };
    expect(limitChoice(org, "users")).toBe("unlimited");
    expect(limitChoice(org, "branches")).toBe("number");
    expect(limitChoice(org, "documentsPerMonth")).toBe("default");
    expect(limitChoice({}, "users")).toBe("default");
  });

  it("builds each change, and refuses a number the server would", () => {
    expect(limitPatch("users", "default")).toEqual({ resetLimits: ["users"] });
    expect(limitPatch("users", "unlimited")).toEqual({ limitOverrides: { users: null } });
    expect(limitPatch("users", "number", "25")).toEqual({ limitOverrides: { users: 25 } });
    expect(limitPatch("users", "number", "0")).toEqual({ limitOverrides: { users: 0 } });
    expect(limitPatch("users", "number", "-1").error).toBeTruthy();
    expect(limitPatch("users", "number", "2.5").error).toBeTruthy();
  });

  it("writes a limit for a person", () => {
    expect(limitText(null)).toBe("Unlimited");
    expect(limitText(10)).toBe("10");
    expect(limitText(undefined)).toBe("-");
  });
});

describe("the subscription", () => {
  it("builds the body, with a blank date meaning it never ends", () => {
    expect(subscriptionPatch({ endsAt: "2026-12-31", graceDays: "7", onExpiry: "readonly" })).toEqual({ subscription: { endsAt: "2026-12-31", graceDays: 7, onExpiry: "readonly" } });
    expect(subscriptionPatch({ endsAt: "", graceDays: "", onExpiry: "block" })).toEqual({ subscription: { endsAt: null, graceDays: 0, onExpiry: "block" } });
    expect(subscriptionPatch({ endsAt: "", graceDays: "100", onExpiry: "block" }).error).toBeTruthy();
    expect(subscriptionPatch({ endsAt: "", graceDays: "1.5", onExpiry: "block" }).error).toBeTruthy();
  });

  it("shows a stored end date as a day", () => {
    expect(isoDay("2026-10-10T23:59:59.999Z")).toBe("2026-10-10");
    expect(isoDay(null)).toBe("");
  });

  it("labels each state with a tone", () => {
    expect(stateLabel({ state: "active", daysLeft: null })).toEqual({ text: "Active", tone: "success" });
    expect(stateLabel({ state: "active", daysLeft: 5 })).toEqual({ text: "Ends in 5 days", tone: "warning" });
    expect(stateLabel({ state: "active", daysLeft: 1 }).text).toBe("Ends in 1 day");
    expect(stateLabel({ state: "grace" })).toEqual({ text: "Grace period", tone: "warning" });
    expect(stateLabel({ state: "expired", onExpiry: "block" })).toEqual({ text: "Expired", tone: "danger" });
    expect(stateLabel({ state: "expired", onExpiry: "readonly" }).text).toBe("Expired (read-only)");
    expect(stateLabel({ state: "suspended" }).tone).toBe("danger");
    expect(stateLabel({ state: "closed" }).tone).toBe("neutral");
  });
});

describe("the set-up", () => {
  it("lists only what has not finished", () => {
    const provisioning = { steps: { settings: { state: "done" }, chart: { state: "failed", message: "boom" }, taxCodes: { state: "skipped" }, fiscalYear: { state: "pending" } } };
    expect(provisioningIssues(provisioning)).toEqual([
      { name: "chart", state: "failed", message: "boom" },
      { name: "fiscalYear", state: "pending", message: null },
    ]);
    expect(provisioningIssues(null)).toEqual([]);
  });
});
