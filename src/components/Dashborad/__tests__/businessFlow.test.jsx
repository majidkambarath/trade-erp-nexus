import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import BusinessFlow from "../BusinessFlow";
import { cycleStory } from "../helpers";
import { clearPageSessions } from "../../../lib/pageSession";

// jsdom has no layout and no ResizeObserver, so a responsive chart would fail to measure itself: give it a size
vi.mock("recharts", async (orig) => {
  const actual = await orig();
  const { cloneElement } = await import("react");
  return { ...actual, ResponsiveContainer: ({ children, height }) => cloneElement(children, { width: 320, height: typeof height === "number" ? height : 56 }) };
});

const SCOPE = { at: "this month", current: true, to: "2026-10-05" };
const FLOW = {
  statement: { revenue: 1000, directCosts: 700, grossProfit: 300, operatingExpenses: 80, otherIncome: 30, netProfit: 250 },
  previous: { revenue: 800, netProfit: 100, revenueChangePct: 25, statement: { revenue: 800, directCosts: 560, grossProfit: 240, operatingExpenses: 140, otherIncome: 0, netProfit: 100 } },
  stages: { bought: 500, stock: 2050, sold: 1000, collected: 400, owedByCustomers: 1547, owedToVendors: 2000 },
  cycle: { from: "2026-07-08", to: "2026-10-05", days: 90, minDays: 14, enough: true, dso: 20, dpo: 25.7, dio: 45, cycleDays: 39.3, receivables: 1547, payables: 2000, stockValue: 2050, invoiced: 945, purchased: 525, cogs: 600 },
};
const MONTHLY = ["2026-07", "2026-08", "2026-09", "2026-10"].map((month, i) => ({ month, sales: 1000 + i * 100, purchases: 0, grossProfit: 300 + i * 20, netProfit: [100, -40, 160, 250][i] }));
const loaded = (flow = FLOW, monthly = MONTHLY) => ({ data: { businessFlow: flow, monthly }, error: null });

