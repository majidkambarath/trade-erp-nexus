import React from "react";
import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import BrandMark from "../components/shell/BrandMark";
import { PRODUCT_NAME } from "../config/product";
import { cn } from "../lib/utils";

const link = ({ isActive }) =>
  cn(
    "inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
  );

// The developer console's frame: a plain bar with the product, two places to go and who is signed in. It is a
// separate area from the product (no rail, no organisation, no customer navigation) because the people using it
// work ON organisations, not inside one.
export default function PlatformShell({ user, onSignOut, children }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="pt-safe border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <BrandMark className="h-8 w-8" iconClassName="h-4 w-4" />
          <span className="text-sm font-extrabold tracking-tight">{PRODUCT_NAME}</span>
          <span className="hidden rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground sm:inline">Developer console</span>
          <nav aria-label="Console" className="ms-2 flex items-center gap-1">
            <NavLink to="/platform" end className={link}>Organisations</NavLink>
            <NavLink to="/platform/activity" className={link}>Activity</NavLink>
            <NavLink to="/platform/security" className={link}>Security</NavLink>
          </nav>
          <div className="ms-auto flex min-w-0 items-center gap-2">
            <span className="hidden min-w-0 truncate text-sm text-muted-foreground md:inline">{user?.email}</span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-input bg-card px-3.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="pb-safe mx-auto max-w-6xl px-4 py-5 sm:py-6">{children}</main>
    </div>
  );
}
