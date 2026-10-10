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
import { tabAllowed } from "../../lib/permissions";

// Read the real router so a page added without a navigation entry fails here.
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const routerSrc = fs.readFileSync(path.join(srcDir, "router/index.jsx"), "utf8");
// Login, the 404 catch-all, the page a customer opens from an emailed link (/d/:token, outside the
// app shell and the session guard) and the developer console (/platform, its own sign-in and frame) have
// no navigation. Neither have the two pages reached while signed out: "forgot my password" and the emailed reset link.
const NON_APP = new Set(["/", "*", "/d/:token", "/platform/*", "/forgot-password", "/reset-password"]);
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
    ["/approvals", "home", "Approvals"],
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

// What a person's role holds comes from the server (status.me.grants); these are the lists the built-in roles expand to.
const grants = (...keys) => ({ me: { grants: keys } });
const allKeys = [...new Set(allTabs.flatMap(({ tab }) => [].concat(tab.permission || [])))];
const EVERYTHING = grants(...allKeys);
const SALES = grants("sales.view", "sales.create", "sales.edit", "sales.send", "inventory.view", "lookups.view", "reports.view");
const STOREKEEPER = grants("inventory.view", "inventory.create", "inventory.adjust", "sales.view", "purchase.view", "reports.view", "lookups.view");

describe("what a role may open", () => {
  it("shows everything while the person's role is not known, because the server is the lock and a missing answer must not lock anyone out", () => {
    expect(getVisibleModules(null).map((m) => m.id)).toEqual(MODULES.map((m) => m.id));
    expect(getVisibleModules({}).map((m) => m.id)).toEqual(MODULES.map((m) => m.id));
  });

  it("someone who holds everything sees every module", () => {
    expect(getVisibleModules(EVERYTHING).map((m) => m.id)).toEqual(MODULES.map((m) => m.id));
  });

  it("a storekeeper sees inventory and the stock reports, but not finance, the books or the people", () => {
    const modules = getVisibleModules(STOREKEEPER);
    const ids = modules.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["home", "inventory", "settings"]));
    for (const hidden of ["finance", "people"]) expect(ids).not.toContain(hidden);
    // the one Accounts page that follows the sales and purchase documents (customer and vendor paperwork), and nothing of the chart
    expect(modules.find((m) => m.id === "accounts").tabs.map((t) => t.label)).toEqual(["KYC documents"]);
    // (the e-invoicing page is open to whoever may see sales documents, as the server's own list of it is)
    expect(modules.find((m) => m.id === "reports").tabs.map((t) => t.label)).toEqual(["Ageing", "Account statement", "Stock", "e-Invoicing"]);
  });

  it("drops individual tabs the role cannot open, keeping the module", () => {
    const sales = getVisibleModules(SALES).find((m) => m.id === "sales");
    // Quotations, orders, delivery notes, returns and customers are sales paperwork; the receivables tab is the books,
    // which a sales executive does not hold, so it is not offered.
    expect(sales.tabs.map((t) => t.label)).toEqual(["Quotations", "Orders", "Delivery notes", "Returns", "Customers"]);
  });

  it("a role that holds nothing still keeps the open pages", () => {
    expect(getVisibleModules(grants()).map((m) => m.id)).toEqual(["settings"]);
  });

  it("any ONE of a tab's permissions is enough", () => {
    const viaFinance = getVisibleModules(grants("finance.view")).find((m) => m.id === "sales");
    expect(viaFinance.tabs.map((t) => t.label)).toEqual(["Receivables"]);
    const viaReports = getVisibleModules(grants("reports.financial")).find((m) => m.id === "sales");
    expect(viaReports.tabs.map((t) => t.label)).toEqual(["Receivables"]);
  });

  it("the Approvals tab is offered to anyone who may approve something in any module, and to nobody else", () => {
    const home = (g) => getVisibleModules(g).find((m) => m.id === "home")?.tabs.map((t) => t.label);
    expect(home(grants("reports.view"))).toEqual(["Dashboard"]);
    expect(home(grants("sales.view", "finance.create", "purchase.delete", "reports.view"))).toEqual(["Dashboard"]);
    for (const key of ["sales.approve", "purchase.approve", "finance.approve"]) expect(home(grants("reports.view", key))).toEqual(["Dashboard", "Approvals"]);
    expect(home(grants("finance.approve"))).toEqual(["Approvals"]); // an approver without the dashboard still has the list
    expect(allTabs.filter(({ tab }) => tab.badge).map(({ tab }) => [tab.label, tab.badge])).toEqual([["Approvals", "approvals"]]);
  });

  it("guarding is the default: every tab names what it needs, or says it is open and why", () => {
    for (const { module, tab } of allTabs) {
      const where = module.id + "/" + tab.label;
      if (tab.open) expect(String(tab.open).length, where + " needs a real reason").toBeGreaterThan(10);
      else {
        expect(tab.permission, where + " names no permission").toBeTruthy();
        for (const key of [].concat(tab.permission)) expect(key, where).toMatch(/^[a-z]+.[A-Za-z]+$/);
      }
    }
    expect(allTabs.filter(({ tab }) => tab.open).map(({ tab }) => tab.label)).toEqual(["Settings"]);
  });

  it("the cosmetic role names are gone: nothing asks for a role any more", () => {
    for (const { tab } of allTabs) expect(tab.roles).toBeUndefined();
  });

  it("a tab is refused once the role is known and does not hold what it needs", () => {
    expect(tabAllowed({ permission: "finance.view" }, { grants: ["sales.view"] })).toBe(false);
    expect(tabAllowed({ permission: "finance.view" }, { grants: ["finance.view"] })).toBe(true);
    expect(tabAllowed({}, { grants: ["finance.view"] })).toBe(false); // names nothing: refused
    expect(tabAllowed({ open: "reason given here" }, { grants: [] })).toBe(true);
    expect(tabAllowed({ permission: "finance.view" }, null)).toBe(true); // role unknown: nothing hidden
  });
});

