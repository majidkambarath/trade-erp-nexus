import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { findActive, getMobileNav, getVisibleModules, moduleHref, pageTitle } from "../config/navigation";
import { getBrand } from "../config/brands";
import { PRODUCT_NAME } from "../config/product";
import AppRail from "./shell/AppRail";
import TopBar from "./shell/TopBar";
import ModuleTabs from "./shell/ModuleTabs";
import CommandPalette from "./shell/CommandPalette";
import BottomNav from "./shell/BottomNav";
import MoreSheet from "./shell/MoreSheet";
import { UpdateNotice } from "./shell/InstallApp";
import PageErrorBoundary from "./shell/PageErrorBoundary";
import { useSession } from "./shell/useSession";
import { OrganisationProvider, useOrganisation } from "./shell/OrganisationContext";
import OrganisationBlocked from "./shell/OrganisationBlocked";
import PasswordChangeRequired from "./shell/PasswordChangeRequired";
// shown only to a person whose organisation requires two-factor and who has not set it up: loaded when needed, so the setup
// (and the QR library behind it) is not part of what every signed-in person downloads first
const TwoFactorRequired = lazy(() => import("./shell/TwoFactorRequired"));
import NotInPlan from "./shell/NotInPlan";
import NotAllowed from "./shell/NotAllowed";
import { tabAllowed } from "../lib/permissions";
import SubscriptionNotice from "./shell/SubscriptionNotice";
import { NavBadgesProvider } from "./shell/NavBadges";
import { subscriptionNotice } from "../lib/subscriptionText";

// Shown while a page's own code is being fetched. Deliberately quiet - a spinner that fills
// the workspace reads as a failure; this reads as a pause.
function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center p-10">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-brand" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}

// Workspace-first shell (Aurify ERP Redesign): a narrow labelled rail for modules, a top
// bar for search and account, and the active module's pages as tabs above the content.
const LayoutShell = () => {
  const { pathname } = useLocation();
  const { profile, logout } = useSession();
  const { status, blocked, refresh, featureOn, branchKey, localeKey } = useOrganisation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // set by main.jsx when the service worker has a newer build waiting
  const [applyUpdate, setApplyUpdate] = useState(null);
  // The client's own name, empty on the shipped pack. The top bar shows it after the product
  // name; the browser tab falls back to the product when there is none.
  const clientName = getBrand().shortName;
  const appName = clientName || PRODUCT_NAME;
  // The top bar names the organisation whose data this is; the client pack's name is the fallback.
  const organisationName = status?.organisation?.legalName || clientName;

  // Only what the person's role may open AND the organisation's plan includes. While the status is unknown
  // nothing is hidden (the server refuses what the plan lacks).
  const modules = useMemo(() => getVisibleModules(status), [status]);
  const active = useMemo(() => findActive(pathname, modules), [pathname, modules]);
  // A page the plan does not include can still be reached by a typed address or an old bookmark: say so,
  // rather than loading a screen whose every request will be refused.
  const requested = useMemo(() => findActive(pathname), [pathname]);
  const outOfPlan = requested?.tab?.feature && !featureOn(requested.tab.feature) ? requested.tab.feature : null;
  // ...or by a role that does not include it: the same kindness, with a way to somewhere they CAN go
  const notAllowed = requested?.tab && !outOfPlan && !tabAllowed(requested.tab, status?.me) ? requested.tab : null;
  const home = modules[0] ? moduleHref(modules[0]) : null;
  const notice = useMemo(() => subscriptionNotice(status?.subscription), [status]);
  // Four modules for the bottom bar, the remainder for the More sheet.
  const { primary, rest } = useMemo(() => getMobileNav(modules), [modules]);

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

  // Navigating always dismisses the sheet, including via the back button.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // A newer build is cached and waiting. It is offered, not applied: see lib/pwa.js.
  useEffect(() => {
    const onReady = (e) => setApplyUpdate(() => e.detail);
    window.addEventListener("app-update-ready", onReady);
    return () => window.removeEventListener("app-update-ready", onReady);
  }, []);

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

  // The sheet belongs to the bottom bar, which is hidden from lg up; close it if the
  // window grows past the breakpoint so its focus trap and scroll lock never outlive it.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMoreOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // A subscription that has ended (or a suspended account) replaces the whole app with one page that says why.
  if (blocked) return <OrganisationBlocked blocked={blocked} onCheckAgain={refresh} onSignOut={logout} />;
  // A password someone else set must be replaced by the person's own before anything else works (the server refuses it all).
  if (status?.me?.mustChangePassword) return <PasswordChangeRequired name={status.me.name} onChanged={refresh} onSignOut={logout} />;
  // An organisation that requires two-factor sign-in: until the person has set it up, the server allows nothing but setting it up.
  if (status?.me?.twoFactorRequired) {
    return (
      <Suspense fallback={<PageLoading />}>
        <TwoFactorRequired name={status.me.name} email={status.me.email} onEnrolled={refresh} onSignOut={logout} />
      </Suspense>
    );
  }

  return (
    // A fixed frame, not `h-dvh` in the page's flow. In flow, any absolutely positioned element deep in a long page
    // (an sr-only span in a list, a row menu) took the WINDOW as its containing block, escaped this overflow-hidden and
    // made the document taller than the window: scrolling past the end of a list then slid the whole shell up, leaving
    // the bottom bar floating mid-window over an empty block. A fixed frame is the containing block for what is inside
    // it, clips it, and stays put whatever the document does.
    <div className="fixed inset-0 flex overflow-hidden bg-background text-foreground">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-3"
      >
        Skip to content
      </a>

      <AppRail modules={modules} activeModuleId={active?.module?.id} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          appName={organisationName}
          profile={profile}
          onLogout={logout}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <SubscriptionNotice notice={notice} />
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
          className="erp-scope min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none"
        >
          {/* a page that breaks shows a message here; the rail and header stay usable, and
              moving to another page clears it */}
          {/* choosing another branch starts the page afresh, so every list is read again for that branch */}
          <PageErrorBoundary key={`${branchKey}:${localeKey}`} resetKey={pathname}>
            {outOfPlan ? (
              <NotInPlan feature={outOfPlan} />
            ) : notAllowed ? (
              <NotAllowed me={status?.me} needed={notAllowed.permission} home={home} />
            ) : (
              <Suspense fallback={<PageLoading />}>
                <Outlet />
              </Suspense>
            )}
          </PageErrorBoundary>
        </main>

        <BottomNav
          primary={primary}
          rest={rest}
          activeModuleId={active?.module?.id}
          moreOpen={moreOpen}
          onOpenMore={() => setMoreOpen(true)}
        />
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} modules={modules} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} modules={rest} active={active} />
      {applyUpdate && (
        <UpdateNotice onApply={applyUpdate} onDismiss={() => setApplyUpdate(null)} />
      )}
    </div>
  );
};

// The organisation is loaded once, here, for everything inside the shell.
const Layout = () => (
  <OrganisationProvider>
    {/* the small counts beside a navigation entry (what is waiting for this person's approval) */}
    <NavBadgesProvider>
      <LayoutShell />
    </NavBadgesProvider>
  </OrganisationProvider>
);

export default Layout;
