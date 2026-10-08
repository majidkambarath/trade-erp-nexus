import React, { useState } from "react";
import BrandMark from "../components/shell/BrandMark";
import { PRODUCT_NAME } from "../config/product";
import { Field, TextInput } from "../components/accounting/kit";
import { consoleError, platform } from "./platformApi";

// The developer console's own sign-in. Separate from the product's: a customer's login does not open it, and a
// console account does not open a customer's data.
export default function PlatformLogin({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onSignedIn(await platform.login(email.trim(), password));
    } catch (err) {
      setError(consoleError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8" aria-label="Developer console sign-in">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10" iconClassName="h-5 w-5" />
          <div>
            <p className="text-sm font-extrabold tracking-tight">{PRODUCT_NAME}</p>
            <p className="text-xs text-muted-foreground">Developer console</p>
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">For the people who run the product. A customer's login does not work here.</p>

        <div className="mt-5 space-y-4">
          <Field label="Email" required>
            <TextInput type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" required>
            <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-status-danger/25 bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