describe("pageTitle", () => {
  it("includes the tab for multi-tab modules", () => {
    expect(pageTitle(findActive("/payment-voucher"), "Harbour Trading")).toBe(
      "Payments · Finance · Harbour Trading"
    );
  });

  it("omits the redundant tab for single-page modules", () => {
    // Settings is the single-page module now. People used to be one, until Users and roles was added beside Staff.
    expect(pageTitle(findActive("/settings"), "Harbour Trading")).toBe("Settings · Harbour Trading");
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
    const { primary, rest } = getMobileNav(getVisibleModules());
    expect(ids(primary)).toEqual(["home", "sales", "purchase", "finance"]);
    expect(ids(rest)).toEqual(["inventory", "accounts", "reports", "people", "settings"]);
  });

  it("splits every module into exactly one of the two", () => {
    const modules = getVisibleModules();
    const { primary, rest } = getMobileNav(modules);
    expect([...ids(primary), ...ids(rest)].sort()).toEqual(ids(modules).sort());
  });

  it("fills the bar from the remaining modules when a role cannot see a flagged one", () => {
    // An Accountant sees neither Sales' nor Purchase's order pages... but does see their
    // receivables and payables, so those modules survive. Use a role that loses one outright.
    const modules = getVisibleModules(grants("users.view", "reports.view"));
    const { primary } = getMobileNav(modules);
    expect(primary.length).toBe(Math.min(MOBILE_SLOTS, modules.filter((m) => m.placement !== "footer").length));
    expect(ids(primary)).toContain("home");
  });

  it("never pins a footer module - Settings belongs in the sheet", () => {
    const { primary, rest } = getMobileNav(getVisibleModules(grants("users.view", "reports.view")));
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
  const everything = tabs(getVisibleModules());

  it("every feature a tab names is one the server knows", () => {
    for (const { tab } of allTabs) if (tab.feature) expect(Object.keys(FEATURE_LABELS)).toContain(tab.feature);
  });

  it("hides nothing while the organisation status is not known", () => {
    expect(tabs(getVisibleModules(null))).toEqual(everything);
    expect(tabs(getVisibleModules({}))).toEqual(everything);
  });

  it("hides exactly the tabs whose feature is switched off", () => {
    const status = { features: { einvoicing: false, banking: false, quotations: true } };
    const shown = tabs(getVisibleModules(status));
    expect(shown).not.toContain("e-Invoicing@/e-invoicing");
    for (const t of ["Cheques@/cheques", "Banks@/banks", "Card types@/card-types", "Cards@/cards"]) expect(shown).not.toContain(t);
    expect(shown).toContain("Quotations@/quotations");
    expect(shown).toContain("Cash & bank@/cash-and-bank"); // chart-based, not the banking feature
    expect(shown).toContain("Orders@/sales-order");
  });

  it("drops every tab of a switched-off feature but keeps the module while it has others", () => {
    const off = Object.fromEntries(Object.keys(FEATURE_LABELS).map((k) => [k, false]));
    const modules = getVisibleModules({ features: off });
    expect(modules.map((m) => m.id)).toContain("sales");
    expect(tabs(modules).filter((t) => /Quotations|Delivery notes|Batches|Reconcile|IFRS|VAT|e-Invoicing/.test(t))).toEqual([]);
  });
});
