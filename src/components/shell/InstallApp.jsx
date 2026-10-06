import React, { useEffect, useState } from "react";
import { Share, Plus, X, ShieldAlert } from "lucide-react";
import { installState, onInstallChange, promptInstall } from "../../lib/pwa";

/**
 * Keeps the install offer in step with the browser. Returns the current state, which is one of
 * "ready" (a tap installs it), "manual" (Safari, which needs telling how), "insecure" (an
 * address no browser will install from), "installed" or "unsupported" - the last two meaning
 * there is nothing to offer.
 */
export function useInstallState() {
  const [state, setState] = useState(() => installState());
  useEffect(() => onInstallChange(() => setState(installState())), []);
  return state;
}

/**
 * How to install on iOS, where there is no prompt to call. Shown only when the person asks for
 * it, so the app never nags about adding itself to a home screen.
 */
export function IosInstallSheet({ onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 md:items-center md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="pb-safe w-full max-w-sm rounded-t-2xl border border-border bg-card p-5 shadow-elevated md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="install-title" className="text-base font-semibold text-foreground">
            Add Zarvia to your Home Screen
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <ol className="mt-4 space-y-3 text-sm text-foreground">
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary">
              <Share className="h-4 w-4" aria-hidden="true" />
            </span>
            Tap Share at the bottom of Safari
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
            Choose <strong className="font-semibold">Add to Home Screen</strong>
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          It then opens full screen, without the browser bars, like any other app on the device.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/**
 * Why nothing happened. A browser only installs from https (or localhost), so the dev server
 * opened by its LAN address cannot - and that is worth saying plainly rather than leaving a
 * menu item that quietly does nothing.
 */
export function InsecureInstallSheet({ onClose }) {
  const host = typeof window !== "undefined" ? window.location.host : "";
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 md:items-center md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="insecure-title"
        className="pb-safe w-full max-w-sm rounded-t-2xl border border-border bg-card p-5 shadow-elevated md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="insecure-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldAlert className="h-5 w-5 text-status-warning" aria-hidden="true" />
            This address cannot be installed
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Browsers only install an app from a secure address &mdash; <strong className="font-semibold text-foreground">https</strong>,
          or localhost. This page is on <span className="font-mono text-xs text-foreground">{host}</span>, so the
          install is refused before it reaches us.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Open the deployed site on this phone and the Install option will work there.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/** Runs the install: the browser's own dialog, or the iOS instructions. */
export function useInstall() {
  const state = useInstallState();
  const [sheet, setSheet] = useState(null);

  const install = async () => {
    if (state === "manual") return setSheet("ios");
    if (state === "insecure") return setSheet("insecure");
    const outcome = await promptInstall();
    // The stored prompt is single-use; if it had already gone, say why rather than nothing.
    if (outcome === "unavailable") setSheet("insecure");
  };

  const close = () => setSheet(null);

  return {
    canInstall: state === "ready" || state === "manual" || state === "insecure",
    install,
    iosSheet:
      sheet === "ios" ? <IosInstallSheet onClose={close} /> :
      sheet === "insecure" ? <InsecureInstallSheet onClose={close} /> : null,
  };
}

/**
 * Told about a new version, offered rather than applied: swapping the app out from under
 * someone halfway through a voucher is how work gets lost.
 */
export function UpdateNotice({ onApply, onDismiss }) {
  return (
    <div
      role="status"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] start-3 end-3 z-[80] flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-elevated lg:bottom-4 lg:start-auto lg:max-w-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">A new version is ready</p>
        <p className="text-xs text-muted-foreground">Reload when you are at a good point to.</p>
      </div>
      <button
        type="button"
        onClick={onApply}
        className="h-9 shrink-0 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Not now"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
