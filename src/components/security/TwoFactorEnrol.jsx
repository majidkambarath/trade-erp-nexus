import React, { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Field, TextInput } from "../accounting/kit";
import { qrDataUrl } from "../../lib/qr";
import { codePayload, codeProblem, manageProblem, typedDigits } from "../../lib/twoFactorForms";
import RecoveryCodes from "./RecoveryCodes";

const secondary = "inline-flex h-11 items-center justify-center rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent md:h-10";
const primary = "inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 md:h-10";

// Setting two-factor up, in three steps, for a customer's person and for the developer console alike (`api` is the difference):
//   1. the password again (a borrowed session must not be able to bind someone else's app)
//   2. scan the QR code, or type the key into the authenticator app, then type the six digits it shows
//   3. the recovery codes, once
// `api` = { setup(password) -> { secret, formattedSecret, uri, account, issuer }, enable(code) -> { recoveryCodes } }.
// `onEnabled` fires the moment the server has turned it on (the recovery codes are then on screen); `onFinished` when the person
// has confirmed they kept them.
export default function TwoFactorEnrol({ api, account, issuer = "Zarvia", onEnabled, onFinished, onCancel, cancelLabel = "Cancel" }) {
  const [step, setStep] = useState("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [shown, setShown] = useState(null); // what setup returned: the key and the address the QR code carries
  const [qr, setQr] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [codes, setCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // draw the QR code once there is an address; if the drawing cannot happen, the typed key is still there
  useEffect(() => {
    if (!shown?.uri) return undefined;
    let live = true;
    qrDataUrl(shown.uri).then((url) => live && setQr(url), () => live && setQrFailed(true));
    return () => { live = false; };
  }, [shown]);

  async function begin(event) {
    event.preventDefault();
    if (busy) return;
    if (!password) return setError("Enter your password");
    setBusy(true);
    setError("");
    try {
      setShown(await api.setup(password));
      setPassword("");
      setStep("scan");
    } catch (err) {
      setError(manageProblem(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event) {
    event.preventDefault();
    if (busy) return;
    const problem = codeProblem(code, { allowRecovery: false });
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      const result = await api.enable(codePayload(code).code);
      setCodes(result.recoveryCodes || []);
      setStep("codes");
      onEnabled?.(); // it is ON from here, whether or not the codes below are kept: whoever holds this dialog can say so at once
    } catch (err) {
      setError(manageProblem(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(shown.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (step === "codes") {
    return (
      <RecoveryCodes
        codes={codes}
        account={account}
        issuer={issuer}
        notice="Two-factor sign-in is on."
        doneLabel="Done"
        onDone={() => onFinished?.()}
      />
    );
  }

  if (step === "scan" && shown) {
    return (
      <form onSubmit={confirm} noValidate className="grid gap-5">
        <ol className="grid gap-4 text-sm">
          <li className="grid gap-3">
            <p><span className="font-medium">1.</span> Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password...) and scan this code.</p>
            <div className="flex justify-center rounded-xl border border-border bg-white p-2 sm:justify-start" style={{ minHeight: 232 }}>
              {qr ? <img src={qr} alt={`QR code to add ${account || "this account"} to an authenticator app`} width={216} height={216} /> : (
                <p className="self-center px-4 text-sm text-neutral-600" role="status">{qrFailed ? "The picture could not be drawn. Type the key below into your app instead." : "Drawing the code…"}</p>
              )}
            </div>
            <p className="text-muted-foreground">Cannot scan it? Choose &ldquo;enter a setup key&rdquo; in your app and type this key (time-based):</p>
            <div className="flex flex-wrap items-center gap-2">
              <code aria-label="Setup key" className="select-all rounded-lg border border-border bg-secondary/60 px-3 py-2 font-mono text-sm tracking-wider">{shown.formattedSecret}</code>
              <button type="button" onClick={copyKey} className="inline-flex h-11 items-center gap-2 rounded-full border border-input bg-card px-4 text-sm font-medium hover:bg-accent md:h-10">
                <Copy className="h-4 w-4" aria-hidden="true" />Copy key
              </button>
              <span role="status" className="text-xs text-muted-foreground">{copied ? "Copied" : ""}</span>
            </div>
          </li>
          <li className="grid gap-2">
            <p><span className="font-medium">2.</span> Type the six digits your app shows now.</p>
            <Field label="Code from your app" required>
              <TextInput value={code} onChange={(e) => { setCode(typedDigits(e.target.value)); setError(""); }} inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" className="max-w-[10rem] text-center font-mono tracking-widest" autoFocus />
            </Field>
          </li>
        </ol>
        {error && <p role="alert" className="rounded-xl border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {onCancel && <button type="button" onClick={onCancel} className={secondary}>{cancelLabel}</button>}
          <button type="submit" disabled={busy} className={primary}>{busy ? "Checking…" : "Turn on two-factor"}</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={begin} noValidate className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        You will sign in with your password and then a six-digit code from an app on your phone. Confirm your password to begin.
      </p>
      <Field label="Your password" required>
        <TextInput type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} autoComplete="current-password" autoFocus />
      </Field>
      {error && <p role="alert" className="rounded-xl border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel && <button type="button" onClick={onCancel} className={secondary}>{cancelLabel}</button>}
        <button type="submit" disabled={busy} className={primary}>{busy ? "Checking…" : "Continue"}</button>
      </div>
    </form>
  );
}
