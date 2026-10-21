import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, ExternalLink, Send, ThumbsDown, ThumbsUp, LifeBuoy } from "lucide-react";
import { Modal } from "../accounting/kit";
import { assistant } from "../../lib/assistantApi";
import { recentRefusal } from "../../lib/lastRefusal";
import { canSend, openingTip, toExchange, whyNotSend, MAX_QUESTION } from "../../lib/assistant";
import { findActive } from "../../config/navigation";

// Zarvia AI. Drawn inside the existing Modal rather than as a new overlay of its own: that one
// already handles the device insets, the focus trap and the body scroll lock, and it is already
// measured by the mobile sweep. A chat does not need a new primitive.
//
// It reads no business data. Everything it says comes from the product's documentation and from the
// table of refusal codes, so there is nothing here to scope to a branch or a party.

const SUGGESTIONS = [
  "How do I raise an invoice?",
  "Why does it say posting is closed?",
  "How do I record a payment?",
];

export default function AssistantPanel({ onClose, initialExchanges = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = findActive(location.pathname);
  const screen = active?.tab?.to || location.pathname;
  const screenName = active?.tab?.label || "";

  const [exchanges, setExchanges] = useState(initialExchanges || []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState("");
  const [failed, setFailed] = useState("");
  const endRef = useRef(null);
  const conversationRef = useRef("");
  // Read once, on open: by the time an answer comes back the refusal may have been cleared, and the
  // suggestion should still say what they were stuck on.
  const refusalRef = useRef(recentRefusal());

  useEffect(() => {
    let alive = true;
    assistant
      .screen(screen)
      .then((data) => {
        if (alive) setTip(openingTip(screen, data?.topics || []));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [screen]);

  useEffect(() => {
    // jsdom has no scrollIntoView, and a panel that cannot scroll is not a reason to fail a test.
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [exchanges, busy]);

  const send = useCallback(
    async (asked) => {
      const question = String(asked || "").trim();
      if (!question || busy) return;
      setBusy(true);
      setFailed("");
      setText("");
      try {
        const answer = await assistant.ask({ question, screen, screenName, conversationId: conversationRef.current });
        if (answer?.conversationId) conversationRef.current = answer.conversationId;
        setExchanges((xs) => [...xs, toExchange(question, answer)]);
      } catch (err) {
        setFailed(err?.message || "I could not reach the assistant just now.");
        setText(question);
      } finally {
        setBusy(false);
      }
    },
    [busy, screen, screenName]
  );

  const rate = async (id, helpful) => {
    setExchanges((xs) => xs.map((x) => (x.id === id ? { ...x, helpful } : x)));
    try {
      await assistant.helpful(id, helpful);
    } catch {
      // A thumb that did not save is not worth telling anybody about.
    }
  };

  const handOver = async (exchange) => {
    try {
      await assistant.escalate({
        question: exchange.question,
        messageId: exchange.id,
        screen,
        conversationId: conversationRef.current,
      });
      setExchanges((xs) => xs.map((x) => (x.id === exchange.id ? { ...x, escalated: true, canEscalate: false } : x)));
    } catch (err) {
      setFailed(err?.message || "I could not pass that on. Please contact the team directly.");
    }
  };

  const go = (path) => {
    navigate(path);
    onClose?.();
  };

  const reason = whyNotSend(text, { busy });
  const chips = refusalRef.current ? [`Why did it say: ${refusalRef.current.message}`, ...SUGGESTIONS] : SUGGESTIONS;

  return (
    <Modal
      title="Zarvia AI"
      description="Ask about anything in Zarvia. It answers from the product guide and can point you at the right screen."
      onClose={onClose}
      size="lg"
    >
      <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto pe-1" role="log" aria-live="polite">
        {!exchanges.length && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Bot className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{tip || "Ask me how something works, or why Zarvia would not let you do something."}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {chips.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-start text-xs hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {exchanges.map((x) => (
          <div key={x.id} className="space-y-2">
            <p className="ms-auto max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm">{x.question}</p>
            <div className="max-w-[92%] space-y-2">
              <p className="whitespace-pre-line text-sm">{x.answer}</p>
              {Boolean(x.citations.length) && <p className="text-xs text-muted-foreground">From: {x.citations.join(" and ")}</p>}
              {Boolean(x.links.length) && (
                <div className="flex flex-wrap gap-2">
                  {x.links.map((l) => (
                    <button key={l.path} type="button" onClick={() => go(l.path)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-label="This helped" aria-pressed={x.helpful === true} onClick={() => rate(x.id, true)} className="rounded p-1.5 text-muted-foreground hover:bg-accent aria-pressed:text-primary">
                  <ThumbsUp className="size-3.5" aria-hidden="true" />
                </button>
                <button type="button" aria-label="This did not help" aria-pressed={x.helpful === false} onClick={() => rate(x.id, false)} className="rounded p-1.5 text-muted-foreground hover:bg-accent aria-pressed:text-destructive">
                  <ThumbsDown className="size-3.5" aria-hidden="true" />
                </button>
                {x.escalated ? (
                  <span className="text-xs text-muted-foreground">Passed to the Zarvia team.</span>
                ) : (
                  x.canEscalate && (
                    <button type="button" onClick={() => handOver(x)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
                      <LifeBuoy className="size-3.5" aria-hidden="true" />
                      Ask the Zarvia team
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}

        {exchanges.some((x) => x.testMode) && (
          <p role="status" className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Test mode: these answers are canned examples, not real ones. Nobody has connected the AI service yet.
          </p>
        )}
        {busy && <p className="text-sm text-muted-foreground">Reading the documentation...</p>}
        {Boolean(failed) && <p role="status" className="text-sm text-destructive">{failed}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label className="sr-only" htmlFor="zarvia-ai-question">
          Your question
        </label>
        <textarea
          id="zarvia-ai-question"
          data-autofocus
          rows={2}
          value={text}
          maxLength={MAX_QUESTION}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter asks; Shift+Enter is a new line. A question is usually one line.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder="How do I...?"
          className="min-h-11 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-base sm:text-sm"
        />
        <button type="submit" disabled={!canSend(text, { busy })} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-50 lg:h-10">
          <Send className="size-4" aria-hidden="true" />
          Ask
        </button>
      </form>
      {Boolean(reason) && <p className="mt-1 text-xs text-muted-foreground">{reason}</p>}
    </Modal>
  );
}
