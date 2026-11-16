import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowUp, BellRing, Gauge, LineChart, Scale, History, Plus, Trash2, Check, Compass, Copy, ExternalLink, Landmark, LifeBuoy, MessageCircleQuestion, Package, Receipt, Sparkles, ThumbsDown, ThumbsUp, TrendingUp, Users, Wand2, X } from "lucide-react";
import { assistant } from "../../lib/assistantApi";
import { recentRefusal } from "../../lib/lastRefusal";
import { canSend, openingTip, toExchange, whyNotSend, MAX_QUESTION } from "../../lib/assistant";
import { formatAnswer, plainAnswer } from "../../lib/answerFormat";
import { pageSession } from "../../lib/pageSession";
import AssistantProposal from "./AssistantProposal";
import AssistantTable from "./AssistantTable";
import { useGuides } from "../../guides/guideContext";
import { wording } from "../../guides/index";
import { suggestGuides } from "../../lib/assistantGuides";
import { findActive } from "../../config/navigation";
import { cn } from "../../lib/utils";

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
  // The step-by-step walkthroughs this person may run (their role and plan decide). Offered under an answer when
  // the question names one: the help explains, the guide shows how on the real screen.
  const guides = useGuides();
  const guidesFor = (question) => suggestGuides(question, guides.flows, (f) => wording(guides.table, `flow.${f.id}`));
  const startGuide = (id) => {
    guides.start(id);
    onClose?.();
  };
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
  // Can Zarvia AI prepare payments and invoices for this person? Decides whether examples are offered.
  const [acting, setActing] = useState(false);
  // Which lookups in their own books this person may ask for ("unpaid_bills", ...). Decides the examples offered.
  const [lookups, setLookups] = useState([]);
  const [failed, setFailed] = useState("");
  // "chat" or "history": the list of this person's earlier chats, with the chats themselves kept on the server
  const [view, setView] = useState("chat");
  const [chats, setChats] = useState(null);
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
        setActing(data?.actions === true);
        setLookups(Array.isArray(data?.lookups) ? data.lookups : []);
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

  // Earlier chats: the list is read when it is opened and once for the empty state's "Recent chats"
  const loadChats = useCallback(() => Promise.resolve().then(() => assistant.conversations()).then((list) => setChats(Array.isArray(list) ? list : [])).catch(() => setChats([])), []);
  useEffect(() => {
    loadChats();
  }, [loadChats]);
  const openChat = async (id) => {
    try {
      const rows = await assistant.conversation(id);
      setExchanges((Array.isArray(rows) ? rows : []).map((m) => toExchange(m.question, { ...m, messageId: m._id || m.id, conversationId: id })));
      conversationRef.current = id;
      session.set("conversationId", id);
      setFailed("");
      setView("chat");
    } catch (err) {
      setFailed(err?.message || "I could not open that chat.");
    }
  };
  const forgetChat = async (id) => {
    try {
      await assistant.forgetConversation(id);
      setChats((cs) => (cs || []).filter((c) => c.id !== id));
      if (conversationRef.current === id) startAgain();
    } catch (err) {
      setFailed(err?.message || "I could not delete that chat.");
    }
  };

  const startAgain = () => {
    setView("chat");
    loadChats();
    setExchanges([]);
    setFailed("");
    conversationRef.current = "";
    session.remove("conversationId");
    session.remove("exchanges");
  };

  // The card changed (saved, or its result): keep it in the exchange, so the panel's own memory has it too.
  const updateProposal = (exchangeId, proposalId, patch) =>
    setExchanges((xs) => xs.map((x) => (x.id === exchangeId ? { ...x, proposals: (x.proposals || []).map((p) => (p.id === proposalId ? { ...p, ...patch } : p)) } : x)));
  // "Change details": the normal form, opened already filled in from the prepared document.
  const openForm = (target) => {
    navigate(target.path, { state: target.state });
    onClose?.();
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
      className="pb-safe fixed end-0 z-50 flex w-full flex-col overflow-hidden rounded-t-2xl border bg-card shadow-elevated sm:end-4 sm:w-[28rem] sm:rounded-2xl"
      style={{ bottom: "calc(var(--bottom-nav-h, 0px) + 0.5rem)", maxHeight: "min(40rem, calc(100dvh - 5rem))" }}
    >
      <header className="flex items-center gap-3 border-b bg-gradient-to-br from-brand-soft via-card to-card px-4 py-3">
        <ZarviaAvatar size="md" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">Zarvia AI</span>
          <span className="block truncate text-xs text-muted-foreground">
            {screenName ? `Looking at ${screenName}` : "Answers from the product guide"}
          </span>
        </span>
        <button type="button" onClick={() => { setView(view === "history" ? "chat" : "history"); if (view !== "history") loadChats(); }} aria-pressed={view === "history"} title="Earlier chats" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground">
          <History className="size-4" aria-hidden="true" />
          <span className="sr-only">Earlier chats</span>
        </button>
        {Boolean(exchanges.length) && (
          <button type="button" onClick={startAgain} title="New chat" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Plus className="size-4" aria-hidden="true" />
            <span className="sr-only">Start again</span>
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4" role="log" aria-live="polite">
        {view === "history" && (
          <div className="animate-chat-in space-y-2 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Earlier chats</p>
            {chats === null && <p className="text-muted-foreground">Loading...</p>}
            {chats && !chats.length && <p className="rounded-xl bg-muted/50 px-3 py-4 text-center text-muted-foreground">No earlier chats yet. Your questions are kept here so you can come back to them.</p>}
            <ul className="space-y-1.5">
              {(chats || []).map((c) => (
                <li key={c.id} className="flex items-center gap-1 rounded-xl border bg-card transition-colors hover:border-brand/40">
                  <button type="button" onClick={() => openChat(c.id)} className="min-w-0 flex-1 px-3 py-2 text-start">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="block text-xs text-muted-foreground">{c.questions} {c.questions === 1 ? "question" : "questions"} · {chatDay(c.lastAskedAt)}</span>
                  </button>
                  <button type="button" onClick={() => forgetChat(c.id)} aria-label={`Delete chat: ${c.title}`} className="me-1 rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view === "chat" && !exchanges.length && (
          <div className="animate-chat-in space-y-4 text-sm">
            <div className="flex flex-col items-center gap-2 pt-1 text-center">
              <ZarviaAvatar size="lg" />
              <p className="text-base font-semibold">How can I help?</p>
              {covered === false ? (
                <p className="max-w-[22rem] text-muted-foreground">
                  I have nothing written about {screenName || "this screen"} yet. Ask anyway and I will
                  pass it to the Zarvia team.
                </p>
              ) : (
                <p className="max-w-[22rem] text-muted-foreground">
                  {tip || "Ask me how something works, or why Zarvia would not let you do something."}
                </p>
              )}
            </div>

            {lookups.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">From your books</p>
                <div className="grid grid-cols-2 gap-2">
                  {lookupChips(lookups).map(([tool, q]) => {
                    const Icon = LOOKUP_ICON[tool] || Sparkles;
                    return (
                      <button key={q} type="button" onClick={() => send(q)} className="flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-start text-xs font-medium transition-colors hover:border-brand/40 hover:bg-brand-soft/60">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-on-soft">
                          <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">{q}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nothing offered until the screen has answered: otherwise the general questions
                appear for a moment and are then replaced, which reads as a glitch. */}
            {Boolean(chats?.length) && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent chats</p>
                <div className="flex flex-col gap-1.5">
                  {chats.slice(0, 3).map((c) => (
                    <button key={c.id} type="button" onClick={() => openChat(c.id)} className="flex min-h-10 items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-start text-xs transition-colors hover:border-brand/40 hover:bg-brand-soft/60">
                      <History className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 truncate">{c.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {covered !== null && Boolean(chips.length) && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Try one of these</p>
                <div className="flex flex-col gap-1.5">
                  {chips.map((s) => (
                    <SuggestionRow key={s} text={s} icon={s.startsWith("Why did it say") ? AlertCircle : MessageCircleQuestion} onPick={send} />
                  ))}
                </div>
              </div>
            )}

            {covered === false && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">I do know about</p>
                <div className="flex flex-col gap-1.5">
                  {GENERAL.map((s) => (
                    <SuggestionRow key={s} text={s} icon={MessageCircleQuestion} onPick={send} />
                  ))}
                </div>
              </div>
            )}

            <p className="flex gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              <Wand2 className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden="true" />
              <span>
              {lookups.length > 0 && (
                <>
                  I can look things up in your books. Try: <span className="font-medium">{lookupExample(lookups)}</span>.{" "}
                </>
              )}
              {acting && (
                <>
                  I can prepare a payment, a receipt, an expense, a draft invoice, or a new customer or vendor for you to check. Try: <span className="font-medium">pay Al Noor 5,000 by bank transfer</span>. I never save anything until you press the button.
                </>
              )}
              {!acting && !lookups.length && <>Ask me how to do something in Zarvia, or why it said no.</>}
              </span>
            </p>
          </div>
        )}

        {view === "chat" && exchanges.map((x) => (
          <div key={x.id} className="animate-chat-in space-y-3">
            <p className="ms-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-card">{x.question}</p>
            <div className="flex gap-2.5">
              <ZarviaAvatar size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="rounded-2xl rounded-tl-md bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed">
                  <Answer text={x.answer} />
                </div>
                {Boolean(x.citations.length) && (
                  <p className="text-xs text-muted-foreground">From: {x.citations.join(" and ")}</p>
                )}
                {(x.proposals || []).map((p) => (
                  <AssistantProposal
                    key={p.id}
                    proposal={p}
                    messageId={x.id}
                    onChange={(proposalId, patch) => updateProposal(x.id, proposalId, patch)}
                    onOpenForm={openForm}
                    onOpenPath={go}
                  />
                ))}
                {(x.tables || []).map((t, i) => (
                  <AssistantTable key={`${x.id}-t${i}`} table={t} onOpen={go} />
                ))}
                <GuideButtons guides={guidesFor(x.question)} onStart={startGuide} />
                {Boolean(x.links.length) && (
                  <div className="flex flex-wrap gap-2">
                    {x.links.map((l) => (
                      <button key={l.path} type="button" onClick={() => go(l.path)} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-0.5">
                  <button type="button" aria-label="This helped" aria-pressed={x.helpful === true} onClick={() => rate(x.id, true)} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent aria-pressed:text-primary">
                    <ThumbsUp className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="This did not help" aria-pressed={x.helpful === false} onClick={() => rate(x.id, false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent aria-pressed:text-destructive">
                    <ThumbsDown className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Copy this answer" onClick={() => copy(x)} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent">
                    {copied === x.id ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  </button>
                  {x.escalated ? (
                    <span className="ms-1 text-xs text-muted-foreground">Passed to the Zarvia team.</span>
                  ) : (
                    x.canEscalate && (
                      <button type="button" onClick={() => handOver(x)} className="ms-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent">
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
          <p role="status" className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Test mode: these answers are canned examples, not real ones. Nobody has connected the AI service yet.
          </p>
        )}
        {busy && (
          <div className="flex animate-chat-in gap-2.5">
            <ZarviaAvatar size="sm" />
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted/60 px-3.5 py-2.5">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-chat-dot rounded-full bg-brand" style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </span>
              <span className="text-xs text-muted-foreground">Reading the documentation...</span>
            </div>
          </div>
        )}
        {Boolean(failed) && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-status-danger-soft px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{failed}</span>
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="border-t bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border bg-background p-1.5 ps-3 transition-shadow focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/15">
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
            placeholder={lookups.length ? "Ask about Zarvia or your books..." : "How do I...?"}
            className="max-h-24 min-h-10 flex-1 resize-none bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground/80 sm:text-sm"
          />
          <button type="submit" aria-label="Ask" title="Ask" disabled={!canSend(text, { busy })} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-opacity hover:opacity-90 disabled:opacity-35">
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
        {reason ? (
          <p className="mt-1.5 px-1 text-xs text-muted-foreground">{reason}</p>
        ) : (
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">Zarvia AI never saves anything by itself. Check an answer before you act on it.</p>
        )}
      </form>
    </div>
  );
}

const chatDay = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// The questions offered for looking things up, in this order, from the lookups this person may use.
const LOOKUP_CHIPS = [
  ["business_snapshot", "How are we doing?"],
  ["profit_and_loss", "Profit this month"],
  ["balance_sheet", "Balance sheet"],
  ["stock_alerts", "Stock alerts"],
  ["unpaid_bills", "List unpaid vendors"],
  ["unpaid_invoices", "Who owes us money?"],
  ["stock_levels", "What is running low?"],
  ["cash_and_bank", "How much is in the bank?"],
  ["trade_totals", "Sales this month"],
];
const LOOKUP_ICON = { business_snapshot: Gauge, profit_and_loss: LineChart, balance_sheet: Scale, stock_alerts: BellRing, unpaid_bills: Receipt, unpaid_invoices: Users, stock_levels: Package, cash_and_bank: Landmark, trade_totals: TrendingUp };
const lookupChips = (lookups) => LOOKUP_CHIPS.filter(([tool]) => lookups.includes(tool)).slice(0, 6);
const lookupExample = (lookups) => (lookupChips(lookups)[0]?.[1] || "").toLowerCase().replace(/\?$/, "");

// Zarvia AI's face: the gold sparkle on its soft gold disc. Gold is the accent, never a fill behind white text.
function ZarviaAvatar({ size = "sm", className = "" }) {
  const box = { sm: "size-7", md: "size-9", lg: "size-12" }[size];
  const icon = { sm: "size-3.5", md: "size-4", lg: "size-5" }[size];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/25", box, className)} aria-hidden="true">
      <Sparkles className={icon} />
    </span>
  );
}

// A question offered before anything is asked: one tap asks it.
function SuggestionRow({ text, icon, onPick }) {
  const Icon = icon;
  return (
    <button type="button" onClick={() => onPick(text)} className="flex min-h-10 items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-start text-xs transition-colors hover:border-brand/40 hover:bg-brand-soft/60">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0">{text}</span>
    </button>
  );
}

// "Guide me: Create a purchase order" under an answer: starts the step-by-step walkthrough on the real screen.
function GuideButtons({ guides, onStart }) {
  if (!guides.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {guides.map((g) => (
        <button key={g.id} type="button" onClick={() => onStart(g.id)} className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-start text-xs font-medium text-brand-on-soft transition-colors hover:border-brand/50">
          <Compass className="size-3.5 shrink-0" aria-hidden="true" />
          Guide me: {g.title}
        </button>
      ))}
    </div>
  );
}
