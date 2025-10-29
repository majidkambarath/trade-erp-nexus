import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  LogOut,
  Settings,
  User,
  Receipt,
  CreditCard,
  FileText,
  ShoppingCart,
  Package,
  Box,
  Barcode,
  BookOpen,
  Ruler,
  Users,
  BarChart3,
  Shield,
  Zap,
  DollarSign,
  TrendingUp,
  Archive,
  Calculator,
  Wallet,
  ShoppingBag,
  Truck,
  Warehouse,
  Database,
  Scale,
  UserPlus,
  PieChart,
  Activity,
  ArrowLeftRight,
  Percent,
  UserCheck,
  Briefcase,
} from "lucide-react";

const Sidebar = () => {
  const [expandedSections, setExpandedSections] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // Mock user role
  const userRole = "Admin";

  // Navigation structure based on ERP requirements
  const navigationSections = useMemo(() => {
    const sections = [
      {
        key: "financial",
        icon: <DollarSign strokeWidth={1.5} size={22} />,
        text: "Financial Modules",
        children: [
          {
            icon: <Receipt strokeWidth={1.5} size={20} />,
            text: "Receipt Voucher",
            to: "/receipt-voucher",
          },
          {
            icon: <CreditCard strokeWidth={1.5} size={20} />,
            text: "Payment Voucher",
            to: "/payment-voucher",
          },
          {
            icon: <Calculator strokeWidth={1.5} size={20} />,
            text: "Journal Voucher",
            to: "/journal-voucher",
          },
          {
            icon: <Wallet strokeWidth={1.5} size={20} />,
            text: "Contra Voucher",
            to: "/contra-voucher",
          },
          {
            icon: <TrendingUp strokeWidth={1.5} size={20} />,
            text: "Expense Voucher",
            to: "/expense-voucher",
          },
        ].filter((item) => userRole === "Admin" || userRole === "Accountant"),
      },
      {
        key: "accounts",
        icon: <Calculator strokeWidth={1.5} size={22} />,
        text: "Accounts Module",
        children: [
          {
            icon: <ShoppingCart strokeWidth={1.5} size={20} />,
            text: "Purchase Accounts",
            to: "/purchase-accounts",
          },
          {
            icon: <FileText strokeWidth={1.5} size={20} />,
            text: "Sales Accounts",
            to: "/sales-accounts",
          },
          {
            icon: <ArrowLeftRight strokeWidth={1.5} size={20} />,
            text: "Transactions",
            to: "/transactions",
          },
          {
            icon: <Users strokeWidth={1.5} size={20} />,
            text: "Transactors",
            to: "/transactors",
          },
        ].filter((item) => userRole === "Admin" || userRole === "Accountant"),
      },
      {
        key: "vendorModules",
        icon: <Briefcase strokeWidth={1.5} size={22} />,
        text: "Vendor Modules",
        children: [
          {
            icon: <UserPlus strokeWidth={1.5} size={20} />,
            text: "Vendor Creation",
            to: "/vendor-creation",
          },
        ].filter(
          (item) => userRole === "Admin" || userRole === "Purchase Officer"
        ),
      },
      {
        key: "customerModules",
        icon: <UserCheck strokeWidth={1.5} size={22} />,
        text: "Customer Modules",
        children: [
          {
            icon: <UserPlus strokeWidth={1.5} size={20} />,
            text: "Customer Creation",
            to: "/customer-creation",
          },
        ].filter(
          (item) => userRole === "Admin" || userRole === "Sales Executive"
        ),
      },
      {
        key: "salesPurchase",
        icon: <ShoppingBag strokeWidth={1.5} size={22} />,
        text: "Sales & Purchase",
        children: [
          {
            icon: <ShoppingCart strokeWidth={1.5} size={20} />,
            text: "Purchase Order",
            to: "/purchase-order",
          },
          {
            icon: <FileText strokeWidth={1.5} size={20} />,
            text: "Sales Order",
            to: "/sales-order",
          },
          {
            icon: <ArrowLeftRight strokeWidth={1.5} size={20} />,
            text: "Purchase Return",
            to: "/purchase-return",
          },
          {
            icon: <ArrowLeftRight strokeWidth={1.5} size={20} />,
            text: "Sales Return",
            to: "/sales-return",
          },
        ].filter(
          (item) =>
            userRole === "Admin" ||
            userRole === "Purchase Officer" ||
            userRole === "Sales Executive"
        ),
      },
      {
        key: "inventory",
        icon: <Warehouse strokeWidth={1.5} size={22} />,
        text: "Inventory & Stock",
        children: [
          {
            icon: <Barcode strokeWidth={1.5} size={20} />,
            text: "Stock Item Creation",
            to: "/stock-item-creation",
          },
          {
            icon: <Box strokeWidth={1.5} size={20} />,
            text: "Inventory",
            to: "/inventory",
          },
        ].filter(
          (item) => userRole === "Admin" || userRole === "Inventory Manager"
        ),
      },
      {
        key: "unitOfMeasure",
        icon: <Scale strokeWidth={1.5} size={22} />,
        text: "Unit of Measure",
        children: [
          {
            icon: <Ruler strokeWidth={1.5} size={20} />,
            text: "Unit Setup",
            to: "/unit-setup",
          },
        ].filter(
          (item) => userRole === "Admin" || userRole === "Inventory Manager"
        ),
      },
      {
        key: "staff",
        icon: <UserPlus strokeWidth={1.5} size={22} />,
        text: "Staff Management",
        children: [
          {
            icon: <Users strokeWidth={1.5} size={20} />,
            text: "Staff Records",
            to: "/staff-records",
          },
        ].filter((item) => userRole === "Admin" || userRole === "HR"),
      },
      {
        key: "reports",
        icon: <BarChart3 strokeWidth={1.5} size={22} />,
        text: "Reports",
        children: [
          {
            icon: <FileText strokeWidth={1.5} size={20} />,
            text: "VAT Reports",
            to: "/vat-reports", // Your VAT Reports page
          },
          // Add more reports later
          // { icon: <PieChart strokeWidth={1.5} size={20} />, text: "Sales Report", to: "/sales-report" },
        ].filter(() => userRole === "Admin" || userRole === "Accountant"),
      },
    ];
    return sections.filter((section) => section.children.length > 0);
  }, [userRole]);

  // Auto-expand sections with active children or main section on route change
  useEffect(() => {
    const activeSection = navigationSections.find(
      (section) =>
        section.children.some((child) => child.to === currentPath) ||
        section.to === currentPath
    );
    if (activeSection) {
      setExpandedSections((prev) => ({
        ...prev,
        [activeSection.key]: true,
      }));
    }
  }, [currentPath, navigationSections]);

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = (e) => {
    e.preventDefault();
    try {
      const sessionKeys = [
        "accessToken",
        "refreshToken",
        "adminId",
        "loginTime",
        "tokenExpiry",
        "rememberMe",
      ];
      const localKeys = [
        "accessToken",
        "refreshToken",
        "adminId",
        "loginTime",
        "tokenExpiry",
        "rememberMe",
        "userPreferences",
        "theme",
      ];
      sessionKeys.forEach((key) => sessionStorage.removeItem(key));
      localKeys.forEach((key) => localStorage.removeItem(key));
      navigate("/");
    } catch (error) {
      sessionStorage.clear();
      localStorage.clear();
      navigate("/");
    }
  };

  return (
    <>
      {!isSidebarCollapsed && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 lg:hidden" />
      )}

      <div
        className={`relative flex flex-col h-screen bg-white text-gray-800 shadow-2xl transition-all duration-500 ease-out border-r border-gray-200/50 z-50 ${
          isSidebarCollapsed ? "w-20" : "w-72"
        }`}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between p-6 border-b border-gray-200/50 backdrop-blur-xl">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center shadow-lg">
                <Zap className="w-5 h-5 text-gray-800" />
              </div>
              <div>
                <span className="text-xl font-bold text-gray-800">
                  ERP NEXUS
                </span>
                <div className="text-xs text-gray-600 -mt-1">
                  Enterprise System
                </div>
              </div>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="relative p-2.5 rounded-xl bg-gray-100/50 backdrop-blur-sm transition-all duration-300 border border-gray-200/50 hover:bg-gray-200/50 hover:border-gray-300/50"
            aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight strokeWidth={2} size={18} className="text-gray-600" />
            ) : (
              <ChevronLeft strokeWidth={2} size={18} className="text-gray-600" />
            )}
          </button>
        </div>

        {/* User Profile */}
        {!isSidebarCollapsed && (
          <div className="p-4 border-b border-gray-200/50">
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-gray-100/50 backdrop-blur-xl border border-gray-200/50 shadow-lg">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shadow-md">
                <User className="w-5 h-5 text-gray-800" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">
                  Administrator
                </div>
                <div className="text-xs text-gray-600 truncate">
                  admin@company.com
                </div>
              </div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-white">
          <nav className="space-y-2 p-4">
            <SidebarItem
              icon={<LayoutDashboard strokeWidth={1.5} size={22} />}
              text="Dashboard"
              to="/dashboard"
              active={currentPath === "/dashboard"}
              isCollapsed={isSidebarCollapsed}
              special={true}
              onClick={() => handleNavigation("/dashboard")}
            />

            {navigationSections.map((section, index) => (
              <SidebarSection
                key={section.key}
                icon={section.icon}
                text={section.text}
                sectionKey={section.key}
                sectionTo={section.to}
                expanded={expandedSections[section.key]}
                onToggle={() => toggleSection(section.key)}
                hasActiveChild={
                  section.children.some((child) => child.to === currentPath) ||
                  section.to === currentPath
                }
                isCollapsed={isSidebarCollapsed}
                delay={index * 50}
                children={section.children}
                handleNavigation={handleNavigation}
                currentPath={currentPath}
              />
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200/50 p-4 space-y-2 backdrop-blur-xl">
          <SidebarItem
            icon={<Settings strokeWidth={1.5} size={22} />}
            text="Settings"
            to="/settings"
            active={currentPath === "/settings"}
            isCollapsed={isSidebarCollapsed}
            onClick={() => handleNavigation("/settings")}
          />
          <SidebarItem
            icon={<HelpCircle strokeWidth={1.5} size={22} />}
            text="Help Center"
            to="/help-center"
            active={currentPath === "/help-center"}
            isCollapsed={isSidebarCollapsed}
            onClick={() => handleNavigation("/help-center")}
          />
          <div onClick={handleLogout} className="cursor-pointer">
            <div
              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                isSidebarCollapsed ? "justify-center" : ""
              } bg-gray-100/50 backdrop-blur-xl border border-gray-200/50 hover:bg-gray-200/50`}
            >
              <LogOut strokeWidth={1.5} size={22} className="text-gray-600" />
              {!isSidebarCollapsed && (
                <span className="font-medium text-gray-600">Log Out</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Sidebar Item Component
const SidebarItem = React.memo(
  ({ icon, text, to, active, isCollapsed, special = false, onClick }) => (
    <div
      className="block cursor-pointer group"
      title={isCollapsed ? text : ""}
      onClick={onClick}
    >
      <div
        className={`relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
          isCollapsed ? "justify-center" : ""
        } ${
          active
            ? special
              ? "bg-gray-200 text-gray-800 shadow-lg border border-gray-200/50"
              : "bg-gray-100 text-gray-800 shadow-md border border-gray-200/50"
            : "text-gray-600 hover:bg-gray-200/50 hover:border-gray-300/50"
        }`}
      >
        <div
          className={`relative z-10 p-2 rounded-lg ${
            active && special ? "bg-gray-300/50" : "bg-gray-200/50"
          }`}
        >
          {icon}
        </div>
        {!isCollapsed && (
          <span className="font-medium truncate relative z-10 text-sm">
            {text}
          </span>
        )}
      </div>
    </div>
  )
);

// Sidebar Section Component
const SidebarSection = React.memo(
  ({
    icon,
    text,
    sectionKey,
    sectionTo,
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
      if (e.target.closest(".toggle-arrow")) {
        onToggle();
        return;
      }
      handleNavigation(sectionTo);
      onToggle();
    };

    return (
      <div className="w-full group" style={{ animationDelay: `${delay}ms` }}>
        <div
          onClick={handleSectionClick}
          className={`relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 ${
            isCollapsed ? "justify-center" : ""
          } ${
            hasActiveChild || currentPath === sectionTo
              ? "bg-gray-200 text-gray-800 shadow-lg border border-gray-200/50"
              : "text-gray-600 hover:bg-gray-200/50 hover:border-gray-300/50"
          }`}
          title={isCollapsed ? text : ""}
        >
          <div className="relative z-10 p-2 rounded-lg bg-gray-200/50">
            {icon}
          </div>
          {!isCollapsed && (
            <>
              <span className="font-medium flex-1 truncate relative z-10 text-sm">
                {text}
              </span>
              <div
                className={`toggle-arrow transform transition-transform duration-300 relative z-10 p-1 rounded ${
                  expanded ? "rotate-180" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle();
                }}
              >
                <ChevronDown strokeWidth={1.5} size={18} className="text-gray-600" />
              </div>
            </>
          )}
        </div>

        <div
          className={`overflow-hidden transition-all duration-500 ease-out ${
            expanded && !isCollapsed ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="ml-6 mt-2 space-y-1 border-l border-gray-200/50 pl-4">
            {children.map((child) => (
              <div
                key={child.to}
                className="block cursor-pointer group"
                title={isCollapsed ? child.text : ""}
                onClick={() => handleNavigation(child.to)}
              >
                <div
                  className={`relative flex items-center gap-3 p-2.5 rounded-lg transition-all duration-300 ${
                    currentPath === child.to
                      ? "bg-gray-100 text-gray-800 border border-gray-200/50 shadow-md"
                      : "text-gray-600 hover:bg-gray-200/50 hover:border-gray-300/50"
                  }`}
                >
                  {currentPath === child.to && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-gray-400 rounded-r-full"></div>
                  )}
                  <div className="relative z-10 ml-1 p-1.5 rounded-md bg-gray-200/50">
                    {child.icon}
                  </div>
                  {!isCollapsed && (
                    <span className="font-medium text-sm truncate relative z-10">
                      {child.text}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

SidebarItem.displayName = "SidebarItem";
SidebarSection.displayName = "SidebarSection";

export default Sidebar;