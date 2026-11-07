import React, { useState } from "react";
import { Button } from "../components/ui/button";
import { employeeApi, employeeError } from "./employeeApi";

export default function EmployeeLogin({ onSignedIn }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // login() only returns { id, staffId, mustChangePassword } - enough to authenticate, not enough to
      // show a name. me() reads the real profile so the header never shows the "My work" fallback for
      // the rest of a fresh session (it was otherwise stuck that way until a manual reload).
      await employeeApi.login(phone.trim(), password);
      onSignedIn(await employeeApi.me());
    } catch (err) {
      setError(employeeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-border p-6">
        <h1 className="mb-1 text-xl font-semibold text-foreground">My work</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in with the phone number your workplace registered for you.</p>
        {error && <p role="alert" className="mb-4 rounded-lg border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-foreground">Phone number</span>
          <input
            type="tel"
            required
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+971501234567"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base"
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium text-foreground">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base"
          />
        </label>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}
