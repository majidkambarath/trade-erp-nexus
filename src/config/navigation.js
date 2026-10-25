// Information architecture: the single source of truth for navigation.
// The rail, header tabs, command palette, mobile drawer and document title all read this.
//
// Modules are grouped by business workflow (Aurify ERP Redesign). Every `to` is an
// existing route in src/router/index.jsx; moving a page between modules never changes
// its URL. src/config/__tests__/navigation.test.js fails if a route is left unmapped.
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  Contact,
  Gauge,
  Handshake,
  MessagesSquare,
  SlidersHorizontal,
  Target,
  LayoutDashboard,
  Landmark,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
// (with its extension: the mobile sweep loads this file straight from node, which does not guess one)
import { ERP_MODULES, tabInPlan } from "../lib/organisation.js";
import { tabAllowed } from "../lib/permissions.js";

// A tab names the `permission` it needs (one, or a list of which any will do) and may name a `feature` of the plan. It is
// offered only when the person's role holds the permission AND the organisation's plan includes the feature. A tab that
// needs nothing says it is `open` and why. (The server decides every request for itself; this decides what to show.)

export const MODULES = [
  {
    id: "home",
    mobilePrimary: true,
    label: "Home",
    icon: LayoutDashboard,
    tabs: [
      { label: "Dashboard", to: "/dashboard", permission: "reports.view", keywords: ["overview", "kpi"] },
      // `badge` names the count shown beside the tab (components/shell/NavBadges.jsx): what is waiting for this person's approval
      { label: "Approvals", to: "/approvals", permission: ["sales.approve", "purchase.approve", "finance.approve"], badge: "approvals", keywords: ["approve", "waiting", "pending", "to approve", "second approver", "limit", "held", "review"] },
    ],
  },
  // ---- the CRM workspace -------------------------------------------------------------------------------------
  //
  // A module names the `workspace` it belongs to; absent means "erp". Only the rail and the bottom bar filter on it
  // (src/components/Layout.jsx), so findActive, getVisibleModules, the route-coverage test and the mobile sweep's
  // page list all still read ONE flat list and needed no change.
  //
  // Each of these is a single-tab module on purpose: ModuleTabs draws no strip below two tabs, so each is a plain
  // rail item and the CRM reads as its own sidebar rather than as one tab strip among ten.
  //
  // There is deliberately no `/crm` route: a tab's path prefix-matches its children, so it would own every page
  // below it and navigation.test.js requires each route to belong to exactly one tab. Hence /crm/dashboard.
  //
  // The ids are chosen so the mobile sweep's `${m.id}-${slug}` screenshot names come out unchanged (it drops a slug
  // the id already ends with), which is why the wave-1 DEEP steps and .shots filenames still work.
  {
    id: "crm-dashboard",
    workspace: "crm",
    label: "Dashboard",
    icon: Gauge,
    tabs: [{ label: "Dashboard", to: "/crm/dashboard", permission: "crm.view", keywords: ["crm", "today", "my work", "late", "forecast", "moved by itself", "automation"] }],
  },
  {
    id: "crm-leads",
    workspace: "crm",
    label: "Leads",
    icon: Target,
    tabs: [{ label: "Leads", to: "/crm/leads", permission: "crm.view", keywords: ["enquiry", "enquiries", "prospect", "lead", "walk-in", "referral", "qualify", "score"] }],
  },
  {
    id: "crm-contacts",
    workspace: "crm",
    label: "Contacts",
    icon: Contact,
    tabs: [{ label: "Contacts", to: "/crm/contacts", permission: "crm.view", keywords: ["people", "person", "contact", "who to call", "decision maker", "address book"] }],
  },
  {
    id: "crm-pipeline",
    workspace: "crm",
    label: "Pipeline",
    icon: Handshake,
    tabs: [{ label: "Pipeline", to: "/crm/pipeline", permission: "crm.view", keywords: ["deals", "opportunities", "funnel", "stages", "forecast", "weighted", "board"] }],
  },
  {
    id: "crm-communications",
    workspace: "crm",
    label: "Communications",
    // `short` is what the 88px rail and the bottom bar say when the full name will not fit in them. Everything that
    // has room - the tab strip, the command palette, the More sheet, the page itself - still says the whole word.
    short: "Comms",
    icon: MessagesSquare,
    tabs: [{ label: "Communications", to: "/crm/communications", permission: "crm.view", keywords: ["calls", "visits", "messages", "notes", "log", "history", "what was said"] }],
  },
  {
    id: "crm-follow-ups",
    workspace: "crm",
    label: "Follow-ups",
    icon: CalendarClock,
    // `badge` names the count shown beside the tab (components/shell/NavBadges.jsx): what this person owes today
    tabs: [{ label: "Follow-ups", to: "/crm/follow-ups", permission: "crm.view", badge: "crmFollowUps", keywords: ["call", "visit", "reminder", "due", "overdue", "chase", "activity", "task", "worklist"] }],
  },
  {
    id: "crm-calendar",
    workspace: "crm",
    label: "Calendar",
    icon: CalendarDays,
    tabs: [{ label: "Calendar", to: "/crm/calendar", permission: "crm.view", keywords: ["schedule", "diary", "agenda", "month", "events", "due", "reschedule", "drag", "what is on"] }],
  },
  {
    id: "crm-reports",
    workspace: "crm",
    label: "Reports",
    icon: BarChart3,
    tabs: [
      {
        label: "Reports",
        to: "/crm/reports",
        permission: "crm.view",
        keywords: ["analysis", "conversion", "win rate", "lost reasons", "by source", "pipeline report", "aging", "sales performance", "communication activity", "register"],
      },
    ],
  },
  {
    id: "crm-setup",
    workspace: "crm",
    label: "Setup",
    icon: SlidersHorizontal,
    tabs: [
      { label: "Setup", to: "/crm/setup", permission: "crm.manage", keywords: ["stages", "pipeline setup", "automation", "assignment", "round robin", "rules"] },
      // The same screen as People > Users and roles, reached from here. An organisation that bought the CRM alone has no ERP half
      // and so no People module in front of it, yet its owner still has to add the colleagues who will use the CRM. Two
      // addresses for one screen, each belonging to one tab (the route-coverage test requires exactly one), so the rail the
      // person is working in stays the rail they are working in.
      { label: "Team", to: "/crm/team", permission: "users.view", requires: "crm.view", keywords: ["users", "people", "add user", "roles", "permissions", "colleagues", "invite", "who can"] },
    ],
  },
  {
    id: "sales",
    mobilePrimary: true,
    label: "Sales",
    icon: ShoppingBag,
    tabs: [
      { label: "Quotations", to: "/quotations", permission: "sales.view", feature: "quotations", keywords: ["quote", "offer", "proposal", "estimate", "rfq", "validity"] },
      { label: "Orders", to: "/sales-orders", permission: "sales.view", keywords: ["sales order", "customer order", "confirmed", "delivered", "left to deliver", "progress"] },
      {
        label: "Delivery notes",
        to: "/delivery-notes",
        permission: "sales.view",
        feature: "deliveryNotes",
        keywords: ["delivery order", "dispatch", "proof of delivery", "pod", "pick list", "not invoiced", "14 days", "driver"],
      },
      { label: "Invoices", to: "/sales-order", permission: "sales.view", keywords: ["sales invoice", "tax invoice", "paid", "unpaid", "outstanding", "collected", "receivable", "confirmed", "approved"] },
      { label: "Returns", to: "/sales-return", permission: "sales.view", keywords: ["sales return"] },
      { label: "Customers", to: "/customer-creation", permission: ["sales.view", "accounts.view"], keywords: ["clients", "parties"] },
      {
        label: "Receivables",
        to: "/credit-accounts",
        permission: ["finance.view", "reports.financial"],
        keywords: ["credit accounts", "customer balances", "ar"],
      },
    ],
  },
  {
    id: "purchase",
    mobilePrimary: true,
    label: "Purchase",
    icon: Truck,
    tabs: [
      { label: "Orders", to: "/purchase-orders", permission: "purchase.view", keywords: ["purchase order", "po", "vendor order", "confirmed", "left to receive", "progress"] },
      { label: "Goods received", to: "/goods-received", permission: "purchase.view", keywords: ["grn", "goods receipt", "receiving", "received not invoiced", "vendor delivery", "short", "3-way"] },
      { label: "Invoices", to: "/purchase-order", permission: "purchase.view", keywords: ["purchase invoice", "bill", "vendor invoice", "paid", "unpaid", "outstanding", "payable", "confirmed", "approved"] },
      { label: "Returns", to: "/purchase-return", permission: "purchase.view", keywords: ["purchase return"] },
      { label: "Vendors", to: "/vendor-creation", permission: ["purchase.view", "accounts.view"], keywords: ["suppliers", "parties"] },
      {
        label: "Payables",
        to: "/debit-accounts",
        permission: ["finance.view", "reports.financial"],
        keywords: ["debit accounts", "vendor balances", "ap"],
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Warehouse,
    tabs: [
      {
        label: "Stock Items",
        to: "/stock-item-creation",
        // /stock-detail/:id is not nested under the list route, so it is matched explicitly.
        match: ["/stock-item-creation", "/stock-detail"],
        permission: "inventory.view",
        keywords: ["products", "sku", "items"],
      },
      { label: "Movements", to: "/inventory", permission: "inventory.view", keywords: ["inventory", "stock movement"] },
      { label: "Production", to: "/production", permission: "inventory.view", feature: "production", badge: "myWork", keywords: ["manufacture", "make", "assembly", "product cost", "costing", "bill of materials"] },
      { label: "Categories", to: "/category-management", permission: "inventory.view" },
      { label: "Units", to: "/unit-setup", permission: "inventory.view", keywords: ["unit of measure", "uom"] },
      { label: "Batches", to: "/batches", permission: "inventory.view", feature: "batches", keywords: ["expiry", "shelf life", "write off", "fefo", "lot"] },
    ],
  },
  // The first industry vertical: a workshop's vehicles and job cards. Opt-in per organisation (utils/plans.js
  // OPT_IN_MODULES on the server), off for every plan and every existing client until the developer console
  // switches it on - a person without the module simply never sees this rail item, the same way a person
  // without crm.view never sees the CRM. Not mobilePrimary: the four pinned slots are already sales, purchase,
  // inventory and finance (CLAUDE.md), and flagging a fifth would silently drop one of those on a phone.
  {
    id: "garage",
    label: "Garage",
    icon: Wrench,
    tabs: [
      { label: "Board", to: "/garage/board", permission: "garage.view", keywords: ["workshop", "job cards", "today", "in progress", "ready", "waiting for approval"] },
      { label: "Job cards", to: "/garage/job-cards", permission: "garage.view", keywords: ["job card", "estimate", "complaint", "repair", "service", "task"] },
      { label: "Vehicles", to: "/garage/vehicles", permission: "garage.view", keywords: ["vehicle", "car", "plate", "chassis", "vin", "service history"] },
    ],
  },
  {
    id: "finance",
    mobilePrimary: true,
    label: "Finance",
    icon: Landmark,
    tabs: [
      { label: "Receipts", to: "/receipt-voucher", permission: "finance.view", keywords: ["receipt voucher"] },
      { label: "Payments", to: "/payment-voucher", permission: "finance.view", keywords: ["payment voucher"] },
      { label: "Journal", to: "/journal-voucher", permission: "finance.view", keywords: ["journal voucher"] },
      { label: "Contra", to: "/contra-voucher", permission: "finance.view", keywords: ["contra voucher"] },
      { label: "Expenses", to: "/expense-voucher", permission: "finance.view", keywords: ["expense voucher"] },
      { label: "Notes", to: "/debit-credit-notes", permission: "finance.view", keywords: ["debit note", "credit note", "price adjustment", "dn", "cn"] },
      { label: "Cheques", to: "/cheques", permission: ["banking.view", "finance.view"], feature: "banking", keywords: ["cheque register", "pdc", "post-dated", "bounced", "clearing"] },
      { label: "Cash & bank", to: "/cash-and-bank", match: ["/cash-and-bank", "/transactors"], permission: ["finance.view", "banking.view", "accounts.view"], keywords: ["cash", "bank", "balances", "accounts", "transfer"] },
      { label: "Reconcile", to: "/bank-reconciliation", permission: "banking.view", feature: "reconciliation", keywords: ["bank reconciliation", "reconcile", "statement", "import statement", "card settlement", "brs", "mt940"] },
      { label: "Ledger", to: "/ledger", match: ["/ledger", "/transactions"], permission: ["finance.view", "reports.financial"], keywords: ["account ledger", "running balance", "transactions", "day book"] },
    ],
  },
  {
    // The ledger itself: what accounts exist, how they are grouped, and how transactions post to them.
    id: "accounts",
    label: "Accounts",
    icon: BookOpen,
    tabs: [
      { label: "Chart of accounts", to: "/chart-of-accounts", permission: "accounts.view", keywords: ["coa", "ledger accounts", "account groups", "assets", "liabilities", "equity", "income", "expenses", "opening balance", "documents", "create account"] },
      { label: "Banks", to: "/banks", permission: "banking.view", feature: "banking", keywords: ["bank master", "swift", "iban", "branches"] },
      { label: "KYC documents", to: "/kyc-documents", permission: ["accounts.view", "sales.view", "purchase.view"], keywords: ["document types", "trade licence", "emirates id", "expiry", "kyc", "expiring documents"] },
      { label: "Card types", to: "/card-types", permission: "banking.view", feature: "banking", keywords: ["visa", "mastercard", "card fee", "processing fee"] },
      { label: "Cards", to: "/cards", permission: "banking.view", feature: "banking", keywords: ["card master", "pos terminal", "credit card", "merchant", "debit card", "prepaid"] },
      { label: "Opening balances", to: "/opening-balances", permission: "accounts.view", keywords: ["go live", "conversion", "opening stock", "opening invoices", "trial balance", "opening balance equity", "migrate", "old books"] },
      { label: "Currencies", to: "/currencies", permission: "accounts.view", feature: "currencies", keywords: ["exchange rate", "fx", "foreign currency", "usd", "eur", "rates", "base currency", "aed"] },
      { label: "Setup", to: "/accounting-setup", permission: "accounts.view", keywords: ["posting accounts", "account configuration", "fiscal year", "period lock", "tax codes", "credit control", "audit log", "numbering"] },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    tabs: [
      { label: "Statements", to: "/financial-statements", permission: "reports.financial", keywords: ["trial balance", "profit and loss", "p&l", "gross profit", "cash flow", "balance sheet", "financial statements"] },
      { label: "IFRS", to: "/ifrs-statements", permission: "reports.financial", feature: "ifrsStatements", keywords: ["ifrs statements", "statement of financial position", "profit or loss", "changes in equity", "cash flows", "notes", "comparative", "ias 1", "ias 7"] },
      { label: "Ledger", to: "/ledger-reports", permission: "reports.financial", keywords: ["general ledger", "day book", "daily summary", "daily voucher summary", "day end", "day-end cash", "cash position", "journals register", "cash book", "bank book", "gl"] },
      { label: "Analysis", to: "/trade-reports", permission: "reports.view", keywords: ["sales by customer", "sales by item", "purchases by vendor", "purchases by item", "customer items", "who bought", "item wise", "month wise", "monthly sales", "receivables", "payables", "party movement", "sales register", "purchase register"] },
      { label: "Balances", to: "/party-balances", permission: ["reports.financial", "finance.view"], keywords: ["customer balances", "vendor balances", "receivables", "payables", "credit exposure", "credit limit", "outstanding"] },
      { label: "Ageing", to: "/ageing", permission: "reports.view", keywords: ["aged receivables", "aged payables", "overdue", "outstanding"] },
      { label: "Account statement", to: "/statement", permission: ["reports.view", "finance.view"], keywords: ["statement of account", "customer statement", "vendor statement"] },
      { label: "Stock", to: "/stock-reports", permission: "reports.view", keywords: ["stock valuation", "inventory valuation", "stock movement", "item ledger", "sales analysis", "gross margin", "expiry", "slow moving", "dead stock", "reorder", "low stock"] },
      { label: "Currency", to: "/currency-register", permission: ["reports.financial", "accounts.view"], feature: "currencies", keywords: ["currency register", "foreign receipts", "foreign payments", "fx register"] },
      { label: "VAT", to: "/vat-reports", permission: "reports.financial", feature: "vatReturn", keywords: ["vat report", "fta", "tax"] },
      // `soon`: the screens work against a built-in sandbox, but the connection to an accredited
      // service provider (live exchange with other businesses and the FTA) is not built yet.
      { label: "e-Invoicing", to: "/e-invoicing", permission: ["reports.financial", "sales.view"], feature: "einvoicing", soon: true, keywords: ["einvoicing", "peppol", "pint ae", "asp", "fta", "electronic invoice", "tax invoice", "credit note"] },
    ],
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    tabs: [
      { label: "Staff", to: "/staff-records", permission: "staff.view", keywords: ["employees", "hr"] },
      { label: "Users and roles", to: "/users", permission: "users.view", keywords: ["accounts", "permissions", "sign in", "roles", "access", "rbac", "who can", "add user", "password"] },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    placement: "footer",
    tabs: [{ label: "Settings", to: "/settings", open: "every person has their own preferences and password here; what else the page shows is up to the server", keywords: ["profile", "company", "credit control", "returns", "trn", "tax registration", "password", "theme", "date format"] }],
  },
];

/**
 * The two halves of the product. A workspace is one level ABOVE a module: it decides which rail you are looking at,
 * and nothing else. Everything that answers "which page is this" still reads the one flat MODULES list, which is why
 * findActive, getVisibleModules, pageTitle, the route-coverage test and the mobile sweep needed no change at all.
 *
 * The ERP is the default and a module that names no workspace belongs to it, so adding a workspace could not quietly
 * move an existing page.
 */
export const ERP = "erp";

// The modules that ARE the ERP are named in lib/organisation.js (ERP_MODULES), because Settings reads them too. An organisation
// holding none of them has bought the CRM and nothing else (the `crm` plan), so there is no ERP for it to switch into: Home,
// Reports and People would be an ERP of a dashboard full of zeros.
export { ERP_MODULES };

export const WORKSPACES = [
  { id: ERP, label: "ERP", icon: Building2, hint: "Buying, selling, stock and the books", anyModule: ERP_MODULES },
  // `module` is the permission module that SELLS the workspace (utils/plans.js): an organisation that has not bought it
  // is never offered it, whatever its people's roles say. The ERP names none - it is the product itself.
  { id: "crm", label: "CRM", icon: Handshake, module: "crm", hint: "Enquiries, people and the deals in front of the paperwork" },
];

export const workspaceOf = (module) => module?.workspace || ERP;

/** The modules of one workspace, in rail order. */
export const modulesIn = (workspaceId, modules = MODULES) => modules.filter((m) => workspaceOf(m) === (workspaceId || ERP));

/**
 * The workspaces this person can actually open, in order. A role with no crm.view sees one, and the switcher then
 * draws nothing: there is nothing to switch to.
 *
 * A FOOTER module (Settings) does not count towards a workspace. It is open to every signed-in person - their own
 * password and preferences are there - so counting it would give a CRM-only person an "ERP" made of one settings page
 * and a switch into it.
 */
export const visibleWorkspaces = (modules = MODULES) =>
  WORKSPACES.filter((w) => modules.some((m) => workspaceOf(m) === w.id && m.placement !== "footer"));

/**
 * The workspaces this person is OFFERED a switch between. Two things must both say yes, and the first is the one a
 * person cannot change:
 *
 *   1. the ORGANISATION bought the workspace's module (`status.modules.crm.on`) - an organisation on the Standard or
 *      Trade-only plan has the ERP and nothing to switch to;
 *   2. the PERSON can open at least one of its pages (`modules` is already what their role may open).
 *
 * The first is already inside `me.grants` (the server caps them to what was bought), so on a healthy status the second
 * check is enough; asking the module as well means a status that disagrees with itself can never offer a workspace
 * whose every request the server will refuse.
 *
 * `status` undefined means the caller did not say, and only the modules are judged. `null`, or a status whose grants
 * are not known yet, is "still loading": nothing is known about the plan, and the only workspace that cannot be wrong
 * is the ERP - so an organisation without the CRM is not offered it for the half second the page takes to arrive.
 */
export const offeredWorkspaces = (modules = MODULES, status) => {
  const open = visibleWorkspaces(modules);
  if (status === undefined) return open;
  if (!Array.isArray(status?.me?.grants)) return open.filter((w) => !w.module);
  return open.filter((w) => boughtWorkspace(w, status));
};

/**
 * Did the ORGANISATION buy this workspace? Only an explicit `on: false` from the server says no - a status that does not
 * mention a module (an older server, a partial status) hides nothing, and the server refuses what was not sold. The CRM is
 * bought when its one module is on; the ERP when ANY of its modules is, so an organisation on the CRM-only plan has no ERP
 * half at all, and its owner is not offered a switch into one.
 */
const boughtWorkspace = (workspace, status) => {
  const on = (m) => status.modules?.[m]?.on !== false;
  if (workspace.module && !on(workspace.module)) return false;
  if (workspace.anyModule && !workspace.anyModule.some(on)) return false;
  return true;
};

/**
 * Which rail to draw. Normally the half the page belongs to, read from the address. The exception is a page that
 * belongs to a half the person is not offered - Settings, opened from the account menu by someone who works only in
 * the CRM, is an ERP page - which would otherwise draw a rail of one item with no switch to get back out of it: they
 * keep the rail of the half they do work in. Until the status has arrived nothing is known, and the address decides, so
 * a reload on a CRM page never flashes the ERP rail first.
 */
export const workspaceInUse = (activeModule, modules = MODULES, status) => {
  const own = workspaceOf(activeModule);
  if (!Array.isArray(status?.me?.grants)) return own;
  const offered = offeredWorkspaces(modules, status);
  return offered.some((w) => w.id === own) ? own : offered[0]?.id || own;
};

/** Exact path, or a nested detail route (/debit-accounts/vendor/123). */
export const isPathActive = (path, currentPath) => {
  if (!path || !currentPath) return false;
  if (currentPath === path) return true;
  return currentPath.startsWith(`${path}/`);
};

export const tabMatches = (tab, currentPath) =>
  (tab.match ?? [tab.to]).some((p) => isPathActive(p, currentPath));

const canSee = (tab, status) => tabInPlan(tab, status) && tabAllowed(tab, status?.me);

/** Modules filtered to what the person's role may open and the organisation's plan includes. A module with no visible tab
 * is dropped. `status` is the organisation status (or null while it is unknown, which hides nothing). */
export const getVisibleModules = (status = null, modules = MODULES) =>
  modules
    .map((m) => ({ ...m, tabs: m.tabs.filter((t) => canSee(t, status)) }))
    .filter((m) => m.tabs.length > 0);

/** The module and tab owning `pathname`, or null for an unmapped route. */
export const findActive = (pathname, modules = MODULES) => {
  for (const module of modules) {
    const tab = module.tabs.find((t) => tabMatches(t, pathname));
    if (tab) return { module, tab };
  }
  return null;
};

/** The phone's bottom bar: four modules in the thumb zone, everything else behind More.
 * `mobilePrimary` in MODULES marks the intended four; a role that cannot see one of them
 * has its slot filled from the remaining modules in rail order, so the bar is never short.
 * Footer modules (Settings) are never pinned - they live in the More sheet. */
export const MOBILE_SLOTS = 4;

export const getMobileNav = (modules) => {
  const pinnable = modules.filter((m) => m.placement !== "footer");
  const flagged = pinnable.filter((m) => m.mobilePrimary);
  const fill = pinnable.filter((m) => !m.mobilePrimary);
  const primary = [...flagged, ...fill].slice(0, MOBILE_SLOTS);
  const pinned = new Set(primary.map((m) => m.id));
  return { primary, rest: modules.filter((m) => !pinned.has(m.id)) };
};

/** A module's landing page: its first visible tab. */
export const moduleHref = (module) => module.tabs[0]?.to;

/** "Payments · Finance · Zarvia" — or "Finance · Zarvia" for single-page modules. */
export const pageTitle = (active, appName) => {
  if (!active) return appName;
  const { module, tab } = active;
  const parts = module.tabs.length > 1 ? [tab.label, module.label] : [module.label];
  return [...parts, appName].join(" · ");
};
