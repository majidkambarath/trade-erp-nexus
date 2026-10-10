import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { formatCurrencyAED, formatNumber } from "@/utils/format";
import { compactAmount, fitLabel, tip } from "./helpers";
import { motionOK, useInView } from "./motion";
import { sankeyLayout } from "./sankeyLayout";

// A flow of money drawn as cards joined by ribbons. A ribbon is as thick as the amount it carries and takes the colour of
// where it ends, so "where did each dirham of revenue go" reads at a glance: ink for the whole, rose for what was spent,
// the accent for what was kept. Text is always in text ink; the colour is only on the ribbon and the card's stripe.
//
// Reading it is not only by eye: every card and ribbon has a name and an amount for a screen reader, a card is a link
// to the report behind it (Tab, then Enter), and hovering or focusing one lights up its own ribbons and dims the rest.

const TONE = { total: "var(--chart-1)", gain: "var(--chart-2)", loss: "var(--chart-5)" };
const PAD = 10;

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

export default function FlowSankey({ graph, height = 310, onOpen, openLabel = "Open the report", caption }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const timeline = useRef(null);
  const width = useElementWidth(wrapRef);
  const inView = useInView(wrapRef);
  const [active, setActive] = useState(null); // { type: "node" | "link", id }
  const [pointer, setPointer] = useState(null);

  const nodeWidth = Math.max(86, Math.min(150, Math.floor((width - 72) / 3)));
  const layout = useMemo(
    () => sankeyLayout({ nodes: graph.nodes, links: graph.links, width, height, nodeWidth }),
    [graph, width, height, nodeWidth],
  );
  const total = graph.figures?.revenue || Math.max(0, ...layout.nodes.map((n) => n.value));
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  // the graph's own identity: a new period or new figures replay the draw, a resize does not
  const key = useMemo(() => layout.nodes.map((n) => `${n.id}:${n.value}`).join("|") + "#" + layout.links.map((l) => `${l.from}>${l.to}:${l.value}`).join("|"), [layout]);

  useLayoutEffect(() => {
    if (!motionOK() || !svgRef.current) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
      tl.fromTo("[data-node]", { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.07 }, 0)
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

  // what is lit while something is hovered or focused: a card with the ribbons that touch it and the cards on their
  // other ends; a ribbon with its two cards
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

  const tooltip = (() => {
    if (!active || !pointer) return null;
    if (active.type === "node") {
      const n = byId.get(active.id);
      return n && { title: n.label, line: formatCurrencyAED(n.value), note: share(n.value) };
    }
    const l = active.link;
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    return a && b && { title: `${a.label} → ${b.label}`, line: formatCurrencyAED(l.value), note: share(l.value) };
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

  return (
    <div ref={wrapRef} className="relative">
      <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary} className="block max-w-full">
        <g fill="none">
          {layout.links.map((l) => {
            const to = byId.get(l.to);
            const lit = linkLit(l);
            return (
              <path
                key={`${l.from}-${l.to}`}
                data-link
                d={l.d}
                pathLength={1}
                strokeDasharray="1"
                stroke={TONE[to.tone] || TONE.total}
                strokeWidth={l.thickness}
                strokeOpacity={lit ? (active ? 0.62 : 0.38) : 0.1}
                style={{ transition: "stroke-opacity 160ms ease" }}
                onMouseEnter={() => setActive({ type: "link", link: l })}
                onMouseMove={moveTip}
                onMouseLeave={() => setActive(null)}
              />
            );
          })}
        </g>
        <g>
          {layout.nodes.map((n) => {
            const lit = nodeLit(n);
            // narrow cards (a phone) use a size down, so "Operating" is not cut to "Operati..."
            const font = n.w < 100 ? 11 : 12;
            const pad = n.w < 100 ? 8 : PAD;
            const inner = n.w - pad * 2 - 4;
            const lines = fitLabel(n.label, inner, { fontSize: font, maxLines: 2 });
            const top = n.y + n.h / 2 - ((lines.length + 1) * 15) / 2;
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
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} fill="var(--card)" stroke="var(--border)" />
                <rect x={n.x} y={n.y + 8} width={4} height={n.h - 16} rx={2} fill={TONE[n.tone] || TONE.total} />
                {lines.map((line, i) => (
                  <text key={i} x={n.x + pad + 4} y={top + 12 + i * 15} fontSize={font} fontWeight={600} fill="var(--foreground)" stroke="none">
                    {line}
                  </text>
                ))}
                <text x={n.x + pad + 4} y={top + 12 + lines.length * 15} fontSize={font} fontWeight={400} fill="var(--muted-foreground)" stroke="none">
                  {compactAmount(n.value)}
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
          style={{ ...tip, padding: "8px 12px", left: Math.min(Math.max(pointer.x + 12, 4), Math.max(4, width - 220)), top: Math.max(pointer.y - 8, 0), maxWidth: 240 }}
        >
          <p className="font-semibold">{tooltip.title}</p>
          <p className="mt-0.5 text-muted-foreground">{tooltip.line}</p>
          {tooltip.note && <p className="text-muted-foreground">{tooltip.note}</p>}
        </div>
      )}
      {caption}
    </div>
  );
}
