import { describe, it, expect } from "vitest";
import { sankeyLayout, statementGraph } from "../sankeyLayout";

const into = (graph, id) => graph.links.filter((l) => l.to === id).reduce((t, l) => t + l.value, 0);
const out = (graph, id) => graph.links.filter((l) => l.from === id).reduce((t, l) => t + l.value, 0);

describe("statementGraph", () => {
  const healthy = { revenue: 1000, directCosts: 700, grossProfit: 300, otherIncome: 30, operatingExpenses: 80, netProfit: 250 };

  it("splits revenue into the cost of goods and the gross profit, and the gross profit and other income into expenses and profit", () => {
    const g = statementGraph(healthy);
    expect(g.links.map((l) => [l.from, l.to, l.value])).toEqual([
      ["revenue", "cogs", 700], ["revenue", "gross", 300], ["gross", "opex", 80], ["gross", "net", 220], ["other", "net", 30],
    ]);
    expect(g.notes).toEqual([]);
  });

  it("what goes in comes out: revenue is fully shared, expenses and net profit add up to what was left", () => {
    const g = statementGraph(healthy);
    expect(out(g, "revenue")).toBe(1000);
    expect(into(g, "opex")).toBe(80);
    expect(into(g, "net")).toBe(250); // the net profit of the statement
    expect(into(g, "gross")).toBe(out(g, "gross"));
  });

  it("other income pays the expenses when the gross profit alone cannot", () => {
    const g = statementGraph({ ...healthy, operatingExpenses: 320 });
    expect(g.links.map((l) => [l.from, l.to, l.value])).toEqual([
      ["revenue", "cogs", 700], ["revenue", "gross", 300], ["gross", "opex", 300], ["other", "opex", 20], ["other", "net", 10],
    ]);
    expect(into(g, "net")).toBe(10);
  });

  it("a loss ends where the money did and says by how much it fell short, rather than drawing a negative", () => {
    const g = statementGraph({ ...healthy, operatingExpenses: 400 });
    expect(into(g, "opex")).toBe(330);
    expect(into(g, "net")).toBe(0);
    expect(g.notes).toEqual([{ key: "loss", amount: 70 }]);
  });

  it("cost of goods above revenue leaves no gross profit and a note", () => {
    const g = statementGraph({ revenue: 100, directCosts: 150, otherIncome: 0, operatingExpenses: 0 });
    expect(g.links.map((l) => [l.from, l.to, l.value])).toEqual([["revenue", "cogs", 100]]);
    expect(g.notes).toEqual([{ key: "cogs", amount: 50 }]);
  });

  it("no revenue, nothing to draw; garbage in is treated as zero", () => {
    expect(statementGraph({ revenue: 0, directCosts: 0, otherIncome: 0, operatingExpenses: 0 }).links).toEqual([]);
    expect(statementGraph({ revenue: NaN, directCosts: undefined, otherIncome: "x", operatingExpenses: null }).links).toEqual([]);
  });

  it("every card opens the profit and loss", () => {
    expect(new Set(statementGraph(healthy).nodes.map((n) => n.to))).toEqual(new Set(["/financial-statements?tab=pl"]));
  });
});

