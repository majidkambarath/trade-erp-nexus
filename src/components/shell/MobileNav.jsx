import React from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import BrandMark from "./BrandMark";

// Below 640px the rail is hidden. This drawer lists every module with its pages one
// level deep - never nested further, which was the core problem with the old sidebar.
export default function MobileNav({ open, onOpenChange, modules, active, appName }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 sm:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 start-0 z-50 flex w-[min(20rem,85vw)] flex-col bg-sidebar text-sidebar-foreground shadow-elevated sm:hidden"
        >
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
            <BrandMark className="h-8 w-8" iconClassName="h-4 w-4" />
            <Dialog.Title className="text-sm font-extrabold tracking-tight">{appName}</Dialog.Title>
            <Dialog.Close
              aria-label="Close navigation"
              className="ms-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <nav aria-label="Main" className="erp-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {modules.map((module) => (
              <section key={module.id} className="mb-3">
                <h2 className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {React.createElement(module.icon, { className: "h-4 w-4", "aria-hidden": "true" })}
                  {module.label}
                </h2>
                <ul>
                  {module.tabs.map((tab) => {
                    const isActive = tab === active?.tab;
                    return (
                      <li key={tab.to}>
                        <Link
                          to={tab.to}
                          onClick={() => onOpenChange(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "block rounded-lg px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isActive
                              ? "bg-brand-soft text-brand-on-soft"
                              : "text-foreground hover:bg-accent"
                          )}
                        >
                          {tab.label}
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
