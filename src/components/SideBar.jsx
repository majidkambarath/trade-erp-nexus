import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Settings,
  User,
  Receipt,
  CreditCard,
  FileText,
  ShoppingCart,
  Box,
  Barcode,
  Ruler,
  Users,
  BarChart3,
  Zap,
  DollarSign,
  TrendingUp,
  Calculator,
  Wallet,
  ShoppingBag,
  Warehouse,
  UserPlus,
  ArrowLeftRight,
  UserCheck,
  Briefcase,
} from "lucide-react";

/** Match exact path or nested detail routes (e.g. /debit-accounts/vendor/123). */
const isPathActive = (path, currentPath) => {
  if (!path || !currentPath) return false;
  if (currentPath === path) return true;
  return currentPath.startsWith(`${path}/`);
};

const pathMatchesAny = (paths, currentPath) =>
  paths.some((p) => isPathActive(p, currentPath));

const Sidebar = ({ mobileOpen = false, onMobileClose }) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("erp-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const userRole = "Admin";

  /**
   * ERP navigation tree:
   * - type "link"  → one click goes to a page
   * - type "group" → accordion with children only (never navigates to undefined)
   */
  const navigation = useMemo(() => {
    const allow = (...roles) => roles.includes(userRole);

    const financeChildren = [
      { icon: Receipt, text: "Receipt Voucher", to: "/receipt-voucher" },
      { icon: CreditCard, text: "Payment Voucher", to: "/payment-voucher" },
      { icon: Calculator, text: "Journal Voucher", to: "/journal-voucher" },
      { icon: Wallet, text: "Contra Voucher", to: "/contra-voucher" },
      { icon: TrendingUp, text: "Expense Voucher", to: "/expense-voucher" },
    ].filter(() => allow("Admin", "Accountant"));

    const accountsChildren = [
      { icon: ShoppingCart, text: "Debit Accounts", to: "/debit-accounts" },
      { icon: FileText, text: "Credit Accounts", to: "/credit-accounts" },
      { icon: ArrowLeftRight, text: "Transactions", to: "/transactions" },
      { icon: Users, text: "Transactors", to: "/transactors" },
    ].filter(() => allow("Admin", "Accountant"));

    const ordersChildren = [
      { icon: ShoppingCart, text: "Purchase Order", to: "/purchase-order" },
      { icon: FileText, text: "Sales Order", to: "/sales-order" },
      { icon: ArrowLeftRight, text: "Purchase Return", to: "/purchase-return" },
      { icon: ArrowLeftRight, text: "Sales Return", to: "/sales-return" },
    ].filter(() => allow("Admin", "Purchase Officer", "Sales Executive"));

    const inventoryChildren = [
      { icon: Barcode, text: "Stock Items", to: "/stock-item-creation" },
      { icon: Box, text: "Inventory", to: "/inventory" },
      { icon: Ruler, text: "Unit of Measure", to: "/unit-setup" },
      { icon: FileText, text: "Categories", to: "/category-management" },
    ].filter(() => allow("Admin", "Inventory Manager"));

    const items = [
      {
        type: "label",
        key: "label-finance",
        text: "Finance",
        show: financeChildren.length > 0 || accountsChildren.length > 0,
      },
      financeChildren.length > 0 && {
        type: "group",
        key: "financial",
        icon: DollarSign,
        text: "Financial Modules",
        children: financeChildren,
      },
      accountsChildren.length > 0 && {
        type: "group",
        key: "accounts",
        icon: Calculator,
        text: "Accounts Module",
        children: accountsChildren,
      },
      {
        type: "label",
        key: "label-parties",
        text: "Parties",
        show: allow("Admin", "Purchase Officer", "Sales Executive"),
      },
      allow("Admin", "Purchase Officer") && {
        type: "link",
        key: "vendors",
        icon: Briefcase,
        text: "Vendors",
        to: "/vendor-creation",
      },
      allow("Admin", "Sales Executive") && {
        type: "link",
        key: "customers",
        icon: UserCheck,
        text: "Customers",
        to: "/customer-creation",
      },
      {
        type: "label",
        key: "label-ops",
        text: "Operations",
        show:
          ordersChildren.length > 0 ||
          inventoryChildren.length > 0 ||
          allow("Admin", "HR"),
      },
      ordersChildren.length > 0 && {
        type: "group",
        key: "salesPurchase",
        icon: ShoppingBag,
        text: "Sales & Purchase",
        children: ordersChildren,
      },
      inventoryChildren.length > 0 && {
        type: "group",
        key: "inventory",
        icon: Warehouse,
        text: "Inventory & Stock",
        children: inventoryChildren,
      },
      allow("Admin", "HR") && {
        type: "link",
        key: "staff",
        icon: UserPlus,
        text: "Staff",
        to: "/staff-records",
      },
      {
        type: "label",
        key: "label-insights",
        text: "Insights",
        show: allow("Admin", "Accountant"),
      },
      allow("Admin", "Accountant") && {
        type: "link",
        key: "vat-reports",
        icon: BarChart3,
        text: "VAT Reports",
        to: "/vat-reports",
      },
    ];

    return items.filter(Boolean);
  }, [userRole]);

  // Auto-expand only the section that owns the current route (accordion)
  useEffect(() => {
    const activeGroup = navigation.find(
      (item) =>
        item.type === "group" &&
        item.children?.some((child) => isPathActive(child.to, currentPath))
    );
    if (activeGroup) {
      setExpandedSections({ [activeGroup.key]: true });
    }
  }, [currentPath, navigation]);

  const toggleSection = useCallback((sectionKey) => {
    setExpandedSections((prev) => {
      const willOpen = !prev[sectionKey];
      return willOpen ? { [sectionKey]: true } : {};
    });
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("erp-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleNavigation = useCallback(
    (path) => {
      if (!path) return;
      navigate(path);
      onMobileClose?.();
    },
    [navigate, onMobileClose]
  );

  const handleLogout = (e) => {
    e.preventDefault();
    try {
      [
        "accessToken",
        "refreshToken",
        "adminId",
        "loginTime",
        "tokenExpiry",
        "rememberMe",
      ].forEach((key) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      });
      localStorage.removeItem("userPreferences");
      navigate("/");
    } catch {
      sessionStorage.clear();
      localStorage.clear();
      navigate("/");
    }
  };

  const renderNavItem = (item, index) => {
    if (item.type === "label") {
      if (!item.show || isSidebarCollapsed) return null;
      return (
        <div
          key={item.key}
          className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
        >
          {item.text}
        </div>
      );
    }

    if (item.type === "link") {
      const Icon = item.icon;
      return (
        <SidebarItem
          key={item.key}
          icon={<Icon strokeWidth={1.6} size={isSidebarCollapsed ? 20 : 18} />}
          text={item.text}
          active={isPathActive(item.to, currentPath)}
          isCollapsed={isSidebarCollapsed}
          onClick={() => handleNavigation(item.to)}
        />
      );
    }

    if (item.type === "group") {
      const Icon = item.icon;
      const childPaths = item.children.map((c) => c.to);
      return (
        <SidebarSection
          key={item.key}
          icon={<Icon strokeWidth={1.6} size={isSidebarCollapsed ? 20 : 18} />}
          text={item.text}
          expanded={!!expandedSections[item.key]}
          onToggle={() => toggleSection(item.key)}
          hasActiveChild={pathMatchesAny(childPaths, currentPath)}
          isCollapsed={isSidebarCollapsed}
          delay={index * 30}
          children={item.children}
          handleNavigation={handleNavigation}
          currentPath={currentPath}
        />
      );
    }

    return null;
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`relative z-50 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground font-sans transition-[width,transform] duration-300 ease-out ${
          isSidebarCollapsed ? "sm:w-[4.75rem]" : "sm:w-[17rem]"
        } ${
          mobileOpen
            ? "fixed inset-y-0 left-0 w-[17rem] translate-x-0 shadow-2xl"
            : "fixed inset-y-0 left-0 w-[17rem] -translate-x-full sm:static sm:translate-x-0"
        }`}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute top-1/2 right-0 z-[60] hidden h-11 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[var(--shadow-elevated)] transition hover:bg-secondary sm:flex"
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isSidebarCollapsed ? "Expand" : "Collapse"}
        >
          {isSidebarCollapsed ? (
            <ChevronRight strokeWidth={2.25} size={14} />
          ) : (
            <ChevronLeft strokeWidth={2.25} size={14} />
          )}
        </button>

        <div
          className={`relative flex items-center pt-5 pb-3 ${
            isSidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--highlight)] shadow-sm">
                  <Zap className="h-5 w-5 text-[#171717]" strokeWidth={2.2} />
                </div>
                <div>
                  <span className="block text-lg font-extrabold tracking-tight text-sidebar-foreground">
                    NH FOODS
                  </span>
                  <div className="text-[11px] font-medium text-muted-foreground -mt-0.5">
                    UAE · ERP
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onMobileClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent sm:hidden"
                aria-label="Close menu"
              >
                <ChevronLeft strokeWidth={2} size={16} className="text-muted-foreground" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--highlight)]"
              aria-label="Expand sidebar"
            >
              <Zap className="h-5 w-5 text-[#171717]" strokeWidth={2.2} />
            </button>
          )}
        </div>

        {!isSidebarCollapsed && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 rounded-full bg-sidebar-accent px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-sidebar-foreground">
                  Administrator
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  admin@nhfoods.ae
                </div>
              </div>
              <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--highlight)]" />
            </div>
          </div>
        )}

        <div
          className={`min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-500 scrollbar-track-transparent ${
            isSidebarCollapsed ? "px-2" : "px-3"
          }`}
        >
          <nav
            className={`pb-3 ${
              isSidebarCollapsed
                ? "flex flex-col items-center gap-2.5"
                : "space-y-1.5"
            }`}
          >
            <SidebarItem
              icon={
                <LayoutDashboard
                  strokeWidth={1.6}
                  size={isSidebarCollapsed ? 20 : 18}
                />
              }
              text="Dashboard"
              active={currentPath === "/dashboard"}
              isCollapsed={isSidebarCollapsed}
              onClick={() => handleNavigation("/dashboard")}
            />

            {navigation.map((item, index) => renderNavItem(item, index))}
          </nav>
        </div>

        <div
          className={`shrink-0 border-t border-sidebar-border py-4 ${
            isSidebarCollapsed
              ? "flex flex-col items-center gap-2.5 px-2"
              : "space-y-1.5 px-3"
          }`}
        >
          <SidebarItem
            icon={
              <Settings strokeWidth={1.6} size={isSidebarCollapsed ? 20 : 18} />
            }
            text="Settings"
            active={isPathActive("/settings", currentPath)}
            isCollapsed={isSidebarCollapsed}
            onClick={() => handleNavigation("/settings")}
          />
          <div
            onClick={handleLogout}
            className="cursor-pointer"
            title={isSidebarCollapsed ? "Log Out" : undefined}
          >
            {isSidebarCollapsed ? (
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-muted-foreground transition hover:bg-secondary hover:text-sidebar-foreground">
                <LogOut strokeWidth={1.6} size={20} />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-full bg-sidebar-accent px-3 py-2.5 transition hover:opacity-90">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-sidebar-border bg-sidebar">
                  <LogOut
                    strokeWidth={1.75}
                    size={16}
                    className="text-muted-foreground"
                  />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  Log Out
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

const SidebarItem = React.memo(
  ({ icon, text, active, isCollapsed, onClick }) => (
    <div
      className="block cursor-pointer group"
      title={isCollapsed ? text : ""}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {isCollapsed ? (
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ${
            active
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
              : "border border-sidebar-border bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
          }`}
        >
          {icon}
        </div>
      ) : (
        <div
          className={`relative flex items-center gap-3 rounded-full px-3 py-2.5 transition-all duration-200 ${
            active
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
              : "border border-sidebar-border bg-sidebar text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          }`}
        >
          <div
            className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              active ? "bg-black/10 dark:bg-black/20" : "bg-sidebar-accent"
            }`}
          >
            {icon}
          </div>
          <span className="relative z-10 truncate text-sm font-semibold">
            {text}
          </span>
        </div>
      )}
    </div>
  )
);

const SidebarSection = React.memo(
  ({
    icon,
    text,
    expanded,
    onToggle,
    hasActiveChild,
    children,
    isCollapsed,
    delay = 0,
    handleNavigation,
    currentPath,
  }) => {
    const handleSectionClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isCollapsed) {
        const firstChild = children?.[0]?.to;
        if (firstChild) handleNavigation(firstChild);
        return;
      }
      // Parent only toggles accordion — never navigates to a missing route
      onToggle();
    };

    if (isCollapsed) {
      return (
        <div
          className="cursor-pointer"
          title={text}
          onClick={handleSectionClick}
          style={{ animationDelay: `${delay}ms` }}
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ${
              hasActiveChild
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "border border-sidebar-border bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
            }`}
          >
            {icon}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full group" style={{ animationDelay: `${delay}ms` }}>
        <button
          type="button"
          onClick={handleSectionClick}
          aria-expanded={expanded}
          className={`relative flex w-full cursor-pointer items-center gap-3 rounded-full border px-3 py-2.5 text-left transition-all duration-200 ${
            hasActiveChild
              ? "border-sidebar-border bg-sidebar-accent text-sidebar-foreground shadow-sm"
              : "border-sidebar-border bg-sidebar text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          }`}
          title={text}
        >
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
            {icon}
          </div>
          <span className="relative z-10 flex-1 truncate text-sm font-semibold">
            {text}
          </span>
          <span
            className={`relative z-10 rounded-full p-1 transition-transform duration-300 ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <ChevronDown
              strokeWidth={1.75}
              size={16}
              className="text-muted-foreground"
            />
          </span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            expanded ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="ml-5 mt-1.5 space-y-1 border-l border-sidebar-border pl-3">
            {children.map((child) => {
              const ChildIcon = child.icon;
              const active = isPathActive(child.to, currentPath);
              return (
                <div
                  key={child.to}
                  className="block cursor-pointer group"
                  title={child.text}
                  onClick={() => handleNavigation(child.to)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNavigation(child.to);
                    }
                  }}
                >
                  <div
                    className={`relative flex items-center gap-2.5 rounded-full px-2.5 py-2 transition-all duration-200 ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <div
                      className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        active
                          ? "bg-black/10 dark:bg-black/20"
                          : "bg-sidebar-accent"
                      }`}
                    >
                      <ChildIcon strokeWidth={1.6} size={16} />
                    </div>
                    <span className="relative z-10 truncate text-sm font-semibold">
                      {child.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

SidebarItem.displayName = "SidebarItem";
SidebarSection.displayName = "SidebarSection";

export default Sidebar;
