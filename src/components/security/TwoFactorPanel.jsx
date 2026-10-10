import React, { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { ConfirmDialog, Field, Modal, Panel, Pill, Spinner, TextInput } from "../accounting/kit";
import { formatDate } from "../../utils/format";
import { codePayload, codeProblem, manageProblem } from "../../lib/twoFactorForms";
import TwoFactorEnrol from "./TwoFactorEnrol";
import RecoveryCodes from "./RecoveryCodes";

const outline = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent md:h-10";
const filled = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 md:h-10";

// Asks for the password and a code (or a recovery code) before a change that matters: turning two-factor off, or replacing the
// recovery codes. The server asks for the same; this only saves a round trip and says what is missing.
function Reauthenticate({ title, description, confirmLabel, danger, run, onClose }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event?.preventDefault();
    if (busy) return;
    if (!password) return setError("Enter your password");
    const problem = codeProblem(code);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await run({ password, ...codePayload(code) });
    } catch (err) {
      setError(manageProblem(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={outline}>Cancel</button>
          <button type="submit" form="reauth-form" disabled={busy} className={`${filled} ${danger ? "!bg-destructive" : ""}`}>{busy ? "Working…" : confirmLabel}</button>
        </>
      }
    >
      <form id="reauth-form" onSubmit={submit} noValidate className="grid gap-4">
        <Field label="Your password" required>
          <TextInput type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} autoComplete="current-password" autoFocus />
        </Field>
        <Field label="Code from your app, or a recovery code" required>
          <TextInput value={code} onChange={(e) => { setCode(e.target.value); setError(""); }} autoComplete="one-time-code" placeholder="123 456" className="font-mono tracking-wider" />
        </Field>
        {error && <p role="alert" className="rounded-xl border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
      </form>
    </Modal>
  );
}

/**
 * A person's own two-factor: whether it is on, turning it on (QR code and key, then the recovery codes once), turning it off,
 * and replacing the recovery codes. Used on Settings -> Security for a customer's person and on the developer console's own
 * screen: `api` is the difference.
 *   api = { status() -> { enabled, enabledAt, recoveryCodesLeft }, setup, enable, disable(input), recoveryCodes(input) }
 *   locked: the organisation requires it, so it cannot be turned off (the server refuses too)
 */
export default function TwoFactorPanel({ api, account, issuer = "Zarvia", locked = false, onChanged, notify, children }) {
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [dialog, setDialog] = useState(null); // "enrol" | "disable" | "codes" | { codes } (just made)
  const [codesOnScreen, setCodesOnScreen] = useState(false); // two-factor is on and its recovery codes are showing, not yet confirmed kept
  const [confirmClose, setConfirmClose] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await api.status());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const changed = async () => {
    await load();
    await onChanged?.();
  };

  // Closing the setup before the recovery codes are kept would lose them for good (they are shown once): ask first.
  const closeEnrol = () => (codesOnScreen ? setConfirmClose(true) : setDialog(null));

  const on = Boolean(info?.enabled);
  const left = info?.recoveryCodesLeft ?? 0;

  return (
    <Panel
      title="Two-factor sign-in"
      description="Sign in with your password and then a six-digit code from an app on your phone. A stolen password is then not enough to get in."
      actions={info && <Pill tone={on ? "success" : "neutral"}>{on ? "On" : "Off"}</Pill>}
    >
      {!info && !loadError && <Spinner label="Loading two-factor" />}
      {loadError && !info && <p role="alert" className="text-sm text-status-danger">Could not load the two-factor status. <button type="button" onClick={load} className="font-medium underline underline-offset-4">Try again</button></p>}
      {info && !on && (
        <div className="grid max-w-xl gap-4">
          <p className="text-sm text-muted-foreground">Two-factor is off for your account. Anyone who learns your password can sign in as you.</p>
          <div><button type="button" onClick={() => setDialog("enrol")} className={filled}><ShieldCheck className="h-4 w-4" aria-hidden="true" />Turn on two-factor</button></div>
        </div>
      )}
      {info && on && (
        <div className="grid max-w-xl gap-4">
          <p className="text-sm">
            Two-factor is on{info.enabledAt ? <> since <span className="font-medium">{formatDate(info.enabledAt)}</span></> : null}.
            {" "}You have <span className="font-medium">{left}</span> recovery {left === 1 ? "code" : "codes"} left.
          </p>
          {left <= 2 && <p role="note" className="rounded-xl border border-status-warning/30 bg-status-warning-soft p-3 text-sm text-status-warning">{left === 0 ? "You have no recovery codes left." : "You are running low on recovery codes."} Make new ones so a lost phone does not lock you out.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDialog("codes")} className={outline}><KeyRound className="h-4 w-4" aria-hidden="true" />New recovery codes</button>
            {!locked && <button type="button" onClick={() => setDialog("disable")} className={outline}>Turn off two-factor</button>}
          </div>
          {locked && <p className="text-xs text-muted-foreground">Your organisation requires two-factor sign-in, so it cannot be turned off.</p>}
        </div>
      )}
      {children}

      {dialog === "enrol" && (
        <Modal title="Turn on two-factor" onClose={closeEnrol}>
          <TwoFactorEnrol
            api={api}
            account={account}
            issuer={issuer}
            onCancel={() => setDialog(null)}
            onEnabled={() => { setCodesOnScreen(true); changed(); }}
            onFinished={() => { setCodesOnScreen(false); setDialog(null); notify?.("Two-factor sign-in is on"); }}
          />
        </Modal>
      )}
      {confirmClose && (
        <ConfirmDialog
          title="Close without keeping your recovery codes?"
          text="They are shown only once. Two-factor is already on; if you lose them you can make new ones here with your password and a code."
          confirmLabel="Close anyway"
          onClose={() => setConfirmClose(false)}
          onConfirm={() => { setConfirmClose(false); setCodesOnScreen(false); setDialog(null); notify?.("Two-factor sign-in is on"); }}
        />
      )}
      {dialog === "disable" && (
        <Reauthenticate
          title="Turn off two-factor?"
          description="Signing in will ask for your password alone again."
          confirmLabel="Turn off"
          danger
          onClose={() => setDialog(null)}
          run={async (input) => { await api.disable(input); setDialog(null); notify?.("Two-factor sign-in is off"); await changed(); }}
        />
      )}
      {dialog === "codes" && (
        <Reauthenticate
          title="Make new recovery codes"
          description="The ones you have now will stop working."
          confirmLabel="Make new codes"
          onClose={() => setDialog(null)}
          run={async (input) => { const out = await api.recoveryCodes(input); setDialog({ codes: out.recoveryCodes }); await load(); }}
        />
      )}
      {dialog?.codes && (
        <Modal title="Your new recovery codes" onClose={() => setDialog(null)}>
          <RecoveryCodes codes={dialog.codes} account={account} issuer={issuer} doneLabel="Done" onDone={() => { setDialog(null); notify?.("New recovery codes made"); }} />
        </Modal>
      )}
    </Panel>
  );
}
