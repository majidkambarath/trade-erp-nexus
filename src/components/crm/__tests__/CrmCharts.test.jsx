// The ring's centre. A screenshot showed "AED 499,000.00" printed straight over the coloured band: the hole is about
// 130px across and that figure at 18px is about 140px. These pin the rule that fixed it - the centre says a compact
// figure, the exact amounts live in the legend, and the size steps down with the length - plus the layout rule that
// goes with it (the legend moves beside the ring by the width of the PANEL, not of the screen).
import React from "react";
import { describe, it, expect, vi } from "vitest";
// fireEvent from the REACT package: it turns mouseEnter into the mouseover React actually listens for.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { formatCurrencyAED } from "../../../utils/format";

// jsdom has no layout, so a responsive chart cannot measure itself: give it a size.
vi.mock("recharts", async (orig) => {
  const actual = await orig();
  const { cloneElement } = await import("react");
  return { ...actual, ResponsiveContainer: ({ children }) => cloneElement(children, { width: 208, height: 208 }) };
});

const { Ring } = await import("../CrmCharts.jsx");

const ROWS = [
  { key: "new", name: "New", value: 74000, color: "var(--chart-2)" },
  { key: "quoted", name: "Quotation sent", value: 240000, color: "var(--chart-3)" },
  { key: "accepted", name: "Offer accepted", value: 185000, color: "var(--chart-4)" },
];

describe("the ring's centre", () => {
  it("shows a compact figure that fits the hole, not the exact amount", () => {
    render(<Ring rows={ROWS} total={499000} />);
    expect(screen.getByText("499k")).toBeInTheDocument();
    // The wide form is what overflowed. It must not be in the centre any more.
    expect(screen.queryByText("AED 499,000.00")).toBeNull();
    expect(screen.getByText(/in the pipeline/)).toBeInTheDocument();
  });

  it("keeps the exact amounts in the legend, where there is room for them", () => {
    render(<Ring rows={ROWS} total={499000} />);
    const legend = screen.getByRole("list");
    // Intl writes a non-breaking space in "AED 240,000.00"; the page text is normalised to a plain one, the matcher is not.
    expect(within(legend).getByText(formatCurrencyAED(240000).replace(/\s/g, " "))).toBeInTheDocument();
    expect(within(legend).getByText("Quotation sent")).toBeInTheDocument();
    // and the shares, so colour is never the only way to tell the parts apart
    expect(within(legend).getByText("48.1%")).toBeInTheDocument();
  });

  it("becomes whatever is hovered, in the same compact form", () => {
    render(<Ring rows={ROWS} total={499000} />);
    fireEvent.mouseEnter(screen.getByText("Quotation sent").closest("li"));
    expect(screen.getByText("240k")).toBeInTheDocument();
    expect(screen.queryByText("499k")).toBeNull();
    fireEvent.mouseLeave(screen.getByText("Quotation sent").closest("li"));
    expect(screen.getByText("499k")).toBeInTheDocument();
  });

  it("leaves a count as a count, and steps the type down as the figure gets longer", () => {
    const counts = [{ key: "a", name: "Referral", value: 4, color: "var(--chart-2)" }, { key: "b", name: "Walk-in", value: 2, color: "var(--chart-3)" }];
    const small = render(<Ring rows={counts} total={6} label="enquiries" format={(n) => String(n)} />);
    expect(screen.getByText("6").className).toMatch(/text-2xl/);
    small.unmount();

    // A long figure is shrunk, never allowed to outgrow the hole.
    render(<Ring rows={counts} total={6} label="logged" format={(n) => `${n} enquiries`} centreText={() => "123456789"} />);
    expect(screen.getByText("123456789").className).toMatch(/text-base/);
    expect(screen.getByText("123456789").className).toMatch(/whitespace-nowrap/);
  });

  it("lays the legend out by the width of its own panel, not of the screen", () => {
    const { container } = render(<Ring rows={ROWS} total={499000} />);
    const host = container.firstChild;
    expect(host.className).toMatch(/@container/);
    const flow = host.firstChild;
    // @lg: is a container query. sm:flex-row was a screen query, which put the legend beside the ring in a column
    // too narrow for both.
    expect(flow.className).toMatch(/@lg:flex-row/);
    expect(flow.className).not.toMatch(/(^|\s)sm:flex-row/);
  });

  it("draws nothing at all when there is nothing to divide", () => {
    const { container } = render(<Ring rows={[{ key: "x", name: "None", value: 0, color: "red" }]} total={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
