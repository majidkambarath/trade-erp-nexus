// Information architecture: the single source of truth for navigation.
// The rail, header tabs, command palette, mobile drawer and document title all read this.
//
// Modules are grouped by business workflow (Aurify ERP Redesign). Every `to` is an
// existing route in src/router/index.jsx; moving a page between modules never changes
// its URL. src/config/__tests__/navigation.test.js fails if a route is left unmapped.
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Landmark,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
// (with its extension: the mobile sweep loads this file straight from node, which does not guess one)
import { tabInPlan } from "../lib/organisation.js";
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
  {
    id: "sales",
    mobilePrimary: true,
    label: "Sales",
    icon: ShoppingBag,
    tabs: [
      { label: "Quotations", to: "/quotations", permission: "sales.view", feature: "quotations", keywords: ["quote", "offer", "proposal", "estimate", "rfq", "validity"] },
      { label: "Orders", to: "/sales-order", permission: "sales.view", keywords: ["sales order", "invoice"] },
      {
        label: "Delivery notes",
        to: "/delivery-notes",
        permission: "sales.view",
        feature: "deliveryNotes",
        keywords: ["delivery order", "dispatch", "proof of delivery", "pod", "pick list", "not invoiced", "14 days", "driver"],
      },
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
      { label: "Orders", to: "/purchase-order", permission: "purchase.view", keywords: ["purchase order", "po", "grn"] },
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
      { label: "Categories", to: "/category-management", permission: "inventory.view" },
      { label: "Units", to: "/unit-setup", permission: "inventory.view", keywords: ["unit of measure", "uom"] },
      { label: "Batches", to: "/batches", permission: "inventory.view", feature: "batches", keywords: ["expiry", "shelf life", "write off", "fefo", "lot"] },
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
