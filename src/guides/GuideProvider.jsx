// Runs a guide. One provider wraps the app shell (Layout) and the overlay is drawn beside the assistant
// panel, outside the per-page error boundary, so a guide survives moving between pages and lazy page loads.
//
// The guide NEVER clicks or types for the person: it points, waits, and moves on when they have done the
// step (a click) or say they are ready (Next). Their own data goes in, on their own screen.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useOrganisation } from "../components/shell/OrganisationContext";
import { prefsFor } from "../lib/userPrefs";
import { LANGS, flowById, flowsFor, loadLang, stepsFor, ui, wording } from "./index";
import { locate, placeCard, spotRect } from "./locate";
import { GuideContext } from "./guideContext";
import RichText from "./RichText";
import WelcomeGuide from "./WelcomeGuide";


const GIVE_UP_MS = 8000; // how long a target may be missing before the card says so instead of waiting for ever
const same = (a, b) => a && b && ["top", "left", "width", "height"].every((k) => Math.abs(a[k] - b[k]) < 1);

export function GuideProvider({ children }) {
  const org = useOrganisation();
  const me = org.status?.me;
  const prefs = useMemo(() => prefsFor(me?.id), [me?.id]);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [run, setRun] = useState(null); // { flowId, i }
  const [lang, setLangState] = useState(() => prefs.get("display.guideLang", "en"));
  const [table, setTable] = useState(null);
  const [spot, setSpot] = useState(null);
  const [lost, setLost] = useState(false);
  const [tick, setTick] = useState(0); // bumped when preferences change, so "finished" ticks re-read
  const [welcome, setWelcome] = useState(false);

  const flows = useMemo(() => flowsFor({ mayUse: org.mayUse }), [org.mayUse, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const flow = run ? flowById(run.flowId) : null;
  const steps = useMemo(() => stepsFor(flow, org.mayUse), [flow, org.mayUse]);
  const step = flow ? steps[run.i] : null;
  const elRef = useRef(null);

  useEffect(() => { let live = true; loadLang(lang).then((t) => { if (live) setTable(t); }); return () => { live = false; }; }, [lang]);
  const setLang = useCallback((code) => { setLangState(code); prefs.set("display.guideLang", code); }, [prefs]);

  const stop = useCallback(() => { setRun(null); setSpot(null); setLost(false); elRef.current = null; }, []);
  const start = useCallback((flowId) => { if (flowById(flowId)) { setSpot(null); setLost(false); setRun({ flowId, i: 0 }); } }, []);
  const go = useCallback((delta) => {
    setSpot(null); setLost(false); elRef.current = null;
    setRun((r) => (r ? { ...r, i: Math.max(0, Math.min(r.i + delta, stepsFor(flowById(r.flowId), org.mayUse).length - 1)) } : r));
  }, [org.mayUse]);
  const done = useCallback((id) => Boolean(prefs.get(`display.guideDone.${id}`, false)), [prefs, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // The welcome: once per person, on their first sign-in (a person who has already finished a guide is not welcomed again),
  // never while they must first change their password or set up two-factor, and only if there is a guide they may run.
  const mayWelcome = Boolean(me && table && flows.length && !me.mustChangePassword && !me.twoFactorRequired);
  useEffect(() => {
    if (!mayWelcome) return;
    if (!prefs.get("display.guideWelcomed", false) && !flows.some((f) => prefs.get(`display.guideDone.${f.id}`, false))) setWelcome(true);
  }, [mayWelcome, prefs, flows]);
  const closeWelcome = useCallback(() => { prefs.set("display.guideWelcomed", true); setWelcome(false); }, [prefs]);
  const pickJourney = useCallback((flowId) => { closeWelcome(); start(flowId); }, [closeWelcome, start]);

  // a guide belongs to one signed-in person: signing out (or a different person) ends it
  useEffect(() => { if (!me) stop(); }, [me, stop]);

  // go: take the person to the page, then move on
  useEffect(() => {
    if (!step || step.kind !== "go") return;
    if (pathname === step.to || pathname.startsWith(`${step.to}/`)) go(1); else navigate(step.to);
  }, [step, pathname, go, navigate]);

  // the last card: remember the guide as finished
  useEffect(() => {
    if (step?.kind === "done" && run) { prefs.set(`display.guideDone.${run.flowId}`, true); setTick((t) => t + 1); }
  }, [step, run, prefs]);

  // find the target and keep the spotlight on it while the page changes under it
  useEffect(() => {
    if (!step || !step.target) return undefined;
    let since = Date.now();
    let scrolled = false;
    let skipped = false;
    const look = () => {
      const el = locate(document.body, step.target);
      if (elRef.current && elRef.current !== el) elRef.current.removeAttribute?.("data-guide-current");
      elRef.current = el;
      el?.setAttribute?.("data-guide-current", "");
      if (!el) {
        setSpot(null);
        // `ifPresent`: a control that exists only in some states (Confirm order vanishes once confirmed): skip, never dead-end
        if (step.ifPresent && Date.now() - since > 2500 && !skipped) { skipped = true; go(1); return; }
        if (Date.now() - since > GIVE_UP_MS) setLost(true);
        return;
      }
      setLost(false);
      if (!scrolled) { scrolled = true; el.scrollIntoView?.({ block: "center", behavior: "smooth" }); }
      const next = spotRect(el);
      setSpot((prev) => (same(prev, next) ? prev : next));
    };
    look();
    const timer = window.setInterval(look, 200);
    return () => { window.clearInterval(timer); document.querySelectorAll("[data-guide-current]").forEach((n) => n.removeAttribute("data-guide-current")); };
  }, [step, go]);

  // click steps move on when the person clicks the target (the page gets a moment to react first)
  useEffect(() => {
    if (!step || step.kind !== "click") return undefined;
    const onClick = (e) => {
      const el = elRef.current;
      // `clickIn`: a click anywhere in that area counts (a list: the person opens THEIR row, not the one pointed at)
      const inArea = step.clickIn && e.target.closest?.(step.clickIn);
      if (inArea || (el && (el === e.target || el.contains(e.target)))) window.setTimeout(() => go(1), 250);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step, go]);

  const value = useMemo(() => ({ active: run, start, stop, flows, lang, setLang, done, table }), [run, start, stop, flows, lang, setLang, done, table]);
  return (
    <GuideContext.Provider value={value}>
      {children}
      {welcome && !run && mayWelcome && (
        <WelcomeGuide flows={flows} table={table} lang={lang} setLang={setLang} onPick={pickJourney} onLater={closeWelcome} />
      )}
      {run && flow && step && (
        <GuideOverlay {...{ flow, steps, step, i: run.i, spot, lost, lang, setLang, table, go, stop, start, flows }} />
      )}
    </GuideContext.Provider>
  );
}

function GuideOverlay({ flow, steps, step, i, spot, lost, lang, setLang, table, go, stop, start, flows }) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);
  const text = wording(table, `${flow.id}.${step.id}`);
  const t = (k, ...a) => ui(table, k, ...a);
  const total = steps.filter((s) => s.kind !== "go").length;
  const shown = steps.slice(0, i + 1).filter((s) => s.kind !== "go").length;
  const dir = LANGS.find((l) => l.code === lang)?.dir || "ltr";
  const isDone = step.kind === "done";
  const next = isDone && step.next && flows.some((f) => f.id === step.next) ? step.next : null;
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !spot || narrow) { setPos(null); return; }
    setPos(placeCard(spot, { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [spot, step, narrow, lost, lang, table]);

  const cardStyle = narrow
    ? { left: 8, right: 8, bottom: 8 }
    : pos ? { top: pos.top, left: pos.left } : { top: 80, right: 24 }; // before the target is found, or for a card about nothing in particular

  return createPortal(
    <div data-guide-overlay="" data-guide-step={`${flow.id}.${step.id}`} data-guide-kind={step.kind} data-guide-sample={step.sample || ""} dir={dir} className="pointer-events-none fixed inset-0 z-[70]">
      {spot && (
        <div
          aria-hidden="true"
          className="fixed rounded-lg ring-2 ring-primary transition-[top,left,width,height] duration-200 motion-reduce:transition-none"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, boxShadow: "0 0 0 9999px rgba(20,18,14,0.45)" }}
        />
      )}
      <div
        ref={cardRef}
        role="region"
        aria-label={text.title}
        className="pointer-events-auto fixed w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl"
        style={cardStyle}
      >
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{isDone ? t("finished") : t("stepOf", Math.max(shown, 1), total)}{step.optional && !isDone ? ` · ${t("optional")}` : ""}</span>
          <button type="button" onClick={stop} aria-label={t("stop")} className="rounded p-1 hover:bg-secondary"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <p className="text-base font-semibold">{text.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{lost ? t("lost") : <RichText text={text.text} />}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {i > 0 && !isDone && (
            <button type="button" data-action="back" onClick={() => go(-1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-secondary">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />{t("back")}
            </button>
          )}
          {isDone ? (
            <>
              {next && <button type="button" onClick={() => start(next)} className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">{wording(table, `flow.${next}`).title}<ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /></button>}
              <button type="button" onClick={stop} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-secondary"><Check className="h-4 w-4" aria-hidden="true" />{t("stop")}</button>
            </>
          ) : (
            <>
              {(step.kind === "fill" || step.kind === "info" || lost || step.optional) && (
                <button type="button" data-action={lost || (step.optional && step.kind === "click") ? "skip" : "next"} onClick={() => go(1)} className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
                  {lost || (step.optional && step.kind === "click") ? t("skip") : t("next")}<ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </button>
              )}
              {step.kind === "click" && !lost && !step.optional && (
                <button type="button" data-action="skip-link" onClick={() => go(1)} className="ms-auto text-xs text-muted-foreground underline underline-offset-2">{t("skip")}</button>
              )}
            </>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1 border-t border-border pt-2" role="group" aria-label={t("language")}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              data-lang={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              aria-pressed={lang === l.code}
              title={l.label}
              className={`h-7 min-w-7 rounded px-1.5 text-xs ${lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >{l.short}</button>
          ))}
          {table && table.reviewed === false && <span className="ms-auto text-[11px] text-muted-foreground">{t("inReview")}</span>}
        </div>
      </div>
    </div>,
    document.body
  );
}

