import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MOBILE_SLOTS,
  MODULES,
  findActive,
  getMobileNav,
  getVisibleModules,
  pageTitle,
  tabMatches,
} from "../navigation";
import { FEATURE_LABELS } from "../../lib/organisation";

// Read the real router so a page added without a navigation entry fails here.
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const routerSrc = fs.readFileSync(path.join(srcDir, "router/index.jsx"), "utf8");
// Login, the 404 catch-all, the page a customer opens from an emailed link (/d/:token, outside the
// app shell and the session guard) and the developer console (/platform, its own sign-in and frame) have
// no navigation.
const NON_APP = new Set(["/", "*", "/d/:token", "/platform/*"]);
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
    // Quotations and delivery notes are order paperwork, so they follow the order roles; the
    // receivables tab is for accountants only and stays hidden from a sales executive.
    expect(sales.tabs.map((t) => t.label)).toEqual(["Quotations", "Orders", "Delivery notes", "Returns", "Customers"]);
  });

  it("a role with no access at all still keeps unrestricted pages", () => {
    expect(getVisibleModules("Nobody").map((m) => m.id)).toEqual(["home", "settings"]);
  });
});

describe("pageTitle", () => {
  it("includes the tab for multi-tab modules", () => {
    expect(pageTitle(findActive("/payment-voucher"), "Harbour Trading")).toBe(
      "Payments · Finance · Harbour Trading"
    );
  });

  it("omits the redundant tab for single-page modules", () => {
    // Staff is the single-page module here. Reports used to be one, until e-Invoicing
    // was added alongside VAT.
    expect(pageTitle(findActive("/staff-records"), "Harbour Trading")).toBe("People · Harbour Trading");
  });

  it("includes the tab now that Reports has more than one page", () => {
    expect(pageTitle(findActive("/vat-reports"), "Harbour Trading")).toBe(
      "VAT · Reports · Harbour Trading"
    );
  });

  it("falls back to the app name for unmapped pages", () => {
    expect(pageTitle(null, "Harbour Trading")).toBe("Harbour Trading");
  });
});

describe("getMobileNav", () => {
  const ids = (list) => list.map((m) => m.id);

  it("pins the four flagged modules to the bar and leaves the rest behind More", () => {
    const { primary, rest } = getMobileNav(getVisibleModules("Admin"));
    expect(ids(primary)).toEqual(["home", "sales", "purchase", "finance"]);
    expect(ids(rest)).toEqual(["inventory", "accounts", "reports", "people", "settings"]);
  });

  it("splits every module into exactly one of the two", () => {
    const modules = getVisibleModules("Admin");
    const { primary, rest } = getMobileNav(modules);
    expect([...ids(primary), ...ids(rest)].sort()).toEqual(ids(modules).sort());
  });

  it("fills the bar from the remaining modules when a role cannot see a flagged one", () => {
    // An Accountant sees neither Sales' nor Purchase's order pages... but does see their
    // receivables and payables, so those modules survive. Use a role that loses one outright.
    const modules = getVisibleModules("HR");
    const { primary } = getMobileNav(modules);
    expect(primary.length).toBe(Math.min(MOBILE_SLOTS, modules.filter((m) => m.placement !== "footer").length));
    expect(ids(primary)).toContain("home");
  });

  it("never pins a footer module - Settings belongs in the sheet", () => {
    const { primary, rest } = getMobileNav(getVisibleModules("HR"));
    expect(ids(primary)).not.toContain("settings");
    expect(ids(rest)).toContain("settings");
  });

  it("leaves the bar short rather than repeating a module", () => {
    const one = [MODULES[0]];
    const { primary, rest } = getMobileNav(one);
    expect(ids(primary)).toEqual(["home"]);
    expect(rest).toEqual([]);
  });
});

describe("what the plan includes", () => {
  const tabs = (modules) => modules.flatMap((m) => m.tabs.map((t) => `${t.label}@${t.to}`));
  const everything = tabs(getVisibleModules("Admin"));

  it("every feature a tab names is one the server knows", () => {
    for (const { tab } of allTabs) if (tab.feature) expect(Object.keys(FEATURE_LABELS)).toContain(tab.feature);
  });

  it("hides nothing while the organisation status is not known", () => {
    expect(tabs(getVisibleModules("Admin", undefined, null))).toEqual(everything);
    expect(tabs(getVisibleModules("Admin", undefined, {}))).toEqual(everything);
  });

  it("hides exactly the tabs whose feature is switched off", () => {
    const status = { features: { einvoicing: false, banking: false, quotations: true } };
    const shown = tabs(getVisibleModules("Admin", undefined, status));
    expect(shown).not.toContain("e-Invoicing@/e-invoicing");
    for (const t of ["Cheques@/cheques", "Banks@/banks", "Card types@/card-types", "Cards@/cards"]) expect(shown).not.toContain(t);
    expect(shown).toContain("Quotations@/quotations");
    expect(shown).toContain("Cash & bank@/cash-and-bank"); // chart-based, not the banking feature
    expect(shown).toContain("Orders@/sales-order");
  });

  it("drops every tab of a switched-off feature but keeps the module while it has others", () => {
    const off = Object.fromEntries(Object.keys(FEATURE_LABELS).map((k) => [k, false]));
    const modules = getVisibleModules("Admin", undefined, { features: off });
    expect(modules.map((m) => m.id)).toContain("sales");
    expect(tabs(modules).filter((t) => /Quotations|Delivery notes|Batches|Reconcile|IFRS|VAT|e-Invoicing/.test(t))).toEqual([]);
  });
});
