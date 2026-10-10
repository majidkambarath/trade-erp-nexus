import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { motionOK } from "./motion";
import { LayoutDashboard, TrendingUp, Package, ShoppingCart, RefreshCw, MapPin, Plus } from "lucide-react";
import { getBrand } from "@/config/brands";
import { CURRENCY, toInputDate } from "@/utils/format";
import { orgTimezone } from "@/utils/orgLocale";
import { dashboard } from "@/lib/dashboardApi";
import { defaultSelection, describePeriod } from "@/lib/dashboardPeriod";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ErrorNote } from "../accounting/kit";
import PeriodPicker from "./PeriodPicker";
import OverviewTab from "./OverviewTab";
import SalesTab from "./SalesTab";
import InventoryTab from "./InventoryTab";
import ReportsTab from "./ReportsTab";

// Home. Every figure and chart comes from GET /dashboard-summary (src/lib/dashboardApi.js), which
// reads the same reports the rest of the app uses, so nothing here is sampled or made up. Where
// there is nothing to show, the card says so in its own space. The Dashboard tab loads first; the
// other tabs load when they are opened, and all of them follow the period chosen above the tabs
// (PeriodPicker; src/lib/dashboardPeriod.js turns a choice into what the server is asked for).

// the header's date and time, on the organisation's own clock
const clockFormatter = (zone) =>
  new Intl.DateTimeFormat("en-AE", { timeZone: zone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Loads one part of the dashboard for a period once `enabled`, and again whenever the period
// changes (`scope` is memoised, so it is a new object only when the period really is). A reply to an
// older request never replaces a newer one.
function useSection(load, scope, enabled) {
  const [state, setState] = useState({ data: null, loading: false, error: null });
  const run = useRef(0);
  const reload = useCallback(() => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(() => load(scope.query))
      .then(
        (data) => id === run.current && setState({ data, loading: false, error: null }),
        (error) => id === run.current && setState((s) => ({ ...s, loading: false, error }))
      );
  }, [load, scope]);
  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);
  useEffect(() => () => { run.current += 1; }, []);
  return { ...state, reload };
}

function Failed({ state }) {
  if (!state.error) return null;
  return <div className="mb-4"><ErrorNote error={state.error} onRetry={state.reload} /></div>;
}

