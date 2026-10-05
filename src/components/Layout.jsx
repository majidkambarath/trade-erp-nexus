import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { findActive, getVisibleModules, pageTitle } from "../config/navigation";
import { getBrand } from "../config/brands";
import { PRODUCT_NAME } from "../config/product";
import AppRail from "./shell/AppRail";
import TopBar from "./shell/TopBar";
import ModuleTabs from "./shell/ModuleTabs";
import CommandPalette from "./shell/CommandPalette";
import MobileNav from "./shell/MobileNav";
import { useSession } from "./shell/useSession";

// Workspace-first shell (Aurify ERP Redesign): a narrow labelled rail for modules, a top
// bar for search and account, and the active module's pages as tabs above the content.
const Layout = () => {
  const { pathname } = useLocation();
  const { profile, role, logout } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // The client's own name, empty on the shipped pack. The top bar shows it after the product
  // name; the browser tab falls back to the product when there is none.
  const clientName = getBrand().shortName;
  const appName = clientName || PRODUCT_NAME;

  const modules = useMemo(() => getVisibleModules(role), [role]);
  const active = useMemo(() => findActive(pathname, modules), [pathname, modules]);

  useEffect(() => {
    document.title = pageTitle(active, appName);
  }, [active, appName]);

  // Ctrl/Cmd+K opens search from anywhere, including inside form fields.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Publish where the workspace starts so modals can open inside it, leaving the rail and
  // header visible and usable. Measured from the live element rather than hard-coded, so
  // it stays correct when the module tab row appears or the layout changes.
  const mainRef = useRef(null);
  const measureChrome = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    const { top, left } = el.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty("--modal-inset-top", `${Math.round(top)}px`);
    root.style.setProperty("--modal-inset-start", `${Math.round(left)}px`);
  }, []);

  useEffect(() => {
    measureChrome();
    const observer = new ResizeObserver(measureChrome);
    if (mainRef.current) observer.observe(mainRef.current);
    window.addEventListener("resize", measureChrome);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureChrome);
    };
  }, [measureChrome]);

  // the tab row appears and disappears per module, which moves the top of the workspace
  useEffect(measureChrome, [measureChrome, active]);

  // Lock page scroll while any modal is open. The app has 30 hand-rolled modal overlays
  // and only two of them did this, so scrolling inside an open form chained through to the
  // list behind it and scrolled it out from under the user. Watching the DOM fixes all of
  // them centrally; the Radix dialogs in the shell manage their own lock.
  useEffect(() => {
    const root = document.body;
    const anyDialogOpen = () => document.querySelector('[role="dialog"]') !== null;
    const sync = () => {
      root.style.overflow = anyDialogOpen() ? "hidden" : "";
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => {
      observer.disconnect();
      root.style.overflow = "";
    };
  }, []);

  // The drawer is mobile-only; close it if the window grows past the breakpoint so its
  // focus trap and scroll lock never outlive the (now hidden) drawer.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 640) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-3"
      >
        Skip to content
      </a>

      <AppRail modules={modules} activeModuleId={active?.module.id} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          appName={clientName}
          profile={profile}
          onLogout={logout}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <ModuleTabs module={active?.module} activeTab={active?.tab} />

        {/* erp-scope stays on the content only: it is the legacy shim that still themes
            unmigrated pages, and must not restyle the shell.
            min-h-0 is what lets this area shrink below its content and scroll on its own;
            anything setting a min-height here (the old .erp-page did, min-height: 100%)
            makes it as tall as the window and slides the whole shell off screen. */}
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="erp-scope min-h-0 flex-1 overflow-y-auto focus:outline-none"
        >
          <Outlet />
        </main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} modules={modules} />
      <MobileNav
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        modules={modules}
        active={active}
        appName={clientName}
      />
    </div>
  );
};

export default Layout;
