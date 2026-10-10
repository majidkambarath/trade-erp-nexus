import React from "react";
import BrandMark from "../shell/BrandMark";
import { PRODUCT_NAME } from "../../config/product";

// The plain frame of the pages a person reaches while NOT signed in, other than the sign-in page itself: "forgot my password",
// the emailed reset link. One centred card, no menu, nothing that needs a session.
export default function AuthFrame({ title, lead, children, footer }) {
  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center bg-background px-4 py-8 text-foreground">
      <main className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <span className="text-lg font-semibold tracking-tight">{PRODUCT_NAME}</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
        {lead && <p className="mt-2 text-sm text-muted-foreground">{lead}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </main>
    </div>
  );
}

export const primaryButton =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 lg:h-10";

export const errorBox = "rounded-xl border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger";
