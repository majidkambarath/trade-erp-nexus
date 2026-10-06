import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

// Secondary navigation for the active module, as tabs in the page header. These are
// links to separate pages, so this is a <nav> with aria-current, not an ARIA tablist
// (role="tablist" is for switching panels within one page).
export default function ModuleTabs({ module, activeTab }) {
  const activeRef = useRef(null);

  // Keep the current tab visible when tabs overflow on narrow screens (Finance has 7).
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeTab?.to]);

  // Single-page modules (Home, Reports, People, Settings) need no tab row.
  if (!module || module.tabs.length < 2) return null;

  return (
    <div className="flex shrink-0 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
      {/* The module name is already under the thumb in the bottom bar on touch, so it only
          earns its width next to the rail. */}
      <span className="hidden shrink-0 text-sm font-bold text-foreground lg:block">
        {module.label}
      </span>
      <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-border lg:block" />
      <nav
        aria-label={module.label}
        // snap-x makes the flick land on a tab edge instead of mid-label; the gradient
        // mask on the trailing edge is what tells a touch user there is more to swipe to.
        className="scrollbar-none tab-strip-fade -mb-px min-w-0 snap-x snap-proximity overflow-x-auto overscroll-x-contain"
      >
        <ul className="flex">
          {module.tabs.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <li key={tab.to} className="shrink-0 snap-start">
                <Link
                  ref={isActive ? activeRef : undefined}
                  to={tab.to}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    // 48px tall on touch (44px is the minimum comfortable target), 44 on a pointer
                    "relative flex h-12 items-center whitespace-nowrap px-3.5 text-sm font-semibold transition-colors lg:h-11 lg:px-3",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
              {tab.soon && (
                <span className="ms-2 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-on-soft">
                  Soon
                </span>
              )}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
