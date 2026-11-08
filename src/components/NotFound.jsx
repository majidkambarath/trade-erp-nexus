import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, LayoutDashboard } from "lucide-react";
import { PRODUCT_NAME } from "../config/product";

// Shown for any address the router does not recognise (`path="*"`), which is a mistyped URL or an
// old bookmark. It sits OUTSIDE both the sign-in guard and the app shell, so it brings its own
// full-height frame, exactly as OrganisationBlocked and TwoFactorRequired do.
//
// There is deliberately no countdown and no automatic redirect: this page used to fire a
// `<meta http-equiv="refresh">` at the sign-in page while telling the person it was taking them to
// the dashboard, which moved them before they could read the address they had got wrong.
//
// "Go to dashboard" needs no check for whether anyone is signed in, and must not grow one. A fresh
// tab holds no access token in memory even for a signed-in person - RequireSession restores the
// session from the cookie - so asking here would answer "signed out" for someone who is not. The
// link is self-correcting: RequireSession either lets them through or sends them to sign in with
// `?next=/dashboard`, which brings them back.
export default function NotFound() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <main className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Compass className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">This page does not exist</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          There is nothing at this address. It may have been mistyped, or the page may have moved.
        </p>
        {/* The address itself, so a typo is visible rather than guessed at. React escapes it. */}
        <p className="mt-3 break-all rounded-lg bg-secondary px-3 py-2 font-mono text-xs text-foreground">
          {pathname}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent md:h-10"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </button>
          <Link
            to="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 md:h-10"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Go to dashboard
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">{PRODUCT_NAME}</p>
      </main>
    </div>
  );
}