function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const [tab, setTab] = useState("overview");
  const [visited, setVisited] = useState({ overview: true });
  const [now, setNow] = useState(new Date());

  // What the person picked, and the last pick that could be asked for: a range that ends before it starts is explained
  // under the control while the figures stay on the period that was showing.
  const today = useMemo(() => toInputDate(now), [now]);
  const [selection, setSelection] = useState(defaultSelection);
  const [applied, setApplied] = useState(defaultSelection);
  const picked = useMemo(() => describePeriod(selection, today), [selection, today]);
  const scope = useMemo(() => describePeriod(applied, today), [applied, today]);
  const choose = (next) => {
    setSelection(next);
    if (describePeriod(next, today).ok) setApplied(next);
  };

  const core = useSection(dashboard.summary, scope, true);
  // what the figures are compared with is the server's own answer, shown only once it is the answer for THIS period
  const served = core.data?.period;
  const compare = served && served.from === scope.from && served.to === scope.to ? served : null;
  const analytics = useSection(dashboard.analytics, scope, true);
  const sales = useSection(dashboard.sales, scope, Boolean(visited.sales));
  const inventory = useSection(dashboard.inventory, scope, Boolean(visited.inventory));
  const reports = useSection(dashboard.reports, scope, Boolean(visited.finance));
  const sections = [core, analytics, sales, inventory, reports];
  const refreshing = sections.some((s) => s.loading);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!motionOK()) return undefined; // reduced motion (or no matchMedia): everything is simply there
    // fromTo with both ends written out, never from(): from() reads the element's CURRENT opacity as its end value, and a
    // card with a CSS transition (the four quick-action buttons) is part-way through one when the effect runs a second
    // time (React StrictMode, or a quick tab change) - it then "animated" to 5% opacity and stayed invisible.
    // clearProps hands the element back to its stylesheet when the reveal is over, so hover styles are the CSS's again.
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-anim='hero']", { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out", clearProps: "opacity,transform" });
      // the whole reveal takes 0.6s however many cards there are (it was 0.07s each: the last cards of a long page came in seconds late)
      gsap.fromTo(
        "[data-anim='bento']",
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: { amount: 0.6 }, delay: 0.08, ease: "power3.out", clearProps: "opacity,transform" },
      );
    }, rootRef);
    return () => ctx.revert();
  }, [theme, tab]);

  const clockLabel = useMemo(() => clockFormatter(orgTimezone()).format(now), [now]);

  // The tab row scrolls on a phone, so the chosen tab is brought into view - otherwise
  // picking "Reports" leaves it half off the right edge.
  const tabEls = useRef({});
  const tabRef = (value) => (el) => { tabEls.current[value] = el; };

  const openTab = (value) => {
    setTab(value);
    setVisited((v) => (v[value] ? v : { ...v, [value]: true }));
    tabEls.current[value]?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
  };

  const refresh = () => {
    if (motionOK()) gsap.fromTo("[data-anim='bento']", { opacity: 0.5, y: 8 }, { opacity: 1, y: 0, duration: 0.35, stagger: { amount: 0.4 }, clearProps: "opacity,transform" });
    [core, analytics, visited.sales && sales, visited.inventory && inventory, visited.finance && reports].filter(Boolean).forEach((s) => s.reload());
  };

  const company = core.data?.company;
  const busy = (s) => cn("transition-opacity", s.loading && s.data && "opacity-60");

  return (
    <div ref={rootRef} className="min-h-full bg-background font-sans text-foreground">
      <div className="mx-auto w-full max-w-[1680px] space-y-5 bg-background px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        {/* One row on a phone: the title on the left, Refresh and New Order on the right (they used to wrap
            under the title and leave the right half of the header empty), the company line across the full
            width below. At lg the actions sit beside both lines, as before. */}
        <div
          data-anim="hero"
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 lg:gap-y-0"
        >
          <div className="col-start-1 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">Operations Overview</h1>
            {company?.emirate && (
              <Badge variant="secondary" className="rounded-full border-0 bg-secondary font-semibold">
                <MapPin className="mr-1 h-3 w-3" />
                {company.emirate}, UAE
              </Badge>
            )}
          </div>

          <p className="col-span-2 row-start-2 text-sm text-muted-foreground lg:col-span-1 lg:col-start-1">
            {company?.name || getBrand().name} · {CURRENCY} · {clockLabel}
          </p>

          <div className="col-start-2 row-start-1 flex items-center gap-1 sm:gap-2 lg:row-span-2">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={refresh} aria-label="Refresh the figures">
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
            {/* icon only below sm (the name stays for a screen reader); the words come back from sm up */}
            <Button
              className="rounded-full bg-primary px-0 text-primary-foreground hover:opacity-90 max-sm:w-11 sm:px-5"
              onClick={() => navigate("/sales-order")}
              aria-label="New order"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Order</span>
            </Button>
          </div>
        </div>

        <PeriodPicker selection={selection} onChange={choose} today={today} scope={scope} problem={picked.ok ? null : picked.error} compare={compare} />

        <Tabs value={tab} onValueChange={openTab} className="gap-6">
          {/* Four pills with icons are ~510px. Centring that in a 390px screen made the whole
              page 450px wide and scrolled every card's left edge out of view. The row scrolls
              on its own instead, and only centres once it fits. */}
          <div className="sticky top-0 z-20 bg-background/90 py-1 backdrop-blur-md" data-anim="hero">
            <div className="scrollbar-none -mx-4 flex overflow-x-auto px-4 sm:mx-0 sm:justify-center sm:px-0">
              <TabsList className="h-12 shrink-0 gap-1 rounded-full bg-secondary/90 px-1.5 shadow-inner">
                <TabsTrigger ref={tabRef("overview")} value="overview" className="rounded-full px-3.5 sm:px-5">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger ref={tabRef("sales")} value="sales" className="rounded-full px-3.5 sm:px-5">
                  <ShoppingCart className="h-4 w-4" />
                  Sales
                </TabsTrigger>
                <TabsTrigger ref={tabRef("inventory")} value="inventory" className="rounded-full px-3.5 sm:px-5">
                  <Package className="h-4 w-4" />
                  Inventory
                </TabsTrigger>
                <TabsTrigger ref={tabRef("finance")} value="finance" className="rounded-full px-3.5 sm:px-5">
                  <TrendingUp className="h-4 w-4" />
                  Reports
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="overview" className="mt-2">
            <Failed state={core} />
            <Failed state={analytics} />
            <div aria-busy={core.loading || analytics.loading} className={busy(core)}>
              <OverviewTab core={core} analytics={analytics} scope={scope} theme={theme} />
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-5">
            <Failed state={sales} />
            <div aria-busy={sales.loading} className={busy(sales)}>
              <SalesTab state={sales} scope={scope} />
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-5">
            <Failed state={inventory} />
            <div aria-busy={inventory.loading} className={busy(inventory)}>
              <InventoryTab state={inventory} theme={theme} scope={scope} />
            </div>
          </TabsContent>

          <TabsContent value="finance" className="space-y-5">
            <Failed state={reports} />
            <div aria-busy={reports.loading} className={busy(reports)}>
              <ReportsTab state={reports} scope={scope} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Dashboard;
