import React from "react";
import { Ban, Check, CreditCard, FilePlus2, Lock, Search, Undo2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Pill } from "../../accounting/kit";
import { useOrganisation } from "../../shell/OrganisationContext";
import { CONFIDENCE, MATCH_KIND, isIn } from "../../../lib/bankReconcile";
import { formatNumber } from "../../../utils/format";
import { Amount, Day, EntryRow } from "./parts";

// One line of the bank's statement and what can be done about it. An open line shows the engine's
// best suggestion with the reasons in words; a matched line shows what it was matched to; an ignored
// line shows why. The next step is always one button.

const STATE = { open: ["neutral", "To do"], matched: ["info", "Matched"], reconciled: ["success", "Reconciled"], ignored: ["neutral", "Ignored"] };

export default function LineCard({ line, onMatch, onFind, onPost, onCard, onIgnore, onUnmatch, onUnignore }) {
  const s = line.suggestion;
  const [tone, label] = STATE[line.state] || STATE.open;
  const m = line.match;
  // Match, find, post, card settlement, ignore, put back and unmatch are all banking.reconcile. A person who may only look sees
  // the line, the suggestion and the match, and no row of buttons: the "locked" note is information, so it stays.
  const { canAny } = useOrganisation();
  const canReconcile = canAny("banking.reconcile");
  const hasActions = canReconcile || line.state === "reconciled";
  return (
    <article aria-label={`Statement line: ${line.description || "no description"}`} className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground"><Day value={line.day} />{line.valueDay && line.valueDay !== line.day ? <> · value <Day value={line.valueDay} /></> : null}</p>
          <p className="mt-0.5 break-words font-medium">{line.description || "(no description)"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[line.reference && `Ref ${line.reference}`, line.chequeNo && `Cheque ${line.chequeNo}`, line.balance !== null && line.balance !== undefined && `Balance ${formatNumber(line.balance, 2)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Amount value={line.amount} className="text-base" />
          <Pill tone={tone}>{label}</Pill>
        </div>
      </div>

      {line.state === "open" && s && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/50 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Pill tone={CONFIDENCE[s.confidence].tone}>{CONFIDENCE[s.confidence].label}</Pill>
            <span className="text-xs text-muted-foreground">{s.reasons.join(", ")}</span>
          </div>
          <div className="space-y-2">{s.entries.map((e) => <EntryRow key={e.id} entry={e} />)}</div>
          {canReconcile && s.entries.some((e) => e.type === "cheque") && <p className="mt-2 text-xs text-muted-foreground">Matching clears this cheque on {line.day}: the bank has paid it.</p>}
        </div>
      )}
      {line.state === "open" && !s && <p className="mt-3 text-sm text-muted-foreground">Nothing in the books fits this line yet.</p>}

      {(line.state === "matched" || line.state === "reconciled") && m && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/50 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {MATCH_KIND[m.kind] || "Matched"}
            {m.lineCount > 1 ? ` · together with ${m.lineCount - 1} other line${m.lineCount === 2 ? "" : "s"}` : ""}
            {m.method === "auto" ? " · accepted from a suggestion" : ""}
          </p>
          {m.entries.length === 0 && <p className="text-sm text-muted-foreground">These lines cancel each other out, so there is nothing to post.</p>}
          <div className="space-y-2">{m.entries.map((e, i) => <EntryRow key={`${e.voucherNo}-${i}`} entry={e} />)}</div>
        </div>
      )}

      {line.state === "ignored" && <p className="mt-3 text-sm text-muted-foreground">Left out: {line.ignoredReason}</p>}

      {hasActions && <div className="mt-3 flex flex-wrap items-center gap-2">
        {canReconcile && line.state === "open" && s && (
          <Button size="sm" onClick={() => onMatch(line, s)}><Check className="h-3.5 w-3.5" aria-hidden="true" />{s.kind === "group" ? `Match all ${s.entries.length}` : "Match"}</Button>
        )}
        {canReconcile && line.state === "open" && (
          <>
            <Button size="sm" variant="outline" onClick={() => onFind(line)}><Search className="h-3.5 w-3.5" aria-hidden="true" />{s ? "Find another" : "Find in the books"}</Button>
            <Button size="sm" variant="outline" onClick={() => onPost(line)}><FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />Post an entry</Button>
            {isIn(line.amount) && <Button size="sm" variant="outline" onClick={() => onCard(line)}><CreditCard className="h-3.5 w-3.5" aria-hidden="true" />Card settlement</Button>}
            <Button size="sm" variant="ghost" onClick={() => onIgnore(line)}><Ban className="h-3.5 w-3.5" aria-hidden="true" />Ignore</Button>
          </>
        )}
        {canReconcile && line.state === "matched" && <Button size="sm" variant="outline" onClick={() => onUnmatch(line)}><Undo2 className="h-3.5 w-3.5" aria-hidden="true" />Unmatch</Button>}
        {line.state === "reconciled" && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Locked in a completed reconciliation</span>}
        {canReconcile && line.state === "ignored" && !line.reconciliationId && <Button size="sm" variant="outline" onClick={() => onUnignore(line)}><Undo2 className="h-3.5 w-3.5" aria-hidden="true" />Put back</Button>}
      </div>}
    </article>
  );
}

