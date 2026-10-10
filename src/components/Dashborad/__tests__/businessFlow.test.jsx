import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import BusinessFlow from "../BusinessFlow";
import { cycleStory } from "../helpers";

const SCOPE = { at: "this month", current: true, to: "2026-10-05" };
const FLOW = {
  statement: { revenue: 1000, directCosts: 700, grossProfit: 300, operatingExpenses: 80, otherIncome: 30, netProfit: 250 },
  previous: { revenue: 800, netProfit: 100, revenueChangePct: 25 },
  stages: { bought: 500, stock: 2050, sold: 1000, collected: 400, owedByCustomers: 1547, owedToVendors: 2000 },
  cycle: { from: "2026-07-08", to: "2026-10-05", days: 90, minDays: 14, enough: true, dso: 20, dpo: 25.7, dio: 45, cycleDays: 39.3, receivables: 1547, payables: 2000, stockValue: 2050, invoiced: 945, purchased: 525, cogs: 600 },
};
const loaded = (flow = FLOW) => ({ data: { businessFlow: flow }, error: null });

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
const show = (state) =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<BusinessFlow state={state} scope={SCOPE} />} />
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
