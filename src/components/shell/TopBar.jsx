import React from "react";
import { useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, LogOut, Moon, Search, Settings } from "lucide-react";
import { useTheme } from "../theme-provider";
import { initials } from "./useSession";
import BrandMark from "./BrandMark";
import { PRODUCT_NAME } from "../../config/product";
import { useInstall } from "./InstallApp";
import BranchSwitcher from "./BranchSwitcher";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

const menuItem =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-accent";

function UserMenu({ profile, onLogout }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { canInstall, install, iosSheet } = useInstall();
  const name = profile?.name || "Signed in";

  return (
    <>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Account menu for ${name}`}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground lg:h-9 lg:w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {initials(profile?.name)}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-60 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-bold">{name}</p>
            {profile?.email && (
              <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
            )}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {/* Only once the browser says it can be installed, and never once it is. */}
          {canInstall && (
            <DropdownMenu.Item className={menuItem} onSelect={install}>
              <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Install app
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className={menuItem} onSelect={() => navigate("/settings")}>
            <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.CheckboxItem
            className={menuItem}
            checked={theme === "dark"}
            onCheckedChange={toggleTheme}
            // keep the menu open so the change can be seen
            onSelect={(e) => e.preventDefault()}
          >
            <Moon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Dark mode
            <span
              aria-hidden="true"
              className={`ms-auto h-5 w-9 rounded-full p-0.5 transition-colors ${
                theme === "dark" ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-card transition-transform ${
                  theme === "dark" ? "translate-x-4 rtl:-translate-x-4" : ""
                }`}
              />
            </span>
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item className={`${menuItem} text-status-danger`} onSelect={onLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    {iosSheet}
    </>
  );
}

export default function TopBar({ appName, profile, onLogout, onOpenSearch }) {
  // pt-safe keeps the row clear of a notch or status bar; the 3.5rem row itself is nested
  // inside, so the inset is added to the header rather than eaten out of the controls.
  return (
    <header className="pt-safe shrink-0 border-b border-border bg-card">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        {/* The rail carries the mark on a pointer; on touch the rail is gone, so it sits here.
            Navigation itself is the bottom bar - there is deliberately no hamburger. */}
        <BrandMark className="h-8 w-8 lg:hidden" iconClassName="h-4 w-4" />
        {/* The product leads; the client whose data this is follows it, quieter. */}
        <span className="shrink-0 text-sm font-extrabold tracking-tight">{PRODUCT_NAME}</span>
        {appName && (
          <>
            <span aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />
            <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
              {appName}
            </span>
          </>
        )}

        <BranchSwitcher />

        <button
          type="button"
          onClick={onOpenSearch}
          className="ms-auto flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-input bg-background text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9 lg:w-72 lg:justify-start lg:px-3"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden lg:inline">Search pages…</span>
          <kbd className="ms-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-semibold lg:inline">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
          <span className="sr-only lg:hidden">Search pages</span>
        </button>

        <UserMenu profile={profile} onLogout={onLogout} />
      </div>
    </header>
  );
}
