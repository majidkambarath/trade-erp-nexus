// The small pieces the Setup screen is built from.
import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { AlertCircle, ArrowRight, Check, Sparkles, X } from "lucide-react";
import { inputClass } from "../accounting/kit.jsx";
import { motionOK } from "../Dashborad/motion";
import { rowHues } from "../../lib/crm";

/**
 * A setting that is on or off, as a switch. The whole row is the button (so the 44px target is the row, not the small
 * control), it is a real role="switch" with aria-checked (so a screen reader says "on" / "off"), and the words beside
 * it say what it DOES - a bare checkbox next to a sentence asks the person to work that out.
 */
export function Switch({ checked, onChange, label, description, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-4 rounded-xl border border-border bg-card p-3.5 text-start transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none ${checked ? "bg-brand" : "bg-border"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

/**
 * A number with its unit inside the field ("14 days"), where the eye already is, instead of a hint line underneath that
 * is read after the number has been typed. Everything else is forwarded to the input, which is what lets <Field>
 * attach its id and its error to the INPUT rather than to this wrapper.
 */
export const UnitInput = React.forwardRef(function UnitInput({ unit, className = "", ...props }, ref) {
  return (
    <div className="relative">
      <input ref={ref} type="number" inputMode="numeric" className={`${inputClass} pe-16 ${className}`} {...props} />
      <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-xs text-muted-foreground">{unit}</span>
    </div>
  );
});

const EVENT_WORDS = {
  quotation_sent: "a quotation is sent",
  quotation_accepted: "the customer accepts the quotation",
  invoice_approved: "the invoice is approved",
};

/**
 * The pipeline at a glance: the stages in order, in the colours they have on the dashboard, redrawn as the person
 * edits. It is what makes a change visible the moment it is made (rename, reorder, close a stage) instead of only
 * after saving and going to look. A sparkle marks a stage a document moves a deal into by itself - the module's whole
 * idea, shown rather than described - and each chip jumps to that stage's row below.
 */
export function PipelineFlow({ stages = [], onPick }) {
  const hues = rowHues(stages);
  const items = stages.map((stage, index) => ({ stage, hue: hues[index] }));
  const isClosed = (s) => s.type === "won" || s.type === "lost";
  const open = items.filter((i) => !isClosed(i.stage));
  const closed = items.filter((i) => isClosed(i.stage));

  const chip = ({ stage, hue }) => (
    <li key={stage.uid} className="flex items-center">
      <button
        type="button"
        onClick={() => onPick?.(stage.uid)}
        title={stage.advanceOn ? `A deal moves here by itself when ${EVENT_WORDS[stage.advanceOn] || "its document arrives"}` : "A deal is moved here by hand"}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hue }} aria-hidden="true" />
        <span className="max-w-40 truncate font-medium text-foreground">{stage.name?.trim() || "Untitled"}</span>
        {stage.type === "won" && <Check className="h-3.5 w-3.5 text-status-success" aria-label="won" />}
        {stage.type === "lost" && <X className="h-3.5 w-3.5 text-status-danger" aria-label="lost" />}
        {!isClosed(stage) && <span className="text-xs tabular-nums text-muted-foreground">{Number(stage.probability) || 0}%</span>}
        {stage.advanceOn && <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-label="moves by itself" />}
      </button>
    </li>
  );

  const arrow = (key) => (
    <li key={key} aria-hidden="true" className="flex items-center text-muted-foreground">
      <ArrowRight className="h-3.5 w-3.5" />
    </li>
  );

  const flow = [];
  open.forEach((item, i) => {
    if (i > 0) flow.push(arrow(`a-${item.stage.uid}`));
    flow.push(chip(item));
  });
  closed.forEach((item, i) => {
    if (i === 0) flow.push(arrow("a-closed"));
    flow.push(chip(item));
  });

  return (
    <nav aria-label="The pipeline at a glance" className="rounded-xl bg-secondary/50 p-3">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">{flow}</ol>
    </nav>
  );
}

/**
 * The bar that says "you have unsaved changes", and offers the two things that can be done about them.
 *
 * It sticks to the bottom of the PANEL it belongs to - not of the page - so on a long pipeline the Save button is never
 * a scroll away, and it lets go when the panel ends instead of floating over whatever comes next. Two panels each carry
 * their own, so they can never overlap each other.
 *
 * A server's refusal is written HERE, in red, instead of in a note at the top of the panel: this is where the person's
 * eyes are when they press Save, and a message they have to scroll up to find is a message they did not get.
 */
export function SaveBar({ show, problem, busy, saveLabel = "Save", onSave, onDiscard }) {
  const ref = useRef(null);
  // It slides up into place. Like every motion here it does nothing under reduced motion, and it is a fromTo with
  // clearProps (never from()) for the reason written in useReveal.js.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!show || !el || !motionOK()) return undefined;
    const tween = gsap.fromTo(el, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2, ease: "power2.out", clearProps: "opacity,transform" });
    return () => tween.kill();
  }, [show]);
  if (!show) return null;
  return (
    <div
      ref={ref}
      role="region"
      aria-label="Unsaved changes"
      className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5"
    >
      <p className={`flex min-w-0 items-center gap-2 text-sm ${problem ? "text-status-danger" : "text-foreground"}`} aria-live="polite">
        {problem ? (
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
        )}
        <span className="min-w-0">{problem || "You have changes that are not saved yet"}</span>
      </p>
      <div className="flex items-center gap-2">
        {onDiscard && (
          <button type="button" onClick={onDiscard} disabled={busy} className="h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-60 lg:h-10">
            Discard
          </button>
        )}
        <button type="button" onClick={onSave} disabled={busy} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10">
          {busy ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );
}
