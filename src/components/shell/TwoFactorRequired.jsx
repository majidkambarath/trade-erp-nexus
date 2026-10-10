import React from "react";
import { ShieldCheck } from "lucide-react";
import { twoFactor } from "../../lib/authApi";
import { PRODUCT_NAME } from "../../config/product";
import TwoFactorEnrol from "../security/TwoFactorEnrol";

// Shown instead of the whole app to a person whose organisation requires two-factor sign-in and who has not set it up yet. The
// server refuses everything else for them until they do (TWO_FACTOR_ENROLMENT_REQUIRED), so this is the only page that can work.
// When it finishes the status is read again and the app opens on the same sign-in.
export default function TwoFactorRequired({ name, email, onEnrolled, onSignOut }) {
  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center bg-background px-4 py-6 text-foreground">
      <main className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight">Set up two-factor sign-in</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {name ? `${name}, your` : "Your"} organisation requires a code from an authenticator app, as well as your password, every time you sign in. It takes a minute, and you can then carry on.
        </p>
        <div className="mt-6">
          <TwoFactorEnrol
            api={twoFactor}
            account={email}
            issuer={PRODUCT_NAME}
            onFinished={onEnrolled}
            onCancel={onSignOut}
            cancelLabel="Sign out"
          />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">{PRODUCT_NAME}</p>
      </main>
    </div>
  );
}
