import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, PlayCircle, Search, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Modal, PageHeader, Panel } from "../accounting/kit";
import { useGuides } from "../../guides/guideContext";
import { LANGS, ui, wording } from "../../guides";
import axiosInstance from "../../axios/axios";
import { grouped } from "../../guides/groups";
import { videoUrl } from "../../guides/videos";

// Every guide the person may run, by area, with what they have finished. The same list as the Guide me panel,
// laid out as a page: somewhere to look around, choose the guide language and pick up where they left off.
const norm = (s) => String(s || "").toLowerCase();

// How fast the videos play: remembered for the next video and the next visit (a per-person convenience, so it may fail quietly).
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SPEED_KEY = "zarvia.videoSpeed";
const savedSpeed = () => { try { const v = Number(window.localStorage.getItem(SPEED_KEY)); return SPEEDS.includes(v) ? v : 1; } catch { return 1; } };

export default function LearnPage() {
  const { flows, start, done, table, active, lang, setLang } = useGuides();
  const [q, setQ] = useState("");
  const [watching, setWatching] = useState(null); // { flow, src, poster, lang } of the video being played
  const [ended, setEnded] = useState(false);
  const [speed, setSpeedState] = useState(savedSpeed);
  const player = useRef(null);
  const setSpeed = (v) => { setSpeedState(v); if (player.current) player.current.playbackRate = v; try { window.localStorage.setItem(SPEED_KEY, String(v)); } catch { /* not remembered */ } };
  const [steps, setSteps] = useState(null); // the books' own answer; null until it arrives, or if it cannot be read
  useEffect(() => {
    let live = true;
    axiosInstance.get("/onboarding/checklist").then((r) => { if (live) setSteps(r.data?.data?.steps || null); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const groups = useMemo(() => grouped(flows), [flows]);
  const title = (f) => wording(table, `flow.${f.id}`).title;
  const blurb = (f) => wording(table, `flow.${f.id}`).text;
  const finished = flows.filter((f) => done(f.id)).length;
  const next = flows.find((f) => !done(f.id)) || null;
  const query = norm(q.trim());
  const shown = groups
    .map((g) => ({ ...g, flows: query ? g.flows.filter((f) => norm(title(f)).includes(query) || norm(blurb(f)).includes(query)) : g.flows }))
    .filter((g) => g.flows.length);
  // the videos in the order the page lists the guides (the order to learn them in), for "Next video"
  const playlist = useMemo(() => groups.flatMap((g) => g.flows).map((f) => ({ flow: f, ...videoUrl(f.id, lang) })).filter((v) => v.src), [groups, lang]);
  const upNext = watching ? playlist[playlist.findIndex((v) => v.flow.id === watching.flow.id) + 1] || null : null;
  const watch = (v) => { setEnded(false); setWatching(v); };
  const pct = flows.length ? Math.round((finished / flows.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader title={ui(table, "learnTitle")} description={ui(table, "learnIntro")} />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        <Panel title={ui(table, "progress", finished, flows.length)}>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={flows.length} aria-valuenow={finished}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          {next && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0"><span className="block text-xs text-muted-foreground">{ui(table, "nextUp")}</span><span className="block truncate font-medium">{title(next)}</span></span>
              </span>
              <Button onClick={() => start(next.id)} disabled={Boolean(active)} data-learn-start={next.id}>{ui(table, "start")}</Button>
            </div>
          )}
        </Panel>
        <Panel title={ui(table, "language")}>
          <div className="flex flex-wrap gap-2" role="group" aria-label={ui(table, "language")}>
            {LANGS.map((l) => (
              <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}
                className={`h-11 rounded-lg border px-3 text-sm lg:h-9 ${lang === l.code ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}>{l.label}</button>
            ))}
          </div>
          {lang !== "en" && !table?.reviewed && <p className="mt-2 text-xs text-muted-foreground">{ui(table, "inReview")}</p>}
        </Panel>
      </div>

      {steps && steps.length > 0 && (
        <Panel title={ui(table, "checklistTitle")} description={steps.every((s) => s.done) ? ui(table, "checklistDone") : undefined} className="mb-6">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${s.done ? "border-status-success bg-status-success/10 text-status-success" : "border-border text-transparent"}`}>
                  <Check className="h-3 w-3" aria-label={s.done ? ui(table, "finished") : undefined} aria-hidden={!s.done} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{ui(table, `step.${s.id}`)}</span>
                {!s.done && flows.some((f) => f.id === s.guide) && <Button size="sm" variant="outline" disabled={Boolean(active)} onClick={() => start(s.guide)}>{ui(table, "start")}</Button>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ui(table, "search")} aria-label={ui(table, "search")}
          className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" />
      </div>

      {!shown.length && <p className="py-10 text-center text-sm text-muted-foreground">{ui(table, "noMatch")}</p>}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {shown.map((g) => {
          const n = g.flows.filter((f) => done(f.id)).length;
          return (
            <Panel key={g.id} title={ui(table, `group.${g.id}`)} description={ui(table, `groupHint.${g.id}`)}
              actions={<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{n}/{g.flows.length}</span>}>
              <ul className="-my-1 divide-y divide-border">
                {g.flows.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-2.5">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${done(f.id) ? "border-status-success bg-status-success/10 text-status-success" : "border-border text-transparent"}`}>
                      <Check className="h-3 w-3" aria-label={done(f.id) ? ui(table, "finished") : undefined} aria-hidden={!done(f.id)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{title(f)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{ui(table, "minutes", f.minutes)}</span>
                    </span>
                    {videoUrl(f.id, lang) && (
                      <Button size="sm" variant="ghost" data-learn-watch={f.id} onClick={() => watch({ flow: f, ...videoUrl(f.id, lang) })}
                        aria-label={`${ui(table, "watch")}: ${title(f)}`}>
                        <PlayCircle className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{ui(table, "watch")}</span>
                      </Button>
                    )}
                    <Button size="sm" variant={done(f.id) ? "outline" : "default"} disabled={Boolean(active)} onClick={() => start(f.id)}
                      aria-label={`${ui(table, "start")}: ${title(f)}`}>{ui(table, "start")}</Button>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
      </div>

      {watching && (
        <Modal size="lg" title={ui(table, "watchTitle", title(watching.flow))} onClose={() => setWatching(null)}
          description={watching.lang !== lang ? ui(table, "videoLang", LANGS.find((l) => l.code === watching.lang)?.label || watching.lang) : undefined}>
          {/* the walkthrough as recorded on the screens, with the card read aloud; the guide itself is Start */}
          <video key={watching.src} src={watching.src} poster={watching.poster} controls autoPlay playsInline preload="metadata" onEnded={() => setEnded(true)}
            ref={player} onLoadedMetadata={(e) => { e.currentTarget.playbackRate = speed; }}
            className="aspect-[16/10] w-full rounded-lg bg-black" aria-label={ui(table, "watchTitle", title(watching.flow))} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={ui(table, "videoSpeed")}>
            <span className="me-1 text-xs text-muted-foreground">{ui(table, "videoSpeed")}</span>
            {SPEEDS.map((v) => (
              <button key={v} type="button" data-speed={v} aria-pressed={speed === v} onClick={() => setSpeed(v)}
                className={`h-9 min-w-12 rounded-md border px-2 text-sm ${speed === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}>{v}×</button>
            ))}
          </div>
          {/* the next video's first bytes are fetched quietly now (only its header, a few KB), so "Next video" starts at once */}
          {upNext && <video src={upNext.src} preload="metadata" muted hidden aria-hidden="true" tabIndex={-1} />}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {upNext ? (
              <Button variant={ended ? "default" : "outline"} data-watch-next={upNext.flow.id} onClick={() => watch(upNext)}>
                {ui(table, "watchNext", title(upNext.flow))}
              </Button>
            ) : <span />}
            <Button variant={ended && !upNext ? "default" : "outline"} disabled={Boolean(active)} onClick={() => { const id = watching.flow.id; setWatching(null); start(id); }}>{ui(table, "start")}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
