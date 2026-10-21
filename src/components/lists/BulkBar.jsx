import React, { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "../ui/button";
import { ConfirmDialog, useToasts } from "../accounting/kit";
import { useOrganisation } from "../shell/OrganisationContext";

// The contextual bar a DataTable shows above itself while `selection.length > 0` (see its `bulkBar` prop).
// `actions` is a plain array of:
//   {
//     key, label, icon,
//     permission,            // hidden (not disabled) from a role that lacks it - the house rule, lib/permissions.js
//     danger,                 // red variant
//     confirm: (n) => ({ title, text, confirmLabel, typeToConfirm }),   // asked before `run`, when given
//     run: (ids) => Promise<{ changed: string[], skipped?: string[], message?: string }>,
//   }
// `run` must report which of the ids it actually changed - an action that cannot tell which rows succeeded
// gets no undo and no "N done, M skipped" message, because a bulk action that silently claims success for
// rows it never touched is worse than one that says nothing (see stage 1c.5's notes on why this app does not
// pretend to undo a posted delete).
export default function BulkBar({ selection, onClear, actions = [], onDone }) {
  const { canAny } = useOrganisation();
  const [confirming, setConfirming] = useState(null); // the action waiting on a confirm dialog
  const [busyKey, setBusyKey] = useState(null);
  const { notify, toastNode } = useToasts();
  const n = selection.length;

  const visible = actions.filter((a) => !a.permission || canAny(a.permission));

  async function run(action) {
    setConfirming(null);
    setBusyKey(action.key);
    try {
      const result = await action.run(selection);
      const changed = result?.changed ?? selection;
      const skipped = result?.skipped ?? [];
      onDone?.(changed);
      notify(
        result?.message ||
          (skipped.length
            ? `${changed.length} done, ${skipped.length} left alone.`
            : `${changed.length} ${action.doneWord || "done"}.`),
        skipped.length ? "info" : "success"
      );
    } catch (err) {
      notify(err?.response?.data?.message || err?.message || "That did not work.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  const start = (action) => (action.confirm ? setConfirming(action) : run(action));

  if (!visible.length && !onClear) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2" role="toolbar" aria-label="Selected rows">
      <span className="text-sm font-medium tabular-nums">{n} selected</span>
      <span className="flex flex-wrap items-center gap-1.5">
        {visible.map((a) => {
          const Icon = a.icon;
          return (
            <Button
              key={a.key}
              size="sm"
              variant={a.danger ? "destructive" : "outline"}
              onClick={() => start(a)}
              disabled={busyKey != null}
            >
              {busyKey === a.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
              {a.label}
            </Button>
          );
        })}
      </span>
      <Button size="sm" variant="ghost" className="ms-auto" onClick={onClear} aria-label="Clear selection">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Clear
      </Button>
      {confirming && (
        <ConfirmDialog
          title={confirming.confirm(n).title}
          text={confirming.confirm(n).text}
          confirmLabel={confirming.confirm(n).confirmLabel || confirming.label}
          danger={confirming.danger}
          typeToConfirm={confirming.confirm(n).typeToConfirm}
          busy={busyKey === confirming.key}
          onClose={() => setConfirming(null)}
          onConfirm={() => run(confirming)}
        />
      )}
      {toastNode}
    </div>
  );
}
