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

// Role lists are carried over unchanged from the previous sidebar, per page.
const ORDERS = ["Admin", "Purchase Officer", "Sales Executive"];
const ACCOUNTS = ["Admin", "Accountant"];
const INVENTORY = ["Admin", "Inventory Manager"];

export const MODULES = [
  {
    id: "home",
    label: "Home",
    icon: LayoutDashboard,
    tabs: [{ label: "Dashboard", to: "/dashboard", keywords: ["overview", "kpi"] }],
  },
  {
    id: "sales",
    label: "Sales",
    icon: ShoppingBag,
    tabs: [
      { label: "Orders", to: "/sales-order", roles: ORDERS, keywords: ["sales order", "invoice"] },
      { label: "Returns", to: "/sales-return", roles: ORDERS, keywords: ["sales return"] },
      { label: "Customers", to: "/customer-creation", roles: ["Admin", "Sales Executive"], keywords: ["clients", "parties"] },
      {
        label: "Receivables",
        to: "/credit-accounts",
        roles: ACCOUNTS,
        keywords: ["credit accounts", "customer balances", "ar"],
      },
    ],
  },
  {
    id: "purchase",
    label: "Purchase",
    icon: Truck,
    tabs: [
      { label: "Orders", to: "/purchase-order", roles: ORDERS, keywords: ["purchase order", "po", "grn"] },
      { label: "Returns", to: "/purchase-return", roles: ORDERS, keywords: ["purchase return"] },
      { label: "Vendors", to: "/vendor-creation", roles: ["Admin", "Purchase Officer"], keywords: ["suppliers", "parties"] },
      {
        label: "Payables",
        to: "/debit-accounts",
        roles: ACCOUNTS,
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
        roles: INVENTORY,
        keywords: ["products", "sku", "items"],
      },
      { label: "Movements", to: "/inventory", roles: INVENTORY, keywords: ["inventory", "stock movement"] },
      { label: "Categories", to: "/category-management", roles: INVENTORY },
      { label: "Units", to: "/unit-setup", roles: INVENTORY, keywords: ["unit of measure", "uom"] },
      { label: "Batches", to: "/batches", roles: INVENTORY, keywords: ["expiry", "shelf life", "write off", "fefo", "lot"] },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Landmark,
    tabs: [
      { label: "Receipts", to: "/receipt-voucher", roles: ACCOUNTS, keywords: ["receipt voucher"] },
      { label: "Payments", to: "/payment-voucher", roles: ACCOUNTS, keywords: ["payment voucher"] },
      { label: "Journal", to: "/journal-voucher", roles: ACCOUNTS, keywords: ["journal voucher"] },
      { label: "Contra", to: "/contra-voucher", roles: ACCOUNTS, keywords: ["contra voucher"] },
      { label: "Expenses", to: "/expense-voucher", roles: ACCOUNTS, keywords: ["expense voucher"] },
      { label: "Notes", to: "/debit-credit-notes", roles: ACCOUNTS, keywords: ["debit note", "credit note", "price adjustment", "dn", "cn"] },
      { label: "Cheques", to: "/cheques", roles: ACCOUNTS, keywords: ["cheque register", "pdc", "post-dated", "bounced", "clearing"] },
      { label: "Cash & bank", to: "/cash-and-bank", match: ["/cash-and-bank", "/transactors"], roles: ACCOUNTS, keywords: ["cash", "bank", "balances", "accounts", "transfer"] },
      { label: "Ledger", to: "/ledger", match: ["/ledger", "/transactions"], roles: ACCOUNTS, keywords: ["account ledger", "running balance", "transactions", "day book"] },
    ],
  },
  {
    // The ledger itself: what accounts exist, how they are grouped, and how transactions post to them.
    id: "accounts",
    label: "Accounts",
    icon: BookOpen,
    tabs: [
      { label: "Chart of accounts", to: "/chart-of-accounts", roles: ACCOUNTS, keywords: ["coa", "ledger accounts", "account groups", "assets", "liabilities", "equity", "income", "expenses", "opening balance", "documents", "create account"] },
      { label: "Banks", to: "/banks", roles: ACCOUNTS, keywords: ["bank master", "swift", "iban", "branches"] },
      { label: "KYC documents", to: "/kyc-documents", roles: ACCOUNTS, keywords: ["document types", "trade licence", "emirates id", "expiry", "kyc", "expiring documents"] },
      { label: "Card types", to: "/card-types", roles: ACCOUNTS, keywords: ["visa", "mastercard", "card fee", "processing fee"] },
      { label: "Cards", to: "/cards", roles: ACCOUNTS, keywords: ["card master", "pos terminal", "credit card", "merchant", "debit card", "prepaid"] },
      { label: "Opening balances", to: "/opening-balances", roles: ACCOUNTS, keywords: ["go live", "conversion", "opening stock", "opening invoices", "trial balance", "opening balance equity", "migrate", "old books"] },
      { label: "Currencies", to: "/currencies", roles: ACCOUNTS, keywords: ["exchange rate", "fx", "foreign currency", "usd", "eur", "rates", "base currency", "aed"] },
      { label: "Setup", to: "/accounting-setup", roles: ACCOUNTS, keywords: ["posting accounts", "account configuration", "fiscal year", "period lock", "tax codes", "credit control", "audit log", "numbering"] },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    tabs: [
      { label: "Statements", to: "/financial-statements", roles: ACCOUNTS, keywords: ["trial balance", "profit and loss", "p&l", "gross profit", "cash flow", "balance sheet", "financial statements"] },
      { label: "IFRS", to: "/ifrs-statements", roles: ACCOUNTS, keywords: ["ifrs statements", "statement of financial position", "profit or loss", "changes in equity", "cash flows", "notes", "comparative", "ias 1", "ias 7"] },
      { label: "Ledger", to: "/ledger-reports", roles: ACCOUNTS, keywords: ["general ledger", "day book", "journals register", "cash book", "bank book", "gl"] },
      { label: "Balances", to: "/party-balances", roles: ACCOUNTS, keywords: ["customer balances", "vendor balances", "receivables", "payables", "credit exposure", "credit limit", "outstanding"] },
      { label: "Ageing", to: "/ageing", roles: ACCOUNTS, keywords: ["aged receivables", "aged payables", "overdue", "outstanding"] },
      { label: "Account statement", to: "/statement", roles: ACCOUNTS, keywords: ["statement of account", "customer statement", "vendor statement"] },
      { label: "Stock", to: "/stock-reports", roles: ACCOUNTS, keywords: ["stock valuation", "inventory valuation", "stock movement", "item ledger", "sales analysis", "gross margin", "expiry", "slow moving", "dead stock", "reorder", "low stock"] },
      { label: "Currency", to: "/currency-register", roles: ACCOUNTS, keywords: ["currency register", "foreign receipts", "foreign payments", "fx register"] },
      { label: "VAT", to: "/vat-reports", roles: ACCOUNTS, keywords: ["vat report", "fta", "tax"] },
      // `soon`: the screens work against a built-in sandbox, but the connection to an accredited
      // service provider (live exchange with other businesses and the FTA) is not built yet.
      { label: "e-Invoicing", to: "/e-invoicing", roles: ACCOUNTS, soon: true, keywords: ["einvoicing", "peppol", "pint ae", "asp", "fta", "electronic invoice", "tax invoice", "credit note"] },
    ],
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    tabs: [{ label: "Staff", to: "/staff-records", roles: ["Admin", "HR"], keywords: ["employees"] }],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    placement: "footer",
    tabs: [{ label: "Settings", to: "/settings", keywords: ["profile", "company", "credit control", "returns", "trn", "tax registration", "password", "theme", "date format"] }],
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

const canSee = (tab, role) => !tab.roles || tab.roles.includes(role);

/** Modules filtered to what `role` may open. A module with no visible tab is dropped. */
export const getVisibleModules = (role, modules = MODULES) =>
  modules
    .map((m) => ({ ...m, tabs: m.tabs.filter((t) => canSee(t, role)) }))
    .filter((m) => m.tabs.length > 0);

/** The module and tab owning `pathname`, or null for an unmapped route. */
export const findActive = (pathname, modules = MODULES) => {
  for (const module of modules) {
    const tab = module.tabs.find((t) => tabMatches(t, pathname));
    if (tab) return { module, tab };
  }
  return null;
};

/** A module's landing page: its first visible tab. */
export const moduleHref = (module) => module.tabs[0]?.to;

/** "Payments · Finance · NH FOODS" — or "Finance · NH FOODS" for single-page modules. */
export const pageTitle = (active, appName) => {
  if (!active) return appName;
  const { module, tab } = active;
  const parts = module.tabs.length > 1 ? [tab.label, module.label] : [module.label];
  return [...parts, appName].join(" · ");
};
