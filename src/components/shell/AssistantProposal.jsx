import React, { useRef, useState } from "react";
import { CheckCircle2, FilePenLine } from "lucide-react";
import { assistant } from "../../lib/assistantApi";
import { canSave, formTarget, refusalText, savedResult, stillNeeded } from "../../lib/assistantProposals";
import { Button } from "../ui/button";

// A document Zarvia AI PREPARED, drawn under its answer. The assistant has saved nothing: the person checks
// the lines and presses the button, which posts the prepared body to the product's own route with their own
// sign-in - so their rights, the approval limits and the period lock decide, exactly as if they had typed it.
// "Change details" opens the normal form already filled in, for anything the card does not let them edit.
export default function AssistantProposal({ proposal: p, messageId, onChange, onOpenForm, onOpenPath }) {
  const [filled, setFilled] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The card shows its own result at once; the parent keeps it too, so a reopened panel still knows.
  const [saved, setSaved] = useState(null);
  const lock = useRef(false);
  const form = formTarget(p, filled);
  const needed = stillNeeded(p, filled);
  const done = p.savedAs || p.result?.ok || saved?.ok;
  const outcome = p.result || saved;

  const save = async () => {
    // A second press while the first is still on its way must not post a second payment.
    if (lock.current || !canSave(p, filled)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await assistant.saveProposal(p, filled);
      const result = savedResult(p, data);
      setSaved(result);
      onChange?.(p.id, { result, savedAs: result.number || "saved" });
      // Remembered on the answer so a reopened panel never offers it again. The document IS saved either way.
      assistant.proposalSaved(messageId, p.id, result.number).catch(() => {});
    } catch (err) {
      setError(refusalText(err));
      lock.current = false;
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const text = outcome?.text || `Saved ${p.savedAs}.`;
    return (
      <div role="status" className="rounded-xl border border-status-success/25 bg-status-success-soft px-3 py-2.5 text-sm">
        <p className="flex items-start gap-2 font-medium text-status-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{text}</span>
        </p>
        {outcome?.open && (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onOpenPath?.(outcome.open)}>
            Open the draft
          </Button>
        )}
      </div>
    );
  }

  return (
    <section aria-label={`${p.title}, ready to check`} className="rounded-xl border bg-card px-3 py-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.title} · ready to check</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
        {p.lines.map(([k, v], i) => (
          <React.Fragment key={`${k}-${i}`}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="min-w-0 break-words font-medium">{v}</dd>
          </React.Fragment>
        ))}
      </dl>

      {p.warnings.map((w) => (
        <p key={w} className="mt-2 rounded-md border border-status-warning/25 bg-status-warning-soft px-2.5 py-1.5 text-xs text-status-warning">{w}</p>
      ))}

      {p.missing.includes("reference") && (
        <label className="mt-3 block text-xs font-medium">
          Reference (the transfer or deposit slip number)
          <input
            type="text"
            value={filled.reference || ""}
            onChange={(e) => setFilled((f) => ({ ...f, reference: e.target.value }))}
            maxLength={60}
            autoComplete="off"
            className="mt-1 block h-11 w-full rounded-lg border border-input bg-background px-3 text-base sm:h-9 sm:text-sm"
          />
        </label>
      )}

      {error && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || needed.length > 0} onClick={save} className="h-auto min-h-9 whitespace-normal text-start">
          {busy ? "Saving…" : p.confirm}
        </Button>
        {form && (
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenForm?.(form)}>
            <FilePenLine className="size-3.5" aria-hidden="true" />
            Change details
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Nothing is saved until you press the button.</p>
    </section>
  );
}
