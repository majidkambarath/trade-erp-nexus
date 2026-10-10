import React from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { moduleHref } from "../../config/navigation";
import { CountPill, useModuleBadge } from "./NavBadges";

// Primary navigation below the desktop breakpoint: four modules in the thumb zone plus
// More, the way a native app does it. The labelled rail (AppRail) is the same idea for a
// pointer; this is its touch counterpart, so both read from src/config/navigation.js.
//
// Height is 3.5rem of controls plus the device's own bottom inset (the iPhone home bar),
// published as --bottom-nav-h so Layout can reserve exactly that much room for content.
function NavButton({ icon, label, isActive, badge, count, ...props }) {
  const Tag = props.to ? Link : "button";
  return (
    <Tag
      {...(Tag === "button" ? { type: "button" } : {})}
      {...props}
      aria-current={props.to && isActive ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5",
        // 44px is the smallest comfortable touch target; the row is taller than that.
        "min-h-[2.75rem] text-[11px] font-semibold leading-none transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isActive ? "text-brand" : "text-muted-foreground active:bg-accent"
      )}
    >
      {/* The active pip sits above the icon rather than under the label: a bottom
          underline would collide with the home bar on a gesture-nav phone. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 h-0.5 w-8 rounded-b-full transition-colors",
          isActive ? "bg-brand" : "bg-transparent"
        )}
      />
      {React.createElement(icon, {
        className: "h-[22px] w-[22px] shrink-0",
        "aria-hidden": "true",
        strokeWidth: isActive ? 2.2 : 1.8,
      })}
      <span className="max-w-full truncate px-0.5">{label}</span>
      {badge && (
        <span
          aria-hidden="true"
          className="absolute end-[22%] top-1 h-1.5 w-1.5 rounded-full bg-brand"
        />
      )}
      {/* what is waiting behind one of the module's tabs (config/navigation.js `badge`) */}
      <CountPill count={count} className="absolute end-[14%] top-0.5" />
    </Tag>
  );
}

// One module in the bar: its icon and name, a dot if it holds an announced feature, and a number if something waits in it.
function ModuleButton({ module, isActive }) {
  const waiting = useModuleBadge(module);
  return (
    <NavButton
      to={moduleHref(module)}
      icon={module.icon}
      label={module.label}
      isActive={isActive}
      badge={module.tabs.some((t) => t.soon)}
      count={waiting}
    />
  );
}

export default function BottomNav({ primary, rest, activeModuleId, onOpenMore, moreOpen }) {
  const restHasActive = rest.some((m) => m.id === activeModuleId);

  // The shell is a fixed-height flex column with its own scrolling pane, so the bar is a
  // normal last child rather than a fixed overlay: nothing to reserve space for, and no
  // chance of it covering the last row of a list.
  return (
    <nav
      aria-label="Modules"
      className="pb-safe shrink-0 border-t border-border bg-card lg:hidden"
    >
      <ul className="flex items-stretch gap-0.5 px-1 pt-0.5">
        {primary.map((m) => (
          <li key={m.id} className="flex min-w-0 flex-1">
            <ModuleButton module={m} isActive={m.id === activeModuleId} />
          </li>
        ))}
        {rest.length > 0 && (
          <li className="flex min-w-0 flex-1">
            <NavButton
              onClick={onOpenMore}
              icon={MoreHorizontal}
              label="More"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              isActive={moreOpen || restHasActive}
            />
          </li>
        )}
      </ul>
    </nav>
  );
}
