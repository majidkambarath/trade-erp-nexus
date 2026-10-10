import React, { useState } from "react";
import BrandMark from "../components/shell/BrandMark";
import { PRODUCT_NAME } from "../config/product";
import { Field, TextInput } from "../components/accounting/kit";
import { consoleError, consoleErrorCode, platform } from "./platformApi";
import { codePayload, codeProblem, typedDigits } from "../lib/twoFactorForms";

// The developer console's own sign-in. Separate from the product's: a customer's login does not open it, and a
// console account does not open a customer's data.
export default function PlatformLogin({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState(null); // the password was right and two-factor is on: the second step
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await platform.login(email.trim(), password);
      if (result?.twoFactorRequired) setChallenge(result.challengeToken);
      else onSignedIn(result);
    } catch (err) {
      setError(consoleError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event) => {
    event.preventDefault();
    if (busy) return;
    const problem = codeProblem(code, { allowRecovery: recovery });
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      onSignedIn(await platform.loginTwoFactor(challenge, codePayload(code)));
    } catch (err) {
      const kind = consoleErrorCode(err);
      // the challenge is over (it lasts five minutes) or the account is locked: back to the password
      if (kind === "CHALLENGE_EXPIRED" || kind === "CHALLENGE_INVALID" || err?.response?.status === 423) {
        setChallenge(null);
        setCode("");
        setPassword("");
      }
      setError(
        kind === "INVALID_TWO_FACTOR_CODE" ? "That code is not right. Check the six digits your app shows now, or use a recovery code."
          : kind === "TWO_FACTOR_CODE_REUSED" ? "That code has already been used. Wait for your app to show the next one."
            : consoleError(err)
      );
    } finally {
      setBusy(false);
    }
  };

  if (challenge) {
    return (
      <div className="pt-safe pb-safe grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <form onSubmit={submitCode} noValidate className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8" aria-label="Developer console second step">
          <h1 className="text-2xl font-semibold tracking-tight">{recovery ? "Use a recovery code" : "Enter your code"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {recovery ? "Type one of the recovery codes you saved. Each works once." : `Open your authenticator app and type the six digits it shows for ${email.trim()}.`}
          </p>
          <div className="mt-5">
            <Field label={recovery ? "Recovery code" : "Code from your app"} required>
              <TextInput
                value={code}
                onChange={(e) => { setCode(recovery ? e.target.value.toUpperCase() : typedDigits(e.target.value)); setError(""); }}
                inputMode={recovery ? "text" : "numeric"}
                autoComplete="one-time-code"
                placeholder={recovery ? "XXXXX-XXXXX" : "123 456"}
                className="text-center font-mono tracking-widest"
                autoFocus
              />
            </Field>
          </div>
          {error && <p role="alert" className="mt-4 rounded-lg border border-status-danger/25 bg-status-danger-soft px-3 py-2 text-sm text-status-danger">{error}</p>}
          <button type="submit" disabled={busy} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10">
            {busy ? "Checking…" : "Continue"}
          </button>
          <div className="mt-4 flex flex-col items-start gap-2 text-sm">
            <button type="button" onClick={() => { setRecovery((r) => !r); setCode(""); setError(""); }} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 lg:min-h-0">
              {recovery ? "Use the code from my app instead" : "Use a recovery code"}
            </button>
            <button type="button" onClick={() => { setChallenge(null); setCode(""); setError(""); }} className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4 lg:min-h-0">Back to sign in</button>
          </div>
        </form>
      </div>
    );
  }

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
