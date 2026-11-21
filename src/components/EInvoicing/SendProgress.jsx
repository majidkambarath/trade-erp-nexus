import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { AlertCircle, CheckCircle2, FileText, Loader2, Send } from "lucide-react";
import { motionOK } from "../Dashborad/motion";
import { Button } from "../ui/button";
import { ErrorNote, Modal, errorMessage, formatDateTime } from "../accounting/kit";
import { NEXT_STEP, StatusPill, deliveryText } from "./shared";

// The dialog shown while an invoice is on its way to Wafeq. A send checks the invoice, calls Wafeq and reads its answer,
// which can take many seconds, so the person sees what is happening instead of a closed dialog and a greyed button.
// It only SHOWS a promise the parent started (one request per press, and hiding the dialog never loses the outcome).

const STEPS = ["Checking the invoice against the UAE rules", "Sending it to Wafeq", "Waiting for Wafeq's answer"];
const TITLES = { send: "Sending", correct: "Resending as a correction:", retry: "Sending again:" };

// A document, a dotted path and Wafeq, with a paper plane gliding along it. Still under reduced motion and in tests.
function SendingArt() {
  const root = useRef(null);
  useLayoutEffect(() => {
    if (!motionOK() || !root.current) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-plane]", { x: 0, opacity: 0 }, { x: 150, opacity: 1, duration: 1.4, ease: "power1.inOut", repeat: -1, repeatDelay: 0.2 });
      gsap.to("[data-node]", { scale: 1.06, duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut" });
    }, root);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={root} className="mx-auto flex w-full max-w-xs items-center justify-between py-2" aria-hidden="true">
      <span data-node className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><FileText className="h-6 w-6" /></span>
      <span className="relative mx-3 h-12 flex-1">
        <span className="absolute inset-x-0 top-1/2 border-t-2 border-dotted border-border" />
        <span data-plane className="absolute start-0 top-1/2 -translate-y-1/2 text-brand"><Send className="h-4 w-4" /></span>
      </span>
      <span data-node className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card text-xs font-bold">Wafeq</span>
    </div>
  );
}

function Working() {
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = [setTimeout(() => setStep(1), 1200), setTimeout(() => setStep(2), 3000), setTimeout(() => setSlow(true), 12000)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <div className="space-y-4">
      <SendingArt />
      <ol role="status" aria-live="polite" className="space-y-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${i === step ? "font-medium" : "text-muted-foreground"}`}>
            {i === step ? <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" /> : <span className="mx-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50" aria-hidden="true" />}
            {s}
          </li>
        ))}
      </ol>
      {slow && <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">Wafeq is taking longer than usual. You can hide this: the invoice keeps sending and the list updates when it is done.</p>}
    </div>
  );
}

function Pop({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!motionOK() || !ref.current) return undefined;
    const ctx = gsap.context(() => { gsap.fromTo(ref.current, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)", clearProps: "transform,opacity" }); }, ref);
    return () => ctx.revert();
  }, []);
  return <div ref={ref} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full">{children}</div>;
}

export default function SendProgress({ doc, kind = "send", promise, onRetry, onValidation, onHistory, onClose }) {
  const [state, setState] = useState({ phase: "working" });
  useEffect(() => {
    let live = true;
    setState({ phase: "working" });
    promise.then(
      (r) => { if (live) setState({ phase: "done", result: r }); },
      (e) => {
        if (!live) return;
        if (e?.code === "EINVOICE_VALIDATION") onValidation(e.details?.issues || []);
        else setState({ phase: "error", error: e });
      },
    );
    return () => { live = false; };
  }, [promise]); // eslint-disable-line react-hooks/exhaustive-deps

  const sub = state.result ? (state.result.submission || state.result) : null;
  const failed = sub?.status === "FAILED";
  const title = kind === "send" ? `Sending ${doc.transactionNo}` : `${TITLES[kind]} ${doc.transactionNo}`;
  const heading = state.phase === "working" ? title : state.phase === "error" ? "Could not send" : failed ? "Not sent yet" : "Sent to Wafeq";

  return (
    <Modal size="sm" dirty={false} onClose={onClose} title={heading} description={state.phase === "working" ? doc.transactionNo : undefined}
      footer={
        state.phase === "working" ? <Button variant="outline" onClick={onClose}>Hide</Button>
          : state.phase === "error" ? <><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={onRetry}>Try again</Button></>
            : <>{sub?._id || sub?.id ? <Button variant="outline" onClick={() => onHistory(sub._id || sub.id)}>View history</Button> : null}<Button onClick={onClose}>Done</Button></>
      }>
      {state.phase === "working" && <Working />}
      {state.phase === "error" && <ErrorNote error={{ message: errorMessage(state.error) }} />}
      {state.phase === "done" && (
        <div className="space-y-3 text-center">
          <Pop>{failed ? <AlertCircle className="h-10 w-10 text-status-danger" aria-hidden="true" /> : <CheckCircle2 className="h-10 w-10 text-status-success" aria-hidden="true" />}</Pop>
          {sub?.status && <div><StatusPill status={sub.status} /></div>}
          <p className="text-sm text-muted-foreground">{failed ? (sub.lastError || NEXT_STEP.FAILED) : NEXT_STEP[sub?.status] || "Sent."}</p>
          {failed && sub.nextRetryAt && <p className="text-sm">Automatic retry at {formatDateTime(sub.nextRetryAt)}.</p>}
          {!failed && sub?.deliveryStatus && <p className="text-sm">{deliveryText(sub.deliveryStatus)}</p>}
          {!failed && sub?.route === "reporting_only" && <p className="text-sm text-muted-foreground">Reported to the tax authority only: the buyer is not on Peppol.</p>}
          {state.result?.alreadySubmitted && <p className="text-sm text-muted-foreground">This invoice had already been sent; nothing was sent twice.</p>}
        </div>
      )}
    </Modal>
  );
}
