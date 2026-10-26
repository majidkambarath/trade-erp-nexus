import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ERP,
  ERP_MODULES,
  MOBILE_SLOTS,
  MODULES,
  findActive,
  getMobileNav,
  getVisibleModules,
  modulesIn,
  offeredWorkspaces,
  pageTitle,
  tabMatches,
  workspaceInUse,
} from "../navigation";
import { FEATURE_LABELS } from "../../lib/organisation";
import { tabAllowed } from "../../lib/permissions";

// Read the real router so a page added without a navigation entry fails here.
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const routerSrc = fs.readFileSync(path.join(srcDir, "router/index.jsx"), "utf8");
// Login, the 404 catch-all, the page a customer opens from an emailed link (/d/:token, outside the
// app shell and the session guard) and the developer console (/platform, its own sign-in and frame) have
// no navigation. Neither have the two pages reached while signed out: "forgot my password" and the emailed reset link.
// ...and the address Google returns the browser to after a person connects their calendar, which is a machine
// redirect rather than a page anybody opens.
const NON_APP = new Set(["/", "*", "/d/:token", "/platform/*", "/forgot-password", "/reset-password", "/crm/google/callback"]);
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

  // The rail is 88px wide and the bottom bar is a quarter of a phone, so a module's rail name has to be a short
  // word. "Communications" bled straight over the edge of the rail; `short` is how a long name says itself there.
  // Ten characters is "Follow-ups", which fits; anything longer needs a `short`.
  it("every module has a name short enough for the rail", () => {
    const tooLong = MODULES.map((m) => m.short || m.label).filter((name) => name.length > 10);
    expect(tooLong).toEqual([]);
  });

  it("a short name is only ever an abbreviation, never a different word", () => {
    for (const m of MODULES.filter((x) => x.short)) {
      // "Comms" for "Communications": the rail must not say one thing and the page another.
      expect(m.label.toLowerCase().startsWith(m.short.toLowerCase().slice(0, 3))).toBe(true);
    }
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
    ["/sales-orders", "sales", "Orders"],
    ["/sales-order", "sales", "Invoices"],
    ["/delivery-notes", "sales", "Delivery notes"],
    ["/purchase-orders", "purchase", "Orders"],
    ["/goods-received", "purchase", "Goods received"],
    ["/purchase-order", "purchase", "Invoices"],
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
    expect(modules.find((m) => m.id === "reports").tabs.map((t) => t.label)).toEqual(["Analysis", "Ageing", "Account statement", "Stock", "e-Invoicing"]);
  });

  it("drops individual tabs the role cannot open, keeping the module", () => {
    const sales = getVisibleModules(SALES).find((m) => m.id === "sales");
    // Quotations, orders, delivery notes, invoices, returns and customers are sales paperwork; the receivables tab is the books,
    // which a sales executive does not hold, so it is not offered.
    expect(sales.tabs.map((t) => t.label)).toEqual(["Quotations", "Orders", "Delivery notes", "Invoices", "Returns", "Customers"]);
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
    // In module order: Home's approvals, the CRM's own follow-ups, then the process steps given to a person.
    expect(allTabs.filter(({ tab }) => tab.badge).map(({ tab }) => [tab.label, tab.badge])).toEqual([
      ["Approvals", "approvals"],
      ["Follow-ups", "crmFollowUps"],
      ["Production", "myWork"],
    ]);
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

  // The bottom bar belongs to the workspace being worked in, so it is fed that workspace's modules (Layout.jsx does
  // the same). The ERP's bar is exactly what it has always been; the CRM has a bar of its own.
  it("pins the four flagged modules to the bar and leaves the rest behind More", () => {
    const { primary, rest } = getMobileNav(modulesIn(ERP, getVisibleModules()));
    expect(ids(primary)).toEqual(["home", "sales", "purchase", "finance"]);
    expect(ids(rest)).toEqual(["inventory", "garage", "accounts", "reports", "people", "settings"]);
  });

  it("gives the CRM workspace its own bar, with no ERP page on it", () => {
    const { primary, rest } = getMobileNav(modulesIn("crm", getVisibleModules()));
    expect(ids(primary)).toEqual(["crm-dashboard", "crm-leads", "crm-contacts", "crm-pipeline"]);
    expect(ids(rest)).toEqual(["crm-communications", "crm-follow-ups", "crm-calendar", "crm-reports", "crm-setup"]);
  });

  it("splits every module into exactly one of the two", () => {
    const modules = modulesIn(ERP, getVisibleModules());
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
    expect(shown).toContain("Orders@/sales-orders");
  });

  it("drops every tab of a switched-off feature but keeps the module while it has others", () => {
    const off = Object.fromEntries(Object.keys(FEATURE_LABELS).map((k) => [k, false]));
    const modules = getVisibleModules({ features: off });
    expect(modules.map((m) => m.id)).toContain("sales");
    expect(tabs(modules).filter((t) => /Quotations|Delivery notes|Batches|Reconcile|IFRS|VAT|e-Invoicing/.test(t))).toEqual([]);
  });
});

