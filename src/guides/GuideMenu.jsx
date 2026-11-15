// "Guide me" in the top bar: the guides this person may run, the ones for the screen they are on first.
import React from "react";
import { useLocation } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, LifeBuoy } from "lucide-react";
import { useGuides } from "./guideContext";
import { ui, wording } from "./index";

const item =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-accent";

export default function GuideMenu() {
  const { flows, start, done, table, active } = useGuides();
  const { pathname } = useLocation();
  if (!flows.length) return null; // a person who may run no guide is not shown a button that opens nothing

  const here = (f) => f.steps.some((s) => s.kind === "go" && (pathname === s.to || pathname.startsWith(`${s.to}/`)));
  const ordered = [...flows].sort((a, b) => Number(here(b)) - Number(here(a)));
  const label = ui(table, "guideMe");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        title={label}
        data-guide="guide-me"
        className="inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground data-[state=open]:bg-accent"
      >
        <LifeBuoy className="h-4 w-4" aria-hidden="true" />
        <span className="hidden lg:inline">{label}</span>
        <span className="sr-only lg:hidden">{label}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-[60] w-72 rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          <DropdownMenu.Label className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{ui(table, "menuTitle")}</DropdownMenu.Label>
          {ordered.map((f) => {
            const w = wording(table, `flow.${f.id}`);
            return (
              <DropdownMenu.Item key={f.id} data-flow={f.id} className={item} onSelect={() => start(f.id)} disabled={Boolean(active)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{w.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{ui(table, "minutes", f.minutes)}{here(f) ? ` · ${ui(table, "here")}` : ""}</span>
                </span>
                {done(f.id) && <Check className="h-4 w-4 text-status-success" aria-label={ui(table, "finished")} />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
