import React, { useState } from "react";
import { Network, ShieldCheck } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { Button } from "../ui/button";
import { ConfirmDialog, ErrorNote, Pill, Select } from "../accounting/kit";

// How invoices leave the system: the built-in sandbox, or Wafeq (a Ministry-accredited service provider). Zarvia holds the Wafeq account; the
// business only approves us once ("Connect with Wafeq") and we keep the ids Wafeq returns. Nothing here ever shows a key.
export default function WafeqConnection({ settings, notify, onSaved }) {
  const w = settings.wafeq || { status: "disconnected", modes: {} };
  const [mode, setMode] = useState("sandbox");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const linked = w.status === "active";
  const modeInfo = (w.modes || {})[mode] || {};

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await einvoice.wafeqStart({ mode });
      window.location.assign(url);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  async function disconnect() {
    setConfirm(false);
    setBusy(true);
    try {
      await einvoice.wafeqDisconnect();
      notify("Disconnected from Wafeq");
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`rounded-xl border p-4 ${linked ? "border-border" : "border-ring bg-accent"}`}>
          <p className="flex items-center gap-2 text-sm font-semibold"><Network className="h-4 w-4" aria-hidden="true" />Built-in sandbox {!linked && <Pill tone="info">In use</Pill>}</p>
          <p className="mt-1 text-sm text-muted-foreground">Invoices go through the full process but are not delivered to anyone. Use it to practise. Nothing here is a valid tax e-invoice.</p>
        </div>
        <div className={`rounded-xl border p-4 ${linked ? "border-ring bg-accent" : "border-border"}`}>
          <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Wafeq {linked && <Pill tone={w.mode === "live" ? "success" : "info"}>{w.mode === "live" ? "Live" : "Test mode"}</Pill>}{w.status === "revoked" && <Pill tone="danger">Connection lost</Pill>}</p>
          {linked ? (
            <>
              <dl className="mt-2 grid gap-1 text-sm">
                <div className="flex gap-2"><dt className="text-muted-foreground">Business</dt><dd className="font-medium">{w.name}</dd></div>
                <div className="flex gap-2"><dt className="text-muted-foreground">Peppol ID</dt><dd className="font-mono text-xs font-medium">{w.participantId}</dd></div>
              </dl>
              {w.mode !== "live" && <p className="mt-2 text-xs text-muted-foreground">Test mode: invoices are checked and delivered in simulation. Nothing reaches the tax authority.</p>}
              <Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={() => setConfirm(true)}>Disconnect</Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Sends your invoices over the Peppol network and reports them to the tax authority. Your business must first appoint <strong>Wafeq FZ LLC</strong> as its e-invoicing provider in EmaraTax (e-Invoicing).</p>
              {w.status === "revoked" && <p className="mt-2 text-sm text-status-danger">{w.lastError || "Wafeq no longer accepts this connection."} Connect again.</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select aria-label="Wafeq mode" value={mode} onChange={(e) => setMode(e.target.value)} className="h-9 w-44">
                  <option value="sandbox">Test mode</option>
                  <option value="live" disabled={!(w.modes?.live?.available)}>Live{w.modes?.live?.available ? "" : " (not available yet)"}</option>
                </Select>
                <Button size="sm" disabled={busy || !modeInfo.oauth} onClick={connect}>{busy ? "Opening Wafeq…" : "Connect with Wafeq"}</Button>
              </div>
              {!modeInfo.oauth && <p className="mt-2 text-xs text-muted-foreground">This server is not set up for {mode === "live" ? "live" : "test"} connections yet. Ask support to link your business.</p>}
            </>
          )}
        </div>
      </div>
      {error && <ErrorNote error={error} />}
      {confirm && <ConfirmDialog title="Disconnect from Wafeq?" confirmLabel="Disconnect" text="Invoices already sent stay as they are. New ones will use the built-in sandbox until you connect again." onClose={() => setConfirm(false)} onConfirm={disconnect} />}
    </div>
  );
}
