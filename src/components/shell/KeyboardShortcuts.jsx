import React, { useEffect, useState } from "react";
import { Modal } from "../accounting/kit";
import { Button } from "../ui/button";
import { SHORTCUT_HELP, classify, enterTarget, findNewTarget, findSaveTarget, isTyping, topDialog } from "../../lib/shortcuts";

// Mounted once in the shell. Listens on the window so it works from inside any field, and steps aside for a key a form has already
// handled (the order form saves on Ctrl+Enter itself and says so: that press arrives here already prevented).
export default function KeyboardShortcuts() {
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let pendingNew = null;

    // "Save and new": after the save, wait for the form or dialog to go, then open the next one. Gives up quietly.
    const startSaveAndNew = () => {
      if (pendingNew) clearInterval(pendingNew);
      const hadDialog = Boolean(topDialog());
      const started = Date.now();
      pendingNew = setInterval(() => {
        const gone = hadDialog ? !topDialog() : !document.querySelector("main form");
        if (gone) {
          clearInterval(pendingNew);
          pendingNew = null;
          // let the list render its New button
          setTimeout(() => findNewTarget()?.click(), 250);
        } else if (Date.now() - started > 8000) {
          clearInterval(pendingNew);
          pendingNew = null;
        }
      }, 200);
    };

    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;
      const action = classify(e, { typing: isTyping(e.target) });
      if (!action) return;
      if (action === "help") {
        e.preventDefault();
        setHelp((v) => !v);
        return;
      }
      if (action === "enter") {
        const t = enterTarget();
        if (!t) return;
        e.preventDefault();
        t.el.click();
        return;
      }
      // Ctrl+S: the browser's "save page" is never what is wanted inside the app
      e.preventDefault();
      const el = findSaveTarget();
      if (!el) return;
      el.click();
      if (action === "saveNew") startSaveAndNew();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (pendingNew) clearInterval(pendingNew);
    };
  }, []);

  if (!help) return null;
  return (
    <Modal
      size="sm" title="Keyboard shortcuts" onClose={() => setHelp(false)}
      description="Work without the mouse. These work from inside any field."
      footer={<Button variant="outline" onClick={() => setHelp(false)}>Close</Button>}
    >
      <dl className="divide-y divide-border text-sm">
        {SHORTCUT_HELP.map(([keys, what]) => (
          <div key={keys} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="shrink-0"><kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">{keys}</kbd></dt>
            <dd className="text-end text-muted-foreground">{what}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
