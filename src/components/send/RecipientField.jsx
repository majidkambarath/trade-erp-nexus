import React, { useId } from "react";
import { X } from "lucide-react";
import { inputClass } from "../accounting/kit";
import { cn } from "../../lib/utils";
import { isEmail } from "../../lib/partyForms";

// Email addresses as chips. Type or paste any number, separated by comma, semicolon, space or Enter; each
// good one becomes a chip, each bad one stays in the box so the person can fix it. The remove button is a
// 44px target with a smaller mark, because a finger must hit it and the chip row must still wrap on a phone.
// The typed-but-not-yet-a-chip text belongs to the parent (`pending`), so a half-typed last address is read
// when the form is sent instead of being silently dropped.
export default function RecipientField({ label, emails, onChange, pending, onPending, error, hint, placeholder, autoFocus = false }) {
  const id = useId();
  const setPending = onPending;

  // Takes what has been typed, keeps the good addresses, leaves the rest in the box.
  const commit = (text, { final = false } = {}) => {
    const parts = String(text).split(/[,;\s]+/);
    const tail = final ? "" : parts.pop();
    const added = [];
    const left = [];
    for (const raw of parts) {
      const e = raw.trim().toLowerCase();
      if (!e) continue;
      if (isEmail(e)) {
        if (!emails.includes(e) && !added.includes(e)) added.push(e);
      } else left.push(e);
    }
    if (added.length) onChange([...emails, ...added]);
    setPending([...left, tail].filter(Boolean).join(" "));
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <div className={cn("flex flex-wrap items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40", error ? "border-status-danger" : "border-input")}>
        {emails.map((e) => (
          <span key={e} className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-border bg-secondary ps-3 text-sm text-foreground">
            <span className="min-w-0 break-all py-1">{e}</span>
            <button
              type="button" aria-label={`Remove ${e}`} onClick={() => onChange(emails.filter((x) => x !== e))}
              className="-my-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} data-autofocus={autoFocus ? "" : undefined}
          value={pending} placeholder={emails.length ? "" : placeholder} aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={(ev) => commit(ev.target.value)}
          onBlur={() => pending.trim() && commit(pending, { final: true })}
          onKeyDown={(ev) => { if (ev.key === "Enter" && pending.trim()) { ev.preventDefault(); commit(pending, { final: true }); } else if (ev.key === "Backspace" && !pending && emails.length) onChange(emails.slice(0, -1)); }}
          className={cn(inputClass, "h-9 min-w-[10rem] flex-1 border-0 px-1 py-0 focus-visible:ring-0 lg:h-8")}
        />
      </div>
      {error ? <p id={`${id}-err`} role="alert" className="mt-1 text-xs font-medium text-status-danger">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
