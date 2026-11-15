// The first thing a new person sees: one plain question and a few big choices, each starting a short journey of guides
// on their own screen. Only the journeys their plan and role allow are shown, so there is never a choice that leads
// nowhere, and "Not now" is always as easy as a choice. It is shown once per person (GuideProvider remembers it);
// afterwards the same journeys are on the Learn page and in Guide me.
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "lucide-react";
import { LANGS, ui } from "./index";
import { journeysFor } from "./journeys";

export default function WelcomeGuide({ flows, table, lang, setLang, onPick, onLater }) {
  const first = useRef(null);
  const t = (k, ...a) => ui(table, k, ...a);
  const choices = journeysFor(flows);
  const dir = LANGS.find((l) => l.code === lang)?.dir || "ltr";

  useEffect(() => {
    first.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onLater(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onLater]);

  if (!choices.length) return null;
  return createPortal(
    <div data-guide-welcome="" dir={dir} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="guide-welcome-title"
        className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-2xl sm:p-6">
        <h2 id="guide-welcome-title" className="text-xl font-semibold">{t("welcomeTitle")}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("welcomeText")}</p>

        <ul className="mt-4 grid grid-cols-1 gap-2.5">
          {choices.map((j, i) => (
            <li key={j.id}>
              <button ref={i === 0 ? first : undefined} type="button" data-journey={j.id} onClick={() => onPick(j.first)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-start outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium text-foreground">{t(`journey.${j.id}`)}</span>
                  <span className="block text-sm text-muted-foreground">{t(`journeyHint.${j.id}`)}</span>
                  {j.minutes > 0 && <span className="mt-0.5 block text-xs text-muted-foreground">{t("journeyTime", j.minutes)}</span>}
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-1" role="group" aria-label={t("language")}>
            {LANGS.map((l) => (
              <button key={l.code} type="button" data-lang={l.code} aria-pressed={lang === l.code} title={l.label} onClick={() => setLang(l.code)}
                className={`h-9 min-w-9 rounded px-2 text-xs ${lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{l.short}</button>
            ))}
          </div>
          <button type="button" data-welcome-later="" onClick={onLater} className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-secondary">{t("welcomeLater")}</button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("welcomeLaterNote", t("guideMe"))}</p>
        {lang !== "en" && table && table.reviewed === false && <p className="mt-1 text-[11px] text-muted-foreground">{t("inReview")}</p>}
      </div>
    </div>,
    document.body,
  );
}