describe("sankeyLayout", () => {
  const W = 640;
  const H = 310;
  const layoutOf = (statement) => {
    const g = statementGraph(statement);
    return sankeyLayout({ nodes: g.nodes, links: g.links, width: W, height: H });
  };
  const healthy = { revenue: 1000, directCosts: 700, otherIncome: 30, operatingExpenses: 80 };

  it("puts the first bar at the left edge and the last one a caption's width in from the right", () => {
    const l = layoutOf(healthy);
    const xs = [...new Set(l.nodes.map((n) => n.x))].sort((a, b) => a - b);
    expect(xs[0]).toBe(0);
    expect(xs.at(-1) + l.nodes[0].w).toBe(W - 150); // padRight
    expect(new Set(l.nodes.map((n) => n.w)).size).toBe(1);
    expect(l.nodes[0].w).toBeLessThanOrEqual(16); // a bar, not a box
  });

  it("keeps every column inside the height and no two cards of a column overlapping", () => {
    const l = layoutOf(healthy);
    for (const col of [0, 1, 2]) {
      const nodes = l.nodes.filter((n) => n.col === col).sort((a, b) => a.y - b.y);
      expect(nodes[0].y).toBeGreaterThanOrEqual(0);
      expect(nodes.at(-1).y + nodes.at(-1).h).toBeLessThanOrEqual(H + 0.001);
      nodes.slice(1).forEach((n, i) => expect(n.y).toBeGreaterThanOrEqual(nodes[i].y + nodes[i].h));
    }
  });

  it("gives every bar a caption zone above it, however small the figure: a small amount is written outside its bar", () => {
    const l = layoutOf({ ...healthy, otherIncome: 1 });
    for (const n of l.nodes) {
      expect(n.barY - n.y).toBeCloseTo(46, 6);
      expect(n.barH).toBeGreaterThanOrEqual(6);
      expect(n.h).toBeCloseTo(46 + n.barH, 6);
    }
  });

  it("puts what is kept first: gross profit above the cost of goods, net profit above the expenses", () => {
    const l = layoutOf(healthy);
    const by = new Map(l.nodes.map((n) => [n.id, n]));
    expect(by.get("gross").barY).toBeLessThan(by.get("cogs").barY);
    expect(by.get("net").barY).toBeLessThan(by.get("opex").barY);
  });

  it("captions a bar that sends money on to the left of its right edge, so no ribbon crosses its caption", () => {
    const l = layoutOf(healthy);
    const align = Object.fromEntries(l.nodes.map((n) => [n.id, n.align]));
    // the first bar and every bar where the money stops are captioned from the bar's left; the others end at its right edge
    expect(align).toEqual({ revenue: "start", gross: "end", other: "end", cogs: "start", net: "start", opex: "start" });
  });

  it("a bar is as tall as its amount at one scale", () => {
    const l = layoutOf(healthy);
    for (const n of l.nodes.filter((x) => x.value * l.scale > 6)) expect(n.barH).toBeCloseTo(n.value * l.scale, 6);
  });

  it("levels the flow: the last column sits level with the block that feeds it, not at the top of the chart", () => {
    const l = layoutOf({ revenue: 302451, directCosts: 264305, otherIncome: 0, operatingExpenses: 14051 });
    const by = new Map(l.nodes.map((n) => [n.id, n]));
    const middle = (id) => by.get(id).barY + by.get(id).barH / 2;
    const spread = (ids) => (Math.min(...ids.map((id) => by.get(id).barY)) + Math.max(...ids.map((id) => by.get(id).barY + by.get(id).barH))) / 2;
    // nearer to the block that feeds it than the centre of the chart (where an unlevelled column would sit)
    expect(Math.abs(spread(["opex", "net"]) - middle("gross"))).toBeLessThan(Math.abs(H / 2 - middle("gross")));
    // and inside the chart
    for (const id of ["opex", "net"]) expect(by.get(id).y + by.get(id).h).toBeLessThanOrEqual(H + 0.001);
  });

  it("draws a ribbon as thick as its amount at one scale, inside both of its bars", () => {
    const l = layoutOf(healthy);
    const byId = new Map(l.nodes.map((n) => [n.id, n]));
    for (const r of l.links) {
      expect(r.thickness).toBeCloseTo(Math.max(1, r.value * l.scale), 6);
      const a = byId.get(r.from);
      const b = byId.get(r.to);
      expect(r.sy - r.thickness / 2).toBeGreaterThanOrEqual(a.barY - 0.001);
      expect(r.sy + r.thickness / 2).toBeLessThanOrEqual(a.barY + a.barH + 0.001);
      expect(r.ty - r.thickness / 2).toBeGreaterThanOrEqual(b.barY - 0.001);
      expect(r.ty + r.thickness / 2).toBeLessThanOrEqual(b.barY + b.barH + 0.001);
      expect(r.sx).toBe(a.x + a.w);
      expect(r.tx).toBe(b.x);
      expect(r.d).toMatch(/^M[\d.]+,[\d.]+ C/);
    }
  });

  it("leaves out a bar with nothing through it and any ribbon to a missing bar", () => {
    const l = sankeyLayout({
      nodes: [{ id: "a", col: 0 }, { id: "b", col: 1 }, { id: "c", col: 1 }],
      links: [{ from: "a", to: "b", value: 5 }, { from: "a", to: "ghost", value: 3 }, { from: "a", to: "c", value: 0 }],
      width: 400, height: 200,
    });
    expect(l.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(l.links).toHaveLength(1);
  });

  it("an empty graph is empty, not an error", () => {
    expect(sankeyLayout({ nodes: [], links: [], width: 300, height: 100 })).toEqual({ nodes: [], links: [], scale: 0 });
  });
});
