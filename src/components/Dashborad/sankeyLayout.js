// Pure layout for the business flow chart: the statement as a graph, and the graph as positions. No React, no DOM.

const round = (n) => Math.round(n * 100) / 100;
const pos = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

// ---------------------------------------------------------------- the statement as a graph

// Revenue splits into the cost of what was sold and the gross profit; the gross profit and any other income then
// pay the operating expenses and what is left is the net profit. Every link is a part of the figure it leaves, so what
// goes in comes out, and a node's size is the sum of its links.
//
// A loss cannot be drawn as a flow: when the cost of goods is more than revenue, or the expenses are more than the
// gross profit and other income, the flow ends where the money did and `notes` says by how much it fell short
// (`cogs`: the cost of goods exceeds revenue, `loss`: the expenses exceed what was left; `amount` is the shortfall).
export function statementGraph(s) {
  const revenue = pos(s.revenue);
  const cogs = pos(s.directCosts);
  const other = pos(s.otherIncome);
  const expenses = pos(s.operatingExpenses);
  const notes = [];

  const toCost = Math.min(cogs, revenue);
  const gross = round(revenue - toCost);
  if (cogs > revenue) notes.push({ key: "cogs", amount: round(cogs - revenue) });

  const available = round(gross + other);
  const spent = Math.min(expenses, available);
  const left = round(available - spent);
  if (expenses > available) notes.push({ key: "loss", amount: round(expenses - available) });

  // gross profit pays the expenses first, other income covers what is left of them
  const grossToExpenses = Math.min(gross, spent);
  const otherToExpenses = round(spent - grossToExpenses);
  const grossToNet = round(gross - grossToExpenses);
  const otherToNet = round(other - otherToExpenses);

  const tone = { revenue: "total", cogs: "loss", gross: "gain", other: "gain", opex: "loss", net: "gain" };
  const to = "/financial-statements?tab=pl";
  const nodes = [
    { id: "revenue", label: "Revenue", col: 0 },
    { id: "cogs", label: "Cost of goods sold", col: 1 },
    { id: "gross", label: "Gross profit", col: 1 },
    { id: "other", label: "Other income", col: 1 },
    { id: "opex", label: "Operating expenses", col: 2 },
    { id: "net", label: "Net profit", col: 2 },
  ].map((n) => ({ ...n, tone: tone[n.id], to }));
  const links = [
    { from: "revenue", to: "cogs", value: toCost },
    { from: "revenue", to: "gross", value: gross },
    { from: "gross", to: "opex", value: grossToExpenses },
    { from: "gross", to: "net", value: grossToNet },
    { from: "other", to: "opex", value: otherToExpenses },
    { from: "other", to: "net", value: otherToNet },
  ].filter((l) => l.value > 0.004);

  return { nodes, links, notes, figures: { revenue, cogs, gross, other, expenses, left } };
}

// ---------------------------------------------------------------- positions

// nodes: [{ id, col }] (order within a column is the order given), links: [{ from, to, value }].
// A node is a card of fixed width whose height follows its value but never drops below `minNodeHeight` (the card has to
// hold its name and amount), so the scale is the largest one at which every column still fits `height`. A ribbon is as
// thick as its value at that scale and is stacked inside the card it leaves and the one it enters.
export function sankeyLayout({ nodes, links, width, height, nodeWidth = 112, minNodeHeight = 58, gap = 14 }) {
  const live = links.filter((l) => l.value > 0);
  const flow = new Map(nodes.map((n) => [n.id, { into: 0, out: 0 }]));
  for (const l of live) {
    if (!flow.has(l.from) || !flow.has(l.to)) continue;
    flow.get(l.from).out += l.value;
    flow.get(l.to).into += l.value;
  }
  const kept = nodes
    .map((n) => ({ ...n, value: Math.max(flow.get(n.id).into, flow.get(n.id).out) }))
    .filter((n) => n.value > 0);
  const ids = new Set(kept.map((n) => n.id));
  const used = live.filter((l) => ids.has(l.from) && ids.has(l.to));
  if (kept.length === 0) return { nodes: [], links: [], scale: 0 };

  const cols = Math.max(...kept.map((n) => n.col)) + 1;
  const columns = Array.from({ length: cols }, (_, c) => kept.filter((n) => n.col === c));
  const heightsAt = (scale) => columns.map((col) => col.reduce((t, n) => t + Math.max(minNodeHeight, n.value * scale), 0) + gap * Math.max(0, col.length - 1));
  const fits = (scale) => Math.max(...heightsAt(scale)) <= height;

  let lo = 0;
  let hi = height / Math.min(...columns.filter((c) => c.length).map((c) => c.reduce((t, n) => t + n.value, 0)));
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const scale = lo;

  const stepX = cols > 1 ? (width - nodeWidth) / (cols - 1) : 0;
  const placed = new Map();
  columns.forEach((col, c) => {
    const total = col.reduce((t, n) => t + Math.max(minNodeHeight, n.value * scale), 0) + gap * Math.max(0, col.length - 1);
    let y = (height - total) / 2;
    for (const n of col) {
      const h = Math.max(minNodeHeight, n.value * scale);
      placed.set(n.id, { ...n, x: c * stepX, y, w: nodeWidth, h, out: 0, into: 0 });
      y += h + gap;
    }
  });

  // stack each node's ribbons inside it, centred, in the order of the node they connect to
  const order = new Map(kept.map((n, i) => [n.id, i]));
  const ribbons = used.map((l) => ({ ...l, thickness: Math.max(1, l.value * scale) }));
  const outgoing = (id) => ribbons.filter((r) => r.from === id).sort((a, b) => order.get(a.to) - order.get(b.to));
  const incoming = (id) => ribbons.filter((r) => r.to === id).sort((a, b) => order.get(a.from) - order.get(b.from));
  for (const n of placed.values()) {
    const outs = outgoing(n.id);
    const ins = incoming(n.id);
    let y = n.y + (n.h - outs.reduce((t, r) => t + r.thickness, 0)) / 2;
    for (const r of outs) {
      r.sy = y + r.thickness / 2;
      y += r.thickness;
    }
    y = n.y + (n.h - ins.reduce((t, r) => t + r.thickness, 0)) / 2;
    for (const r of ins) {
      r.ty = y + r.thickness / 2;
      y += r.thickness;
    }
  }
  const out = ribbons.map((r) => {
    const a = placed.get(r.from);
    const b = placed.get(r.to);
    const x0 = a.x + a.w;
    const x1 = b.x;
    const mid = (x0 + x1) / 2;
    return { ...r, sx: x0, tx: x1, d: `M${x0},${r.sy} C${mid},${r.sy} ${mid},${r.ty} ${x1},${r.ty}` };
  });

  return { nodes: [...placed.values()], links: out, scale };
}
