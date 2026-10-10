import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Field, TextInput } from "../accounting/kit";
import { auth } from "../../lib/authApi";
import { STRENGTH, passwordStrength } from "../../lib/settingsForm";
import { passwordHint } from "../../lib/passwordForms";
import { resetProblem, tokenFromSearch, validateNewPassword } from "../../lib/twoFactorForms";
import AuthFrame, { errorBox, primaryButton } from "./AuthFrame";

// The page the emailed link opens: choose a new password. Outside the sign-in guard and the app shell.
//
// The token in the link is a password for a few minutes: it is read once, held in memory, and taken out of the address bar at
// once, so it is not left in the history, not shown over a shoulder and not sent on as a referrer. Reloading the page therefore
// asks for a new link, which is the point.
export default function ResetPassword() {
  const { search } = useLocation();
  const [token] = useState(() => tokenFromSearch(search));
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [done, setDone] = useState(false);
  const strength = passwordStrength(form.password);

  useEffect(() => {
    if (search) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [search]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const found = validateNewPassword(form);
    setErrors(found);
    setProblem(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await auth.resetPassword(token, form.password);
      setDone(true);
    } catch (err) {
      setProblem(resetProblem(err));
    } finally {
      setBusy(false);
    }
  };

  const askAgain = <Link to="/forgot-password" className="font-medium text-foreground underline underline-offset-4">Ask for a new link</Link>;

  if (done) {
    return (
      <AuthFrame title="Password changed">
        <div role="status" className="flex gap-3 rounded-xl border border-border bg-secondary/60 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-success" aria-hidden="true" />
          <p>Your password has been changed, and you have been signed out everywhere. Sign in with the new one.</p>
        </div>
        <Link to="/" className={`${primaryButton} mt-5`}>Go to sign in</Link>
      </AuthFrame>
    );
  }

  if (!token || problem?.dead) {
    return (
      <AuthFrame title="This link does not work" lead="It may have been used already, have run out (a link lasts 30 minutes), or have been copied wrongly." footer={askAgain}>
        <Link to="/" className="text-sm font-medium text-foreground underline underline-offset-4">Back to sign in</Link>
      </AuthFrame>
    );
  }

  const type = show ? "text" : "password";
  return (
    <AuthFrame title="Choose a new password" lead="Use something you do not use anywhere else." footer={<Link to="/" className="font-medium text-foreground underline underline-offset-4">Back to sign in</Link>}>
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Field label="New password" required error={errors.password} hint={passwordHint}>
          <TextInput type={type} value={form.password} onChange={set("password")} autoComplete="new-password" autoFocus />
        </Field>
        {form.password && (
          <div aria-live="polite" className="-mt-2">
            <div className="h-1.5 w-full rounded-full bg-secondary"><div className={`h-1.5 rounded-full transition-all ${STRENGTH[strength].bar} ${STRENGTH[strength].width}`} /></div>
            <p className="mt-1 text-xs text-muted-foreground">Strength: {STRENGTH[strength].label}</p>
          </div>
        )}
        <Field label="Confirm new password" required error={errors.confirm}>
          <TextInput type={type} value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-foreground" />
          Show passwords
        </label>
        {problem && <p role="alert" className={errorBox}>{problem.text}</p>}
        <button type="submit" disabled={busy} className={primaryButton}>{busy ? "Saving…" : "Save my new password"}</button>
      </form>
    </AuthFrame>
  );
}
