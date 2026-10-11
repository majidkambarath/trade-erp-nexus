import React, { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { formatCurrencyAED, formatNumber } from "@/utils/format";
import { fitLabel, flowNumber, tip } from "./helpers";
import { motionOK, useInView } from "./motion";
import { sankeyHeight, sankeyLayout } from "./sankeyLayout";

// A flow of money drawn the way a good finance report would draw it, with a point of view: the profit is the hero.
//  - the path that is KEPT (gross profit, other income, net profit) is the saturated accent; what was SPENT is the same
//    rose but a fraction as loud, so the eye lands on what is left, not on the big cost that every trading business has;
//  - thin bars for the stages, each NAMED ABOVE ITS BAR with its amount and share - nothing squeezed into a box, so 8% is
//    as legible as 87%; a caption never sits on a ribbon (a stage that sends money on is captioned to the left of its
//    bar's end, a stage that ends the line to the right);
//  - ribbons fade along their length in the colour of where they end, so direction reads without arrows.
//
// Text is always in text tokens (it never wears a series colour), so both themes work with no per-theme ink.
// Reading it is not only by eye: every bar and ribbon has a name and an amount for a screen reader, a bar is a link to the
// report behind it (Tab, then Enter), and hovering or focusing one lights up its own ribbons and dims the rest.

const TONE = { total: "var(--chart-1)", gain: "var(--chart-2)", loss: "var(--chart-5)" };
// how strongly a ribbon starts and ends, by where it ends: the kept path is loud, the spent path quiet
const FADE = { gain: [0.55, 0.3], loss: [0.24, 0.12], total: [0.4, 0.2] };

function useElementWidth(ref, fallback = 640) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width || fallback;
}

// Below this the ribbons have nowhere to go; a `narrow` element is shown instead (the same figures as a waterfall)
const MIN_WIDTH = 560;

