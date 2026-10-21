import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, Check, Copy, ExternalLink, LifeBuoy, RotateCcw, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { assistant } from "../../lib/assistantApi";
import { recentRefusal } from "../../lib/lastRefusal";
import { canSend, openingTip, toExchange, whyNotSend, MAX_QUESTION } from "../../lib/assistant";
import { formatAnswer, plainAnswer } from "../../lib/answerFormat";
import { pageSession } from "../../lib/pageSession";
import { findActive } from "../../config/navigation";

// Zarvia AI, docked rather than drawn as a dialog in the middle of the page.
//
// A support chat is something you keep open while you carry on working - you read the answer, look
// at the screen it is about, ask the next thing - so it sits in the corner and leaves the page
// visible. A centred modal makes the app disappear behind it, which is right for a form and wrong
// for a conversation. Below `sm` it becomes a sheet across the bottom, clear of the bottom bar.
//
// It reads no business data: everything it says comes from the documentation and the table of
// refusal codes, so there is nothing here to scope to a branch or a party.

const session = pageSession("assistant");

// Offered only where the documentation has nothing for this screen, so they are general on purpose.
const GENERAL = ["How do I raise an invoice?", "Why does it say posting is closed?", "How do I record a payment?"];

// An answer drawn from the blocks the formatter found. Built as elements, never as HTML.
function Answer({ text }) {
  const runs = (spans) => spans.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>));
  return (
    <div className="space-y-2">
      {formatAnswer(text).map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{runs(b.spans)}</p>
        ) : b.type === "ol" ? (
          <ol key={i} className="ms-4 list-decimal space-y-1">
            {b.items.map((it, j) => (
              <li key={j}>{runs(it)}</li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="ms-4 list-disc space-y-1">
            {b.items.map((it, j) => (
              <li key={j}>{runs(it)}</li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

export default function AssistantPanel({ onClose, initialExchanges = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = findActive(location.pathname);
  const screen = active?.tab?.to || location.pathname;
  const screenName = active?.tab?.label || "";

  const [exchanges, setExchanges] = useState(() => initialExchanges || session.get("exchanges", []));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState("");
  const [suggested, setSuggested] = useState([]);
  // null until the screen answers: "covered" is whether the documentation has ANY topic about this
  // screen, which is not the same as whether those topics happen to carry question phrasings.
  const [covered, setCovered] = useState(null);
  const [failed, setFailed] = useState("");
  const [copied, setCopied] = useState("");
  const endRef = useRef(null);
  const boxRef = useRef(null);
  const conversationRef = useRef(session.get("conversationId", ""));
  const refusalRef = useRef(recentRefusal());

  useEffect(() => {
    let alive = true;
    assistant
      .screen(screen)
      .then((data) => {
        if (!alive) return;
        const topics = data?.topics || [];
        setTip(openingTip(screen, topics));
        setSuggested(Array.isArray(data?.suggestions) ? data.suggestions : []);
        // Either signal means the documentation knows this screen.
        setCovered(topics.length > 0 || (data?.suggestions || []).length > 0);
      })
      .catch(() => alive && setCovered(false));
    return () => {
      alive = false;
    };
  }, [screen]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
    session.set("exchanges", exchanges);
  }, [exchanges, busy]);

  // The dialog's own keyboard: Escape closes it, wherever the focus is inside.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const node = boxRef.current;
    node?.addEventListener("keydown", onKey);
    node?.querySelector("textarea")?.focus();
    return () => node?.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = useCallback(
    async (asked) => {
      const question = String(asked || "").trim();
      if (!question || busy) return;
      setBusy(true);
      setFailed("");
      setText("");
      try {
        const answer = await assistant.ask({ question, screen, screenName, conversationId: conversationRef.current });
        if (answer?.conversationId) {
          conversationRef.current = answer.conversationId;
          session.set("conversationId", answer.conversationId);
        }
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
      await assistant.escalate({ question: exchange.question, messageId: exchange.id, screen, conversationId: conversationRef.current });
      setExchanges((xs) => xs.map((x) => (x.id === exchange.id ? { ...x, escalated: true, canEscalate: false } : x)));
    } catch (err) {
      setFailed(err?.message || "I could not pass that on. Please contact the team directly.");
    }
  };

  const copy = async (x) => {
    try {
      await navigator.clipboard?.writeText(plainAnswer(x.answer));
      setCopied(x.id);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // No clipboard permission is not worth an error message; the text is on screen to select.
    }
  };

  const startAgain = () => {
    setExchanges([]);
    setFailed("");
    conversationRef.current = "";
    session.remove("conversationId");
    session.remove("exchanges");
  };

  const go = (path) => {
    navigate(path);
    onClose?.();
  };

  // What this screen is covered by decides the empty state. A screen the documentation says nothing
  // about - the CRM today - must SAY so: offering invoice questions on a CRM page reads as careless,
  // and is worse than admitting the gap and offering the way out.
  // The screen's own questions when it has them; the general ones when it is covered but the topics
  // carry no phrasings; and none at all when the documentation does not know this screen - there
  // the general ones appear under their own heading, so nobody mistakes them for being about here.
  const chips = [
    ...(refusalRef.current ? [`Why did it say: ${refusalRef.current.message}`] : []),
    ...(suggested.length ? suggested : covered === false ? [] : GENERAL),
  ];
  const reason = whyNotSend(text, { busy });

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Zarvia AI"
      className="pb-safe fixed end-0 z-50 flex w-full flex-col rounded-t-xl border bg-card shadow-lg sm:end-4 sm:w-[26rem] sm:rounded-xl"
      style={{ bottom: "calc(var(--bottom-nav-h, 0px) + 0.5rem)", maxHeight: "min(38rem, calc(100dvh - 5rem))" }}
    >
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent">
          <Bot className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-tight">Zarvia AI</span>
          <span className="block truncate text-xs text-muted-foreground">
            {screenName ? `Looking at ${screenName}` : "Answers from the product guide"}
          </span>
        </span>
        {Boolean(exchanges.length) && (
          <button type="button" onClick={startAgain} title="Start again" className="rounded p-1.5 text-muted-foreground hover:bg-accent">
            <RotateCcw className="size-4" aria-hidden="true" />
            <span className="sr-only">Start again</span>
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-accent">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3" role="log" aria-live="polite">
        {!exchanges.length && (
          <div className="space-y-3 text-sm">
            {covered === false ? (
              <p className="text-muted-foreground">
                I have nothing written about {screenName || "this screen"} yet. Ask anyway and I will
                pass it to the Zarvia team.
              </p>
            ) : (
              <p className="text-muted-foreground">
                {tip || "Ask me how something works, or why Zarvia would not let you do something."}
              </p>
            )}

            {/* Nothing offered until the screen has answered: otherwise the general questions
                appear for a moment and are then replaced, which reads as a glitch. */}
            {covered !== null && Boolean(chips.length) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Try one of these</p>
                <div className="flex flex-wrap gap-2">
                  {chips.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-start text-xs hover:bg-accent">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {covered === false && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">I do know about</p>
                <div className="flex flex-wrap gap-2">
                  {GENERAL.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-start text-xs hover:bg-accent">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="border-t pt-3 text-xs text-muted-foreground">
              Your own figures - what a customer owes, why a total looks wrong - are{" "}
              <span className="font-medium">coming soon</span>.
            </p>
          </div>
        )}

        {exchanges.map((x) => (
          <div key={x.id} className="space-y-2">
            <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-sm">{x.question}</p>
            <div className="flex gap-2">
              <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent">
                <Bot className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="rounded-2xl rounded-bl-sm border px-3 py-2 text-sm">
                  <Answer text={x.answer} />
                </div>
                {Boolean(x.citations.length) && (
                  <p className="text-xs text-muted-foreground">From: {x.citations.join(" and ")}</p>
                )}
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
                <div className="flex flex-wrap items-center gap-1">
                  <button type="button" aria-label="This helped" aria-pressed={x.helpful === true} onClick={() => rate(x.id, true)} className="rounded p-1.5 text-muted-foreground hover:bg-accent aria-pressed:text-primary">
                    <ThumbsUp className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="This did not help" aria-pressed={x.helpful === false} onClick={() => rate(x.id, false)} className="rounded p-1.5 text-muted-foreground hover:bg-accent aria-pressed:text-destructive">
                    <ThumbsDown className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Copy this answer" onClick={() => copy(x)} className="rounded p-1.5 text-muted-foreground hover:bg-accent">
                    {copied === x.id ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  </button>
                  {x.escalated ? (
                    <span className="ms-1 text-xs text-muted-foreground">Passed to the Zarvia team.</span>
                  ) : (
                    x.canEscalate && (
                      <button type="button" onClick={() => handOver(x)} className="ms-1 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
                        <LifeBuoy className="size-3.5" aria-hidden="true" />
                        Ask the Zarvia team
                      </button>
                    )
                  )}
                </div>
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
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="zarvia-ai-question">
            Your question
          </label>
          <textarea
            id="zarvia-ai-question"
            data-autofocus
            rows={1}
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
            className="max-h-24 min-h-11 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-base sm:text-sm"
          />
          <button type="submit" disabled={!canSend(text, { busy })} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-50 lg:h-10">
            <Send className="size-4" aria-hidden="true" />
            Ask
          </button>
        </div>
        {Boolean(reason) && <p className="mt-1 text-xs text-muted-foreground">{reason}</p>}
      </form>
    </div>
  );
}
