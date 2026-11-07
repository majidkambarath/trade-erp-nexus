// Shown instead of the rest of the portal while profile.mustChangePassword is true - an administrator set
// the first password, so it is changed before anything else, the same gate PasswordChangeRequired.jsx
// holds the main app to (controllers/hr/employeePortalController.js changePassword clears the flag).
import React, { useState } from "react";
import { Button } from "../components/ui/button";
import { employeeApi, employeeError } from "./employeeApi";

export default function EmployeeChangePassword({ onChanged }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (newPassword !== confirm) { setError("The two passwords do not match"); return; }
    setBusy(true);
    setError(null);
    try {
      await employeeApi.changePassword(currentPassword, newPassword);
      onChanged(await employeeApi.me());
    } catch (err) {
      setError(employeeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-border p-6">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Choose your own password</h1>
        <p className="mb-6 text-sm text-muted-foreground">Your workplace set a temporary password for you. Choose one only you know before continuing.</p>
        {error && <p role="alert" className="mb-4 rounded-lg border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-foreground">Current password</span>
          <input type="password" required autoFocus value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base" />
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-foreground">New password</span>
          <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base" />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium text-foreground">Confirm new password</span>
          <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base" />
        </label>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Set password"}</Button>
      </form>
    </div>
  );
}
