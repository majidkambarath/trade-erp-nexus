import React, { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { auth } from "../../lib/authApi";
import { codePayload, codeProblem, secondStepProblem, typedDigits } from "../../lib/twoFactorForms";
import { cn } from "../../lib/utils";

// Sign-in, step two: the password was right and the account has two-factor on, so the server wants a code from the authenticator
// app - or one of the ten recovery codes, for a lost phone. A challenge from step one (good for five minutes) is what ties this
// to the password just typed. `onSignedIn(data)` gets the same payload a one-step sign-in returns; `onRestart(message)` sends the
// person back to the password when the challenge is over (it expired, or the account is locked).
export default function TwoFactorStep({ challengeToken, email, onSignedIn, onRestart }) {
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const change = (e) => {
    setCode(recovery ? e.target.value.toUpperCase() : typedDigits(e.target.value));
    setError("");
  };

  const switchMode = () => {
    setRecovery((r) => !r);
    setCode("");
    setError("");
  };

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const problem = codeProblem(code, { allowRecovery: recovery });
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      const body = await auth.loginTwoFactor(challengeToken, codePayload(code)); // { success, data: { admin, tokens } }
      if (!body?.success) throw Object.assign(new Error("failed"), { response: { data: body } });
      onSignedIn(body.data);
    } catch (err) {
      const { text, restart } = secondStepProblem(err);
      if (restart) onRestart(text);
      else {
        setError(text);
        setBusy(false);
      }
    }
  }

  return (
    <>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground">
        {recovery ? <KeyRound className="h-6 w-6" aria-hidden="true" /> : <ShieldCheck className="h-6 w-6" aria-hidden="true" />}
      </span>
      <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{recovery ? "Use a recovery code" : "Enter your code"}</h2>
      <p className="mt-2 text-muted-foreground">
        {recovery
          ? "Type one of the recovery codes you saved when you turned two-factor on. Each works once."
          : `Open your authenticator app and type the six digits it shows for ${email || "your account"}.`}
      </p>

      {error && (
        <div id="login-error" role="alert" className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="two-factor-code" className="text-sm font-semibold text-foreground">{recovery ? "Recovery code" : "Code from your app"}</label>
          <input
            id="two-factor-code"
            value={code}
            onChange={change}
            autoFocus
            autoComplete="one-time-code"
            inputMode={recovery ? "text" : "numeric"}
            placeholder={recovery ? "XXXXX-XXXXX" : "123 456"}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            spellCheck={false}
            className={cn(
              "h-12 w-full rounded-xl border bg-card px-4 text-center font-mono text-lg tracking-widest text-foreground",
              "placeholder:text-muted-foreground outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
              error ? "border-destructive" : "border-input"
            )}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
              Checking…
            </>
          ) : (
            "Continue"
          )}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-start gap-2 text-sm">
        <button type="button" onClick={switchMode} className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 lg:min-h-0">
          {recovery ? "Use the code from my app instead" : "Use a recovery code"}
        </button>
        <button type="button" onClick={() => onRestart("")} className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4 hover:text-foreground lg:min-h-0">
          Back to sign in
        </button>
      </div>
    </>
  );
}
