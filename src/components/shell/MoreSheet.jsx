import React from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { TabBadge } from "./NavBadges";

// What does not fit the bottom bar's four slots. A bottom sheet rather than a side drawer:
// it opens from the bar that summoned it and its content lands under the thumb instead of
// at the top of the screen.
//
// Pages are listed one level deep under their module and never nested further - that was
// the core problem with the sidebar this shell replaced.
export default function MoreSheet({ open, onOpenChange, modules, active }) {
  const close = () => onOpenChange(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="pb-safe fixed bottom-0 start-0 end-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-card text-card-foreground shadow-elevated lg:hidden"
        >
          <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-3">
            {/* Grab handle: the affordance people expect at the top of a sheet. */}
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-border"
            />
            <Dialog.Title className="mt-1 text-sm font-semibold tracking-tight">
              All modules
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="ms-auto grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <nav
            aria-label="All modules"
            className="erp-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3"
          >
            {modules.map((module) => (
              <section key={module.id} className="mb-2">
                <h2 className="flex items-center gap-2 px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {React.createElement(module.icon, { className: "h-4 w-4", "aria-hidden": "true" })}
                  {module.label}
                </h2>
                <ul className="grid grid-cols-2 gap-1">
                  {module.tabs.map((tab) => {
                    const isActive = tab === active?.tab;
                    return (
                      <li key={tab.to}>
                        <Link
                          to={tab.to}
                          onClick={close}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            // 44px tall rows: these are fingers, not a cursor.
                            "flex min-h-[2.75rem] items-center rounded-lg px-3 py-2 text-sm font-medium",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isActive
                              ? "bg-brand-soft text-brand-on-soft"
                              : "text-foreground active:bg-accent"
                          )}
                        >
                          <span className="truncate">{tab.label}</span>
                          <TabBadge tab={tab} className="ms-1.5 shrink-0" />
                          {tab.soon && (
                            <span className="ms-1.5 shrink-0 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-soft">
                              Soon
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
