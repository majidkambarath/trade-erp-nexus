import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { branchChoices, branchInUse } from "../../lib/organisation";
import { useOrganisation } from "./OrganisationContext";

const item =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-accent";

// Where the person is working. An organisation with one branch shows nothing. A head-office user can switch between
// every branch and each one (documents, ledger and reports then show that branch alone); anyone else sees their own
// branch's name, because that is all they will ever be shown. A person who belongs to a branch but was given a role in
// others is offered exactly those branches. Someone whose role differs by branch (`canViewAll` false in the status) is
// never offered "All branches": they work in one branch at a time, and the switcher names the one in use. Choosing a
// branch sends it as X-Branch and reads the status again (`selectBranch`), so the role and permissions of THAT branch
// apply at once.
export default function BranchSwitcher() {
  const { status, branch, selectBranch } = useOrganisation();
  if (!branch?.label) return null;

  const choices = branchChoices(status);
  if (choices.length === 0) {
    return (
      <span className="hidden shrink-0 items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        {branch.label}
      </span>
    );
  }

  const current = branchInUse(status, branch.selected);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Branch: ${branch.label}. Change branch`}
        className="inline-flex h-9 max-w-44 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{branch.label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} className="z-50 min-w-56 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated">
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work in</p>
          {choices.map((c) => (
            <DropdownMenu.Item key={c.value || "all"} className={item} onSelect={() => c.value !== current && selectBranch(c.value)}>
              <span className="grid h-4 w-4 place-items-center">{c.value === current && <Check className="h-4 w-4" aria-hidden="true" />}</span>
              {c.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