beforeEach(() => clearPageSessions());

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
// the tests below are about the Flow view unless they say otherwise
const show = (state, view = "flow") =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<BusinessFlow state={state} scope={SCOPE} initialView={view} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("BusinessFlow", () => {
  it("shows bought, in stock, sold and collected, and what is still owed each way", () => {
    show(loaded());
    const tile = (label) => screen.getByText(label).closest("a");
    expect(tile("Bought")).toHaveTextContent("AED 500");
    expect(tile("In stock")).toHaveTextContent("AED 2,050");
    expect(tile("Sold")).toHaveTextContent("AED 1,000");
    expect(tile("Collected")).toHaveTextContent("AED 400");
    expect(tile("Customers still owe you")).toHaveTextContent("AED 1,547");
    expect(tile("You still owe vendors")).toHaveTextContent("AED 2,000");
    expect(tile("Sold").getAttribute("title")).toMatch(/1,000.00/); // the full amount is a hover away
  });

  it("every tile opens the page behind it", () => {
    show(loaded());
    const to = (label) => screen.getByText(label).closest("a").getAttribute("href");
    expect(to("Bought")).toBe("/purchase-order");
    expect(to("In stock")).toBe("/stock-reports");
    expect(to("Sold")).toBe("/sales-order");
    expect(to("Collected")).toBe("/receipt-voucher");
    expect(to("Customers still owe you")).toBe("/ageing");
  });

  it("says how sales compare with the period before, in words and not only colour", () => {
    show(loaded());
    expect(screen.getByText("Sold").closest("a")).toHaveTextContent("+25.0% on the period before");
    show(loaded({ ...FLOW, previous: { ...FLOW.previous, revenueChangePct: -12.5 } }));
    expect(screen.getAllByText("Sold").at(-1).closest("a")).toHaveTextContent("−12.5% on the period before");
  });

  it("draws the statement as cards, named and valued for a screen reader, each a link to the profit and loss", () => {
    const { container } = show(loaded());
    const svg = container.querySelector("svg[role='img']");
    expect(svg.getAttribute("aria-label")).toMatch(/Revenue: .*1,000\.00, 100\.0% of revenue/);
    expect(svg.getAttribute("aria-label")).toMatch(/Net profit: .*250\.00, 25\.0% of revenue/);
    const cards = container.querySelectorAll("[data-node]");
    expect(cards).toHaveLength(6);
    expect([...cards].every((c) => c.getAttribute("role") === "link" && c.getAttribute("tabindex") === "0")).toBe(true);
    expect(container.querySelectorAll("[data-link]")).toHaveLength(5);
  });

  it("a card opens the profit and loss with the mouse and with Enter", () => {
    const { container, unmount } = show(loaded());
    fireEvent.click(container.querySelector("[data-node]"));
    expect(screen.getByTestId("where")).toHaveTextContent("/financial-statements?tab=pl");
    unmount();
    const again = show(loaded());
    fireEvent.keyDown(again.container.querySelector("[data-node]"), { key: "Enter" });
    expect(screen.getByTestId("where")).toHaveTextContent("/financial-statements?tab=pl");
  });

  it("hovering a card names it and its share of revenue, and dims what is not connected to it", () => {
    const { container } = show(loaded());
    const cogs = [...container.querySelectorAll("[data-node]")].find((n) => n.getAttribute("aria-label").startsWith("Cost of goods sold"));
    fireEvent.mouseEnter(cogs, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(cogs, { clientX: 100, clientY: 100 });
    const tip = screen.getByRole("status");
    expect(tip).toHaveTextContent("Cost of goods sold");
    expect(tip).toHaveTextContent("70.0% of revenue");
    const dim = [...container.querySelectorAll("[data-node]")].filter((n) => n.style.opacity === "0.4");
    expect(dim.length).toBeGreaterThan(0);
    fireEvent.mouseLeave(cogs);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("on a narrow card the same figures are a waterfall, because ribbons need width", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 340, height: 300, top: 0, left: 0, right: 340, bottom: 300, x: 0, y: 0, toJSON() {} });
    try {
      const { container } = show(loaded());
      expect(container.querySelector("[data-node]")).toBeNull();
      const walk = [...container.querySelectorAll("[role='img']")].find((el) => /Revenue .*Net profit/.test(el.getAttribute("aria-label") || ""));
      expect(walk).toBeTruthy();
      expect(walk.getAttribute("aria-label").replace(/\u00a0/g, " ")).toMatch(/Cost of goods sold minus AED 700.00/);
    } finally {
      spy.mockRestore();
    }
  });

  it("names every bar above it with its amount and share of revenue; revenue itself carries no share", () => {
    const { container } = show(loaded());
    const caption = (name) => {
      const node = [...container.querySelectorAll("[data-node]")].find((n) => n.getAttribute("aria-label").startsWith(name));
      return [...node.querySelectorAll("text")].map((t) => t.textContent).join(" ");
    };
    expect(caption("Revenue")).toBe("Revenue 1,000");
    expect(caption("Cost of goods sold")).toBe("Cost of goods sold 700 70.0%");
    expect(caption("Net profit")).toBe("Net profit 250 25.0%");
  });

  it("says in a sentence what the chart means: of every 100 sold, what is profit and where the rest went", () => {
    const { container } = show(loaded());
    const text = (container.querySelector("[data-headline]")?.textContent || "").replace(/\u00a0/g, " ");
    expect(text).toContain("Of every AED 100 you sell, AED 25.00 is profit.");
    // the sentence as one bar of 100, with what each part is per 100 sold
    expect(text).toMatch(/Goods you sold\s*AED 70\.00/);
    expect(text).toMatch(/Running the business\s*AED 8\.00/);
    expect(text).toMatch(/Profit\s*AED 25\.00/);
    // 25.0% against 12.5% the period before
    expect(text).toContain("Up 12.5 points on the period before");
  });

  it("a loss reads as a loss in the headline, and no change is claimed when there is nothing to compare with", () => {
    const { container } = show(loaded({ ...FLOW, statement: { ...FLOW.statement, operatingExpenses: 400, netProfit: -70 }, previous: { revenue: 0, netProfit: 0, revenueChangePct: null } }));
    const text = (container.querySelector("[data-headline]")?.textContent || "").replace(/\u00a0/g, " ");
    expect(text).toContain("you lose AED 7.00");
    expect(text).not.toMatch(/points on the period before/);
  });

  it("the tooltip says what a stage was in the period before, so a creeping cost is visible", () => {
    const { container } = show(loaded());
    const cogs = [...container.querySelectorAll("[data-node]")].find((n) => n.getAttribute("aria-label").startsWith("Cost of goods sold"));
    fireEvent.mouseEnter(cogs, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(cogs, { clientX: 100, clientY: 100 });
    // 700 of 1,000 now; 560 of 800 before
    expect(screen.getByRole("status")).toHaveTextContent("70.0% of revenue");
    expect(screen.getByRole("status")).toHaveTextContent("Period before: 70.0% of revenue");
  });

  it("an older server without the period before's statement still draws the chart, with no comparison", () => {
    const { previous } = FLOW;
    const { container } = show(loaded({ ...FLOW, previous: { revenue: previous.revenue, netProfit: previous.netProfit, revenueChangePct: previous.revenueChangePct } }));
    const cogs = [...container.querySelectorAll("[data-node]")].find((n) => n.getAttribute("aria-label").startsWith("Cost of goods sold"));
    fireEvent.mouseEnter(cogs, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(cogs, { clientX: 100, clientY: 100 });
    expect(screen.getByRole("status")).not.toHaveTextContent("Period before");
  });

  it("a loss is said in words under the chart instead of being drawn as a negative", () => {
    show(loaded({ ...FLOW, statement: { ...FLOW.statement, operatingExpenses: 400, netProfit: -70 } }));
    expect(screen.getByText(/Expenses are .*70\.00 more than gross profit and other income: a net loss\./)).toBeInTheDocument();
  });

  it("the cash cycle: the days, each part, and what it means", () => {
    show(loaded());
    const card = screen.getByText("Cash cycle", { selector: "h3" }).closest("[data-slot='card']");
    expect(card).toHaveTextContent("39.3 days");
    expect(within(card).getByText("Stock sits").closest("li")).toHaveTextContent("45 days");
    expect(within(card).getByText("Customers pay").closest("li")).toHaveTextContent("20 days");
    expect(within(card).getByText("Vendors wait").closest("li")).toHaveTextContent("25.7 days");
    expect(card).toHaveTextContent("Your cash is tied up for 39.3 days");
  });

  it("an empty business says what to do, and the cash cycle says it needs history, with no NaN anywhere", () => {
    const quiet = {
      statement: { revenue: 0, directCosts: 0, grossProfit: 0, operatingExpenses: 0, otherIncome: 0, netProfit: 0 },
      previous: { revenue: 0, netProfit: 0, revenueChangePct: null },
      stages: { bought: 0, stock: 0, sold: 0, collected: 0, owedByCustomers: 0, owedToVendors: 0 },
      cycle: { from: "2026-10-05", to: "2026-10-05", days: 1, minDays: 14, enough: false, dso: null, dpo: null, dio: null, cycleDays: null, receivables: 0, payables: 0, stockValue: 0, invoiced: 0, purchased: 0, cogs: 0 },
    };
    const { container } = show(loaded(quiet));
    expect(screen.getByText(/No sales or purchases yet/)).toBeInTheDocument();
    expect(screen.getByText("No revenue posted this month")).toBeInTheDocument();
    expect(screen.getByText(/needs at least 14 days of sales to measure/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("shows nothing for a server that has no business flow yet, and skeletons while it loads", () => {
    const { container } = show({ data: { monthly: [] }, error: null });
    expect(container.querySelector("section")).toBeNull();
    const loading = show({ data: null, error: null });
    expect(loading.container.querySelector("section")).not.toBeNull();
  });
});

describe("BusinessFlow: three views of where the revenue went", () => {
  const plain = (t) => t.replace(/\u00a0/g, " ");

  it("opens on the split: each part with its share of revenue and what it did against the period before", () => {
    show(loaded(), null);
    const list = screen.getByRole("list", { name: /Where every AED 100 goes/ });
    const row = (label) => plain(within(list).getByText(label).closest("li").textContent);
    expect(row("Goods you sold")).toMatch(/70\.0% of revenue.*level with the period before.*AED 700/);
    expect(row("Running the business")).toMatch(/8\.0% of revenue.*down 9\.5 points on the period before.*AED 80/);
    expect(row("Profit")).toMatch(/25\.0% of revenue.*up 12\.5 points on the period before.*AED 250/);
    expect(row("Profit")).toMatch(/AED 25\.00 per 100/);
  });

  it("the ring says what it is for a screen reader, and its centre is the net profit", () => {
    const { container } = show(loaded(), null);
    const ring = [...container.querySelectorAll("[role='img']")].find((el) => /Goods you sold .*Profit/.test(plain(el.getAttribute("aria-label") || "")));
    expect(ring).toBeTruthy();
    expect(plain(ring.textContent)).toMatch(/Net profit.*250.*25\.0% of revenue/);
  });

  it("the centre of the ring becomes the part you point at, and goes back to the profit when you move away", () => {
    const { container } = show(loaded(), null);
    const centre = () => plain(container.querySelector("[aria-live='polite']").textContent);
    expect(centre()).toMatch(/Net profit.*250.*25\.0% of revenue/);
    const list = screen.getByRole("list", { name: /Where every AED 100 goes/ });
    const goods = within(list).getByText("Goods you sold").closest("li");
    fireEvent.mouseEnter(goods);
    expect(centre()).toMatch(/Goods you sold.*700.*70\.0% of revenue/);
    fireEvent.mouseLeave(goods);
    expect(centre()).toMatch(/Net profit.*250/);
  });

  it("works from the keyboard too: focusing a row shows it in the centre, and no tooltip is drawn over the figures", () => {
    const { container } = show(loaded(), null);
    const list = screen.getByRole("list", { name: /Where every AED 100 goes/ });
    const running = within(list).getByText("Running the business").closest("li");
    fireEvent.focus(running);
    expect(plain(container.querySelector("[aria-live='polite']").textContent)).toMatch(/Running the business.*80.*8\.0% of revenue/);
    expect(container.querySelector(".recharts-tooltip-wrapper")).toBeNull();
    fireEvent.blur(running);
  });

  it("a tap on a row holds it in the centre and a second tap lets go (a phone has no hover to undo)", () => {
    const { container } = show(loaded(), null);
    const list = screen.getByRole("list", { name: /Where every AED 100 goes/ });
    const profit = within(list).getByText("Profit").closest("li");
    fireEvent.click(profit);
    expect(plain(container.querySelector("[aria-live='polite']").textContent)).toMatch(/^Profit/);
    fireEvent.click(profit);
    expect(plain(container.querySelector("[aria-live='polite']").textContent)).toMatch(/Net profit/);
  });

  it("month by month: eight columns of revenue cut into goods, running costs and profit", () => {
    const { container } = show(loaded(), "months");
    const chart = [...container.querySelectorAll("[role='img']")].find((el) => /Jul 2026: revenue/.test(plain(el.getAttribute("aria-label") || "")));
    expect(chart).toBeTruthy();
    const label = plain(chart.getAttribute("aria-label"));
    expect(label).toContain("Aug 2026: revenue AED 1,100.00, loss AED 40.00");
    expect(label).toContain("Oct 2026: revenue AED 1,300.00, profit AED 250.00");
  });

  it("switches views from the keyboard and mouse, and remembers the choice for next time", () => {
    const first = show(loaded(), null);
    const tabs = screen.getByRole("radiogroup", { name: "How to see it" });
    expect(within(tabs).getByRole("radio", { name: "Split" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(tabs).getByRole("radio", { name: "Flow" }));
    expect(first.container.querySelectorAll("[data-node]").length).toBe(6);
    fireEvent.keyDown(within(tabs).getByRole("radio", { name: "Flow" }), { key: "ArrowLeft" });
    expect(within(tabs).getByRole("radio", { name: "Month by month" })).toHaveAttribute("aria-checked", "true");
    first.unmount();
    show(loaded(), null); // a new visit to the page
    expect(screen.getByRole("radio", { name: "Month by month" })).toHaveAttribute("aria-checked", "true");
  });

  it("a server that sends no net profit by month offers the split and the flow only", () => {
    show(loaded(FLOW, MONTHLY.map((m) => ({ month: m.month, sales: m.sales, purchases: m.purchases, grossProfit: m.grossProfit }))), null);
    const names = within(screen.getByRole("radiogroup", { name: "How to see it" })).getAllByRole("radio").map((t) => t.textContent);
    expect(names).toEqual(["Split", "Flow"]);
  });

  it("no switch when there is nothing to show", () => {
    const quiet = { ...FLOW, statement: { revenue: 0, directCosts: 0, grossProfit: 0, operatingExpenses: 0, otherIncome: 0, netProfit: 0 } };
    show(loaded(quiet), null);
    expect(screen.queryByRole("radiogroup", { name: "How to see it" })).toBeNull();
  });
});

describe("cycleStory", () => {
  const base = { enough: true, minDays: 14, days: 90, invoiced: 100, purchased: 100, cogs: 100, dso: 10, dpo: 5, dio: 20 };

  it("tied up, funded by vendors, and even", () => {
    expect(cycleStory({ ...base, cycleDays: 25 }).tone).toBe("tied");
    expect(cycleStory({ ...base, cycleDays: -8.5 }).text).toBe("Vendors fund you: you collect 8.5 days before you have to pay them.");
    expect(cycleStory({ ...base, cycleDays: 0 }).tone).toBe("even");
  });

  it("names what is missing instead of guessing", () => {
    const s = cycleStory({ ...base, dpo: null, purchased: 0, cycleDays: null });
    expect(s.tone).toBe("wait");
    expect(s.text).toContain("vendors wait: no purchases");
    expect(cycleStory({ ...base, dio: null, cogs: 0, cycleDays: null }).text).toContain("stock sits: no cost of goods sold");
  });

  it("asks for history when the window is short", () => {
    expect(cycleStory({ ...base, enough: false, days: 6, cycleDays: null }).text).toBe("The cycle needs at least 14 days of sales to measure. It has 6.");
  });
});

vi.setConfig({ testTimeout: 15000 });
