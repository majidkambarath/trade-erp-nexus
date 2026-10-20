import React from "react";
import { useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { moduleHref, modulesIn, visibleWorkspaces, workspaceOf } from "../../config/navigation";

const item =
  "flex cursor-pointer select-none items-start gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-accent";

// Which half of the product you are in. The ERP is buying, selling, stock and the books; the CRM is everything that
// happens before a sale exists. Switching changes the RAIL - the CRM has its own sections rather than being one tab
// strip among ten - and lands on that workspace's first page.
//
// Modelled on BranchSwitcher beside it, and it disappears the same way: a person who can only see one workspace is
// offered nothing, because there is nowhere to switch to. Nothing is stored - the workspace in use is read from the
// address (Layout.jsx), so Back, a reload and a pasted link all arrive in the right rail.
export default function WorkspaceSwitcher({ modules = [], activeModule = null }) {
  const navigate = useNavigate();
  const choices = visibleWorkspaces(modules);
  if (choices.length < 2) return null;

  const current = workspaceOf(activeModule);
  const open = (id) => {
    if (id === current) return;
    const first = modulesIn(id, modules)[0];
    const href = first && moduleHref(first);
    if (href) navigate(href);
  };

  const now = choices.find((w) => w.id === current) || choices[0];
  const Icon = now.icon;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Workspace: ${now.label}. Change workspace`}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{now.label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} className="z-50 min-w-64 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated">
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Switch to</p>
          {choices.map((w) => {
            const Mark = w.icon;
            return (
              <DropdownMenu.Item key={w.id} className={item} onSelect={() => open(w.id)}>
                <span className="grid h-4 w-4 shrink-0 place-items-center pt-0.5">{w.id === current && <Check className="h-4 w-4" aria-hidden="true" />}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Mark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {w.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{w.hint}</span>
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
