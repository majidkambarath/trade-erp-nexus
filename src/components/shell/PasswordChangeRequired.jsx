import React, { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import axiosInstance from "../../axios/axios";
import { Field, TextInput } from "../accounting/kit";
import { STRENGTH, passwordStrength } from "../../lib/settingsForm";
import { passwordHint, validatePasswordChange } from "../../lib/passwordForms";
import { PRODUCT_NAME } from "../../config/product";

// Shown instead of the whole app to a person whose password was set by somebody else (an administrator who added or reset
// them, or the developer who set up the organisation). The server refuses everything else until they choose their own, so this
// is the only page that can work. When it succeeds the status is read again and the app opens on the same sign-in.
export default function PasswordChangeRequired({ name, onChanged, onSignOut }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const strength = passwordStrength(form.newPassword);
  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((x) => ({ ...x, [key]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const found = validatePasswordChange(form);
    setErrors(found);
    setServerError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await axiosInstance.put("/profile/change-password", form);
      await onChanged();
    } catch (error) {
      setServerError(error?.response?.data?.message || error?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const type = show ? "text" : "password";
  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <main className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground">
          <KeyRound className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight">Choose your own password</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {name ? `${name}, the` : "The"} password you signed in with was set by someone else. Choose one only you know. You will use it from now on.
        </p>

        <form onSubmit={submit} noValidate className="mt-6 grid gap-5">
          <Field label="Password you signed in with" required error={errors.currentPassword}>
            <TextInput type={type} value={form.currentPassword} onChange={set("currentPassword")} autoComplete="current-password" />
          </Field>
          <Field label="New password" required error={errors.newPassword} hint={passwordHint}>
            <TextInput type={type} value={form.newPassword} onChange={set("newPassword")} autoComplete="new-password" />
          </Field>
          {form.newPassword && (
            <div aria-live="polite" className="-mt-2">
              <div className="h-1.5 w-full rounded-full bg-secondary"><div className={`h-1.5 rounded-full transition-all ${STRENGTH[strength].bar} ${STRENGTH[strength].width}`} /></div>
              <p className="mt-1 text-xs text-muted-foreground">Strength: {STRENGTH[strength].label}</p>
            </div>
          )}
          <Field label="Confirm new password" required error={errors.confirmPassword}>
            <TextInput type={type} value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-foreground" />
            Show passwords
          </label>
          {serverError && <p role="alert" className="rounded-xl border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{serverError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onSignOut} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent md:h-10">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
            <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 md:h-10">
              {busy ? "Saving…" : "Save my password"}
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">{PRODUCT_NAME}</p>
      </main>
    </div>
  );
}