// ---- the switch between the ERP and the CRM: organisation first, then person ------------------------------------------
//
// Four people, one rule. The organisation's plan decides whether the CRM exists for anybody in it; the person's role then
// decides whether THEY can open any of it. The switch appears only when both halves are open to the same person.
describe("which workspaces a person is offered", () => {
  // `crm` is what the server says the organisation bought (status.modules.crm.on); `keys` is what the role holds AFTER
  // the server has capped it to that (status.me.grants), exactly as the real status arrives.
  const as = (keys, crm = true) => ({ me: { grants: keys }, modules: { crm: { on: crm } } });
  const offered = (status) => offeredWorkspaces(getVisibleModules(status), status).map((w) => w.id);

  const CRM_KEYS = ["crm.view", "crm.create", "crm.edit", "crm.manage"];
  const OWNER = as([...allKeys, ...CRM_KEYS]);

  it("an organisation that did not buy the CRM has the ERP and nothing to switch to, whoever the person is", () => {
    // the Owner of a Standard-plan organisation: every ERP permission, and the server has already capped away crm.*
    expect(offered(as(allKeys.filter((k) => !k.startsWith("crm.")), false))).toEqual(["erp"]);
  });

  it("an organisation that bought the CRM offers both to someone who can open both", () => {
    expect(offered(OWNER)).toEqual(["erp", "crm"]);
  });

  it("a person without crm.view in an organisation that DID buy it is offered the ERP alone", () => {
    expect(offered(as(["sales.view", "reports.view", "settings.view", "lookups.view"]))).toEqual(["erp"]);
  });

  it("a person whose role is CRM only is offered the CRM alone: no half-empty ERP to switch to", () => {
    // a custom CRM-only role holds crm.* and the pick lists a form needs, and nothing that opens an ERP page
    expect(offered(as([...CRM_KEYS, "lookups.view"]))).toEqual(["crm"]);
  });

  it("a status that says the CRM is off wins even if a stale grant is still in the list", () => {
    // belt and braces: the grants and the module can only disagree through a bug, and then the refused one loses
    expect(offered(as([...allKeys, ...CRM_KEYS], false))).toEqual(["erp"]);
  });

  it("offers only the ERP while the status is still loading, so nobody is shown a CRM they have not bought", () => {
    expect(offered(null)).toEqual(["erp"]);
    expect(offered({})).toEqual(["erp"]);
    expect(offered({ modules: { crm: { on: true } } })).toEqual(["erp"]); // modules without grants: the person is not known yet
  });

  it("Settings is open to everyone, so it never makes an 'ERP' for somebody who works only in the CRM", () => {
    const status = as([...CRM_KEYS, "lookups.view"]);
    const ids = getVisibleModules(status).map((m) => m.id);
    expect(ids).toContain("settings"); // they still have their own password and preferences
    expect(offered(status)).toEqual(["crm"]);
  });

  it("keeps that person on the CRM rail while they are on the Settings page, so there is never a one-item rail", () => {
    const status = as([...CRM_KEYS, "lookups.view"]);
    const modules = getVisibleModules(status);
    const settings = findActive("/settings", modules).module;
    expect(workspaceInUse(settings, modules, status)).toBe("crm");
    // ...while somebody who does work in both stays where the address says
    const owner = getVisibleModules(OWNER);
    expect(workspaceInUse(findActive("/settings", owner).module, owner, OWNER)).toBe("erp");
    expect(workspaceInUse(findActive("/crm/leads", owner).module, owner, OWNER)).toBe("crm");
  });

  it("lets the address decide until the status has arrived, so a reload on a CRM page never flashes the ERP rail", () => {
    const crmPage = findActive("/crm/leads").module;
    expect(workspaceInUse(crmPage, MODULES, null)).toBe("crm");
    expect(workspaceInUse(crmPage, MODULES, undefined)).toBe("crm");
    expect(workspaceInUse(crmPage, MODULES, {})).toBe("crm");
  });

  it("judges the modules alone when the caller gives no status", () => {
    expect(offeredWorkspaces(getVisibleModules(OWNER)).map((w) => w.id)).toEqual(["erp", "crm"]);
  });

  it("an organisation without the CRM module leaves every CRM page out of what its people can open", () => {
    const status = as(allKeys.filter((k) => !k.startsWith("crm.")), false);
    const ids = getVisibleModules(status).map((m) => m.id);
    expect(ids.filter((id) => id.startsWith("crm-"))).toEqual([]);
  });

  // ---- an organisation that bought the CRM and nothing else (the `crm` plan) ------------------------------------------
  //
  // Every organisation holds the always-on floor (reports.view, settings.view, lookups.view), so the owner of a CRM-only
  // organisation can still see Home's dashboard and Settings. Those say nothing about what was BOUGHT, and must not make an
  // "ERP" out of a dashboard of zeros.
  const OFF = { on: false, full: false, actions: [] };
  const SOLO_MODULES = {
    crm: { on: true }, users: { on: true }, settings: { on: true }, reports: { on: true },
    sales: OFF, purchase: OFF, inventory: OFF, finance: OFF, banking: OFF, accounts: OFF, staff: OFF,
  };
  const SOLO_KEYS = [...CRM_KEYS, "crm.assign", "crm.delete", "users.view", "users.manage", "settings.view", "settings.manage", "reports.view", "lookups.view"];
  const SOLO = { me: { grants: SOLO_KEYS }, modules: SOLO_MODULES };

  it("a CRM-only organisation has no ERP half, so its owner is offered the CRM alone", () => {
    const visible = getVisibleModules(SOLO).map((m) => m.id);
    expect(visible).toContain("home"); // the dashboard IS visible to them (reports.view is the floor) ...
    expect(offered(SOLO)).toEqual(["crm"]); // ... and still there is no ERP to be offered
  });

  it("names the ERP modules, and none of the ones every organisation holds", () => {
    expect(ERP_MODULES).toEqual(["sales", "purchase", "inventory", "finance", "banking", "accounts", "staff"]);
    for (const everyone of ["users", "settings", "reports", "lookups", "crm"]) expect(ERP_MODULES).not.toContain(everyone);
  });

  it("any one ERP module bought brings the ERP back", () => {
    for (const bought of ERP_MODULES) {
      const status = { me: { grants: [...SOLO_KEYS, `${bought}.view`] }, modules: { ...SOLO_MODULES, [bought]: { on: true } } };
      expect(offered(status), bought).toEqual(["erp", "crm"]);
    }
  });

  it("only an explicit off from the server says an ERP module is not bought", () => {
    // a status that does not mention the ERP modules at all (an older server) hides nothing: the server refuses what was not sold
    const quiet = { me: { grants: SOLO_KEYS }, modules: { crm: { on: true } } };
    expect(offered(quiet)).toEqual(["erp", "crm"]);
    expect(offered({ me: { grants: SOLO_KEYS } })).toEqual(["erp", "crm"]);
  });

  it("keeps a CRM-only owner on the CRM rail on every page, the ERP-owned ones included", () => {
    const modules = getVisibleModules(SOLO);
    for (const path of ["/dashboard", "/settings", "/users", "/crm/leads"]) {
      expect(workspaceInUse(findActive(path, modules).module, modules, SOLO), path).toBe("crm");
    }
  });

  it("gives the CRM Setup module a Team tab, shown to whoever may see users", () => {
    const setup = (status) => getVisibleModules(status).find((m) => m.id === "crm-setup")?.tabs.map((t) => t.label);
    expect(setup(SOLO)).toEqual(["Setup", "Team"]);
    // may add people but not set up the pipeline: Team alone
    expect(setup({ me: { grants: ["crm.view", "users.view"] }, modules: SOLO_MODULES })).toEqual(["Team"]);
    // may set up the pipeline but not see users: Setup alone, exactly as before
    expect(setup({ me: { grants: ["crm.view", "crm.manage"] }, modules: SOLO_MODULES })).toEqual(["Setup"]);
    // and nobody sees it without either
    expect(setup({ me: { grants: ["crm.view"] }, modules: SOLO_MODULES })).toBeUndefined();
  });

  it("the Team tab is the same screen as People > Users and roles, one address each", () => {
    expect(findActive("/crm/team").module.id).toBe("crm-setup");
    expect(findActive("/users").module.id).toBe("people");
    const owners = MODULES.flatMap((m) => m.tabs.filter((t) => t.to === "/crm/team" || t.to === "/users"));
    expect(owners.map((t) => t.to).sort()).toEqual(["/crm/team", "/users"]);
  });
});
