import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Plug } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { Button } from "../ui/button";
import { Panel, Pill, errorMessage, formatDateTime } from "../accounting/kit";

const when = (d) => (d ? formatDateTime(d) : "never");

// The link to the provider, in one place: who it is, when it last spoke, and two checks run only when asked (they spend Wafeq's shared
// request budget, so they are not part of loading the dashboard).
export default function ConnectionCard({ settings, period, ours: books }) {
  const w = settings.wafeq || {};
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");

  async function run(kind) {
    setBusy(kind); setProblem("");
    try {
      if (kind === "health") setHealth(await einvoice.wafeqHealth());
      else setSummary(await einvoice.wafeqSummary({ from: period.from || undefined, to: period.to || undefined }));
    } catch (e) { setProblem(errorMessage(e)); } finally { setBusy(""); }
  }

  if (!settings.connected) {
    return (
      <Panel title="Connection">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Plug className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">Using the built-in sandbox: invoices are checked and recorded here but go nowhere. Connect Wafeq to send them over Peppol.</span>
          <Link to="/e-invoicing/settings" className="font-semibold text-primary hover:underline">Open settings</Link>
        </div>
      </Panel>
    );
  }

  const theirs = (dir) => summary?.[dir];
  return (
    <Panel title="Connection" description="Wafeq, the accredited service provider.">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">Business</dt><dd>{w.name || "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Tax registration (TIN)</dt><dd className="tabular-nums">{w.tin || "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Peppol participant</dt><dd className="break-all">{w.participantId || "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Mode</dt><dd><Pill tone={w.mode === "live" ? "success" : "info"}>{w.mode === "live" ? "Live" : "Test mode"}</Pill></dd></div>
        <div><dt className="text-xs text-muted-foreground">Last message from Wafeq</dt><dd>{when(w.lastWebhookAt)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Last check for received invoices</dt><dd>{when(w.inboundPulledAt)}</dd></div>
      </dl>
      {w.lastError && <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-status-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{w.lastError}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => run("health")} disabled={busy === "health"}>{busy === "health" ? "Checking…" : "Check connection"}</Button>
        <Button size="sm" variant="outline" onClick={() => run("summary")} disabled={busy === "summary"}>{busy === "summary" ? "Comparing…" : "Compare with Wafeq"}</Button>
      </div>
      {problem && <p role="alert" className="mt-3 text-sm text-status-danger">{problem}</p>}

      {health && (
        <div className="mt-4 rounded-xl border border-border p-3 text-sm" role="status">
          {health.ok === false && health.note ? <p className="text-status-danger">Could not check: {health.note}</p> : health.ok ? (
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" />Wafeq holds <strong>{health.legalName}</strong> with the same tax number as your company profile.</p>
          ) : (
            <div>
              <p className="flex items-center gap-2 text-status-warning"><AlertTriangle className="h-4 w-4" aria-hidden="true" />Wafeq's record differs from your company profile:</p>
              <ul className="mt-1 list-disc ps-6">{(health.mismatches || []).map((m) => <li key={m.field}>{m.field}: Wafeq has “{m.wafeq}”, you have “{m.ours}”.</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div className="mt-4 rounded-xl border border-border p-3 text-sm" role="status">
          {summary.note && <p className="mb-1 text-status-warning">{summary.note}</p>}
          <ul className="space-y-1">
            {theirs("outbound") && <li>Sent: Wafeq holds <strong>{theirs("outbound").count}</strong>, your books show <strong>{books?.sent ?? 0}</strong>.</li>}
            {theirs("inbound") && <li>Received: Wafeq holds <strong>{theirs("inbound").count}</strong>, your books show <strong>{books?.received ?? 0}</strong>.</li>}
          </ul>
          {summary.sandbox && <p className="mt-2 text-xs text-muted-foreground">The test taxpayer is shared, so Wafeq's count can include other test runs. Live figures should match your own.</p>}
        </div>
      )}
    </Panel>
  );
}
