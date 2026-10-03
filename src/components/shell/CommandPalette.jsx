import React from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { CornerDownLeft, Search } from "lucide-react";

// Ctrl/Cmd+K: jump to any page by name. Covers every destination the user may open
// without adding anything to the rail. Old page names stay searchable through each
// tab's `keywords` (e.g. "debit accounts" finds Purchase > Payables).
export default function CommandPalette({ open, onOpenChange, modules }) {
  const navigate = useNavigate();

  const go = (to) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-[12vh] z-50 mx-auto w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-elevated"
        >
          <Dialog.Title className="sr-only">Go to page</Dialog.Title>
          <Command label="Go to page" loop>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Command.Input
                placeholder="Search pages…"
                className="h-12 w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="erp-scroll max-h-[min(60vh,24rem)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
                No page matches that search.
              </Command.Empty>
              {modules.map((module) => (
                <Command.Group
                  key={module.id}
                  heading={module.label}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {module.tabs.map((tab) => (
                    <Command.Item
                      key={tab.to}
                      // Unique and searchable: "Orders" exists in both Sales and Purchase.
                      value={`${tab.label} ${module.label} ${tab.to}`}
                      keywords={tab.keywords}
                      onSelect={() => go(tab.to)}
                      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground data-[selected=true]:bg-accent"
                    >
                      {React.createElement(module.icon, {
                        className: "h-4 w-4 shrink-0 text-muted-foreground",
                        "aria-hidden": "true",
                      })}
                      <span className="font-medium">{tab.label}</span>
                      {module.tabs.length > 1 && (
                        <span className="text-muted-foreground">{module.label}</span>
                      )}
                      <CornerDownLeft
                        aria-hidden="true"
                        className="ms-auto h-3.5 w-3.5 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100"
                      />
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
