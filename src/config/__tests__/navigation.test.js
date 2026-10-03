import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MODULES,
  findActive,
  getVisibleModules,
  pageTitle,
  tabMatches,
} from "../navigation";

// Read the real router so a page added without a navigation entry fails here.
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const routerSrc = fs.readFileSync(path.join(srcDir, "router/index.jsx"), "utf8");
const NON_APP = new Set(["/", "*"]); // login and the 404 catch-all have no navigation
const routes = [...routerSrc.matchAll(/path="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((p) => !NON_APP.has(p));

// "/stock-detail/:id" -> "/stock-detail/123" so it can be matched like a real URL
const concrete = (route) => route.replace(/:[^/]+/g, "123");
const allTabs = MODULES.flatMap((m) => m.tabs.map((t) => ({ module: m, tab: t })));

describe("route coverage", () => {
  it("found the app routes in the router", () => {
    expect(routes.length).toBeGreaterThanOrEqual(25);
  });

  it.each(routes)("%s belongs to exactly one module tab", (route) => {
    const url = concrete(route);
    const owners = allTabs.filter(({ tab }) => tabMatches(tab, url));
    expect(owners.map((o) => `${o.module.id}/${o.tab.label}`)).toHaveLength(1);
  });

  it("every tab points at a real route", () => {
    for (const { tab } of allTabs) expect(routes).toContain(tab.to);
  });

  it("module ids are unique", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("findActive", () => {
  it.each([
    ["/dashboard", "home", "Dashboard"],
    ["/payment-voucher", "finance", "Payments"],
    ["/stock-detail/abc123", "inventory", "Stock Items"],
    ["/debit-accounts/vendor/v1", "purchase", "Payables"],
    ["/credit-accounts/customer/c1", "sales", "Receivables"],
    ["/settings", "settings", "Settings"],
  ])("%s -> %s / %s", (url, moduleId, tabLabel) => {
    const active = findActive(url);
    expect(active.module.id).toBe(moduleId);
    expect(active.tab.label).toBe(tabLabel);
  });

  it("does not treat a shared prefix as a match", () => {
    // /sales-order must not be claimed by a hypothetical /sales route, and vice versa
    expect(findActive("/sales-orderx")).toBeNull();
  });

  it("returns null for an unmapped path", () => {
    expect(findActive("/no-such-page")).toBeNull();
  });
});

describe("role filtering", () => {
  it("Admin sees every module", () => {
    expect(getVisibleModules("Admin").map((m) => m.id)).toEqual(MODULES.map((m) => m.id));
  });

  it("an Accountant sees finance and reports but not inventory or people", () => {
    const ids = getVisibleModules("Accountant").map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["home", "finance", "reports", "settings"]));
    expect(ids).not.toContain("inventory");
    expect(ids).not.toContain("people");
  });

  it("drops individual tabs the role cannot open, keeping the module", () => {
    const sales = getVisibleModules("Sales Executive").find((m) => m.id === "sales");
    expect(sales.tabs.map((t) => t.label)).toEqual(["Orders", "Returns", "Customers"]);
  });

  it("a role with no access at all still keeps unrestricted pages", () => {
    expect(getVisibleModules("Nobody").map((m) => m.id)).toEqual(["home", "settings"]);
  });
});

describe("pageTitle", () => {
  it("includes the tab for multi-tab modules", () => {
    expect(pageTitle(findActive("/payment-voucher"), "NH FOODS")).toBe(
      "Payments · Finance · NH FOODS"
    );
  });

  it("omits the redundant tab for single-page modules", () => {
    expect(pageTitle(findActive("/vat-reports"), "NH FOODS")).toBe("Reports · NH FOODS");
  });

  it("falls back to the app name for unmapped pages", () => {
    expect(pageTitle(null, "NH FOODS")).toBe("NH FOODS");
  });
});