// `before`: { [nodeId]: share of that period's revenue, in percent } for the period before, for the tooltip
export default function FlowSankey({ graph, height, onOpen, openLabel = "Open the report", caption, narrow, before }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const timeline = useRef(null);
  const width = useElementWidth(wrapRef);
  const inView = useInView(wrapRef);
  const [active, setActive] = useState(null); // { type: "node", id } | { type: "link", link }
  const [pointer, setPointer] = useState(null);

  const h = height || sankeyHeight(width);
  // room for the last column's captions: "Operating expenses" at 12px is about 135px
  const padRight = Math.max(156, Math.min(200, Math.round(width * 0.2)));
  const layout = useMemo(
    () => sankeyLayout({ nodes: graph.nodes, links: graph.links, width, height: h, padRight }),
    [graph, width, h, padRight],
  );
  const total = graph.figures?.revenue || Math.max(0, ...layout.nodes.map((n) => n.value));
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  // the graph's own identity: a new period or new figures replay the draw, a resize does not
  const key = useMemo(() => layout.nodes.map((n) => `${n.id}:${n.value}`).join("|") + "#" + layout.links.map((l) => `${l.from}>${l.to}:${l.value}`).join("|"), [layout]);

  useLayoutEffect(() => {
    if (!motionOK() || !svgRef.current) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
      tl.fromTo("[data-node]", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.07 }, 0)
        .fromTo("[data-link]", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.95, stagger: 0.09, ease: "power1.inOut" }, 0.2);
      timeline.current = tl;
    }, svgRef);
    return () => {
      timeline.current = null;
      ctx.revert();
    };
  }, [key]);

  useLayoutEffect(() => {
    if (inView) timeline.current?.play();
  }, [inView, key]);

  // what is lit while something is hovered or focused: a bar with the ribbons that touch it and the bars on their other
  // ends; a ribbon with its two bars
  const touches = (link, id) => link.from === id || link.to === id;
  const nodeLit = (n) => {
    if (!active) return true;
    if (active.type === "node") return n.id === active.id || layout.links.some((l) => touches(l, active.id) && touches(l, n.id));
    return touches(active.link, n.id);
  };
  const linkLit = (l) => !active || (active.type === "node" ? touches(l, active.id) : l === active.link);

  const share = (value) => (total > 0 ? `${formatNumber((value / total) * 100, 1)}% of revenue` : "");
  const describe = (node) => `${node.label}: ${formatCurrencyAED(node.value)}${share(node.value) ? `, ${share(node.value)}` : ""}`;
  const summary = layout.nodes.map(describe).join("; ");
  const wasShare = (id) => (before && Number.isFinite(before[id]) ? `Period before: ${formatNumber(before[id], 1)}% of revenue` : "");

  const tooltip = (() => {
    if (!active || !pointer) return null;
    if (active.type === "node") {
      const n = byId.get(active.id);
      return n && { title: n.label, line: formatCurrencyAED(n.value), note: share(n.value), was: n.id === "revenue" ? "" : wasShare(n.id) };
    }
    const l = active.link;
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    return a && b && { title: `${a.label} → ${b.label}`, line: formatCurrencyAED(l.value), note: share(l.value), was: "" };
  })();

  const moveTip = (event) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (box) setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
  };
  const focusTip = (el) => {
    const box = wrapRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (box) setPointer({ x: r.left - box.left + r.width / 2, y: r.top - box.top });
  };

  if (narrow && width < MIN_WIDTH) {
    return (
      <div ref={wrapRef} className="relative">
        {narrow}
        {caption}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <svg ref={svgRef} width={width} height={h} viewBox={`0 0 ${width} ${h}`} role="img" aria-label={summary} className="block max-w-full">
        <defs>
          {layout.links.map((l) => {
            const tone = byId.get(l.to).tone;
            const [from, to] = FADE[tone] || FADE.total;
            return (
              <linearGradient key={`${l.from}-${l.to}`} id={`${uid}-${l.from}-${l.to}`} gradientUnits="userSpaceOnUse" x1={l.sx} x2={l.tx} y1="0" y2="0">
                <stop offset="0%" style={{ stopColor: TONE[tone] || TONE.total, stopOpacity: from }} />
                <stop offset="100%" style={{ stopColor: TONE[tone] || TONE.total, stopOpacity: to }} />
              </linearGradient>
            );
          })}
        </defs>
        <g fill="none">
          {layout.links.map((l) => (
            <path
              key={`${l.from}-${l.to}`}
              data-link
              d={l.d}
              pathLength={1}
              strokeDasharray="1"
              stroke={`url(#${uid}-${l.from}-${l.to})`}
              strokeWidth={l.thickness}
              strokeOpacity={linkLit(l) ? 1 : 0.22}
              style={{ transition: "stroke-opacity 160ms ease" }}
              onMouseEnter={() => setActive({ type: "link", link: l })}
              onMouseMove={moveTip}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </g>
        <g>
          {layout.nodes.map((n) => {
            const lit = nodeLit(n);
            const name = fitLabel(n.label, n.captionWidth, { fontSize: 12, maxLines: 1 })[0] || n.label;
            const end = n.align === "end";
            const x = end ? n.x + n.w : n.x;
            const hero = n.id === "net"; // the amount that is yours, written larger than the rest
            const reach = Math.min(n.captionWidth, 150);
            return (
              <g
                key={n.id}
                data-node
                role="link"
                tabIndex={0}
                aria-label={`${describe(n)}. ${openLabel}`}
                style={{ cursor: "pointer", opacity: lit ? 1 : 0.4, transition: "opacity 160ms ease", outline: "none" }}
                onMouseEnter={() => setActive({ type: "node", id: n.id })}
                onMouseMove={moveTip}
                onMouseLeave={() => setActive(null)}
                onFocus={(e) => {
                  setActive({ type: "node", id: n.id });
                  focusTip(e.currentTarget);
                }}
                onBlur={() => setActive(null)}
                onClick={() => onOpen?.(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen?.(n);
                  }
                }}
              >
                {/* a wider, invisible target: a bar is hard to hit with a finger or a mouse */}
                <rect x={end ? n.x + n.w + 6 - (n.w + 12 + reach) : n.x - 6} y={n.y} width={n.w + 12 + reach} height={n.h} fill="transparent" />
                <rect x={n.x} y={n.barY} width={n.w} height={n.barH} rx={n.w / 2} fill={TONE[n.tone] || TONE.total} />
                <text x={x} y={n.y + 15} textAnchor={end ? "end" : "start"} fontSize={12} fontWeight={500} fill="var(--muted-foreground)" stroke="none">
                  {name}
                </text>
                <text
                  x={x}
                  y={n.y + (hero ? 38 : 35)}
                  textAnchor={end ? "end" : "start"}
                  fontSize={hero ? 22 : 17}
                  fontWeight={hero ? 700 : 600}
                  fill="var(--foreground)"
                  stroke="none"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {flowNumber(n.value)}
                  {n.id !== "revenue" && total > 0 && " "}
                  {n.id !== "revenue" && total > 0 && (
                    <tspan dx={5} fontSize={12} fontWeight={500} fill="var(--muted-foreground)">
                      {formatNumber((n.value / total) * 100, 1)}%
                    </tspan>
                  )}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {tooltip && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 text-sm"
          style={{ ...tip, padding: "8px 12px", left: Math.min(Math.max(pointer.x + 12, 4), Math.max(4, width - 240)), top: Math.max(pointer.y - 8, 0), maxWidth: 260 }}
        >
          <p className="font-semibold">{tooltip.title}</p>
          <p className="mt-0.5 text-muted-foreground">{tooltip.line}</p>
          {tooltip.note && <p className="text-muted-foreground">{tooltip.note}</p>}
          {tooltip.was && <p className="text-muted-foreground">{tooltip.was}</p>}
        </div>
      )}
      {caption}
    </div>
  );
}
