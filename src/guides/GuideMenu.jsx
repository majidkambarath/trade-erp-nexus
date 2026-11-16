// "Guide me" in the top bar. A panel, not a flat list: the guides for the screen you are on first, a search box,
// then every guide in its area with how many you have finished. The next unfinished guide is suggested.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, ChevronDown, LifeBuoy, Search, Sparkles, X } from "lucide-react";
import { useGuides } from "./guideContext";
import { ui, wording } from "./index";
import { grouped } from "./groups";

const norm = (s) => String(s || "").toLowerCase();

export default function GuideMenu() {
  const { flows, start, done, table, active } = useGuides();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [openGroups, setOpenGroups] = useState({});
  const box = useRef(null);
  const search = useRef(null);

  const here = (f) => f.steps.some((s) => s.kind === "go" && (pathname === s.to || pathname.startsWith(`${s.to}/`)));
  const groups = useMemo(() => grouped(flows), [flows]);
  const title = (f) => wording(table, `flow.${f.id}`).title;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    search.current?.focus();
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!flows.length) return null; // a person who may run no guide is not shown a button that opens nothing

  const label = ui(table, "guideMe");
  const total = flows.length;
  const finished = flows.filter((f) => done(f.id)).length;
  const onScreen = flows.filter(here);
  const next = flows.find((f) => !done(f.id) && !here(f)) || null;
  const query = norm(q.trim());
  const matches = query ? flows.filter((f) => norm(title(f)).includes(query) || norm(wording(table, `flow.${f.id}`).text).includes(query)) : [];

  const run = (id) => { setOpen(false); setQ(""); start(id); };

  const Row = ({ f, tag }) => (
    <button
      type="button"
      data-flow={f.id}
      disabled={Boolean(active)}
      onClick={() => run(f.id)}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-50"
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${done(f.id) ? "border-status-success bg-status-success/10 text-status-success" : "border-border text-transparent"}`}>
        <Check className="h-3 w-3" aria-label={done(f.id) ? ui(table, "finished") : undefined} aria-hidden={!done(f.id)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{title(f)}</span>
        <span className="block truncate text-xs text-muted-foreground">{ui(table, "minutes", f.minutes)}{tag ? ` · ${tag}` : ""}</span>
      </span>
    </button>
  );

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        title={label}
        data-guide="guide-me"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground aria-expanded:bg-accent"
      >
        <LifeBuoy className="h-4 w-4" aria-hidden="true" />
        <span className="hidden lg:inline">{label}</span>
        <span className="sr-only lg:hidden">{label}</span>
      </button>

      {/* the rows stay in the page (hidden) so a closed panel still has its guides for tests and the walker */}
      <div
        role="dialog"
        aria-label={label}
        hidden={!open}
        className="absolute end-0 top-full z-[60] mt-2 flex max-h-[min(34rem,calc(100dvh-5rem))] w-[22rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
      >
        <div className="border-b border-border px-3.5 pb-3 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <span className="text-xs text-muted-foreground">{ui(table, "progress", finished, total)}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${total ? Math.round((finished / total) * 100) : 0}%` }} />
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              ref={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ui(table, "search")}
              aria-label={ui(table, "search")}
              className="h-9 w-full rounded-lg border border-input bg-background ps-8 pe-8 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            />
            {q && (
              <button type="button" onClick={() => { setQ(""); search.current?.focus(); }} aria-label={ui(table, "clear")} className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {query ? (
            matches.length ? matches.map((f) => <Row key={f.id} f={f} />) : <p className="px-3 py-6 text-center text-sm text-muted-foreground">{ui(table, "noMatch")}</p>
          ) : (
            <>
              {onScreen.length > 0 && (
                <section className="mb-1.5 rounded-lg bg-accent/50 p-1">
                  <h3 className="px-2.5 pb-0.5 pt-1.5 text-xs font-medium text-muted-foreground">{ui(table, "menuTitle")}</h3>
                  {onScreen.map((f) => <Row key={f.id} f={f} />)}
                </section>
              )}
              {next && (
                <section className="mb-1.5 rounded-lg border border-primary/25 p-1">
                  <h3 className="flex items-center gap-1.5 px-2.5 pb-0.5 pt-1.5 text-xs font-medium text-primary"><Sparkles className="h-3 w-3" aria-hidden="true" />{ui(table, "nextUp")}</h3>
                  <Row f={next} />
                </section>
              )}
              {groups.map((g) => {
                const n = g.flows.filter((f) => done(f.id)).length;
                const expanded = openGroups[g.id] ?? g.flows.some(here);
                return (
                  <section key={g.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !expanded }))}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start outline-none hover:bg-accent focus-visible:bg-accent"
                    >
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90 rtl:rotate-90"}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{ui(table, `group.${g.id}`)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{ui(table, `groupHint.${g.id}`)}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${n === g.flows.length ? "bg-status-success/10 text-status-success" : "bg-muted text-muted-foreground"}`}>{n}/{g.flows.length}</span>
                    </button>
                    <div hidden={!expanded} className="pb-1 ps-3">
                      {g.flows.map((f) => <Row key={f.id} f={f} />)}
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </div>
        <div className="border-t border-border p-1.5">
          <Link to="/learn" onClick={() => setOpen(false)} className="block rounded-lg px-2.5 py-2 text-sm font-medium text-primary hover:bg-accent">{ui(table, "openLearn")}</Link>
        </div>
      </div>
    </div>
  );
}
