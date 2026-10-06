import React from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import { moduleHref } from "../../config/navigation";
import BrandMark from "./BrandMark";

// Primary navigation: a narrow rail where every module shows an icon AND a label.
// Icon-only rails were rejected in the ERP redesign research for poor discoverability,
// and a wide sidebar for costing workspace. Sub-pages live in ModuleTabs, not here.
//
// Pointer-only: below lg (1024px) the rail plus a dense table left too little width, so
// BottomNav and MoreSheet carry the same information architecture on touch instead.
function RailItem({ module, isActive }) {
  return (
    <li>
      <Link
        to={moduleHref(module)}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex flex-col items-center gap-1 rounded-lg px-1 py-2.5",
          "text-[11px] font-semibold leading-tight transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive
            ? "bg-brand-soft text-brand-on-soft"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute -start-2 top-2 bottom-2 w-[3px] rounded-e-full bg-brand"
          />
        )}
        {React.createElement(module.icon, {
          className: "h-5 w-5",
          "aria-hidden": "true",
          strokeWidth: isActive ? 2.2 : 1.8,
        })}
        <span className="max-w-full text-center">{module.label}</span>
        {module.tabs.some((t) => t.soon) && (
          <span
            // marks a module containing an announced-but-unreleased feature
            title="Includes a feature coming soon"
            className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand"
          />
        )}
      </Link>
    </li>
  );
}

export default function AppRail({ modules, activeModuleId }) {
  const main = modules.filter((m) => m.placement !== "footer");
  const footer = modules.filter((m) => m.placement === "footer");

  return (
    <nav
      aria-label="Main"
      className="hidden w-[5.5rem] shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex"
    >
      <Link
        to="/dashboard"
        aria-label="Home"
        className="flex h-14 shrink-0 items-center justify-center border-b border-sidebar-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <BrandMark className="h-9 w-9" iconClassName="h-[18px] w-[18px]" />
      </Link>

      <ul className="erp-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {main.map((m) => (
          <RailItem key={m.id} module={m} isActive={m.id === activeModuleId} />
        ))}
      </ul>

      {footer.length > 0 && (
        <ul className="shrink-0 space-y-1 border-t border-sidebar-border px-2 py-3">
          {footer.map((m) => (
            <RailItem key={m.id} module={m} isActive={m.id === activeModuleId} />
          ))}
        </ul>
      )}
    </nav>
  );
}
