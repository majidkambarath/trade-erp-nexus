import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Field, TextInput } from "../accounting/kit";
import { auth } from "../../lib/authApi";
import { looksLikeEmail } from "../../lib/twoFactorForms";
import AuthFrame, { errorBox, primaryButton } from "./AuthFrame";

// "Forgot my password": type the email, get a link. The page says the same thing whether or not the address has an account (the
// server does too), so it cannot be used to find out who has one. Outside the sign-in guard and the app shell.
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!looksLikeEmail(email)) return setProblem("Enter the email address you sign in with");
    setProblem("");
    setError("");
    setBusy(true);
    try {
      await auth.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      const status = err?.response?.status;
      setError(status === 429 ? err.response.data?.message || "Too many requests. Try again in a little while." : err?.response ? "Something went wrong. Try again." : "Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthFrame title="Check your email" footer={<Link to="/" className="font-medium text-foreground underline underline-offset-4">Back to sign in</Link>}>
        <div role="status" className="flex gap-3 rounded-xl border border-border bg-secondary/60 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="space-y-2 text-sm">
            <p>If <span className="font-medium">{email.trim()}</span> belongs to an account, a link to choose a new password is on its way.</p>
            <p className="text-muted-foreground">The link works once, for 30 minutes. If nothing arrives, look in your spam folder, then ask again. Your administrator can also reset your password.</p>
          </div>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Forgot your password?"
      lead="Type the email you sign in with. We will send a link to choose a new password."
      footer={<Link to="/" className="font-medium text-foreground underline underline-offset-4">Back to sign in</Link>}
    >
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Field label="Email address" required error={problem}>
          <TextInput type="email" autoComplete="username" inputMode="email" placeholder="you@company.com" value={email} onChange={(e) => { setEmail(e.target.value); setProblem(""); }} autoFocus />
        </Field>
        {error && <p role="alert" className={errorBox}>{error}</p>}
        <button type="submit" disabled={busy} className={primaryButton}>{busy ? "Sending…" : "Send the link"}</button>
      </form>
    </AuthFrame>
  );
}
