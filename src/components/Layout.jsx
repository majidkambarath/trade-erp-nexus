import React, { useState, useEffect } from "react";
import SidebarPage from "./SideBar.jsx";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 640) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <SidebarPage
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="erp-scope erp-page relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Mobile top bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-extrabold tracking-tight">NH FOODS</p>
            <p className="text-[11px] text-muted-foreground">UAE · ERP</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
